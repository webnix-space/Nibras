// Runs as the `eas-build-post-install` npm lifecycle hook on EAS Build,
// confirmed via Expo's own Android build docs: post-install fires AFTER
// `npx expo prebuild` (CNG) has already generated android/ios native
// folders, and BEFORE the gradle/xcodebuild step. That ordering matters —
// bundleSdk() needs the native project to exist so its output lands
// somewhere the subsequent native build actually packages into the APK.
//
// This is the missing piece behind:
//   "RPC connection failed: Failed to load mobile worker bundle."
// withQvacSDK() (in app.config.js) only mutates native config at prebuild
// time — permissions, gradle entries, native module registration. It does
// NOT produce the QVAC worker bundle artifact itself. That's a separate
// step (see QVAC docs: Plugin System — "Enabling" — mobile/Expo tab says
// prebuild is what triggers plugin-aware bundling, but that's the CLI-flag
// codepath; going through bundleSdk() programmatically here is the correct
// choice for a hook script with no interactive shell).
//
// If this hook fails, the build should fail loudly rather than ship an
// app with a broken QVAC runtime silently — hence process.exit(1) on error.

const { bundleSdk } = require('@qvac/sdk/commands');
const path = require('path');

async function main() {
  console.log('[eas-build-post-install] Bundling QVAC SDK worker...');

  await bundleSdk({
    projectRoot: process.cwd(),
    configPath: path.join(process.cwd(), 'qvac.config.json'),
    quiet: false, // verbose on purpose during bring-up — flip to true once this is proven stable
  });

  console.log('[eas-build-post-install] QVAC SDK bundle complete.');
}

main().catch((err) => {
  console.error('[eas-build-post-install] QVAC bundle FAILED:', err);
  // Fail the build hard. A silent failure here reproduces the exact
  // "builds green, crashes at runtime" bug we're fixing.
  process.exit(1);
});
