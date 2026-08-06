// Runs as the `eas-build-post-install` npm lifecycle hook on EAS Build.
//
// REVISED: the programmatic `@qvac/sdk/commands` import failed on EAS with
// ERR_PACKAGE_PATH_NOT_EXPORTED — the installed @qvac/sdk@0.16.0 on the EAS
// build server does not expose a `./commands` subpath in its package.json
// "exports" map, despite QVAC's own docs showing that import. Rather than
// debug SDK/registry version skew blind, this shells out to `@qvac/cli`'s
// `qvac bundle sdk` command instead — the same underlying operation via the
// documented, stable CLI entrypoint, sidestepping the subpath-export
// question entirely. `@qvac/cli` is NOT currently a devDependency — add it
// before this will work: `"@qvac/cli": "^0.x.x"` (check current version).
//
// If this ALSO fails, the fallback is `npx --package "@qvac/cli" qvac bundle sdk`
// (documented in QVAC's own CLI docs for cases where global/local install
// is unavailable), which avoids needing @qvac/cli in package.json at all —
// try that first if you want to avoid an extra dependency during triage.

const { execSync } = require('child_process');

console.log('[eas-build-post-install] Bundling QVAC SDK worker via CLI...');

try {
  execSync('npx qvac bundle sdk --config ./qvac.config.json', {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
  console.log('[eas-build-post-install] QVAC SDK bundle complete.');
} catch (err) {
  console.error('[eas-build-post-install] QVAC bundle FAILED:', err.message);
  process.exit(1);
}
