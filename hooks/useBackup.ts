'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  exportAll,
  importBundle,
  listLocalBackups,
  scheduleBackup,
} from '@/lib/backup';
import { BackupBundleSchema, EncryptedEnvelopeSchema } from '@/lib/schema';
import type { BackupMeta, ImportReport } from '@/lib/schema';

export function useBackup() {
  const [localBackups, setLocalBackups] = useState<BackupMeta[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const backups = await listLocalBackups();
    setLocalBackups(backups);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const lastBackupAt = localBackups[0]?.createdAt ?? null;

  const daysSinceLastBackup = lastBackupAt
    ? Math.floor((Date.now() - new Date(lastBackupAt).getTime()) / 86_400_000)
    : null;

  const getNextScheduledAt = (): string | null => {
    if (!lastBackupAt || typeof localStorage === 'undefined') return null;
    const cadence = localStorage.getItem('nomadvault-backup-cadence');
    if (!cadence || cadence === 'off') return null;
    const ms: Record<string, number> = {
      daily: 86_400_000,
      weekly: 7 * 86_400_000,
      monthly: 30 * 86_400_000,
    };
    const interval = ms[cadence];
    if (!interval) return null;
    return new Date(new Date(lastBackupAt).getTime() + interval).toISOString();
  };

  const exportNow = useCallback(
    async (opts?: { passphrase?: string }) => {
      setLoading(true);
      try {
        await exportAll(opts);
        await refresh();
      } finally {
        setLoading(false);
      }
    },
    [refresh],
  );

  const importFile = useCallback(
    async (
      file: File,
      opts: { passphrase?: string; mode: 'merge' | 'overwrite' | 'dry_run' },
    ): Promise<ImportReport> => {
      setLoading(true);
      try {
        const text = await file.text();
        const parsed = JSON.parse(text) as unknown;

        if (EncryptedEnvelopeSchema.safeParse(parsed).success) {
          const result = await importBundle(parsed as ReturnType<typeof EncryptedEnvelopeSchema.parse>, opts);
          await refresh();
          return result;
        }

        const bundleResult = BackupBundleSchema.safeParse(parsed);
        if (!bundleResult.success) throw new Error('Unrecognised backup file format');
        const result = await importBundle(bundleResult.data, opts);
        await refresh();
        return result;
      } finally {
        setLoading(false);
      }
    },
    [refresh],
  );

  const setSchedule = useCallback(
    async (
      cadence: 'off' | 'daily' | 'weekly' | 'monthly',
      destination: 'download' | 'supabase' | 's3' | 'gdrive',
    ) => {
      await scheduleBackup(cadence, destination);
    },
    [],
  );

  return {
    listLocal: localBackups,
    listRemote: [] as BackupMeta[], // remote listing wired via /api/backups/list
    lastBackupAt,
    daysSinceLastBackup,
    nextScheduledAt: getNextScheduledAt(),
    loading,
    exportNow,
    importFile,
    setSchedule,
    refresh,
  };
}
