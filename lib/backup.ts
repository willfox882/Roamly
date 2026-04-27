import { v4 as uuidv4 } from 'uuid';
import type { Table } from 'dexie';
import { db, readBundle, writeBundle, wipeAll } from '@/lib/db';
import { wrapEnvelope, unwrapEnvelope, sha256 } from '@/lib/crypto';
import { BackupBundleSchema, EncryptedEnvelopeSchema } from '@/lib/schema';
import type {
  BackupBundle,
  EncryptedEnvelope,
  BackupMeta,
  ImportReport,
} from '@/lib/schema';

// ── Type guards ───────────────────────────────────────────────────────────────

function isEncryptedEnvelope(input: unknown): input is EncryptedEnvelope {
  return EncryptedEnvelopeSchema.safeParse(input).success;
}

function hasLastModifiedAt(r: unknown): r is { lastModifiedAt: string } {
  return (
    typeof r === 'object' &&
    r !== null &&
    'lastModifiedAt' in r &&
    typeof (r as Record<string, unknown>)['lastModifiedAt'] === 'string'
  );
}

// ── Download helper (browser-only) ───────────────────────────────────────────

export function downloadBundle(
  bundle: BackupBundle | EncryptedEnvelope,
  filename?: string,
): void {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') return;
  const isEnvelope = isEncryptedEnvelope(bundle);
  const name = filename ?? (isEnvelope ? 'nomadvault-backup.nomadvault' : 'nomadvault-backup.json');
  const content = JSON.stringify(bundle);
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Core backup operations ────────────────────────────────────────────────────

export async function exportAll(opts?: {
  passphrase?: string;
}): Promise<BackupBundle | EncryptedEnvelope> {
  const bundle = await readBundle();
  const json = JSON.stringify(bundle);
  const now = new Date().toISOString();

  if (opts?.passphrase) {
    const envelope = await wrapEnvelope(json, opts.passphrase);
    const meta: BackupMeta = {
      id: uuidv4(),
      createdAt: now,
      size: new TextEncoder().encode(json).length,
      sha256: envelope.sha256,
      encrypted: true,
      destination: 'download',
    };
    await db.backupsMeta.put(meta);
    downloadBundle(envelope);
    return envelope;
  }

  const hash = await sha256(json);
  const meta: BackupMeta = {
    id: uuidv4(),
    createdAt: now,
    size: new TextEncoder().encode(json).length,
    sha256: hash,
    encrypted: false,
    destination: 'download',
  };
  await db.backupsMeta.put(meta);
  downloadBundle(bundle);
  return bundle;
}

export async function createSnapshot(reason: string): Promise<BackupMeta> {
  const bundle = await readBundle();
  const json = JSON.stringify(bundle);
  const hash = await sha256(json);
  const id = uuidv4();
  const now = new Date().toISOString();
  await db.snapshots.put({ id, createdAt: now, reason, bundle });
  return {
    id,
    createdAt: now,
    size: new TextEncoder().encode(json).length,
    sha256: hash,
    encrypted: false,
    destination: 'local',
  };
}

export async function listLocalBackups(): Promise<BackupMeta[]> {
  return db.backupsMeta.orderBy('createdAt').reverse().toArray();
}

export async function listSnapshots(): Promise<BackupMeta[]> {
  const snaps = await db.snapshots.orderBy('createdAt').reverse().toArray();
  return Promise.all(
    snaps.map(async (s) => {
      const json = JSON.stringify(s.bundle);
      const hash = await sha256(json);
      return {
        id: s.id,
        createdAt: s.createdAt,
        size: new TextEncoder().encode(json).length,
        sha256: hash,
        encrypted: false,
        destination: 'local' as const,
      };
    }),
  );
}

export async function importBundle(
  input: BackupBundle | EncryptedEnvelope,
  opts: {
    passphrase?: string;
    mode: 'merge' | 'overwrite' | 'dry_run';
    partial?: { tripIds?: string[]; bucketIds?: string[] };
  },
): Promise<ImportReport> {
  let bundle: BackupBundle;

  if (isEncryptedEnvelope(input)) {
    if (!opts.passphrase) throw new Error('Passphrase required for encrypted backup');
    const json = await unwrapEnvelope(input, opts.passphrase);
    const parsed = BackupBundleSchema.safeParse(JSON.parse(json));
    if (!parsed.success) throw new Error('Invalid backup bundle: ' + parsed.error.message);
    bundle = parsed.data;
  } else {
    const parsed = BackupBundleSchema.safeParse(input);
    if (!parsed.success) throw new Error('Invalid backup bundle: ' + parsed.error.message);
    bundle = parsed.data;
  }

  // Apply partial selection filter
  if (opts.partial?.tripIds?.length) {
    const allowedTripIds = new Set(opts.partial.tripIds);
    bundle = {
      ...bundle,
      records: {
        ...bundle.records,
        trips: bundle.records.trips.filter((t) => allowedTripIds.has(t.id)),
        events: bundle.records.events.filter((e) => allowedTripIds.has(e.tripId)),
      },
    };
  }
  if (opts.partial?.bucketIds?.length) {
    const allowed = new Set(opts.partial.bucketIds);
    bundle = {
      ...bundle,
      records: {
        ...bundle.records,
        bucketPins: bundle.records.bucketPins.filter((p) => allowed.has(p.id)),
      },
    };
  }

  if (opts.mode === 'dry_run') {
    return computeDryRunReport(bundle);
  }

  // Pre-import snapshot — always before writes
  const snap = await createSnapshot('pre-import');

  const report = await writeBundle(bundle, opts.mode === 'overwrite' ? 'overwrite' : 'merge');
  return { ...report, snapshotId: snap.id };
}

async function computeDryRunReport(bundle: BackupBundle): Promise<ImportReport> {
  let added = 0;
  let replaced = 0;
  let skipped = 0;

  const tables = ['trips', 'events', 'bucketPins', 'exclusions'] as const;
  for (const key of tables) {
    const rows = bundle.records[key];
    if (!rows) continue;
    for (const row of rows) {
      const id = (row as { id?: string }).id;
      if (!id) continue;
      // reason: dynamic table access; key is constrained to known tables
      const existing = await (db[key] as Table<unknown, string>).get(id);
      if (!existing) {
        added++;
      } else if (
        hasLastModifiedAt(row) &&
        hasLastModifiedAt(existing) &&
        row.lastModifiedAt > existing.lastModifiedAt
      ) {
        replaced++;
      } else {
        skipped++;
      }
    }
  }

  return { added, replaced, skipped, conflicts: [], dryRun: true };
}

export async function scheduleBackup(
  cadence: 'off' | 'daily' | 'weekly' | 'monthly',
  destination: 'download' | 'supabase' | 's3' | 'gdrive',
): Promise<void> {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('nomadvault-backup-cadence', cadence);
    localStorage.setItem('nomadvault-backup-destination', destination);
  }

  if (cadence === 'off' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  const reg = await navigator.serviceWorker.ready;
  if (!('periodicSync' in reg)) return;

  const intervals: Record<string, number> = {
    daily: 86_400_000,
    weekly: 7 * 86_400_000,
    monthly: 30 * 86_400_000,
  };
  // reason: PeriodicSyncManager not in standard TS lib yet
  const sync = (reg as unknown as { periodicSync: { register: (tag: string, opts: { minInterval: number }) => Promise<void> } }).periodicSync;
  await sync.register('nomadvault-scheduled-backup', { minInterval: intervals[cadence] ?? 86_400_000 });
}

export async function runScheduledBackup(): Promise<BackupMeta> {
  const destination =
    typeof localStorage !== 'undefined'
      ? (localStorage.getItem('nomadvault-backup-destination') as BackupMeta['destination'] | null)
      : null;

  const bundle = await readBundle();
  const json = JSON.stringify(bundle);
  const hash = await sha256(json);
  const meta: BackupMeta = {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    size: new TextEncoder().encode(json).length,
    sha256: hash,
    encrypted: false,
    destination: destination ?? 'download',
  };
  await db.backupsMeta.put(meta);

  if (destination === 'download') downloadBundle(bundle);

  return meta;
}

export { wipeAll };
