/**
 * Backup / restore unit tests. Runs in jsdom with fake-indexeddb.
 * Uses a low iteration count (1000) for PBKDF2 to keep tests fast.
 */
import { wrapEnvelope, unwrapEnvelope } from '@/lib/crypto';
import { importBundle, createSnapshot, listLocalBackups, listSnapshots, exportAll } from '@/lib/backup';
import { readBundle, writeBundle, wipeAll, upsertTrip, upsertEvent } from '@/lib/db';
import type { Trip, Event } from '@/lib/schema';
import { v4 as uuidv4 } from 'uuid';

const LOW_ITER = 1000;
const PASSPHRASE = 'correct horse battery staple';
const USER = '00000000-0000-4000-a000-000000000001';
const TRIP_ID = '00000000-0000-4000-a000-000000000002';

function makeTrip(overrides: Partial<Trip> = {}): Trip {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    userId: USER,
    title: 'Test Trip',
    startDate: '2026-07-01',
    endDate: '2026-07-15',
    timezone: 'UTC',
    dataVersion: 1,
    createdAt: now,
    lastModifiedAt: now,
    origin: 'local',
    ...overrides,
  };
}

function makeEvent(overrides: Partial<Event> = {}): Event {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    tripId: TRIP_ID,
    userId: USER,
    type: 'flight',
    startDatetime: '2026-07-01T14:30:00-07:00',
    endDatetime: '2026-07-02T17:45:00+09:00',
    timezone: 'JST',
    locationName: 'Tokyo',
    lat: 35.6762,
    lng: 139.6503,
    provider: 'Air Canada',
    confirmationNumber: null,
    pnr: 'ABC123',
    rawSourceJson: null,
    parsedJson: null,
    confidence: 0.9,
    status: 'confirmed',
    createdAt: now,
    lastModifiedAt: now,
    origin: 'local',
    ...overrides,
  };
}

beforeEach(async () => {
  await wipeAll();
});

// ── Crypto layer ──────────────────────────────────────────────────────────────

describe('wrapEnvelope / unwrapEnvelope', () => {
  it('round-trips plaintext', async () => {
    const plain = JSON.stringify({ hello: 'world', n: 42 });
    const env = await wrapEnvelope(plain, PASSPHRASE, LOW_ITER);
    expect(env.alg).toBe('AES-GCM');
    expect(env.kdf).toBe('PBKDF2-SHA256');
    const result = await unwrapEnvelope(env, PASSPHRASE);
    expect(result).toBe(plain);
  });

  it('rejects wrong passphrase', async () => {
    const env = await wrapEnvelope('secret', PASSPHRASE, LOW_ITER);
    await expect(unwrapEnvelope(env, 'wrong passphrase')).rejects.toThrow();
  });

  it('rejects tampered ciphertext (SHA256_MISMATCH or DECRYPT_FAILED)', async () => {
    const env = await wrapEnvelope('secret data', PASSPHRASE, LOW_ITER);
    // flip a character in the middle of the base64 ciphertext
    const tampered = { ...env };
    const mid = Math.floor(env.ciphertext.length / 2);
    const chars = env.ciphertext.split('');
    chars[mid] = chars[mid] === 'A' ? 'B' : 'A';
    tampered.ciphertext = chars.join('');
    await expect(unwrapEnvelope(tampered, PASSPHRASE)).rejects.toThrow();
  });
});

// ── Plain round-trip ──────────────────────────────────────────────────────────

describe('plain backup round-trip', () => {
  it('export → wipeAll → import → records restored', async () => {
    const trip = makeTrip({ id: TRIP_ID });
    const event = makeEvent();
    await upsertTrip(trip);
    await upsertEvent(event);

    const bundle = await readBundle();
    expect(bundle.records.trips).toHaveLength(1);
    expect(bundle.records.events).toHaveLength(1);

    await wipeAll();
    expect((await readBundle()).records.trips).toHaveLength(0);

    const report = await importBundle(bundle, { mode: 'merge' });
    expect(report.dryRun).toBe(false);
    expect(report.added).toBeGreaterThan(0);
    expect(report.snapshotId).toBeDefined();

    const after = await readBundle();
    expect(after.records.trips).toHaveLength(1);
    expect(after.records.trips[0]?.id).toBe(trip.id);
    expect(after.records.events).toHaveLength(1);
  });
});

// ── Encrypted round-trip ──────────────────────────────────────────────────────

