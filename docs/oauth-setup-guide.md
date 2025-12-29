# Setting Up Google OAuth for the App

## Quick Setup Guide

### 1. Get Your Google Client ID

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Go to **APIs & Services > Credentials**
4. Click **Create Credentials > OAuth 2.0 Client ID**
5. Select application type:
   - For **iOS**: Select "iOS"
   - For **Android**: Select "Android"
   - For **Web/Expo Go**: Select "Web application"

### 2. Configure OAuth Client

#### For iOS:
- **Bundle ID**: `com.yourcompany.rn-tournament-players` (or your actual bundle ID)

#### For Android:
- **Package name**: `com.yourcompany.rntournamentplayers`
- **SHA-1 fingerprint**: Get from `expo credentials:manager` or your keystore

#### For Web/Expo Go (Development):
- **Authorized JavaScript origins**: 
  - `http://localhost:19006`
- **Authorized redirect URIs**:
  - `http://localhost:19006`
  - `https://auth.expo.io/@your-username/rn-tournament-players`

### 3. Update the Code

Open `src/components/GoogleDriveAuth.js` and replace:

```javascript
const GOOGLE_CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';
```

with your actual Client ID from Google Cloud Console.

### 4. Configure Redirect URI

The app uses the scheme: `rn-tournament-players://`

**For development with Expo Go:**
```javascript
redirectUri: AuthSession.makeRedirectUri({
  scheme: 'exp',
  path: 'redirect'
}),
```

**For standalone builds:**
```javascript
redirectUri: AuthSession.makeRedirectUri({
  scheme: 'rn-tournament-players',
}),
```

### 5. Add the Redirect URI to Google Cloud Console

Add this to your OAuth client's **Authorized redirect URIs**:

For Expo Go:
- `exp://localhost:19000/--/redirect`

For standalone:
- `rn-tournament-players://`

### 6. Test the OAuth Flow

1. Open the app
2. Go to Settings > Google Drive Authentication
3. Tap "Sign in with Google"
4. Complete the OAuth flow in the browser
5. You should be redirected back to the app with a token

## Using Manual Token (Quick Testing)

If you want to test without setting up OAuth:

1. Go to [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
2. Click the gear icon (⚙️) and check "Use your own OAuth credentials"
3. Enter your Client ID and Client Secret
4. Select **Google Drive API v3** scope: `https://www.googleapis.com/auth/drive`
5. Click "Authorize APIs"
6. Exchange authorization code for tokens
7. Copy the **Access token**
8. In the app, go to Settings > Google Drive Authentication
9. Paste the token in the "Manual Token" section
10. Tap "Save Token"

**Note:** Manual tokens expire after 1 hour and don't auto-refresh.

## Troubleshooting

### "redirect_uri_mismatch" Error
- Ensure the redirect URI in your code matches exactly what's in Google Cloud Console
- Check for trailing slashes
- Verify the scheme in app.json matches the redirectUri

### "invalid_client" Error
- Double-check your Client ID
- Make sure you're using the correct OAuth client (iOS/Android/Web)

### Token Expired
- If you see "⚠️ Token Expired", tap "Refresh Token" (if available)
- Otherwise, sign in again

### No Refresh Token
- Make sure to include `access_type: 'offline'` in the request params
- Google only returns refresh tokens on first authorization
- To get a new refresh token, revoke access in your Google Account settings first

## Production Setup

For production builds:

1. Use separate OAuth clients for iOS and Android
2. Never commit Client Secret to version control
3. Use environment variables:
   ```javascript
   const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
   ```
4. Set up proper error handling and token refresh logic
5. Consider using a backend to manage tokens securely

## Token Storage

Tokens are stored securely using AsyncStorage:
- `@gdrive_access_token` - The access token
- `@gdrive_token_expiry` - Expiry timestamp
- `@gdrive_refresh_token` - Refresh token (if available)

## Next Steps

Once authenticated:
1. Go to "Sync Photos" section in Settings
2. Tap "Sync Now" to upload/download photos
3. Tokens will auto-refresh if a refresh token is available
