import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { scanProject, severityCounts, Finding, Severity } from '../rules/patternRules';
import { useNibrasStore, canScan, FREE_DAILY_LIMIT } from '../store/useNibrasStore';

const SEVERITY_COLOR: Record<Severity, string> = {
  CRITICAL: '#DC2626',
  HIGH: '#EA580C',
  MEDIUM: '#D97706',
  LOW: '#65A30D',
};

export default function GuardModeScreen() {
  const [loading, setLoading] = useState(false);
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
    } catch (err) {
      Alert.alert('Scan failed', String(err));
    } finally {
      setLoading(false);
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
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  card: {
    backgroundColor: '#151A21',
    borderLeftWidth: 4,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  cardSeverity: { fontSize: 11, fontWeight: '800', marginBottom: 4 },
  cardMessage: { color: '#F3F4F6', fontSize: 14, marginBottom: 6 },
  cardMeta: { color: '#6B7280', fontSize: 12, marginBottom: 4 },
  cardSnippet: { color: '#9CA3AF', fontSize: 12, fontFamily: 'monospace' },
  empty: { color: '#6B7280', textAlign: 'center', marginTop: 40 },
});
