import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useNibrasStore, getAggregateStats, FREE_DAILY_LIMIT } from '../store/useNibrasStore';
import { Severity } from '../rules/patternRules';
import { color, spacing, radius, type as t } from '../theme/tokens';

const SEVERITY_COLOR: Record<Severity, string> = {
  CRITICAL: color.critical,
  HIGH: color.high,
  MEDIUM: color.medium,
  LOW: color.low,
};

function RiskPulse({ totals, totalFindings }: { totals: Record<Severity, number>; totalFindings: number }) {
  if (totalFindings === 0) {
    return (
      <View style={styles.pulseEmpty}>
        <Text style={styles.pulseEmptyText}>No findings recorded yet — run a scan to populate this.</Text>
      </View>
    );
  }

  const order: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  return (
    <View>
      <View style={styles.pulseBar}>
        {order.map((sev) => {
          const pct = totals[sev] / totalFindings;
          if (pct === 0) return null;
          return (
            <View
              key={sev}
              style={{ flex: pct, backgroundColor: SEVERITY_COLOR[sev] }}
            />
          );
        })}
      </View>
      <View style={styles.pulseLegend}>
        {order.map((sev) => (
          <View key={sev} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: SEVERITY_COLOR[sev] }]} />
            <Text style={styles.legendText}>
              {sev} {totals[sev]}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const navigation = useNavigation<any>();

  // SELECTOR SUBSCRIPTIONS ONLY — do not destructure the whole store here.
  // useNibrasStore() with no selector subscribes to every field (findings,
  // scanInProgress, hasHydrated, lastScanAt, etc). Any set() call anywhere
  // in the app — including resetDailyIfNeeded() firing on every render of
  // Guard/Vault screens — then re-renders THIS screen too, even though
  // none of those fields are used here. On a non-trivial history array
  // that re-render re-runs getAggregateStats() and remaps recentScans
  // every time, which compounds into a render storm that can peg the JS
  // thread hard enough to make the UI look frozen (old frame on screen,
  // no touch response) without ever throwing or crashing.
  const history = useNibrasStore((s) => s.history);
  const scansToday = useNibrasStore((s) => s.scansToday);
  const isPro = useNibrasStore((s) => s.isPro);

  const { totals, totalFindings, totalScans } = useMemo(() => getAggregateStats(history), [history]);
  const recentScans = useMemo(() => history.slice(0, 8), [history]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Dashboard</Text>
      <Text style={styles.subtitle}>Local scan history — never leaves this device.</Text>

      <View style={styles.statGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statFigure}>{totalScans}</Text>
          <Text style={styles.statLabel}>TOTAL SCANS</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statFigure}>{totalFindings}</Text>
          <Text style={styles.statLabel}>FINDINGS LOGGED</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statFigure, { color: isPro ? color.pulseAccent : color.textPrimary }]}>
            {isPro ? '∞' : `${scansToday}/${FREE_DAILY_LIMIT}`}
          </Text>
          <Text style={styles.statLabel}>SCANS TODAY</Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>RISK DISTRIBUTION — ALL-TIME</Text>
      <View style={styles.card}>
        <RiskPulse totals={totals} totalFindings={totalFindings} />
      </View>

      <View style={styles.quickActions}>
        <Pressable style={styles.actionButton} onPress={() => navigation.navigate('Guard Mode')}>
          <Text style={styles.actionButtonText}>Run Guard Mode Scan</Text>
        </Pressable>
        <Pressable style={styles.actionButtonSecondary} onPress={() => navigation.navigate('Vault Mode')}>
          <Text style={styles.actionButtonSecondaryText}>Open Vault Mode</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionLabel}>RECENT SCANS</Text>
      {recentScans.length === 0 && (
        <Text style={styles.empty}>No scans yet. Run Guard Mode or Vault Mode to begin.</Text>
      )}
      {recentScans.map((record) => {
        const worst: Severity =
          record.severityCounts.CRITICAL > 0
            ? 'CRITICAL'
            : record.severityCounts.HIGH > 0
            ? 'HIGH'
            : record.severityCounts.MEDIUM > 0
            ? 'MEDIUM'
            : 'LOW';
        const total =
          record.severityCounts.CRITICAL +
          record.severityCounts.HIGH +
          record.severityCounts.MEDIUM +
          record.severityCounts.LOW;
        return (
          <View key={record.id} style={[styles.historyCard, { borderLeftColor: SEVERITY_COLOR[worst] }]}>
            <View style={styles.historyRow}>
              <Text style={styles.historyMode}>{record.mode === 'guard' ? 'Guard Mode' : 'Vault Mode'}</Text>
              <Text style={styles.historyTime}>
                {new Date(record.timestamp).toLocaleDateString()} ·{' '}
                {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <Text style={styles.historyDetail}>
              {record.fileCount} file{record.fileCount !== 1 ? 's' : ''} · {total} finding
              {total !== 1 ? 's' : ''}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: color.bg },
  content: { padding: spacing.xl, paddingBottom: 60 },
  title: { ...t.displayLarge, color: color.textPrimary },
  subtitle: { ...t.body, color: color.textSecondary, marginTop: spacing.xs, marginBottom: spacing.xl },

  statGrid: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  statCard: {
    flex: 1,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: color.border,
  },
  statFigure: { ...t.statFigure, color: color.textPrimary },
  statLabel: { ...t.statLabel, color: color.textTertiary, marginTop: spacing.xs },

  sectionLabel: {
    ...t.caption,
    color: color.textTertiary,
    letterSpacing: 1,
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: color.border,
    marginBottom: spacing.xl,
  },

  pulseBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: color.surfaceElevated,
    marginBottom: spacing.md,
  },
  pulseLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { ...t.body, color: color.textSecondary, fontSize: 12 },
  pulseEmpty: { paddingVertical: spacing.md },
  pulseEmptyText: { ...t.body, color: color.textTertiary },

  quickActions: { gap: spacing.md, marginBottom: spacing.xl },
  actionButton: {
    backgroundColor: color.aiAccent,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  actionButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  actionButtonSecondary: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  actionButtonSecondaryText: { color: color.textPrimary, fontSize: 15, fontWeight: '600' },

  historyCard: {
    backgroundColor: color.surface,
    borderLeftWidth: 3,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  historyMode: { ...t.title, fontSize: 14, color: color.textPrimary },
  historyTime: { ...t.body, fontSize: 11, color: color.textTertiary },
  historyDetail: { ...t.body, fontSize: 12, color: color.textSecondary },
  empty: { color: color.textTertiary, textAlign: 'center', marginTop: spacing.xl },
});