describe('encrypted backup round-trip', () => {
  it('encrypts bundle and decrypts on import', async () => {
    const trip = makeTrip({ id: TRIP_ID });
    await upsertTrip(trip);

    const bundle = await readBundle();
    const json = JSON.stringify(bundle);
    const envelope = await wrapEnvelope(json, PASSPHRASE, LOW_ITER);

    await wipeAll();

    const report = await importBundle(envelope, { passphrase: PASSPHRASE, mode: 'merge' });
    expect(report.added).toBeGreaterThan(0);
    const after = await readBundle();
    expect(after.records.trips).toHaveLength(1);
    expect(after.records.trips[0]?.id).toBe(trip.id);
  });

  it('rejects encrypted bundle without passphrase', async () => {
    const envelope = await wrapEnvelope('{}', PASSPHRASE, LOW_ITER);
    await expect(importBundle(envelope, { mode: 'merge' })).rejects.toThrow(/passphrase/i);
  });

  it('rejects encrypted bundle with wrong passphrase — Dexie unchanged', async () => {
    const trip = makeTrip({ id: TRIP_ID });
    await upsertTrip(trip);

    const envelope = await wrapEnvelope(JSON.stringify(await readBundle()), PASSPHRASE, LOW_ITER);
    await wipeAll();

    await expect(importBundle(envelope, { passphrase: 'wrong', mode: 'merge' })).rejects.toThrow();
    // Dexie was wiped before the attempt; assert it's still empty
    expect((await readBundle()).records.trips).toHaveLength(0);
  });
});

// ── Dry run ───────────────────────────────────────────────────────────────────

describe('dry_run mode', () => {
  it('returns a report without writing to Dexie', async () => {
    const trip = makeTrip({ id: TRIP_ID });
    await upsertTrip(trip);
    const bundle = await readBundle();
    await wipeAll();

    const report = await importBundle(bundle, { mode: 'dry_run' });
    expect(report.dryRun).toBe(true);
    expect(report.added).toBeGreaterThan(0);
    expect(report.snapshotId).toBeUndefined();
    // Dexie is still empty
    expect((await readBundle()).records.trips).toHaveLength(0);
  });
});

// ── Snapshot ──────────────────────────────────────────────────────────────────

describe('pre-import snapshot', () => {
  it('createSnapshot stores a bundle in the snapshots table', async () => {
    const trip = makeTrip({ id: TRIP_ID });
    await upsertTrip(trip);

    const meta = await createSnapshot('test-snapshot');
    expect(meta.id).toBeDefined();
    expect(meta.encrypted).toBe(false);

    const snaps = await listSnapshots();
    expect(snaps.length).toBeGreaterThanOrEqual(1);
  });

  it('importBundle (non-dry) creates a pre-import snapshot automatically', async () => {
    const trip = makeTrip({ id: TRIP_ID });
    await upsertTrip(trip);
    const bundle = await readBundle();
    await wipeAll();

    const report = await importBundle(bundle, { mode: 'merge' });
    expect(report.snapshotId).toBeDefined();

    const snaps = await listSnapshots();
    expect(snaps.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Partial restore ───────────────────────────────────────────────────────────

describe('partial restore', () => {
  it('only writes selected tripIds', async () => {
    const trip1 = makeTrip({ id: '00000000-0000-4000-a000-000000000010' });
    const trip2 = makeTrip({ id: '00000000-0000-4000-a000-000000000011' });
    await upsertTrip(trip1);
    await upsertTrip(trip2);

    const bundle = await readBundle();
    await wipeAll();

    const report = await importBundle(bundle, {
      mode: 'merge',
      partial: { tripIds: [trip1.id] },
    });

    const after = await readBundle();
    expect(after.records.trips.map((t) => t.id)).toContain(trip1.id);
    expect(after.records.trips.map((t) => t.id)).not.toContain(trip2.id);
    expect(report.added).toBeGreaterThan(0);
  });
});

// ── listLocalBackups ──────────────────────────────────────────────────────────

describe('listLocalBackups', () => {
  it('returns backups recorded by exportAll (mocking download)', async () => {
    // exportAll calls downloadBundle which tries to create a DOM <a>;
    // in jsdom that's a no-op, so we just verify the meta is stored.
    const trip = makeTrip({ id: TRIP_ID });
    await upsertTrip(trip);

    await exportAll(); // passphrase-less; download is a no-op in jsdom
    const backups = await listLocalBackups();
    expect(backups.length).toBeGreaterThanOrEqual(1);
    expect(backups[0]?.encrypted).toBe(false);
    expect(typeof backups[0]?.sha256).toBe('string');
  });
});
