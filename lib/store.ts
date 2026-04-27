import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'system' | 'light' | 'dark';
type SyncStatus = 'idle' | 'syncing' | 'error' | { lastSyncedAt: string };
type AiConsent = {
  enabled: boolean;
  provider: 'cloud' | 'free' | 'local' | 'none';
};

interface UIStore {
  // Theme
  theme: Theme;
  setTheme: (theme: Theme) => void;

  // Nav
  navOpen: boolean;
  setNavOpen: (open: boolean) => void;

  // Trip context
  lastViewedTripId: string | null;
  setLastViewedTripId: (id: string | null) => void;

  // Sync status (not persisted — resets on app start)
  syncStatus: SyncStatus;
  setSyncStatus: (s: SyncStatus) => void;

  // Backup nudge
  backupNudgeDismissedAt: string | null;
  dismissBackupNudge: () => void;

  // Sync
  syncEnabled: boolean;
  setSyncEnabled: (e: boolean) => void;

  // AI consent
  aiConsent: AiConsent;
  setAiConsent: (c: AiConsent) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      theme: 'dark',
      setTheme: (theme) => set({ theme }),

      navOpen: false,
      setNavOpen: (navOpen) => set({ navOpen }),

      lastViewedTripId: null,
      setLastViewedTripId: (lastViewedTripId) => set({ lastViewedTripId }),

      // not in persist partialize below — resets on reload
      syncStatus: 'idle',
      setSyncStatus: (syncStatus) => set({ syncStatus }),

      backupNudgeDismissedAt: null,
      dismissBackupNudge: () =>
        set({ backupNudgeDismissedAt: new Date().toISOString() }),

      syncEnabled: false,
      setSyncEnabled: (syncEnabled) => set({ syncEnabled }),

      aiConsent: { enabled: false, provider: 'none' },
      setAiConsent: (aiConsent) => set({ aiConsent }),
    }),
    {
      name: 'nomadvault-ui',
      partialize: (state) => ({
        theme: state.theme,
        lastViewedTripId: state.lastViewedTripId,
        backupNudgeDismissedAt: state.backupNudgeDismissedAt,
        syncEnabled: state.syncEnabled,
        aiConsent: state.aiConsent,
      }),
    },
  ),
);
