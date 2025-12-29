# Environment Variables Setup

This project uses environment variables to securely manage sensitive configuration like Google OAuth credentials.

## Local Development Setup

### 1. Create Environment File

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

### 2. Configure Variables

Edit `.env` and add your Google Client ID:

```bash
# Google OAuth Configuration
EXPO_PUBLIC_GOOGLE_CLIENT_ID=YOUR_ACTUAL_CLIENT_ID.apps.googleusercontent.com

# Google Drive Configuration (optional - has default)
EXPO_PUBLIC_GOOGLE_DRIVE_FOLDER_ID=1_Db4qJMQ-TWenhkbu9tVINt1K7xtzrbO
```

### 3. Start Development Server

```bash
npm start
```

Expo will automatically load variables prefixed with `EXPO_PUBLIC_` from your `.env` file.

## EAS Build Setup

For building with Expo Application Services (EAS):

### Option 1: Use Setup Script (Recommended)

Run the automated setup script:

```bash
./scripts/setup-eas-env.sh
```

This will:
- Read your `.env` file
- Upload secrets to EAS
- Configure them for all build profiles

### Option 2: Manual Setup

Set secrets manually:

```bash
# Install EAS CLI if not already installed
npm install -g eas-cli

# Login to your Expo account
eas login

# Set the secrets
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_CLIENT_ID --value "YOUR_CLIENT_ID.apps.googleusercontent.com" --type string

eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_DRIVE_FOLDER_ID --value "YOUR_FOLDER_ID" --type string
```

### Verify Secrets

List all configured secrets:

```bash
eas secret:list
```

### Build with EAS

```bash
# Development build
eas build --profile development --platform ios
eas build --profile development --platform android

# Preview build
eas build --profile preview --platform ios
eas build --profile preview --platform android

# Production build
eas build --profile production --platform ios
eas build --profile production --platform android
```

## Environment Variables Reference

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | Yes | Google OAuth 2.0 Client ID | None |
| `EXPO_PUBLIC_GOOGLE_DRIVE_FOLDER_ID` | No | Google Drive folder ID for photos | `1_Db4qJMQ-TWenhkbu9tVINt1K7xtzrbO` |

## How It Works

### Local Development
1. Variables are loaded from `.env` file
2. Expo automatically includes `EXPO_PUBLIC_*` variables in the app
3. Access via `process.env.EXPO_PUBLIC_VARIABLE_NAME`
4. Also available via `Constants.expoConfig.extra` for runtime access

### EAS Builds
1. Variables are stored as EAS secrets
2. Secrets are injected during build time
3. Different values can be set per build profile (development/preview/production)

## Security Best Practices

✅ **DO:**
- Use `.env` for local development
- Add `.env` to `.gitignore` (already done)
- Use EAS secrets for production builds
- Rotate credentials regularly
- Use different Client IDs for development and production

❌ **DON'T:**
- Commit `.env` file to git
- Share your `.env` file
- Hard-code credentials in source code
- Use production credentials in development

## Troubleshooting

### "Client ID not configured" Error
- Check that `.env` file exists
- Verify `EXPO_PUBLIC_GOOGLE_CLIENT_ID` is set
- Restart the development server (`npm start`)

### EAS Build Fails with Missing Variables
- Run `eas secret:list` to verify secrets are set
- Check that secret names match exactly (case-sensitive)
- Ensure secrets are set for the correct build profile

### Variables Not Loading in App
- Variable names must start with `EXPO_PUBLIC_`
- Restart development server after changing `.env`
- Clear cache: `expo start -c`

## Updating Variables

### Local Development
1. Edit `.env` file
2. Restart development server

### EAS Builds
```bash
# Update existing secret (use --force to overwrite)
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_CLIENT_ID --value "NEW_VALUE" --type string --force

# Or delete and recreate
eas secret:delete --scope project --name EXPO_PUBLIC_GOOGLE_CLIENT_ID
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_CLIENT_ID --value "NEW_VALUE" --type string
```

## Additional Resources

- [Expo Environment Variables Guide](https://docs.expo.dev/guides/environment-variables/)
- [EAS Secrets Documentation](https://docs.expo.dev/build-reference/variables/)
- [Google OAuth Setup Guide](./oauth-setup-guide.md)
