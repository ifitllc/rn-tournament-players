# Tournament Players - React Native App

A React Native application for managing tournament players with photo capture and Supabase-backed storage.

## Features

- 📸 **Photo Capture** - Take player photos with manual crop
- ☁️ **Supabase Sync** - Upload/download photos from a Supabase bucket with validation
- 🏆 **Tournament Management** - Select and download player lists from Omnipong
- 👥 **Manual Player Addition** - Add players not registered in the tournament system
- �� **Search** - Quickly search players
- 🗂️ **Local Photo Browser** - Review, delete all, or delete empty photo files

## Quick Start

1. Install dependencies
   ```bash
   npm install
   ```
2. Configure environment variables
   ```bash
   cp .env.example .env
   # Edit .env with your Supabase credentials
   ```
   See [Environment Setup Guide](docs/environment-setup.md) for details.
3. Start the development server
   ```bash
   npm start
   ```
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Or scan the QR code with Expo Go

## Project Structure

```
├── src/
│   ├── components/
│   │   └── GoogleDriveAuth.js      # Deprecated stub to avoid stale imports
│   ├── helpers/
│   │   ├── imageUtils.js           # Image manipulation utilities
│   │   └── utils.js                # General utilities
│   ├── hooks/
│   │   └── useBackgroundSync.js    # Background sync hook
│   ├── screens/
│   │   ├── PlayersScreen.js        # Main player list screen
│   │   ├── SettingsScreen.js       # Settings and configuration
│   │   └── PhotoBrowserScreen.js   # Local photo browser and cleanup
│   ├── services/
│   │   ├── omnipongService.js      # Tournament data fetching
│   │   ├── supabaseService.js      # Supabase storage integration
│   │   └── gdriveService.native.js # Deprecated stub (Google Drive removed)
│   └── storage/
│       └── photoStore.js           # Local photo storage
├── docs/
│   ├── environment-setup.md        # Supabase environment variable guide
│   ├── oauth-setup-guide.md        # Deprecated (Google OAuth removed)
│   └── google-drive-setup.md       # Deprecated (Google Drive removed)
├── scripts/
│   └── setup-eas-env.sh            # EAS environment setup script
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
3. Capture the photo and adjust the crop
4. Save to store locally and sync later

### Sync with Supabase
1. Configure Supabase credentials in `.env`
2. Use sync controls in Settings (or background sync) to upload/download
3. The app validates downloads (>1KB and non-HTML) to avoid bad files

### Manage Local Photos
- Open Settings → "View Local Photos" to browse cached files
- Use "Delete All" to clear everything or "Delete Empty" to remove tiny/invalid files

## Building for Production

Configure EAS secrets (Supabase URL, anon key, bucket) then build:
```bash
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

```bash
# iOS
npm run ios
# Android
npm run android
# Clear cache
expo start -c
```

## Configuration

- Environment variables: [docs/environment-setup.md](docs/environment-setup.md)
- Supabase bucket: `EXPO_PUBLIC_SUPABASE_BUCKET` (defaults to `tournament-players`)

## Troubleshooting

- **Camera not working**: ensure camera permissions are granted and `expo-camera` is installed
- **Supabase download fails**: confirm URL/anon key/bucket in `.env` and network connectivity
- **Players not loading**: select a tournament in Settings and tap "Download Players"

## Technologies

- **Expo SDK 54** / **React Native 0.81**
- **Supabase JS** for storage access
- **expo-camera**, **expo-image-manipulator**, **expo-file-system** for capture and storage
- **AsyncStorage** for local data persistence

## License

ISC

## Support

For issues and questions, see the docs in the `docs/` folder:
- [Environment Setup](docs/environment-setup.md)
- [Google Drive Setup](docs/google-drive-setup.md) (deprecated)
- [OAuth Setup](docs/oauth-setup-guide.md) (deprecated)
