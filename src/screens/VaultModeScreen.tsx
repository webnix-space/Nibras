import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { scanFileContent, Finding, Severity } from '../rules/patternRules';
import { scanAntipatterns } from '../rules/antipatternRules';
import { runSemanticScan, SemanticFinding, SemanticCategory } from '../rules/qvacDeepScan';
import { useNibrasStore, canScan, FREE_DAILY_LIMIT } from '../store/useNibrasStore';
import { color, spacing, radius, type as t } from '../theme/tokens';

const SEVERITY_COLOR: Record<Severity, string> = {
  CRITICAL: color.critical,
  HIGH: color.high,
  MEDIUM: color.medium,
  LOW: color.low,
};

const CATEGORY_LABEL: Record<SemanticCategory, string> = {
  'null-pointer': 'Null Pointer Risk',
  'race-condition': 'Race Condition',
  performance: 'Performance',
};

const CONFIDENCE_COLOR = { high: color.critical, medium: color.medium, low: color.textTertiary };

export default function VaultModeScreen() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [modelLoadPct, setModelLoadPct] = useState<number | null>(null);
  const [patternFindings, setPatternFindings] = useState<Finding[]>([]);
  const [semanticFindings, setSemanticFindings] = useState<SemanticFinding[]>([]);
  const [tps, setTps] = useState<number | null>(null);
  const [semanticError, setSemanticError] = useState<string | null>(null);

  const { scansToday, isPro, incrementScanCount, resetDailyIfNeeded, recordScan } = useNibrasStore();
  resetDailyIfNeeded();

  async function handlePickFile() {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
    if (result.canceled) return;
    try {
      const content = await FileSystem.readAsStringAsync(result.assets[0].uri);
      setCode(content);
    } catch (err) {
      Alert.alert('Could not read file', String(err));
    }
  }

  async function handleReview() {
    if (!code.trim()) {
      Alert.alert('Empty', 'Paste some code first.');
      return;
    }
    if (!canScan()) {
      Alert.alert(
        'Daily limit reached',
        `Free tier is ${FREE_DAILY_LIMIT} scans/day. Upgrade to Pro for unlimited scans.`
      );
      return;
    }

    setLoading(true);
    setSemanticError(null);
    setSemanticFindings([]);

    try {
      const secretsAndInjection = scanFileContent('pasted-code', code);
      const antipatterns = scanAntipatterns('pasted-code', code);
      const allPatternFindings = [...secretsAndInjection, ...antipatterns];
      setPatternFindings(allPatternFindings);
      incrementScanCount();
      recordScan('vault', 1, allPatternFindings);

      try {
        const result = await runSemanticScan(code, setModelLoadPct);
        setModelLoadPct(null);
        setSemanticFindings(result.findings);
        setTps(Number(result.tokensPerSecond.toFixed(1)));
      } catch (e: any) {
        setModelLoadPct(null);
        setSemanticError(e.message || 'AI analysis unavailable — pattern-match results still shown above.');
      }
    } catch (err) {
      Alert.alert('Review failed', String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Vault Mode</Text>
      <Text style={styles.subtitle}>
        Paste code for review — nothing is saved to disk.{' '}
        {isPro ? 'Unlimited scans' : `${scansToday}/${FREE_DAILY_LIMIT} scans today`}
      </Text>

      <Pressable style={styles.pickButton} onPress={handlePickFile}>
        <Text style={styles.pickButtonText}>Or pick a file instead</Text>
      </Pressable>

      <TextInput
        style={styles.codeInput}
        placeholder="Paste code here…"
        placeholderTextColor={color.textTertiary}
        value={code}
        onChangeText={setCode}
        multiline
        textAlignVertical="top"
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
      />

      <Pressable style={styles.reviewButton} onPress={handleReview} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.reviewButtonText}>Review Code</Text>}
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

      {patternFindings.length > 0 && (
        <>
          <Text style={styles.tierLabel}>PATTERN MATCH — deterministic, fast</Text>
          {patternFindings.map((f, i) => (
            <View key={`p-${i}`} style={[styles.card, { borderLeftColor: SEVERITY_COLOR[f.severity] }]}>
              <Text style={[styles.cardTag, { color: SEVERITY_COLOR[f.severity] }]}>{f.severity}</Text>
              <Text style={styles.cardMessage}>{f.message}</Text>
              <Text style={styles.cardMeta}>line {f.line}</Text>
              <Text style={styles.cardSnippet}>{f.snippet}</Text>
            </View>
          ))}
        </>
      )}

      {semanticError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{semanticError}</Text>
        </View>
      )}

      {semanticFindings.length > 0 && (
        <>
          <Text style={styles.tierLabel}>AI ANALYSIS — probabilistic, on-device model</Text>
          {semanticFindings.map((f, i) => (
            <View key={`s-${i}`} style={[styles.card, { borderLeftColor: CONFIDENCE_COLOR[f.confidence] }]}>
              <View style={styles.semanticHeader}>
                <Text style={[styles.cardTag, { color: CONFIDENCE_COLOR[f.confidence] }]}>
                  {CATEGORY_LABEL[f.category]}
                </Text>
                <Text style={styles.confidenceTag}>{f.confidence} confidence</Text>
              </View>
              <Text style={styles.cardMessage}>{f.explanation}</Text>
              <Text style={styles.fixLabel}>Suggested fix</Text>
              <Text style={styles.cardSnippet}>{f.suggestedFix}</Text>
              {f.lineHint && <Text style={styles.cardMeta}>{f.lineHint}</Text>}
            </View>
          ))}
        </>
      )}

      {patternFindings.length === 0 && semanticFindings.length === 0 && !loading && (
        <Text style={styles.empty}>No review yet. Paste code and tap Review Code.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg },
  content: { padding: spacing.xl, paddingBottom: 60 },
  title: { ...t.displayLarge, color: color.textPrimary },
  subtitle: { ...t.body, color: color.textSecondary, marginTop: spacing.xs, marginBottom: spacing.lg, lineHeight: 18 },
  pickButton: { alignSelf: 'flex-start', marginBottom: spacing.sm },
  pickButtonText: { color: color.aiAccent, fontSize: 13, fontWeight: '600' },
  codeInput: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    color: color.textPrimary,
    padding: spacing.md,
    fontSize: 13,
    fontFamily: 'monospace',
    minHeight: 160,
    marginBottom: spacing.md,
  },
  reviewButton: {
    backgroundColor: color.aiAccent,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  reviewButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
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
  tierLabel: {
    color: color.textTertiary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  card: { backgroundColor: color.surface, borderLeftWidth: 4, borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.sm },
  cardTag: { fontSize: 11, fontWeight: '800' },
  semanticHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  confidenceTag: { color: color.textTertiary, fontSize: 11, fontWeight: '600' },
  cardMessage: { color: color.textPrimary, fontSize: 14, marginTop: spacing.xs, marginBottom: spacing.xs },
  cardMeta: { color: color.textTertiary, fontSize: 12, marginBottom: spacing.xs },
  cardSnippet: { color: color.textSecondary, fontSize: 12, fontFamily: 'monospace' },
  fixLabel: { color: color.aiAccent, fontSize: 10, fontWeight: '700', marginTop: spacing.xs, marginBottom: spacing.xs },
  errorBox: {
    backgroundColor: '#1A0F0F',
    borderWidth: 1,
    borderColor: '#5C2626',
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: { color: '#F3A5A5', fontSize: 13 },
  empty: { color: color.textTertiary, textAlign: 'center', marginTop: 40 },
});
