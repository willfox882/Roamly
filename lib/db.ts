import Dexie, { type Table } from 'dexie';
import { v4 as uuidv4 } from 'uuid';
import type {
  Trip,
  Event,
  BucketPin,
  Exclusion,
  Attachment,
  ChangelogEntry,
  BackupMeta,
  BackupBundle,
  ImportReport,
  ConflictDescriptor,
} from '@/lib/schema';

// ── Supplementary table types ─────────────────────────────────────────────────

interface GeocodeCache {
  query: string;
  lat: number;
  lng: number;
  name: string;
  country: string;
  cachedAt: string;
}

interface AiCache {
  promptHash: string;
  result: unknown;
  cachedAt: string;
}

interface TileCache {
  z: number;
  x: number;
  y: number;
  data: ArrayBuffer;
  lastUsedAt: string;
}

interface Snapshot {
  id: string;
  createdAt: string;
  reason: string;
  bundle: BackupBundle;
}

// ── Dexie class ───────────────────────────────────────────────────────────────

class NomadVaultDB extends Dexie {
  trips!: Table<Trip, string>;
  events!: Table<Event, string>;
  bucketPins!: Table<BucketPin, string>;
  exclusions!: Table<Exclusion, string>;
  attachments!: Table<Attachment, string>;
  changelog!: Table<ChangelogEntry, string>;
  backupsMeta!: Table<BackupMeta, string>;
  snapshots!: Table<Snapshot, string>;
  geocodeCache!: Table<GeocodeCache, string>;
  aiCache!: Table<AiCache, string>;
  tiles!: Table<TileCache, [number, number, number]>;

  constructor() {
    super('nomadvault');

    this.version(1).stores({
      trips: 'id, userId, startDate, lastModifiedAt',
      events: 'id, tripId, userId, type, startDatetime, lastModifiedAt',
      bucketPins: 'id, userId, country, completed',
      exclusions: 'id, userId',
      attachments: 'id, eventId',
      changelog: 'id, recordType, recordId, ts, origin',
      backupsMeta: 'id, createdAt, destination',
      snapshots: 'id, createdAt',
      geocodeCache: 'query, cachedAt',
      aiCache: 'promptHash, cachedAt',
      tiles: '[z+x+y], lastUsedAt',
    });
  }
}

export const db = new NomadVaultDB();

// ── Changelog helper ──────────────────────────────────────────────────────────

export async function recordChange(
  entry: Omit<ChangelogEntry, 'id' | 'ts'>,
): Promise<void> {
  await db.changelog.add({
    ...entry,
    id: uuidv4(),
    ts: new Date().toISOString(),
  });
}

// ── Upsert helpers (always record changelog) ──────────────────────────────────

export async function upsertTrip(trip: Trip): Promise<void> {
  const existing = await db.trips.get(trip.id);
  await db.trips.put(trip);
  await recordChange({
    recordType: 'trips',
    recordId: trip.id,
    op: existing ? 'update' : 'create',
    origin: trip.origin,
  });
}

export async function upsertEvent(event: Event): Promise<void> {
  const existing = await db.events.get(event.id);
  await db.events.put(event);
  await recordChange({
    recordType: 'events',
    recordId: event.id,
    op: existing ? 'update' : 'create',
    origin: event.origin,
  });
}

export async function upsertBucketPin(pin: BucketPin): Promise<void> {
  const existing = await db.bucketPins.get(pin.id);
  await db.bucketPins.put(pin);
  await recordChange({
    recordType: 'bucketPins',
    recordId: pin.id,
    op: existing ? 'update' : 'create',
    origin: pin.origin,
  });
}

export async function upsertExclusion(exclusion: Exclusion): Promise<void> {
  const existing = await db.exclusions.get(exclusion.id);
  await db.exclusions.put(exclusion);
  await recordChange({
    recordType: 'exclusions',
    recordId: exclusion.id,
    op: existing ? 'update' : 'create',
    origin: exclusion.origin,
  });
}

// ── Soft delete (marks as deleted in changelog; removes from primary table) ───

export async function softDelete(
  table: 'trips' | 'events' | 'bucketPins' | 'exclusions',
  id: string,
): Promise<void> {
  await db[table].delete(id);
  await recordChange({
    recordType: table,
    recordId: id,
    op: 'delete',
    origin: 'local',
  });
}

// ── Sync helpers ──────────────────────────────────────────────────────────────

export async function getChangesSince(ts: string): Promise<ChangelogEntry[]> {
  return db.changelog.where('ts').above(ts).sortBy('ts');
}

