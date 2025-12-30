import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';
import { listLocalPhotos, markUploaded, getPendingUploads } from '../storage/photoStore.js';
import { composeImageFileName } from '../helpers/utils.js';

const BUCKET = 'tournament-players';
const PHOTO_DIR = `${FileSystem.documentDirectory}photos/`;
const RATE_LIMIT_MS = 200;
const RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 400;
const RETRY_MAX_DELAY_MS = 4000;

let rateLimiter = Promise.resolve();
let lastRequestTime = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getConfig() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || Constants.expoConfig?.extra?.supabaseUrl;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || Constants.expoConfig?.extra?.supabaseAnonKey;

  if (__DEV__) {
    const prefix = anonKey ? anonKey.slice(0, 8) : 'missing';
    console.log('Supabase config (dev)', { url, bucket: BUCKET, anonPrefix: prefix });
  }

  if (!url || !anonKey) {
    throw new Error('Supabase credentials missing. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  }

  return { url, anonKey };
}

function buildHeaders(anonKey) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  };
}

function getMimeType(fileName) {
  if (fileName.endsWith('.png')) return 'image/png';
  return 'image/jpeg';
}

function joinPath(dir, name) {
  const base = dir.endsWith('/') ? dir.slice(0, -1) : dir;
  return `${base}/${name}`;
}

function basename(path) {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? path : path.slice(idx + 1);
}

async function runWithRateLimit(task) {
  const start = rateLimiter.catch(() => {});
  const work = start.then(async () => {
    const now = Date.now();
    const wait = lastRequestTime + RATE_LIMIT_MS - now;
    if (wait > 0) {
      await sleep(wait);
    }
    const result = await task();
    lastRequestTime = Date.now();
    return result;
  });
  rateLimiter = work.catch(() => {});
  return work;
}

function isRetryableStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}

async function withRetry(task, { label = 'operation', attempts = RETRY_ATTEMPTS, shouldRetry } = {}) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await task();
      const needsRetry = shouldRetry ? shouldRetry(result) : false;
      if (!needsRetry) {
        return result;
      }
      lastError = new Error(`Retryable response for ${label}`);
    } catch (err) {
      lastError = err;
    }

    if (attempt === attempts) {
      break;
    }

    const delay = Math.min(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1), RETRY_MAX_DELAY_MS);
    console.warn(`Retrying ${label} (attempt ${attempt + 1}/${attempts}) after ${delay}ms`, lastError?.message);
    await sleep(delay);
  }

  throw lastError;
}

