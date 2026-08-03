/**
 * Nibras design tokens.
 * Security-console register: data-dense, dark, severity color is a trust
 * signal and must never be reused for decoration — it's load-bearing meaning.
 */

export const color = {
  bg: '#0B0F14',
  surface: '#151A21',
  surfaceElevated: '#1C2430',
  border: '#242A33',
  borderSubtle: '#1A2029',

  textPrimary: '#F3F4F6',
  textSecondary: '#9CA3AF',
  textTertiary: '#6B7280',

  // Severity — reused verbatim from existing screens, never alter without
  // updating patternRules.ts / SEVERITY_COLOR everywhere else too.
  critical: '#DC2626',
  high: '#EA580C',
  medium: '#D97706',
  low: '#65A30D',

  // AI/QVAC tier accent — kept distinct from dashboard accent so the
  // "probabilistic AI" vs "deterministic pattern-match" visual language
  // stays consistent with Guard/Vault Mode's existing convention.
  aiAccent: '#5B8DEF',
  aiAccentBg: '#0F1A2E',
  aiAccentBorder: '#1E3A6E',

  // Dashboard-only secondary accent — healthy/scanning states, distinct
  // from aiAccent so stat charts never look like AI-tier findings.
  pulseAccent: '#22D3B8',
  pulseAccentBg: '#0F2E2B',
  pulseAccentBorder: '#1E6E68',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
};

export const radius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
};

export const type = {
  displayLarge: { fontSize: 28, fontWeight: '700' as const },
  displayMedium: { fontSize: 22, fontWeight: '700' as const },
  title: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 14, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '600' as const },
  statFigure: { fontSize: 32, fontWeight: '800' as const, fontFamily: 'monospace' },
  statLabel: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.5 },
};
