'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useUIStore } from '@/lib/store';

export type SyncStatus = 'idle' | 'syncing' | 'error';

export interface SyncState {
  status: SyncStatus;
  lastSyncAt: string | null;
  pendingChanges: number;
  pushNow: () => Promise<void>;
  pullNow: () => Promise<void>;
}

export function useSync(): SyncState {
  const syncEnabled = useUIStore((s) => s.syncEnabled);
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSyncAtRef = useRef<string | null>(null);

  // Sync ref with state
  useEffect(() => {
    lastSyncAtRef.current = lastSyncAt;
  }, [lastSyncAt]);

  const pullNow = useCallback(async () => {
    if (!syncEnabled) return;
    setStatus('syncing');
    try {
      const since = lastSyncAtRef.current ?? '1970-01-01T00:00:00.000Z';
      const res = await fetch(`/api/sync/pull?since=${encodeURIComponent(since)}`);
      if (!res.ok) throw new Error('pull failed');
      const { data } = (await res.json()) as { data: { records: Record<string, unknown[]>; deletedIds: Record<string, string[]>; serverTs: string } };
      const { applyRemoteRecords } = await import('@/lib/db');
      await applyRemoteRecords(data.records as Parameters<typeof applyRemoteRecords>[0]);
      setLastSyncAt(data.serverTs);
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }, [syncEnabled]);

  const pushNow = useCallback(async () => {
    if (!syncEnabled) return;
    setStatus('syncing');
    try {
      const { getChangesSince, readBundle } = await import('@/lib/db');
      const since = lastSyncAtRef.current ?? '1970-01-01T00:00:00.000Z';
      const changes = await getChangesSince(since);
      if (changes.length === 0) { setStatus('idle'); return; }

      const bundle = await readBundle();
      const records: Record<string, Record<string, unknown>> = {};
      for (const entry of changes) {
        const table = entry.recordType as keyof typeof bundle.records;
        const rows = bundle.records[table];
        if (!Array.isArray(rows)) continue;
        const row = rows.find((r) => (r as { id?: string }).id === entry.recordId);
        if (!row) continue;
        if (!records[table]) records[table] = {};
        records[table][entry.recordId] = row;
      }

      const res = await fetch('/api/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ since, changes, records }),
      });
      if (!res.ok) throw new Error('push failed');
      setLastSyncAt(new Date().toISOString());
      setPendingChanges(0);
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }, [syncEnabled]);

  // Refresh pending count
  useEffect(() => {
    if (!syncEnabled) { setPendingChanges(0); return; }
    void (async () => {
      const { getChangesSince } = await import('@/lib/db');
      const changes = await getChangesSince(lastSyncAt ?? '1970-01-01T00:00:00.000Z');
      setPendingChanges(changes.length);
    })();
  }, [syncEnabled, lastSyncAt]);

  // Pull on mount, then push every 30s when online
  useEffect(() => {
    if (!syncEnabled) return;
    
    // Use fresh refs in the interval/listeners to avoid stale closures
    void pullNow();
    intervalRef.current = setInterval(() => { void pushNow(); }, 30_000);
    const onOnline = () => { void pushNow(); };
    window.addEventListener('online', onOnline);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener('online', onOnline);
    };
  }, [syncEnabled, pullNow, pushNow]);

  return { status, lastSyncAt, pendingChanges, pushNow, pullNow };
}
