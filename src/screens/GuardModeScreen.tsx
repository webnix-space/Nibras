import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { scanProject, severityCounts, Finding, Severity } from '../rules/patternRules';
import { useNibrasStore, canScan, FREE_DAILY_LIMIT } from '../store/useNibrasStore';
import { loadModel, generate, isModelLoaded, isQvacAvailable } from '../qvac/qvacClient';

const SEVERITY_COLOR: Record<Severity, string> = {
  CRITICAL: '#DC2626',
  HIGH: '#EA580C',
  MEDIUM: '#D97706',
  LOW: '#65A30D',
};

// Deep-scan only runs on the highest-severity findings — QVAC is slow
// relative to regex, so don't burn tokens explaining a MEDIUM http:// url.
const DEEP_SCAN_SEVERITIES: Severity[] = ['CRITICAL', 'HIGH'];

export default function GuardModeScreen() {
  const [loading, setLoading] = useState(false);
  const [modelLoadPct, setModelLoadPct] = useState<number | null>(null);
  const [tps, setTps] = useState<number | null>(null);
  const [deepScanNote, setDeepScanNote] = useState<string | null>(null);

  const { findings, setFindings, scansToday, isPro, incrementScanCount, resetDailyIfNeeded } =
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
      type: ['text/*', 'application/javascript', 'application/json'],
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
  container: { flex: 1, backgroundColor: '#0B0F14' },
  content: { padding: 20, paddingBottom: 60 },
  title: { fontSize: 28, fontWeight: '700', color: '#F3F4F6' },
  subtitle: { fontSize: 14, color: '#9CA3AF', marginTop: 4, marginBottom: 20 },
  scanButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  scanButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  modelLoadBox: { backgroundColor: '#151A21', borderRadius: 8, padding: 12, marginBottom: 16 },
  modelLoadText: { color: '#9CA3AF', fontSize: 13, textAlign: 'center' },
  tpsBox: {
    alignSelf: 'center',
    backgroundColor: '#0F2E2B',
    borderWidth: 1,
    borderColor: '#1E6E68',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 16,
  },
  tpsText: { color: '#38BDB0', fontSize: 12, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  deepScanCard: {
    backgroundColor: '#0F1A2E',
    borderWidth: 1,
    borderColor: '#1E3A6E',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  deepScanLabel: { color: '#5B8DEF', fontSize: 10, fontWeight: '800', marginBottom: 6, letterSpacing: 1 },
  deepScanText: { color: '#E5E9F0', fontSize: 13, lineHeight: 19 },
  card: { backgroundColor: '#151A21', borderLeftWidth: 4, borderRadius: 8, padding: 12, marginBottom: 10 },
  cardSeverity: { fontSize: 11, fontWeight: '800', marginBottom: 4 },
  cardMessage: { color: '#F3F4F6', fontSize: 14, marginBottom: 6 },
  cardMeta: { color: '#6B7280', fontSize: 12, marginBottom: 4 },
  cardSnippet: { color: '#9CA3AF', fontSize: 12, fontFamily: 'monospace' },
  empty: { color: '#6B7280', textAlign: 'center', marginTop: 40 },
});
