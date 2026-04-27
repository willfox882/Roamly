/**
 * SQLite fallback driver. Used when SUPABASE_URL is not set.
 * better-sqlite3 is a native module — requires compilation.
 * If unavailable (no Visual Studio on Windows), DB operations return empty results
 * gracefully rather than crashing; the client falls back to Dexie.
 */
import path from 'path';
import fs from 'fs';
import type { Trip, Event, BucketPin, Exclusion } from '@/lib/schema';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DbRow {
  [key: string]: unknown;
}

// Minimal surface that mirrors Supabase client shape used by route handlers
export interface DbClient {
  queryAll<T = DbRow>(sql: string, params?: unknown[]): T[];
  queryOne<T = DbRow>(sql: string, params?: unknown[]): T | null;
  run(sql: string, params?: unknown[]): { changes: number; lastInsertRowid: number | bigint };
  transaction<T>(fn: () => T): T;
}

// ── Lazy init ─────────────────────────────────────────────────────────────────

let _db: DbClient | null = null;

function noop(): DbClient {
  // reason: stub when better-sqlite3 native binary unavailable (e.g. no Visual Studio on Windows dev)
  return {
    queryAll:    () => [],
    queryOne:    () => null,
    run:         () => ({ changes: 0, lastInsertRowid: 0 }),
    transaction: (fn) => fn(),
  };
}

export function getDb(): DbClient {
  if (_db) return _db;

  const dbPath = process.env['SQLITE_PATH'] ?? path.join(process.cwd(), 'tmp', 'nomadvault.db');

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3') as typeof import('better-sqlite3');
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const raw = new Database(dbPath);

    _db = {
      queryAll<T = DbRow>(sql: string, params: unknown[] = []): T[] {
        return raw.prepare(sql).all(...params) as T[];
      },
      queryOne<T = DbRow>(sql: string, params: unknown[] = []): T | null {
        return (raw.prepare(sql).get(...params) as T) ?? null;
      },
      run(sql: string, params: unknown[] = []) {
        const stmt = raw.prepare(sql);
        return stmt.run(...params) as { changes: number; lastInsertRowid: number | bigint };
      },
      transaction<T>(fn: () => T): T {
        return raw.transaction(fn)();
      },
    };

    ensureMigrated(_db);
    return _db;
  } catch {
    // Native binary not available — return no-op so routes fail gracefully
    _db = noop();
    return _db;
  }
}

// ── Migrations ────────────────────────────────────────────────────────────────

let _migrated = false;

export function ensureMigrated(db?: DbClient): void {
  if (_migrated) return;
  const client = db ?? getDb();

  // Extract and run the --SQLITE: block from migrations.sql
  const sqlPath = path.join(__dirname, 'migrations.sql');
  if (!fs.existsSync(sqlPath)) return;

  const raw = fs.readFileSync(sqlPath, 'utf8');
  const sqliteBlock = raw
    .split('\n')
    .filter((line) => line.startsWith('-- CREATE TABLE') || line.startsWith('-- CREATE INDEX'))
    .map((line) => line.replace(/^-- /, ''));

  for (const stmt of sqliteBlock) {
    try { client.run(stmt); } catch { /* ignore already-exists errors */ }
  }

  _migrated = true;
}

// ── Query helpers (mirrors Supabase client surface) ───────────────────────────

export function tripsRepo() {
  const db = getDb();
  return {
    findAll(userId: string): Trip[] {
      const rows = db.queryAll<Record<string, unknown>>(
        'SELECT * FROM trips WHERE user_id = ? ORDER BY start_date',
        [userId],
      );
      return rows.map(rowToTrip);
    },
    findModifiedSince(since: string): Trip[] {
      const rows = db.queryAll<Record<string, unknown>>(
        'SELECT * FROM trips WHERE last_modified_at > ? ORDER BY last_modified_at',
        [since],
      );
      return rows.map(rowToTrip);
    },
    findById(id: string): Trip | null {
      const row = db.queryOne<Record<string, unknown>>('SELECT * FROM trips WHERE id = ?', [id]);
      return row ? rowToTrip(row) : null;
    },
    upsert(trip: Trip): Trip {
      db.run(
        `INSERT INTO trips (id,user_id,title,start_date,end_date,timezone,notes,data_version,origin,created_at,last_modified_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET
           title=excluded.title, start_date=excluded.start_date, end_date=excluded.end_date,
           timezone=excluded.timezone, notes=excluded.notes, last_modified_at=excluded.last_modified_at`,
        [trip.id, trip.userId, trip.title, trip.startDate, trip.endDate, trip.timezone,
         trip.notes ?? null, trip.dataVersion, trip.origin, trip.createdAt, trip.lastModifiedAt],
      );
      return trip;
    },
    delete(id: string): void {
      db.run('DELETE FROM trips WHERE id = ?', [id]);
    },
  };
}

