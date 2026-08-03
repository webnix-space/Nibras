const createJiti = require('jiti');
const jiti = createJiti(__filename);
const qvacModule = jiti('@qvac/sdk/expo-plugin');
const withQvacSDK = qvacModule.withQvacSDK || qvacModule.default;

/** @type {import('expo/config').ExpoConfig} */
const expoConfig = {
  name: 'Nibras',
  slug: 'nibras',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0B0F14',
  },
  assetBundlePatterns: ['assets/**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.webnixhub.nibras',
    infoPlist: {
      NSDocumentsFolderUsageDescription:
        'Nibras reads project files you select to scan for security issues.',
    },
  },
  android: {
    package: 'com.webnixhub.nibras',
    minSdkVersion: 29,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0B0F14',
    },
    permissions: ['READ_EXTERNAL_STORAGE'],
  },
  plugins: [
    'expo-document-picker',
    [
      'expo-build-properties',
      {
        android: {
          kotlinVersion: '2.1.20',
          minSdkVersion: 29,
          compileSdkVersion: 36,
        },
      },
    ],
    // NOTE: '@qvac/sdk/expo-plugin' is deliberately NOT listed here as a string.
    // It's applied programmatically below via withQvacSDK(), because @qvac/sdk
    // ships as an ES Module and Expo's config-plugin resolver historically
    // fails to load ESM-only plugins referenced as plain strings in the
    // plugins array — it silently no-ops instead of erroring, which is why
    // the string-reference version built "successfully" but never actually
    // linked the native QVAC worker bundle.
  ],
  extra: {
    eas: {
      projectId: '1928534d-3f4f-4e72-b1a8-c10f2a6c5aac',
    },
  },
};

module.exports = () => {
  return {
    expo: withQvacSDK(expoConfig),
  };
};
