import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Finding, Severity } from '../rules/patternRules';

export interface ScanRecord {
  id: string;
  timestamp: number;
  mode: 'guard' | 'vault';
  fileCount: number;
  findings: Finding[];
  severityCounts: Record<Severity, number>;
}

interface ScanState {
  // Session-only, not persisted
  findings: Finding[];
  scanInProgress: boolean;

  // Persisted
  scansToday: number;
  lastScanAt: number | null;
  isPro: boolean;
  history: ScanRecord[];

  incrementScanCount: () => void;
  resetDailyIfNeeded: () => void;
  setFindings: (f: Finding[]) => void;
  setScanInProgress: (b: boolean) => void;
  setIsPro: (b: boolean) => void;
  recordScan: (mode: 'guard' | 'vault', fileCount: number, findings: Finding[]) => void;
  clearHistory: () => void;
}

const FREE_DAILY_LIMIT = 5;
const MAX_HISTORY = 200; // cap so AsyncStorage payload doesn't grow unbounded

function countBySeverity(findings: Finding[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const f of findings) counts[f.severity]++;
  return counts;
}

export const useNibrasStore = create<ScanState>()(
  persist(
    (set, get) => ({
      findings: [],
      scanInProgress: false,

      scansToday: 0,
      lastScanAt: null,
      isPro: false,
      history: [],

      incrementScanCount: () =>
        set((s) => ({ scansToday: s.scansToday + 1, lastScanAt: Date.now() })),

      resetDailyIfNeeded: () => {
        const { lastScanAt } = get();
        if (!lastScanAt) return;
        const last = new Date(lastScanAt);
        const now = new Date();
        const isNewDay =
          last.getFullYear() !== now.getFullYear() ||
          last.getMonth() !== now.getMonth() ||
          last.getDate() !== now.getDate();
        if (isNewDay) set({ scansToday: 0 });
      },

      setFindings: (findings) => set({ findings }),
      setScanInProgress: (scanInProgress) => set({ scanInProgress }),
      setIsPro: (isPro) => set({ isPro }),

      recordScan: (mode, fileCount, findings) => {
        const record: ScanRecord = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: Date.now(),
          mode,
          fileCount,
          findings,
          severityCounts: countBySeverity(findings),
        };
        set((s) => ({
          history: [record, ...s.history].slice(0, MAX_HISTORY),
        }));
      },

      clearHistory: () => set({ history: [] }),
    }),
    {
      name: 'nibras-store-v1',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist what should survive app restarts. `findings` and
      // `scanInProgress` are current-session UI state, not history —
      // keeping them out of the persisted payload avoids stale scan
      // results reappearing on next app launch.
      partialize: (s) => ({
        scansToday: s.scansToday,
        lastScanAt: s.lastScanAt,
        isPro: s.isPro,
        history: s.history,
      }),
      version: 1,
    }
  )
);

export function canScan(): boolean {
  const { isPro, scansToday } = useNibrasStore.getState();
  return isPro || scansToday < FREE_DAILY_LIMIT;
}

/** Dashboard aggregation helpers — derived from history, not stored directly. */
export function getAggregateStats(history: ScanRecord[]) {
  const totals: Record<Severity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const record of history) {
    totals.CRITICAL += record.severityCounts.CRITICAL;
    totals.HIGH += record.severityCounts.HIGH;
    totals.MEDIUM += record.severityCounts.MEDIUM;
    totals.LOW += record.severityCounts.LOW;
  }
  const totalFindings = totals.CRITICAL + totals.HIGH + totals.MEDIUM + totals.LOW;
  return { totals, totalFindings, totalScans: history.length };
}

export { FREE_DAILY_LIMIT };
