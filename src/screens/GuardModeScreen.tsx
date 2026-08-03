import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { scanProject, severityCounts, Finding, Severity } from '../rules/patternRules';
import { useNibrasStore, canScan, FREE_DAILY_LIMIT } from '../store/useNibrasStore';
import { loadModel, generate, isModelLoaded, isQvacAvailable } from '../qvac/qvacClient';
import { color, spacing, radius, type as t } from '../theme/tokens';

const SEVERITY_COLOR: Record<Severity, string> = {
  CRITICAL: color.critical,
  HIGH: color.high,
  MEDIUM: color.medium,
  LOW: color.low,
};

const DEEP_SCAN_SEVERITIES: Severity[] = ['CRITICAL', 'HIGH'];

export default function GuardModeScreen() {
  const [loading, setLoading] = useState(false);
  const [modelLoadPct, setModelLoadPct] = useState<number | null>(null);
  const [tps, setTps] = useState<number | null>(null);
  const [deepScanNote, setDeepScanNote] = useState<string | null>(null);

  const { findings, setFindings, scansToday, isPro, incrementScanCount, resetDailyIfNeeded, recordScan } =
    useNibrasStore();

  resetDailyIfNeeded();

  async function handlePickAndScan() {
    if (!canScan()) {
      Alert.alert(
        'Daily limit reached',
        `Free tier is ${FREE_DAILY_LIMIT} scans/day. Upgrade to Pro for unlimited scans.`
      );
      return;
    }

    const result = await DocumentPicker.getDocumentAsync({
      multiple: true,
      type: '*/*',
    });

    if (result.canceled) return;

    setLoading(true);
    setDeepScanNote(null);
    try {
      const files = await Promise.all(
        result.assets.map(async (asset) => {
          const content = await FileSystem.readAsStringAsync(asset.uri);
          return { name: asset.name, content };
        })
      );

      const results = scanProject(files);
      setFindings(results);
      incrementScanCount();
      recordScan('guard', files.length, results);

      const topFindings = results.filter((f) => DEEP_SCAN_SEVERITIES.includes(f.severity));
      if (topFindings.length > 0) {
        await runDeepScan(topFindings);
      }
    } catch (err) {
      Alert.alert('Scan failed', String(err));
    } finally {
      setLoading(false);
    }
  }

  async function runDeepScan(topFindings: Finding[]) {
    if (!isQvacAvailable()) {
      setDeepScanNote('QVAC unavailable on this build — showing pattern-scan results only.');
      return;
    }

    try {
      if (!isModelLoaded()) {
        setModelLoadPct(0);
        await loadModel((pct) => setModelLoadPct(pct));
        setModelLoadPct(null);
      }

      const worst = topFindings[0];
      const prompt = `Explain this security finding in one plain-English sentence for a mobile developer, and give one concrete fix.\n\nFinding: ${worst.message}\nCode: ${worst.snippet}`;

      const result = await generate(
        'You are a concise security reviewer. Respond in 1-2 sentences, no preamble.',
        prompt,
        { maxTokens: 120 }
      );
      setTps(Number(result.tokensPerSecond.toFixed(1)));
      setDeepScanNote(result.text || 'Deep scan returned no output.');
    } catch (e: any) {
      setDeepScanNote(`Deep scan unavailable: ${e.message}`);
    }
  }

  const counts = severityCounts(findings);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Guard Mode</Text>
      <Text style={styles.subtitle}>
        {isPro ? 'Unlimited scans' : `${scansToday}/${FREE_DAILY_LIMIT} scans today`}
      </Text>

      <Pressable style={styles.scanButton} onPress={handlePickAndScan} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.scanButtonText}>Select Files to Scan</Text>
        )}
      </Pressable>

      {modelLoadPct !== null && (
        <View style={styles.modelLoadBox}>
          <Text style={styles.modelLoadText}>Loading on-device model… {modelLoadPct}%</Text>
        </View>
      )}

      {tps !== null && (
        <View style={styles.tpsBox}>
          <Text style={styles.tpsText}>{tps} tok/s on this device</Text>
        </View>
      )}

      {findings.length > 0 && (
        <View style={styles.summaryRow}>
          {(Object.keys(counts) as Severity[]).map((sev) => (
            <View key={sev} style={[styles.badge, { backgroundColor: SEVERITY_COLOR[sev] }]}>
              <Text style={styles.badgeText}>
                {sev} {counts[sev]}
              </Text>
            </View>
          ))}
        </View>
      )}

      {deepScanNote && (
        <View style={styles.deepScanCard}>
          <Text style={styles.deepScanLabel}>QVAC DEEP SCAN</Text>
          <Text style={styles.deepScanText}>{deepScanNote}</Text>
        </View>
      )}

      {findings.map((f, i) => (
        <FindingCard key={`${f.ruleId}-${i}`} finding={f} />
      ))}

      {findings.length === 0 && !loading && (
        <Text style={styles.empty}>No scan results yet. Select files to begin.</Text>
      )}
    </ScrollView>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  return (
    <View style={[styles.card, { borderLeftColor: SEVERITY_COLOR[finding.severity] }]}>
      <Text style={[styles.cardSeverity, { color: SEVERITY_COLOR[finding.severity] }]}>
        {finding.severity}
      </Text>
      <Text style={styles.cardMessage}>{finding.message}</Text>
      <Text style={styles.cardMeta}>
        {finding.file}:{finding.line}
      </Text>
      <Text style={styles.cardSnippet}>{finding.snippet}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg },
  content: { padding: spacing.xl, paddingBottom: 60 },
  title: { ...t.displayLarge, color: color.textPrimary },
  subtitle: { ...t.body, color: color.textSecondary, marginTop: spacing.xs, marginBottom: spacing.xl },
  scanButton: {
    backgroundColor: color.aiAccent,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  scanButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  modelLoadBox: { backgroundColor: color.surface, borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.lg },
  modelLoadText: { color: color.textSecondary, fontSize: 13, textAlign: 'center' },
  tpsBox: {
    alignSelf: 'center',
    backgroundColor: color.pulseAccentBg,
    borderWidth: 1,
    borderColor: color.pulseAccentBorder,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.lg,
  },
  tpsText: { color: color.pulseAccent, fontSize: 12, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  badge: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  deepScanCard: {
    backgroundColor: color.aiAccentBg,
    borderWidth: 1,
    borderColor: color.aiAccentBorder,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  deepScanLabel: { color: color.aiAccent, fontSize: 10, fontWeight: '800', marginBottom: spacing.xs, letterSpacing: 1 },
  deepScanText: { color: color.textPrimary, fontSize: 13, lineHeight: 19 },
  card: { backgroundColor: color.surface, borderLeftWidth: 4, borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.sm },
  cardSeverity: { fontSize: 11, fontWeight: '800', marginBottom: spacing.xs },
  cardMessage: { color: color.textPrimary, fontSize: 14, marginBottom: spacing.xs },
  cardMeta: { color: color.textTertiary, fontSize: 12, marginBottom: spacing.xs },
  cardSnippet: { color: color.textSecondary, fontSize: 12, fontFamily: 'monospace' },
  empty: { color: color.textTertiary, textAlign: 'center', marginTop: 40 },
});
