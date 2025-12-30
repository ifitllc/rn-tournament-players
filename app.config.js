export default {
  expo: {
    name: "Tournament Players",
    slug: "tournament-players",
    owner: "fanyang_us",
    version: "1.1.0",
    orientation: "portrait",
    scheme: ["rn-tournament-players", "com.fanyang.tournamentplayers"],
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#0f172a"
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.fanyang.tournamentplayers",
      buildNumber: "3",
      infoPlist: {
        NSCameraUsageDescription: "This app needs camera access to take player photos for the tournament roster.",
        NSPhotoLibraryUsageDescription: "This app needs photo library access to save and manage player photos."
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#0f172a"
      },
      package: "com.fanyang.tournamentplayers",
      versionCode: 3,
      permissions: [
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE"
      ]
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    entryPoint: "./App.js",
    extra: {
      eas: {
        projectId: "4f035597-cc6b-43c5-bb85-0de458045eec"
      },
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    },
    plugins: [
      [
        "expo-camera",
        {
          cameraPermission: "Allow Tournament Players to access your camera to take player photos."
        }
      ]
    ]
  }
};