type TableKey = 'trips' | 'events' | 'bucketPins' | 'exclusions';
type TableRecord = Trip | Event | BucketPin | Exclusion;

function hasLastModifiedAt(r: unknown): r is { lastModifiedAt: string } {
  return (
    typeof r === 'object' &&
    r !== null &&
    'lastModifiedAt' in r &&
    typeof (r as Record<string, unknown>)['lastModifiedAt'] === 'string'
  );
}

export async function applyRemoteRecords(
  records: Partial<Record<TableKey, TableRecord[]>>,
): Promise<ConflictDescriptor[]> {
  const conflicts: ConflictDescriptor[] = [];

  for (const [tableKey, rows] of Object.entries(records) as [
    TableKey,
    TableRecord[],
  ][]) {
    if (!rows) continue;
    for (const remote of rows) {
      const local = await (db[tableKey] as Table<TableRecord, string>).get(
        (remote as { id: string }).id,
      );

      if (!local) {
        await (db[tableKey] as Table<TableRecord, string>).put(remote);
        await recordChange({
          recordType: tableKey,
          recordId: (remote as { id: string }).id,
          op: 'create',
          origin: 'remote',
        });
        continue;
      }

      // LWW: take whichever has a later lastModifiedAt
      if (
        hasLastModifiedAt(remote) &&
        hasLastModifiedAt(local) &&
        remote.lastModifiedAt > local.lastModifiedAt
      ) {
        await (db[tableKey] as Table<TableRecord, string>).put(remote);
        await recordChange({
          recordType: tableKey,
          recordId: (remote as { id: string }).id,
          op: 'update',
          origin: 'remote',
        });
      } else if (
        hasLastModifiedAt(remote) &&
        hasLastModifiedAt(local) &&
        remote.lastModifiedAt < local.lastModifiedAt
      ) {
        // local wins — surface as conflict descriptor for UI
        conflicts.push({
          recordType: tableKey,
          id: (remote as { id: string }).id,
          localVersion: local as Record<string, unknown>,
          remoteVersion: remote as Record<string, unknown>,
          fields: [],
        });
      }
    }
  }

  return conflicts;
}

// ── Export / Import ───────────────────────────────────────────────────────────

export async function readBundle(): Promise<BackupBundle> {
  const [trips, events, bucketPins, exclusions, attachments, changelog, backupsMeta] =
    await Promise.all([
      db.trips.toArray(),
      db.events.toArray(),
      db.bucketPins.toArray(),
      db.exclusions.toArray(),
      db.attachments.toArray(),
      db.changelog.toArray(),
      db.backupsMeta.toArray(),
    ]);

  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    app: 'NomadVault',
    records: {
      trips,
      events,
      bucketPins,
      exclusions,
      attachments,
      changelog,
      backupsMeta,
    },
  };
}

export async function writeBundle(
  bundle: BackupBundle,
  mode: 'merge' | 'overwrite',
): Promise<ImportReport> {
  let added = 0;
  let replaced = 0;
  let skipped = 0;

  if (mode === 'overwrite') {
    await wipeAll();
  }

  const tables: (keyof BackupBundle['records'])[] = [
    'trips',
    'events',
    'bucketPins',
    'exclusions',
    'attachments',
    'changelog',
    'backupsMeta',
  ];

  for (const key of tables) {
    const rows = bundle.records[key];
    if (!rows) continue;

    for (const row of rows) {
      const id = (row as { id?: string }).id;
      if (!id) continue;

      if (mode === 'overwrite') {
        await (db[key as TableKey] as Table<unknown, string>).put(row);
        added++;
      } else {
        const existing = await (
          db[key as TableKey] as Table<unknown, string>
        ).get(id);

        if (!existing) {
          await (db[key as TableKey] as Table<unknown, string>).put(row);
          added++;
        } else if (
          hasLastModifiedAt(row) &&
          hasLastModifiedAt(existing) &&
          row.lastModifiedAt > existing.lastModifiedAt
        ) {
          await (db[key as TableKey] as Table<unknown, string>).put(row);
          replaced++;
        } else {
          skipped++;
        }
      }
    }
  }

  return {
    added,
    replaced,
    skipped,
    conflicts: [],
    dryRun: false,
  };
}

// ── Wipe ──────────────────────────────────────────────────────────────────────

export async function wipeAll(): Promise<void> {
  await Promise.all([
    db.trips.clear(),
    db.events.clear(),
    db.bucketPins.clear(),
    db.exclusions.clear(),
    db.attachments.clear(),
    db.changelog.clear(),
    db.backupsMeta.clear(),
    db.geocodeCache.clear(),
    db.aiCache.clear(),
    db.tiles.clear(),
  ]);
}
