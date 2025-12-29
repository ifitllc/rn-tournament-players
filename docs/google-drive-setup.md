# Google Drive Setup for Photo Sync

This document explains how to set up Google Drive authentication for bi-directional photo synchronization.

## Overview

The app can now sync photos with Google Drive in both directions:
- **Upload**: Local photos are uploaded to your Google Drive folder
- **Download**: Photos from Google Drive that don't exist locally are downloaded

## Setup Steps

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Drive API** for your project

### 2. Configure OAuth Consent Screen

1. Navigate to **APIs & Services > OAuth consent screen**
2. Select **External** user type (or Internal if using Google Workspace)
3. Fill in the required information:
   - App name
   - User support email
   - Developer contact email
4. Add the following scope:
   - `https://www.googleapis.com/auth/drive`
5. Add test users if using External type

### 3. Create OAuth 2.0 Credentials

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth 2.0 Client ID**
3. Select **Web application** as application type
4. Add authorized redirect URIs:
   - `http://localhost:19006` (for Expo web)
   - `https://auth.expo.io/@your-username/your-app-slug` (for Expo Go)
5. Save and note down your **Client ID** and **Client Secret**

### 4. Implement OAuth Flow (Option A: Manual Token)

For testing, you can manually get an access token:

1. Use the [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
2. Configure it to use your own OAuth credentials
3. Select **Google Drive API v3** scope
4. Authorize and get the access token
5. In the app settings, you can temporarily store this token:

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

// Store the token
await AsyncStorage.setItem('@gdrive_access_token', 'YOUR_ACCESS_TOKEN');
```

**Note**: This token will expire after 1 hour. For production, implement proper OAuth flow.

### 5. Implement OAuth Flow (Option B: Full Implementation)

For production use, implement a proper OAuth flow using libraries like:
- `expo-auth-session` for Expo apps
- `react-native-app-auth` for bare React Native

Example with expo-auth-session:

```javascript
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};

const [request, response, promptAsync] = AuthSession.useAuthRequest(
  {
    clientId: 'YOUR_CLIENT_ID',
    scopes: ['https://www.googleapis.com/auth/drive'],
    redirectUri: AuthSession.makeRedirectUri({
      scheme: 'your-app-scheme'
    }),
  },
  discovery
);

// Call promptAsync() to start the OAuth flow
```

### 6. Set Up Drive Folder ID

The app is configured to use a specific Google Drive folder ID: `1_Db4qJMQ-TWenhkbu9tVINt1K7xtzrbO`

To use your own folder:
1. Create a folder in Google Drive
2. Get the folder ID from the URL (e.g., `https://drive.google.com/drive/folders/YOUR_FOLDER_ID`)
3. Update the `DRIVE_FOLDER_ID` constant in [gdriveService.native.js](../src/services/gdriveService.native.js)

## Using the Sync Feature

Once authentication is set up:

1. Open the app
2. Go to **Settings** (gear icon in top-right)
3. Scroll to **Google Drive Sync** section
4. Tap **Sync Now**

The app will:
- Upload any local photos not on Drive
- Download any Drive photos not stored locally
- Show a summary of uploaded/downloaded/skipped/failed files

## Troubleshooting

### "Google Drive not authenticated" Error
- Make sure you have stored a valid access token
- Check that the token hasn't expired
- Implement token refresh logic for production use

### Rate Limiting
- The app includes 100ms delays between operations
- If you hit rate limits, increase the delay in gdriveService.native.js

### Permission Errors
- Ensure the OAuth scope includes `https://www.googleapis.com/auth/drive`
- Check that your Google Cloud project has Drive API enabled
- Verify the folder ID is correct and accessible

## Security Notes

- Never commit access tokens or client secrets to version control
- Use environment variables for sensitive configuration
- Implement proper token refresh logic for production
- Consider using refresh tokens for long-term access
- Validate file types and sizes before upload/download

## Future Enhancements

- [ ] Automatic token refresh
- [ ] OAuth flow integrated in app
- [ ] Progress indicators for each file
- [ ] Conflict resolution (which file to keep if both changed)
- [ ] Selective sync (choose which photos to sync)
- [ ] Offline queue for sync operations
