import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { composeImageFileName } from '../helpers/utils.js';

const PHOTO_DIR = `${FileSystem.documentDirectory}photos/`;
const PENDING_UPLOADS_KEY = '@pending_uploads_v1';

async function ensureDir() {
  const dirInfo = await FileSystem.getInfoAsync(PHOTO_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
  }
}

export async function savePhoto(playerName, sourceUri) {
  await ensureDir();
  const baseFile = composeImageFileName(playerName).replace('.png', '.jpg');
  const dest = `${PHOTO_DIR}${baseFile}`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  await addPendingUpload(dest);
  return dest;
}

export async function photoExists(playerName) {
  const baseFile = composeImageFileName(playerName).replace('.png', '.jpg');
  const targetJpg = `${PHOTO_DIR}${baseFile}`;
  const targetPng = `${PHOTO_DIR}${composeImageFileName(playerName)}`;
  
  // Check .jpg first (captured photos), then .png (downloaded from Drive)
  let info = await FileSystem.getInfoAsync(targetJpg);
  if (info.exists) return targetJpg;
  
  info = await FileSystem.getInfoAsync(targetPng);
  if (info.exists) return targetPng;
  
  return null;
}

export async function listLocalPhotos() {
  await ensureDir();
  const files = await FileSystem.readDirectoryAsync(PHOTO_DIR);
  return files.map((f) => `${PHOTO_DIR}${f}`);
}

async function addPendingUpload(filePath) {
  const pending = await getPendingUploads();
  if (!pending.includes(filePath)) {
    pending.push(filePath);
    await AsyncStorage.setItem(PENDING_UPLOADS_KEY, JSON.stringify(pending));
  }
}

export async function getPendingUploads() {
  const stored = await AsyncStorage.getItem(PENDING_UPLOADS_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (_) {
    return [];
  }
}

export async function markUploaded(filePath) {
  const pending = await getPendingUploads();
  const next = pending.filter((p) => p !== filePath);
  await AsyncStorage.setItem(PENDING_UPLOADS_KEY, JSON.stringify(next));
}
