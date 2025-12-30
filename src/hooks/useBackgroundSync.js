import { useEffect, useRef } from 'react';
import { getPendingUploads, markUploaded } from '../storage/photoStore.js';

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

export default function useBackgroundSync(uploader, intervalMs = DEFAULT_INTERVAL_MS) {
  const timerRef = useRef(null);

  useEffect(() => {
    startSync();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function startSync() {
    await syncOnce();
    timerRef.current = setInterval(syncOnce, intervalMs);
  }

  async function syncOnce() {
    if (!uploader) return;

    const pending = await getPendingUploads();
    for (const filePath of pending) {
      try {
        const { dir, name } = splitPath(filePath);
        const uploadedId = await uploader(dir, name);
        if (uploadedId) {
          await markUploaded(filePath);
        }
      } catch (err) {
        console.warn('Background sync failed for', filePath, err.message);
      }
    }
  }

  return { syncOnce };
}

function splitPath(fullPath) {
  const lastSlash = fullPath.lastIndexOf('/');
  if (lastSlash === -1) return { dir: '', name: fullPath };
  const dir = fullPath.slice(0, lastSlash);
  const name = fullPath.slice(lastSlash + 1);
  return { dir, name };
}
