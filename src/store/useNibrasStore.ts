import { create } from 'zustand';
import { Finding } from '../rules/patternRules';

interface ScanState {
  scansToday: number;
  lastScanAt: number | null;
  isPro: boolean;
  findings: Finding[];
  scanInProgress: boolean;

  incrementScanCount: () => void;
  resetDailyIfNeeded: () => void;
  setFindings: (f: Finding[]) => void;
  setScanInProgress: (b: boolean) => void;
  setIsPro: (b: boolean) => void;
}

const FREE_DAILY_LIMIT = 5;

export const useNibrasStore = create<ScanState>((set, get) => ({
  scansToday: 0,
  lastScanAt: null,
  isPro: false,
  findings: [],
  scanInProgress: false,

  incrementScanCount: () => set((s) => ({ scansToday: s.scansToday + 1, lastScanAt: Date.now() })),

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
}));

export function canScan(): boolean {
  const { isPro, scansToday } = useNibrasStore.getState();
  return isPro || scansToday < FREE_DAILY_LIMIT;
}

export { FREE_DAILY_LIMIT };