async function isValidImageFile(filePath) {
  const info = await FileSystem.getInfoAsync(filePath);
  if (!info.exists) return false;
  const size = info.size || 0;
  if (size < 1024) return false; // too small, likely error/empty

  try {
    // Read as base64 to inspect magic bytes without assuming text encoding
    const base64 = await FileSystem.readAsStringAsync(filePath, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const head = base64.slice(0, 32);
    const looksPng = head.startsWith('iVBORw0KGgo'); // PNG signature
    const looksJpg = head.startsWith('/9j/'); // JPEG signature
    if (!looksPng && !looksJpg) {
      return false;
    }

    // For small files, also guard against HTML/error bodies
    if (size <= 512 * 1024) {
      const utf8 = await FileSystem.readAsStringAsync(filePath, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const textHead = utf8.slice(0, 4096).toLowerCase();
      if (textHead.includes('<html') || textHead.includes('<!doctype') || textHead.includes('access denied') || textHead.includes('signature does not match')) {
        return false;
      }
    }
  } catch (_) {
    // If inspection fails but size is reasonable, assume valid
    return size > 1024;
  }

  return true;
}

async function ensurePhotoDir() {
  const info = await FileSystem.getInfoAsync(PHOTO_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
  }
}

async function uploadFileFromPath(localPath, fileName) {
  const { url, anonKey } = getConfig();
  const uploadUrl = `${url}/storage/v1/object/${BUCKET}/${encodeURIComponent(fileName)}`;
  if (__DEV__) {
    console.log('Supabase upload request', {
      uploadUrl,
      fileName,
      anonPrefix: anonKey.slice(0, 8),
    });
  }
  const response = await withRetry(
    () =>
      runWithRateLimit(() =>
        FileSystem.uploadAsync(uploadUrl, localPath, {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: {
            ...buildHeaders(anonKey),
            'Content-Type': getMimeType(fileName),
            'x-upsert': 'true',
          },
        }),
      ),
    {
      label: `upload ${fileName}`,
      shouldRetry: (res) => isRetryableStatus(res.status),
    },
  );

  if (response.status >= 200 && response.status < 300) {
    return `${url}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(fileName)}`;
  }

  throw new Error(`Supabase upload failed (${response.status}): ${response.body}`);
}

async function listRemotePhotos() {
  const { url, anonKey } = getConfig();
  console.log('Supabase list request', {
    url,
    bucket: BUCKET,
    hasAnonKey: !!anonKey,
    anonKeyPrefix: anonKey ? anonKey.slice(0, 6) : 'none',
  });
  const response = await withRetry(
    () =>
      runWithRateLimit(() =>
        fetch(`${url}/storage/v1/object/list/${BUCKET}`, {
          method: 'POST',
          headers: {
            ...buildHeaders(anonKey),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prefix: '',
            limit: 1000,
            offset: 0,
            sortBy: { column: 'name', order: 'asc' },
          }),
        }),
      ),
    {
      label: 'list photos',
      shouldRetry: (res) => isRetryableStatus(res.status),
    },
  );

  if (!response.ok) {
    const message = await response.text();
    console.warn('Supabase list failed', response.status, message);
    throw new Error(`Supabase list failed (${response.status}): ${message}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) return [];

  const mapped = data.map((f) => ({
    ...f,
    name: f.name,
    normalized: basename(f.name).toLowerCase(),
  }));

  console.log('Supabase list: total objects', mapped.length);
  if (mapped.length > 0) {
    const sample = mapped.slice(0, 3).map((f) => f.name);
    console.log('Supabase list sample:', sample.join(', '));
  } else {
    console.log('Supabase list returned 0 objects');
  }

  return mapped;
}

async function downloadFile(fileName) {
  const { url, anonKey } = getConfig();
  await ensurePhotoDir();
  const targetPath = `${PHOTO_DIR}${fileName}`;
  const privateUrl = `${url}/storage/v1/object/${BUCKET}/${encodeURIComponent(fileName)}`; // private with auth
  const publicUrl = `${url}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(fileName)}`; // public bucket URL

  const tryDownload = async (dlUrl, label, withHeaders) => {
    console.log('Supabase download URL:', dlUrl, `(mode: ${label}, headers: ${withHeaders})`);
    const options = withHeaders ? { headers: buildHeaders(anonKey) } : undefined;
    const res = await withRetry(
      () => runWithRateLimit(() => FileSystem.downloadAsync(dlUrl, targetPath, options)),
      {
        label: `download ${fileName} (${label})`,
        shouldRetry: (r) => isRetryableStatus(r.status),
      },
    );
    return res;
  };

  // 1) Public path, no auth headers (best for truly public buckets)
  let result = await tryDownload(publicUrl, 'public-no-auth', false);
  if (result.status >= 200 && result.status < 300) {
    const valid = await isValidImageFile(targetPath);
    if (valid) return targetPath;
    await FileSystem.deleteAsync(targetPath, { idempotent: true });
    console.warn(`Downloaded file invalid/HTML for ${fileName} (public-no-auth), retrying`);
  }

  // 2) Public path with headers
  if (result.status === 400 || result.status === 401 || result.status === 403 || result.status === 404) {
    console.warn(`Public (no auth) failed (${result.status}) for ${fileName}, retrying with headers`);
    result = await tryDownload(publicUrl, 'public-with-auth', true);
    if (result.status >= 200 && result.status < 300) {
      const valid = await isValidImageFile(targetPath);
      if (valid) return targetPath;
      await FileSystem.deleteAsync(targetPath, { idempotent: true });
      console.warn(`Downloaded file invalid/HTML for ${fileName} (public-with-auth), retrying`);
    }
  }

  // 3) Private path with headers
  console.warn(`Public path still failed (${result.status}) for ${fileName}, trying private path`);
  result = await tryDownload(privateUrl, 'private-with-auth', true);
  if (result.status >= 200 && result.status < 300) {
    const valid = await isValidImageFile(targetPath);
    if (valid) return targetPath;
    await FileSystem.deleteAsync(targetPath, { idempotent: true });
    throw new Error(`Supabase download appears invalid (html/too small) for ${fileName}`);
  }

  throw new Error(`Supabase download failed (${result.status}) for ${fileName}`);
}

export async function uploadAllPhotos(onProgress) {
  const pending = await getPendingUploads();
  if (pending.length === 0) {
    return { uploaded: 0, failed: 0 };
  }

  let uploaded = 0;
  let failed = 0;

  for (let i = 0; i < pending.length; i += 1) {
    const path = pending[i];
    const fileName = path.split('/').pop();
    try {
      if (onProgress) onProgress(`Uploading ${i + 1}/${pending.length}`);
      await uploadFileFromPath(path, fileName);
      await markUploaded(path);
      uploaded += 1;
    } catch (err) {
      console.warn('Upload failed for', fileName, err.message);
      failed += 1;
    }
  }

  return { uploaded, failed };
}

export async function uploadSinglePhoto(dir, fileName) {
  const fullPath = joinPath(dir, fileName);
  await uploadFileFromPath(fullPath, fileName);
  return true;
}

export async function downloadMissingPhotos(onProgress, playerNames = null) {
  const remoteFiles = await listRemotePhotos();
  const localPhotos = await listLocalPhotos();
  const localNames = new Set(localPhotos.map((p) => basename(p).toLowerCase()));

  let candidates = remoteFiles;
  if (playerNames && playerNames.length > 0) {
    const expectedPng = playerNames.map((name) => composeImageFileName(name));
    const expectedJpg = expectedPng.map((n) => n.replace('.png', '.jpg'));
    const expectedJpeg = expectedPng.map((n) => n.replace('.png', '.jpeg'));
    const expected = new Set([...expectedPng, ...expectedJpg, ...expectedJpeg].map((n) => n.toLowerCase()));
    candidates = remoteFiles.filter((f) => expected.has(f.normalized));

    // If filtering by players finds nothing, fall back to all files to avoid missing photos due to naming drift.
    if (candidates.length === 0) {
      candidates = remoteFiles;
    }

    console.log('Supabase download filter:', {
      players: playerNames.length,
      expectedCount: expected.size,
      remote: remoteFiles.length,
      candidates: candidates.length,
    });

    // Fallback: if we still have zero candidates and there are expected filenames, try direct-download attempts without listing
    if (candidates.length === 0 && remoteFiles.length === 0) {
      console.log('Supabase fallback: attempting direct downloads for expected filenames');
      const expectedList = [...expected];
      let downloaded = 0;
      let failed = 0;
      for (let i = 0; i < expectedList.length; i += 1) {
        const fname = expectedList[i];
        if (localNames.has(fname)) continue;
        try {
          if (onProgress) onProgress(`Downloading ${i + 1}/${expectedList.length}`);
          await downloadFile(fname);
          downloaded += 1;
        } catch (err) {
          failed += 1;
          console.warn('Fallback download failed for', fname, err.message);
        }
      }
      return { downloaded, skipped: 0, failed };
    }
  }

  const toDownload = candidates.filter((f) => !localNames.has(f.normalized));
  let downloaded = 0;
  let skipped = candidates.length - toDownload.length;
  let failed = 0;

  for (let i = 0; i < toDownload.length; i += 1) {
    const file = toDownload[i];
    try {
      if (onProgress) onProgress(`Downloading ${i + 1}/${toDownload.length}`);
      await downloadFile(file.name);
      downloaded += 1;
    } catch (err) {
      console.warn('Download failed for', file.name, err.message);
      failed += 1;
    }
  }

  return { downloaded, skipped, failed };
}

export function hasSupabaseConfig() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || Constants.expoConfig?.extra?.supabaseUrl;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || Constants.expoConfig?.extra?.supabaseAnonKey;
  return Boolean(url && anonKey);
}
