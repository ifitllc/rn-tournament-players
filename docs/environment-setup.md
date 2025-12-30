# Environment Variables Setup

This project uses environment variables to configure Supabase storage for player photos.

## Local Development Setup

### 1. Create Environment File

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

### 2. Configure Variables

Edit `.env` with your Supabase project details:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_SUPABASE_BUCKET=tournament-players
```

### 3. Start Development Server

```bash
npm start
```

Expo automatically loads variables prefixed with `EXPO_PUBLIC_` from your `.env` file.

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
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://your-project.supabase.co" --type string
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your-anon-key" --type string
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_BUCKET --value "tournament-players" --type string
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
| EXPO_PUBLIC_SUPABASE_URL | Yes | Supabase project URL | None |
| EXPO_PUBLIC_SUPABASE_ANON_KEY | Yes | Supabase anonymous key | None |
| EXPO_PUBLIC_SUPABASE_BUCKET | Yes | Supabase storage bucket for photos | tournament-players |

## How It Works

### Local Development
1. Variables are loaded from `.env` file
2. Expo includes `EXPO_PUBLIC_*` variables in the app bundle
3. Access via `process.env.EXPO_PUBLIC_VARIABLE_NAME`
4. Also available via `Constants.expoConfig.extra`

### EAS Builds
1. Variables are stored as EAS secrets
2. Secrets are injected during build time
3. Different values can be set per build profile (development/preview/production)

## Security Best Practices

✅ **DO:**
- Use `.env` for local development
- Keep `.env` out of version control (already ignored)
- Use EAS secrets for production builds
- Rotate Supabase keys periodically

❌ **DON'T:**
- Commit `.env` to git
- Share your Supabase anon key publicly
- Hard-code credentials in source code

## Troubleshooting

### "Supabase URL not configured" Error
- Check that `.env` exists
- Verify `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are set
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
# Update existing secrets (use --force to overwrite)
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "NEW_URL" --type string --force

eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "NEW_ANON_KEY" --type string --force

eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_BUCKET --value "NEW_BUCKET" --type string --force
```

## Additional Resources

- [Expo Environment Variables Guide](https://docs.expo.dev/guides/environment-variables/)
- [EAS Secrets Documentation](https://docs.expo.dev/build-reference/variables/)
