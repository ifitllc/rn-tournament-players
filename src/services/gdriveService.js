// Google Drive service rewritten for Node.js (ESM).
// Uses a service account or ADC via googleapis to upload/download JPEGs.

import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream';
import { promisify } from 'node:util';
import { google } from 'googleapis';

const streamPipeline = promisify(pipeline);

const DRIVE_FOLDER_ID = '1_Db4qJMQ-TWenhkbu9tVINt1K7xtzrbO';
const MIME_TYPE = 'image/jpeg';
const VIEW_BASE = 'https://drive.google.com/uc?export=view&id=';

let driveClient = null;

async function ensureDriveClient() {
	if (driveClient) return driveClient;

	const auth = await google.auth.getClient({
		scopes: ['https://www.googleapis.com/auth/drive'],
	});

	driveClient = google.drive({ version: 'v3', auth });
	return driveClient;
}

export async function uploadFile(fileDir, fileName) {
	try {
		const localPath = resolvePath(fileDir, fileName);
		await assertFileExists(localPath);

		const drive = await ensureDriveClient();
		const existingId = await getFileId(drive, DRIVE_FOLDER_ID, fileName);

		const fileId = existingId
			? await updateFile(drive, existingId, localPath, fileName)
			: await createFile(drive, DRIVE_FOLDER_ID, localPath, fileName);

		console.info(`File ${fileId} uploaded`);
		return fileId;
	} catch (err) {
		console.error(`Failed to upload ${fileName}:`, err.message);
		return null;
	}
}

export async function uploadFileByName(fileName) {
	const localPath = resolveSearchPath(fileName);
	if (!localPath) {
		console.warn(`File ${fileName} not found in common locations`);
		return null;
	}
	const dir = path.dirname(localPath);
	return uploadFile(dir, path.basename(fileName));
}

export async function getPhoto(fileName) {
	const drive = await ensureDriveClient();
	const fileId = await getFileId(drive, DRIVE_FOLDER_ID, fileName);
	return fileId ? `${VIEW_BASE}${fileId}` : null;
}

export async function downloadTournamentPlayerPhotos(photoNames) {
	const drive = await ensureDriveClient();
	let downloaded = 0;
	let skipped = 0;
	let failed = 0;

	for (const photoName of photoNames) {
		const localPath = path.join(getWritableDir(), photoName);
		if (fs.existsSync(localPath)) {
			skipped += 1;
			continue;
		}

		try {
			const fileId = await getFileId(drive, DRIVE_FOLDER_ID, photoName);
			if (!fileId) {
				skipped += 1;
				continue;
			}

			const dest = fs.createWriteStream(localPath);
			const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
			await streamPipeline(res.data, dest);
			downloaded += 1;
		} catch (err) {
			failed += 1;
			console.error(`Failed to download ${photoName}:`, err.message);
		}
		await new Promise((r) => setTimeout(r, 100));
	}

	console.info(`Photo sync: ${downloaded} downloaded, ${skipped} skipped, ${failed} failed`);
	return { downloaded, skipped, failed };
}

export async function photoExists(photoName) {
	const localPath = path.join(getWritableDir(), photoName);
	try {
		await fs.promises.access(localPath, fs.constants.F_OK);
		return true;
	} catch (_) {
		return false;
	}
}

export async function getMissingPhotos(photoNames) {
	const missing = [];
	for (const name of photoNames) {
		if (!(await photoExists(name))) missing.push(name);
	}
	return missing;
}

async function getFileId(drive, folderId, fileName) {
	const res = await drive.files.list({
		q: `mimeType != 'application/vnd.google-apps.folder' and trashed = false and name = '${fileName}' and '${folderId}' in parents`,
		fields: 'files(id, name)',
		spaces: 'drive',
		pageSize: 1,
	});
	return res.data.files?.[0]?.id || null;
}

async function createFile(drive, folderId, localPath, fileName) {
	const fileMetadata = { name: fileName, parents: [folderId] };
	const media = { mimeType: MIME_TYPE, body: fs.createReadStream(localPath) };
	const res = await drive.files.create({ resource: fileMetadata, media, fields: 'id' });
	return res.data.id || null;
}

async function updateFile(drive, fileId, localPath, fileName) {
	const fileMetadata = { name: fileName };
	const media = { mimeType: MIME_TYPE, body: fs.createReadStream(localPath) };
	const res = await drive.files.update({ fileId, resource: fileMetadata, media, fields: 'id' });
	return res.data.id || null;
}

function resolvePath(fileDir, fileName) {
	if (path.isAbsolute(fileDir)) return path.join(fileDir, fileName);
	return path.join(process.cwd(), fileDir, fileName);
}

async function assertFileExists(fullPath) {
	try {
		await fs.promises.access(fullPath, fs.constants.R_OK);
	} catch (_) {
		throw new Error(`File not found: ${fullPath}`);
	}
}

function resolveSearchPath(fileName) {
	const candidates = [
		path.join(process.cwd(), fileName),
		path.join(getWritableDir(), fileName),
	];
	return candidates.find((p) => fs.existsSync(p)) || null;
}

function getWritableDir() {
	return process.env.TMPDIR || process.cwd();
}
