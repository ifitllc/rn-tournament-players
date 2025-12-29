# Tournament Players - React Native App

A React Native application for managing tournament players with photo capture, Google Drive sync, and tournament management.

## Features

- 📸 **Photo Capture** - Take player photos with manual crop functionality
- ☁️ **Google Drive Sync** - Bi-directional photo synchronization
- 🏆 **Tournament Management** - Select and download player lists from Omnipong
- 👥 **Manual Player Addition** - Add players not registered in the tournament system
- 🔍 **Search** - Quick player search functionality
- 🔐 **OAuth Authentication** - Secure Google Drive access

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your Google Client ID
nano .env
```

Add your credentials:
```
EXPO_PUBLIC_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID.apps.googleusercontent.com
```

See [Environment Setup Guide](docs/environment-setup.md) for detailed instructions.

### 3. Get Google OAuth Credentials

Follow the [OAuth Setup Guide](docs/oauth-setup-guide.md) to:
1. Create a Google Cloud project
2. Enable Google Drive API
3. Create OAuth 2.0 credentials
4. Configure redirect URIs

### 4. Start the Development Server

```bash
npm start
```

Then:
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Scan QR code with Expo Go app

## Project Structure

```
├── src/
│   ├── components/
│   │   └── GoogleDriveAuth.js      # OAuth authentication component
│   ├── helpers/
│   │   ├── imageUtils.js           # Image manipulation utilities
│   │   └── utils.js                # General utilities
│   ├── hooks/
│   │   └── useBackgroundSync.js    # Background sync hook
│   ├── screens/
│   │   ├── PlayersScreen.js        # Main player list screen
│   │   └── SettingsScreen.js       # Settings and configuration
│   ├── services/
│   │   ├── omnipongService.js      # Tournament data fetching
│   │   └── gdriveService.native.js # Google Drive API
│   └── storage/
│       └── photoStore.js           # Local photo storage
├── docs/
│   ├── environment-setup.md        # Environment variable guide
│   ├── oauth-setup-guide.md        # Google OAuth setup
│   └── google-drive-setup.md       # Drive integration details
├── scripts/
│   └── setup-eas-env.sh           # EAS environment setup script
├── .env.example                    # Example environment file
└── eas.json                        # EAS build configuration
```

## Usage

### Select Tournament

1. Tap the ⚙️ (gear) icon
2. Go to "Select Tournament"
3. Choose your tournament from the list
4. Tap "Download Players" to fetch the roster

### Take Player Photos

1. Tap on a player name
2. Tap "Take Photo"
3. Capture the photo
4. Drag the crop box to adjust
5. Tap "Use Photo"

### Sync with Google Drive

1. Go to Settings
2. Authenticate with Google Drive
3. Tap "Sync Now" to upload/download photos

### Add Manual Players

1. Go to Settings > Manual Players
2. Enter player name
3. Tap "Add"

## Building for Production

### Configure EAS

```bash
# Run the setup script to configure environment variables
npm run setup-eas

# Or manually
./scripts/setup-eas-env.sh
```

### Build

```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Build for iOS
eas build --platform ios --profile production

# Build for Android
eas build --platform android --profile production
```

See [EAS Build Documentation](https://docs.expo.dev/build/introduction/) for more details.

## Development

### Run on Device

```bash
# iOS
npm run ios

# Android
npm run android
```

### Clear Cache

```bash
expo start -c
```

### View Logs

```bash
# iOS
npx react-native log-ios

# Android
npx react-native log-android
```

## Configuration

### Environment Variables

See [Environment Setup Guide](docs/environment-setup.md)

### Google OAuth

See [OAuth Setup Guide](docs/oauth-setup-guide.md)

### Google Drive

See [Google Drive Setup Guide](docs/google-drive-setup.md)

## Troubleshooting

### Camera Not Working
- Ensure camera permissions are granted
- Check that expo-camera is installed
- Restart the app

### Google Drive Auth Failed
- Verify Client ID in `.env`
- Check redirect URI configuration
- See [OAuth Setup Guide](docs/oauth-setup-guide.md)

### Photos Not Syncing
- Authenticate with Google Drive first
- Check internet connection
- Verify folder ID is correct

### Players Not Loading
- Select a tournament in Settings
- Tap "Download Players"
- Check internet connection

## Technologies

- **Expo SDK 54** - React Native framework
- **React Native 0.81** - Mobile framework
- **expo-camera** - Camera access
- **expo-image-manipulator** - Image cropping
- **expo-auth-session** - OAuth 2.0 flow
- **expo-file-system** - File storage
- **AsyncStorage** - Local data persistence

## License

ISC

## Support

For issues and questions, please check the documentation in the `docs/` folder:
- [Environment Setup](docs/environment-setup.md)
- [OAuth Setup](docs/oauth-setup-guide.md)
- [Google Drive Setup](docs/google-drive-setup.md)