export function eventsRepo() {
  const db = getDb();
  return {
    findByTrip(tripId: string): Event[] {
      const rows = db.queryAll<Record<string, unknown>>(
        'SELECT * FROM events WHERE trip_id = ? ORDER BY start_datetime',
        [tripId],
      );
      return rows.map(rowToEvent);
    },
    findModifiedSince(since: string): Event[] {
      const rows = db.queryAll<Record<string, unknown>>(
        'SELECT * FROM events WHERE last_modified_at > ? ORDER BY last_modified_at',
        [since],
      );
      return rows.map(rowToEvent);
    },
    findById(id: string): Event | null {
      const row = db.queryOne<Record<string, unknown>>('SELECT * FROM events WHERE id = ?', [id]);
      return row ? rowToEvent(row) : null;
    },
    upsert(ev: Event): Event {
      db.run(
        `INSERT INTO events (id,trip_id,user_id,type,start_datetime,end_datetime,timezone,
          location_name,lat,lng,provider,confirmation_number,pnr,raw_source_json,parsed_json,
          confidence,status,origin,data_version,created_at,last_modified_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET
           type=excluded.type, start_datetime=excluded.start_datetime,
           end_datetime=excluded.end_datetime, location_name=excluded.location_name,
           lat=excluded.lat, lng=excluded.lng, provider=excluded.provider,
           confirmation_number=excluded.confirmation_number, pnr=excluded.pnr,
           confidence=excluded.confidence, status=excluded.status,
           last_modified_at=excluded.last_modified_at`,
        [ev.id, ev.tripId, ev.userId, ev.type, ev.startDatetime, ev.endDatetime, ev.timezone,
         ev.locationName, ev.lat, ev.lng, ev.provider, ev.confirmationNumber, ev.pnr,
         ev.rawSourceJson ? JSON.stringify(ev.rawSourceJson) : null,
         ev.parsedJson   ? JSON.stringify(ev.parsedJson)    : null,
         ev.confidence, ev.status, ev.origin, 1, ev.createdAt, ev.lastModifiedAt],
      );
      return ev;
    },
    delete(id: string): void {
      db.run('DELETE FROM events WHERE id = ?', [id]);
    },
  };
}

// ── Row mappers ───────────────────────────────────────────────────────────────

function str(v: unknown): string { return String(v ?? ''); }
function num(v: unknown): number { return Number(v ?? 0); }
function nullStr(v: unknown): string | null { return v == null ? null : String(v); }
function nullNum(v: unknown): number | null { return v == null ? null : Number(v); }
function bool(v: unknown): boolean { return !!v; }

function rowToTrip(row: Record<string, unknown>): Trip {
  return {
    id:             str(row['id']),
    userId:         str(row['user_id']),
    title:          str(row['title']),
    startDate:      str(row['start_date']),
    endDate:        str(row['end_date']),
    timezone:       str(row['timezone']),
    notes:          nullStr(row['notes']) ?? undefined,
    dataVersion:    num(row['data_version']),
    createdAt:      str(row['created_at']),
    lastModifiedAt: str(row['last_modified_at']),
    origin:         (str(row['origin']) as Trip['origin']),
  };
}

function rowToEvent(row: Record<string, unknown>): Event {
  return {
    id:                 str(row['id']),
    tripId:             str(row['trip_id']),
    userId:             str(row['user_id']),
    type:               str(row['type']) as Event['type'],
    startDatetime:      nullStr(row['start_datetime']),
    endDatetime:        nullStr(row['end_datetime']),
    timezone:           nullStr(row['timezone']),
    locationName:       nullStr(row['location_name']),
    lat:                nullNum(row['lat']),
    lng:                nullNum(row['lng']),
    provider:           nullStr(row['provider']),
    confirmationNumber: nullStr(row['confirmation_number']),
    pnr:                nullStr(row['pnr']),
    rawSourceJson:      row['raw_source_json'] ? JSON.parse(str(row['raw_source_json'])) : null,
    parsedJson:         row['parsed_json']   ? JSON.parse(str(row['parsed_json']))   : null,
    confidence:         num(row['confidence']),
    status:             str(row['status']) as Event['status'],
    createdAt:          str(row['created_at']),
    lastModifiedAt:     str(row['last_modified_at']),
    origin:             str(row['origin']) as Event['origin'],
  };
}

// keep TypeScript happy with unused imports
void ((_b: BucketPin, _e: Exclusion) => {}) as unknown;
