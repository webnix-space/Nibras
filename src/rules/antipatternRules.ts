/**
 * Antipattern detection — Vault Mode's fast, deterministic tier.
 *
 * SCOPE HONESTY: only patterns that are genuinely regex-detectable live here.
 * Null pointer risk, race conditions, and performance bottlenecks are NOT
 * pattern-matchable — they depend on control flow and runtime state, not
 * string shape. Those live in qvacDeepScan.ts as labeled "AI Analysis"
 * findings, never blended into this list. Don't add semantic-sounding
 * "detectors" here that are actually regex guessing — that's confidence
 * theater and this product's buyer (NDA/compliance devs, per Business Case)
 * will notice and stop trusting the whole tool.
 */

import { Finding, Severity } from './patternRules';

interface AntipatternRule {
  id: string;
  severity: Severity;
  pattern: RegExp;
  message: string;
}

const ANTIPATTERN_RULES: AntipatternRule[] = [
  {
    id: 'loose-equality',
    severity: 'LOW',
    pattern: /[^=!]==[^=]|[^!]!=[^=]/g,
    message: 'Loose equality (==/!=) — use strict equality (===/!==) to avoid type coercion bugs.',
  },
  {
    id: 'unhandled-promise',
    severity: 'MEDIUM',
    pattern: /\.then\([^)]*\)(?!\s*\.catch)(?!\s*\.finally)/g,
    message: 'Promise .then() without a paired .catch() — unhandled rejection risk.',
  },
  {
    id: 'async-no-try-catch',
    severity: 'MEDIUM',
    pattern: /async\s+(?:function\s*\w*|\([^)]*\)\s*=>)\s*{(?:(?!try|catch)[\s\S])*?await[\s\S]*?}/g,
    message: 'async function uses await with no visible try/catch — unhandled rejection risk.',
  },
  {
    id: 'array-index-no-bounds-check',
    severity: 'LOW',
    pattern: /\[\s*(?:i|idx|index)\s*\+\s*1\s*\](?!\s*\?)/g,
    message: 'Array index arithmetic (e.g. [i+1]) without a visible bounds check — possible out-of-range access.',
  },
  {
    id: 'console-log-left-in',
    severity: 'LOW',
    pattern: /console\.(log|debug)\(/g,
    message: 'console.log/debug left in code — remove before shipping, may leak data in production logs.',
  },
  {
    id: 'empty-catch-block',
    severity: 'MEDIUM',
    pattern: /catch\s*\([^)]*\)\s*{\s*}/g,
    message: 'Empty catch block — error is silently swallowed, failures become invisible.',
  },
  {
    id: 'var-declaration',
    severity: 'LOW',
    pattern: /(?:^|\s)var\s+\w+/g,
    message: "'var' declaration — prefer 'let'/'const' to avoid function-scoping and hoisting bugs.",
  },
  {
    id: 'magic-number-timeout',
    severity: 'LOW',
    pattern: /set(?:Timeout|Interval)\([^,]+,\s*\d{4,}\)/g,
    message: 'Hardcoded multi-second timeout/interval — consider naming as a constant for maintainability.',
  },
];

export function scanAntipatterns(fileName: string, content: string): Finding[] {
  const findings: Finding[] = [];
  const lines = content.split('\n');

  for (const rule of ANTIPATTERN_RULES) {
    lines.forEach((lineText, idx) => {
      const re = new RegExp(rule.pattern.source, rule.pattern.flags);
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
