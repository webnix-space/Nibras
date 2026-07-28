/**
 * Fast pattern-matching rules — runs BEFORE any QVAC call.
 * This is your <500ms "standard scan" tier. No AI dependency.
 * Guard Mode's core detection lives here first; QVAC is the
 * deep-scan layer on top, not the baseline.
 */

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface Finding {
  ruleId: string;
  severity: Severity;
  message: string;
  file: string;
  line: number;
  snippet: string;
}

interface PatternRule {
  id: string;
  severity: Severity;
  pattern: RegExp;
  message: string;
}

// --- Secret detection ---
const SECRET_RULES: PatternRule[] = [
  {
    id: 'secret-aws-key',
    severity: 'CRITICAL',
    pattern: /AKIA[0-9A-Z]{16}/g,
    message: 'AWS Access Key ID hardcoded in source.',
  },
  {
    id: 'secret-generic-api-key',
    severity: 'CRITICAL',
    pattern: /(api[_-]?key|apikey)\s*[:=]\s*['"][A-Za-z0-9_\-]{16,}['"]/gi,
    message: 'Hardcoded API key literal.',
  },
  {
    id: 'secret-private-key-block',
    severity: 'CRITICAL',
    pattern: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    message: 'Private key material committed to source.',
  },
  {
    id: 'secret-generic-token',
    severity: 'HIGH',
    pattern: /(secret|token|password)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
    message: 'Possible hardcoded secret/password/token.',
  },
];

// --- Injection risk ---
const INJECTION_RULES: PatternRule[] = [
  {
    id: 'inj-sql-string-concat',
    severity: 'CRITICAL',
    pattern: /(SELECT|INSERT|UPDATE|DELETE)[^;]*['"]\s*\+\s*\w+/gi,
    message: 'SQL query built via string concatenation — injection risk. Use parameterized queries.',
  },
  {
    id: 'inj-eval',
    severity: 'CRITICAL',
    pattern: /\beval\s*\(/g,
    message: 'eval() usage — also an automatic App Store rejection risk for your own app.',
  },
  {
    id: 'inj-new-function',
    severity: 'CRITICAL',
    pattern: /new\s+Function\s*\(/g,
    message: 'new Function() usage — dynamic code execution, App Store rejection risk.',
  },
  {
    id: 'inj-shell-exec',
    severity: 'HIGH',
    pattern: /(child_process|subprocess)\.(exec|spawn)\s*\([^)]*\$\{/g,
    message: 'Shell command built with interpolated variable — command injection risk.',
  },
  {
    id: 'inj-dangerously-set-html',
    severity: 'HIGH',
    pattern: /dangerouslySetInnerHTML/g,
    message: 'Raw HTML injection point — XSS risk if input is not sanitized.',
  },
];

// --- Insecure deps / known-bad patterns ---
const DEP_RULES: PatternRule[] = [
  {
    id: 'dep-http-not-https',
    severity: 'MEDIUM',
    pattern: /['"]http:\/\/(?!localhost|127\.0\.0\.1)[^'"]+['"]/g,
    message: 'Plaintext HTTP URL to non-local host — should be HTTPS.',
  },
  {
    id: 'dep-disabled-tls-verify',
    severity: 'CRITICAL',
    pattern: /(rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0)/g,
    message: 'TLS certificate verification disabled.',
  },
];

const ALL_RULES: PatternRule[] = [...SECRET_RULES, ...INJECTION_RULES, ...DEP_RULES];

export function scanFileContent(fileName: string, content: string): Finding[] {
  const findings: Finding[] = [];
  const lines = content.split('\n');

  for (const rule of ALL_RULES) {
    // reset lastIndex for global regexes reused across files
    rule.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    const re = new RegExp(rule.pattern.source, rule.pattern.flags);

    lines.forEach((lineText, idx) => {
      re.lastIndex = 0;
      if (re.test(lineText)) {
        findings.push({
          ruleId: rule.id,
          severity: rule.severity,
          message: rule.message,
          file: fileName,
          line: idx + 1,
          snippet: lineText.trim().slice(0, 160),
        });
      }
    });
  }

  return findings;
}

export function scanProject(files: { name: string; content: string }[]): Finding[] {
  return files.flatMap((f) => scanFileContent(f.name, f.content));
}

export function severityCounts(findings: Finding[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const f of findings) counts[f.severity]++;
  return counts;
}
