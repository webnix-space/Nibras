/**
 * Detects imports/requires of packages that don't exist on npm/PyPI —
 * the classic AI-hallucinated-dependency failure mode.
 *
 * NOTE: requires network access (npm registry / PyPI API). This is the
 * one part of Guard Mode that can't be "zero cloud" for the check itself
 * — only the CODE never leaves the device. Package name lookups going out
 * is a metadata call, not code exfiltration, but say this explicitly in
 * your privacy copy so it doesn't read as a contradiction of your core promise.
 */

export interface HallucinationFinding {
  packageName: string;
  file: string;
  line: number;
  ecosystem: 'npm' | 'pypi';
  exists: boolean;
}

const JS_IMPORT_RE = /(?:import\s+.*?from\s+|require\s*\(\s*)['"]([^'".][^'"]*)['"]/g;
const PY_IMPORT_RE = /^\s*(?:import|from)\s+([a-zA-Z0-9_]+)/gm;

function extractJsPackages(content: string): string[] {
  const names = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(JS_IMPORT_RE.source, 'g');
  while ((m = re.exec(content))) {
    let pkg = m[1];
    if (pkg.startsWith('@')) {
      pkg = pkg.split('/').slice(0, 2).join('/');
    } else {
      pkg = pkg.split('/')[0];
    }
    names.add(pkg);
  }
  return [...names];
}

function extractPyPackages(content: string): string[] {
  const names = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(PY_IMPORT_RE.source, 'gm');
  while ((m = re.exec(content))) {
    names.add(m[1]);
  }
  return [...names];
}

const STDLIB_PY = new Set(['os', 'sys', 'json', 're', 'math', 'time', 'typing', 'collections', 'itertools']);

async function checkNpmExists(pkg: string): Promise<boolean> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg)}`, { method: 'HEAD' });
    return res.ok;
  } catch {
    return true; // fail-open: no network = don't false-flag
  }
}

async function checkPyPiExists(pkg: string): Promise<boolean> {
  try {
    const res = await fetch(`https://pypi.org/pypi/${encodeURIComponent(pkg)}/json`, { method: 'HEAD' });
    return res.ok;
  } catch {
    return true;
  }
}

export async function checkHallucinatedPackages(
  files: { name: string; content: string; language: 'js' | 'ts' | 'py' }[]
): Promise<HallucinationFinding[]> {
  const findings: HallucinationFinding[] = [];

  for (const file of files) {
    const isPy = file.language === 'py';
    const pkgs = isPy ? extractPyPackages(file.content) : extractJsPackages(file.content);

    for (const pkg of pkgs) {
      if (isPy && STDLIB_PY.has(pkg)) continue;

      const exists = isPy ? await checkPyPiExists(pkg) : await checkNpmExists(pkg);
      if (!exists) {
        const line = file.content.split('\n').findIndex((l) => l.includes(pkg)) + 1;
        findings.push({
          packageName: pkg,
          file: file.name,
          line: line || 1,
          ecosystem: isPy ? 'pypi' : 'npm',
          exists: false,
        });
      }
    }
  }

  return findings;
}
