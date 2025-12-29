// React Native compatible Google Drive service
// Uses expo-file-system and Google Drive REST API

import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { listLocalPhotos, markUploaded } from '../storage/photoStore.js';

const DRIVE_FOLDER_ID = Constants.expoConfig?.extra?.driveFolderId || process.env.EXPO_PUBLIC_GOOGLE_DRIVE_FOLDER_ID || '1_Db4qJMQ-TWenhkbu9tVINt1K7xtzrbO';
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3';
const ACCESS_TOKEN_KEY = '@gdrive_access_token';

// Note: In production, you'd need proper OAuth2 flow
// This is a simplified version assuming token is stored
async function getAccessToken() {
  const token = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
  if (!token) {
    throw new Error('Google Drive not authenticated. Please set up OAuth first.');
  }
  return token;
}

export async function setAccessToken(token) {
  await AsyncStorage.setItem(ACCESS_TOKEN_KEY, token);
}

/**
 * Upload all local photos to Google Drive
 * Optimized to batch check Drive files and compare timestamps
 */
export async function uploadToDrive(onProgress) {
  try {
    const token = await getAccessToken();
    const localPhotos = await listLocalPhotos();
    
    console.log(`📤 Found ${localPhotos.length} local photos to check`);
    
    if (localPhotos.length === 0) {
      if (onProgress) onProgress('No local photos to upload');
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause
      return { uploaded: 0, skipped: 0, failed: 0 };
    }
    
    // Get all Drive files in one API call instead of checking each file individually
    if (onProgress) onProgress('Loading Drive files...');
    const driveFiles = await listFilesInFolder(token, DRIVE_FOLDER_ID);
    const driveFileMap = new Map(driveFiles.map(f => [f.name, f]));
    console.log(`📂 Found ${driveFiles.length} files on Drive`);
    
    // Get local file info with timestamps
    const localFileInfos = await Promise.all(
      localPhotos.map(async (path) => {
        const fileName = path.split('/').pop();
        const info = await FileSystem.getInfoAsync(path);
        return { path, fileName, modifiedTime: info.modificationTime };
      })
    );
    
    let uploaded = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < localFileInfos.length; i++) {
      const { path, fileName, modifiedTime } = localFileInfos[i];
      try {
        const driveFile = driveFileMap.get(fileName);
        
        if (driveFile) {
          // File exists on Drive - compare timestamps
          const driveModifiedTime = new Date(driveFile.modifiedTime).getTime();
          const localModifiedTime = modifiedTime * 1000; // Convert to milliseconds
          
          // Skip if local file is not newer (allowing 1 second tolerance for rounding)
          if (localModifiedTime <= driveModifiedTime + 1000) {
            skipped++;
            await markUploaded(path); // Mark as uploaded even if skipped (already in sync)
            console.log(`⏭️  Skipped ${fileName} (up to date on Drive)`);
            continue;
          }
          
          // Local file is newer - update on Drive
          if (onProgress) {
            onProgress(`Updating ${uploaded + 1}/${localFileInfos.length - skipped}`);
          }
          await updateFileOnDrive(token, driveFile.id, path, fileName);
          await markUploaded(path); // Mark as uploaded after successful update
          uploaded++;
          console.log(`🔄 Updated ${fileName}`);
        } else {
          // New file - upload to Drive
          if (onProgress) {
            onProgress(`Uploading ${uploaded + 1}/${localFileInfos.length - skipped}`);
          }
          await uploadFileToDrive(token, path, fileName);
          await markUploaded(path); // Mark as uploaded after successful upload
          uploaded++;
          console.log(`✅ Uploaded ${fileName}`);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (err) {
        console.error(`Failed to upload ${fileName}:`, err.message);
        failed++;
      }
    }

    console.log(`✅ Upload complete: ${uploaded} uploaded, ${skipped} skipped, ${failed} failed`);
    return { uploaded, skipped, failed };
  } catch (err) {
    console.error('Upload to Drive failed:', err.message);
    throw err;
  }
}

/**
 * Download photos from Google Drive that don't exist locally
 * @param {Function} onProgress - Progress callback
 * @param {Array<string>} playerNames - Optional list of player names to download for (tournament players)
 */
export async function downloadFromDrive(onProgress, playerNames = null) {
  try {
    const token = await getAccessToken();
    const localPhotos = await listLocalPhotos();
    const localFileNames = new Set(localPhotos.map(p => p.split('/').pop()));
    
    // List all files in Drive folder
    let driveFiles = await listFilesInFolder(token, DRIVE_FOLDER_ID);
    
    // Filter by player names if provided
    if (playerNames && playerNames.length > 0) {
      const { composeImageFileName } = require('../helpers/utils.js');
      const expectedFileNames = new Set(
        playerNames.map(name => composeImageFileName(name))
      );
      driveFiles = driveFiles.filter(f => expectedFileNames.has(f.name));
      console.log(`📥 Filtered to ${driveFiles.length} files for current tournament players`);
    }
    
    const filesToDownload = driveFiles.filter(f => !localFileNames.has(f.name));
    
    console.log(`📥 Found ${driveFiles.length} files on Drive, ${filesToDownload.length} new to download`);
    
    if (filesToDownload.length === 0) {
      if (onProgress) onProgress('All photos already synced');
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause
      return { downloaded: 0, skipped: driveFiles.length, failed: 0 };
    }
    
    let downloaded = 0;
    let skipped = driveFiles.length - filesToDownload.length;
    let failed = 0;

    for (let i = 0; i < filesToDownload.length; i++) {
      const file = filesToDownload[i];
      try {
        if (onProgress) {
          onProgress(`Downloading ${i + 1}/${filesToDownload.length}`);
        }
        
        await downloadFileFromDrive(token, file.id, file.name, file.modifiedTime);
        downloaded++;
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (err) {
        console.error(`Failed to download ${file.name}:`, err.message);
        failed++;
      }
    }

    console.log(`✅ Download complete: ${downloaded} downloaded, ${skipped} skipped, ${failed} failed`);
    return { downloaded, skipped, failed };
  } catch (err) {
    console.error('Download from Drive failed:', err.message);
    throw err;
  }
}

/**
 * Update existing file on Drive
 */
async function updateFileOnDrive(token, fileId, localPath, fileName) {
  try {
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    const fileUri = await FileSystem.readAsStringAsync(localPath, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const mimeType = fileName.endsWith('.png') ? 'image/png' : 'image/jpeg';
    
    // Use multipart upload to update file content
    const metadata = {
      name: fileName,
      mimeType: mimeType,
    };

    const boundary = 'foo_bar_baz';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelim = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${mimeType}\r\n` +
      'Content-Transfer-Encoding: base64\r\n\r\n' +
      fileUri +
      closeDelim;

    const response = await fetch(
      `${DRIVE_UPLOAD_BASE}/files/${fileId}?uploadType=multipart`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update file: ${response.status} - ${errorText}`);
    }

    return await response.json();
  } catch (err) {
    console.error('Failed to update file on Drive:', err.message);
    throw err;
  }
}

/**
 * List all files in the Drive folder
 */
async function listFilesInFolder(token, folderId) {
  try {
    console.log('📁 Listing files in folder:', folderId);
    console.log('🔑 Using token (first 20 chars):', token.substring(0, 20) + '...');
    
    const query = `'${folderId}' in parents and trashed=false`;
    const url = `${DRIVE_API_BASE}/files?q=${encodeURIComponent(query)}&fields=files(id,name,modifiedTime)&pageSize=100`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log('📡 Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      throw new Error(`Failed to list files: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Found files:', data.files?.length || 0);
    return data.files || [];
  } catch (err) {
    console.error('❌ Failed to list files:', err.message);
    throw err;
  }
}

/**
 * Upload a new file to Google Drive
 */
async function uploadFileToDrive(token, localPath, fileName) {
  try {
    // Read file as base64
    const fileContent = await FileSystem.readAsStringAsync(localPath, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Create metadata
    const metadata = {
      name: fileName,
      parents: [DRIVE_FOLDER_ID],
      mimeType: 'image/jpeg',
    };

    // Create multipart upload
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: image/jpeg\r\n' +
      'Content-Transfer-Encoding: base64\r\n\r\n' +
      fileContent +
      closeDelimiter;

    const response = await fetch(`${DRIVE_UPLOAD_BASE}/files?uploadType=multipart`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    return result.id;
  } catch (err) {
    console.error('Failed to upload file:', err.message);
    throw err;
  }
}

/**
 * Download a file from Google Drive
 */
async function downloadFileFromDrive(token, fileId, fileName, modifiedTime) {
  try {
    const PHOTO_DIR = `${FileSystem.documentDirectory}photos/`;
    
    // Ensure directory exists
    const dirInfo = await FileSystem.getInfoAsync(PHOTO_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
    }

    const localPath = `${PHOTO_DIR}${fileName}`;
    const downloadUrl = `${DRIVE_API_BASE}/files/${fileId}?alt=media`;

    const downloadResult = await FileSystem.downloadAsync(
      downloadUrl,
      localPath,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (downloadResult.status !== 200) {
      throw new Error(`Download failed with status: ${downloadResult.status}`);
    }

    // Log modification time for tracking
    if (modifiedTime) {
      console.log(`Downloaded ${fileName} (original modified: ${modifiedTime})`);
    }

    return localPath;
  } catch (err) {
    console.error('Failed to download file:', err.message);
    throw err;
  }
}
