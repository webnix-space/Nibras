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
    allowBackup: false, // prevents Android auto-restoring AsyncStorage/app data on reinstall
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0B0F14',
    },
    permissions: ['READ_EXTERNAL_STORAGE'],
  },
  plugins: [
    'expo-document-picker',
    '@react-native-vector-icons/ionicons', // SDK 56: @expo/vector-icons deprecated, static font requires this plugin
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

module.exports = ({ config }) => {
  // Dynamic app.config.js must return the ExpoConfig object directly —
  // NOT { ...config, expo: ... }. That malformed shape is what produced
  // "Config `_internal.projectRoot` isn't defined by expo-cli" on EAS:
  // the loader choked trying to read _internal off a top-level object
  // that was never a valid ExpoConfig in the first place.
  return withQvacSDK({
    ...config,
    ...expoConfig,
  });
};
