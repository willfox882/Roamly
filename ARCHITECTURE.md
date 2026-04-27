# Roamly — System Architecture

> Authoritative architecture document. Every file in this repo references this for design intent.
> If this document and a stub disagree, **this document wins** — update the stub.
>
> **Branding:** the product is **Roamly**. The legacy name **NomadVault** is preserved
> in storage identifiers (Dexie DB name, localStorage keys, backup-format `app` literal,
> `.nomadvault` file extension, `nomadvault-sync-queue` SW tag). See `CLAUDE.md` § Names.

---

## 1. Mission & Constraints

**Mission.** A privacy-first, offline-capable, mobile-first PWA that consolidates travel data, shows it on a timeline + map, detects gaps, and surfaces lowkey local recommendations. Designed for a single user (multi-user-ready) and to function without any paid AI key.

**Hard constraints (non-negotiable).**
1. **Local-first canonical store.** IndexedDB (Dexie) is the source of truth. Remote sync is *opt-in*.
2. **Privacy by default.** Sensitive fields (PNR, confirmation #, payment refs) are *client-encrypted* before they leave the device.
3. **AI is optional.** Deterministic regex parser + heuristic recommender must produce usable output with zero API keys.
4. **Offline read.** Recent trip data + map tiles cached; PWA installable on iPhone Safari.
5. **One-click export & restore.** User can always walk away with all their data.

**Soft constraints.**
- Single-developer maintainable; no microservice sprawl.
- TypeScript strict; functional React; minimal abstractions.

---

## 2. Stack Decisions

| Concern | Choice | Rationale |
| --- | --- | --- |
| Framework | Next.js 14 (App Router) + TypeScript | Single repo: routes, API handlers, SSR for shell, edge-friendly |
| Styling | Tailwind CSS + custom theme tokens | Apple-style design tokens; small bundle |
| Animation | Framer Motion | Spring + tween, drag, layout transitions |
| Icons | Lucide | Consistent, tree-shakeable |
| State (server) | TanStack Query (React Query) | Cache invalidation, retries, offline replay |
| State (UI) | Zustand | Tiny, no boilerplate, no provider hell |
| Local DB | Dexie (IndexedDB wrapper) | Mature, indexed queries, migrations |
| Map (primary) | Mapbox GL JS | Vector tiles, clustering, performant |
| Map (fallback) | Leaflet + OSM | Works without token |
| Backend (cloud) | Supabase (Postgres + Storage + Auth) | Optional, opt-in |
| Backend (fallback) | Node + better-sqlite3 | Local dev w/o Supabase |
| AI provider | Pluggable: cloud / free / local / deterministic | User picks |
| Crypto | Web Crypto API (AES-GCM, PBKDF2) | Standard, no deps |
| PWA | Workbox-via-next-pwa OR custom SW | Asset cache + runtime cache + tile cache |
| Testing | Jest + RTL (unit), Playwright (E2E) | Single-runner E2E, modern |
| Lint | ESLint + Prettier + tsc --noEmit | Standard |

---

## 3. Top-Level Architecture (data flow)

```
┌────────────────────────────────────────────────────────────────────┐
│                         CLIENT (PWA)                                │
│                                                                     │
│   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐       │
│   │  Pages   │──▶│ Components│──▶│  Hooks   │──▶│  Lib     │       │
│   │  (app/)  │   │           │   │          │   │ (lib/*)  │       │
│   └──────────┘   └──────────┘   └────┬─────┘   └────┬─────┘       │
│                                       │              │              │
│                              ┌────────▼──────────────▼─────────┐    │
│                              │  Dexie (IndexedDB) — CANONICAL  │    │
│                              │  trips, events, bucket,         │    │
│                              │  exclusions, attachments,       │    │
│                              │  changelog, backups_meta        │    │
│                              └────────┬─────────────────────────┘   │
│                                       │                              │
│            ┌──────────────────────────┼──────────────────────────┐  │
│            ▼                          ▼                          ▼  │
│   ┌─────────────┐          ┌─────────────────┐         ┌──────────┐│
│   │ Service     │          │ aiClient        │         │ backup.ts││
│   │ Worker      │          │ (cloud/free/    │         │ (encrypt+││
│   │ (cache+sync)│          │ local/regex)    │         │ upload)  ││
│   └─────┬───────┘          └────────┬────────┘         └────┬─────┘│
│         │                           │                       │       │
└─────────┼───────────────────────────┼───────────────────────┼───────┘
          │                           │                       │
          ▼                           ▼                       ▼
   ┌──────────────┐           ┌──────────────┐        ┌──────────────┐
   │  /api/sync/* │           │ /api/ai/*    │        │ /api/backups/│
   │  (Next API)  │           │ (Next API)   │        │  *           │
   └──────┬───────┘           └──────┬───────┘        └──────┬───────┘
          │                          │                       │
          ▼                          ▼                       ▼
   ┌──────────────┐           ┌──────────────┐        ┌──────────────┐
   │ Supabase /   │           │ Provider     │        │ Supabase     │
   │ SQLite       │           │ (Anthropic / │        │ Storage / S3 │
   │ Postgres     │           │  free / llama│        │ / GDrive     │
   │              │           │  .cpp)       │        │              │
   └──────────────┘           └──────────────┘        └──────────────┘
```

**Write path.** UI → Zustand action → `lib/db.ts` upsert → optimistic React Query cache update → background `useSync` queues a push. All writes record a `changelog` entry (`{recordId, op, ts, origin: 'local'}`).

**Read path.** Component → React Query → first checks Dexie (always), then optionally revalidates against `/api/sync/pull`. UI never blocks on network.

**Parse path.** PasteParseModal → `lib/parser.ts` (regex first; cheap + private) → if low confidence and user enabled AI → `aiClient.parseEmail()` → Zod-validate → present preview → on save, upsert events.

---

## 4. Module Boundaries

```
app/                     # Next.js routes (UI + API handlers). No business logic here.
app/components/          # Pure presentational + small stateful components.
app/api/**/route.ts      # Thin HTTP handlers. Validate w/ Zod, delegate to lib/server/.
lib/                     # Client-side business logic. Imported by app/ and hooks/.
  aiClient.ts              # Provider abstraction. No HTTP details leak out.
  api.ts                   # fetch wrappers for /api/*. Typed.
  db.ts                    # Dexie schema, migrations, query helpers.
  parser.ts                # Deterministic regex parser. Pure functions.
  gapDetector.ts           # Pure: (events, prefs) -> gaps[]
  geocode.ts               # Cached geocoder. Falls back to airport-code table.
  mapUtils.ts              # Pin styling, clustering helpers.
  backup.ts                # Export/import + encryption (Web Crypto).
  crypto.ts                # PBKDF2 + AES-GCM helpers.
  schema.ts                # Zod schemas + inferred TS types. SINGLE SOURCE OF TRUTH.
  store.ts                 # Zustand stores (UI-only state).
hooks/                   # React hooks composing lib/.
server/                  # Server-only code. Cannot be imported by client.
  db/sqlite.ts             # SQLite fallback driver.
  db/migrations.sql        # Postgres + SQLite-compatible DDL.
  workers/parseWorker.ts   # Optional Web Worker for parser hot path.
config/prompts/          # Verbatim prompt templates (.txt). Loaded at runtime by aiClient.
tests/                   # Jest unit tests + Playwright E2E.
seed/                    # Demo data + loader script.
public/                  # PWA manifest, icons, service worker.
```

**Import rules.**
- `app/` may import from `lib/`, `hooks/`, `app/components/`.
- `lib/` may import from `lib/`. **Never** imports from `app/` or `server/`.
- `server/` may import from `lib/schema.ts` only (shared types). Never from `app/`.
- `hooks/` may import from `lib/`.

---

## 5. Data Model

See `lib/schema.ts` for the canonical Zod definitions. SQL DDL in `server/db/migrations.sql`. Both must stay in sync.

**Core types.**

```ts
type ID = string; // uuid

interface Trip {
  id: ID;
  userId: ID;
  title: string;
  startDate: string;        // ISO date
  endDate: string;
  timezone: string;
  notes?: string;
  dataVersion: number;      // schema version, default 1
  createdAt: string;        // ISO
  lastModifiedAt: string;
  origin: 'local' | 'remote' | 'import';
}

type EventType = 'flight' | 'hotel' | 'excursion' | 'transport' | 'reservation' | 'other';

interface Event {
  id: ID;
  tripId: ID;
  userId: ID;
  type: EventType;
  startDatetime: string | null;   // ISO w/ tz
  endDatetime: string | null;
  timezone: string | null;
  locationName: string | null;
  lat: number | null;
  lng: number | null;
  provider: string | null;
  confirmationNumber: string | null;  // ENCRYPTED in remote store
  pnr: string | null;                  // ENCRYPTED in remote store
  rawSourceJson: unknown;              // original parse input
  parsedJson: unknown;                 // structured result
  confidence: number;                  // 0..1
  status: 'confirmed' | 'tentative' | 'needs_review' | 'cancelled';
  createdAt: string;
  lastModifiedAt: string;
  origin: 'local' | 'remote' | 'import';
}

interface BucketPin { id, userId, name, lat, lng, country, priority: 1|2|3, completed: boolean, completedDate?, notes? }
interface Exclusion { id, userId, placeName, lat?, lng?, country?, reason }
interface Attachment { id, eventId, blobKey, mimeType, size, sha256, createdAt }
interface ChangelogEntry { id, recordType, recordId, op: 'create'|'update'|'delete', ts, origin }
interface BackupMeta { id, createdAt, size, sha256, encrypted: boolean, destination, remoteRef? }
```

**Sensitive fields.** `event.confirmationNumber`, `event.pnr`, `event.rawSourceJson` (may contain payment refs).
- In Dexie: stored plaintext (local device).
- In remote sync / backups: AES-GCM encrypted with a key derived from user passphrase via PBKDF2 (SHA-256, 250k iters, random salt per record).

---

## 6. AI Layer

**`aiClient`** lives in `lib/aiClient.ts`. Public surface:

```ts
parseEmail(rawText: string, opts?: { provider?: 'cloud'|'free'|'local'|'auto' }): Promise<ParsedEvent[]>
recommend(input: { lat, lng, startDate, endDate, exclusions, preferences }): Promise<Recommendation[]>
```

**Modes.**
- `cloud`: posts to `/api/ai/parse` or `/api/ai/recommend`. Server holds key (`ANTHROPIC_API_KEY` etc.). Default model: `claude-haiku-4-5-20251001` for parse, `claude-sonnet-4-6` for recommend.
- `free`: routes to a free public endpoint (configured via env). Adds rate-limit handling.
- `local`: HTTP call to user-run llama.cpp server (e.g., `http://localhost:8080/v1/chat/completions`).
- `auto`: try in order `cloud → free → local → deterministic` until one returns valid JSON.

**Always available: deterministic fallback.** `lib/parser.ts` (regex + date parsing + airport code lookup). Returns `confidence ≤ 0.7`.

**Caching.** Wrap aiClient calls in a 24h IndexedDB cache keyed by `sha256(prompt)`. Bypass on user "Re-parse" action.

**Prompt templates.** Loaded verbatim from `/config/prompts/*.txt`. Do not inline into TS — the spec mandates verbatim files.

---

## 7. Sync Protocol

**Push.** `POST /api/sync/push` body: `{ since: ISO, changes: ChangelogEntry[], records: Record<recordType, Record<id, payload>> }`.
- Server: for each entry, apply LWW (compare `lastModifiedAt`).
- Returns: `{ accepted: id[], conflicts: ConflictDescriptor[] }`.

**Pull.** `GET /api/sync/pull?since=ISO` returns `{ records, deletedIds, serverTs }`.

**Conflict.** `ConflictDescriptor = { recordType, id, localVersion, remoteVersion, fields: string[] }`.
Default policy: LWW for scalar fields, manual merge UI for `parsedJson` and `notes`.

**Encryption boundary.** Sync transport itself is HTTPS. *On top of* HTTPS, sensitive fields are pre-encrypted client-side. Server stores the ciphertext blobs and never sees the passphrase.

---

## 8. Backup & Restore (mandatory v1)

### 8.1 Export / Import
- **Export** (`lib/backup.ts::exportAll`):
  1. Read all Dexie tables → assemble `BackupBundle` (versioned: `{ schemaVersion: 1, exportedAt, app: 'NomadVault', records: {...} }`).
  2. Compute SHA-256 of the JSON.
  3. If user provided a passphrase, derive key via PBKDF2 → AES-GCM encrypt the JSON → wrap in envelope `{ alg: 'AES-GCM', kdf: 'PBKDF2-SHA256', iterations, salt, iv, ciphertext, sha256 }`.
  4. Trigger browser download (`.json` or `.nomadvault` for encrypted).

- **Import** (`lib/backup.ts::importBundle`):
  1. Detect envelope → if encrypted, prompt for passphrase → decrypt.
  2. Validate against Zod `BackupBundleSchema`.
  3. Compute diff vs current Dexie → show preview UI: per-record `Add | Replace | Skip`.
  4. User picks merge strategy: `merge` (LWW per record), `overwrite` (replace local entirely), `cancel`.
  5. **Always** create a pre-import snapshot first (export to local Dexie `snapshots` table) so user can roll back.

### 8.2 Scheduled Backups
- Settings: `Off | Daily | Weekly | Monthly`, destination: `Download | Supabase Storage | S3 | Google Drive`.
- Trigger via Service Worker `periodicSync` (where supported) + foreground fallback timer.
- Each scheduled backup is encrypted client-side before upload.
- Local index `backups_meta` records `{id, createdAt, size, sha256, encrypted, destination, remoteRef}`.

### 8.3 Restore
- UI lists backups (local + remote), shows metadata + integrity (recompute SHA-256 after download).
- Restore modes: `Full | Partial (pick trips/pins) | Dry run`.
- Dry run shows the diff against current state, no writes.
- Pre-restore snapshot always created. Rollback = restore from snapshot.

### 8.4 Crypto Details
- Salt: 16 bytes random per export.
- IV: 12 bytes random per encryption.
- KDF: PBKDF2-SHA256, 250,000 iterations.
- Cipher: AES-GCM-256.
- Passphrase rotation: re-encrypt by full export+import path.

---

## 9. Gap Detection

`lib/gapDetector.ts::detectGaps(events: Event[], prefs: UserPrefs): Gap[]`

**Rules (v1).**
1. **Missing accommodation.** For every flight arrival timestamped `T_in city C`, if no `hotel` event covers night-of(`T_in`) in `C`, emit `severity: 'high'`.
2. **Missing return transport.** For a trip with start/end, if last event is not a `flight|transport` returning to home base, emit `severity: 'medium'`.
3. **Missing confirmation.** Excursion with date but `confirmationNumber == null` → `severity: 'low'`.
4. **Overlap conflict.** Two events with overlapping `[start, end)` → `severity: 'medium'`.
5. **Timezone drift.** Departure timezone ≠ arrival timezone + multi-leg reset → flag for review.

Output:
```ts
type Gap = {
  type: 'missing_accommodation' | 'missing_transport' | 'missing_confirmation' | 'overlap' | 'timezone_drift';
  severity: 'low' | 'medium' | 'high';
  message: string;
  relatedEventIds: ID[];
  suggestedActions: Array<{ label: string, actionId: string }>;
};
```

UI: `GapAlert` cards grouped by severity, with quick-add CTAs.

---

## 10. UI / UX System

**Apple-style tokens** (see `tailwind.config.js`):
- Colors: primary `#0A84FF`, accent `#FFD60A`, success `#30D158`, danger `#FF3B30`, surfaceDark `#0B1220`, surfaceLight `#F7F8FA`, muted `#8E8E93`.
- Radius: default `12px`, pill `9999px`.
- Font stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial`.
- Surfaces: glass = `bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/10`.
- Motion: 150–300ms ease, spring for drag.
- Min touch target: 44×44.

**Layout.**
- Mobile: bottom nav with 5 tabs (Home, Map, Add, Bucket, Settings).
- Header: app name + sync status pill + offline indicator.
- Pages render under a `SafeArea` wrapper that respects iOS safe-area insets.

**Pages.**
- `/` Dashboard — next-up trip card, timeline of nearest events, gap alerts, sync status.
- `/map` — full-screen Mapbox/Leaflet, filter chips for pin types, long-press to add bucket pin.
- `/trips/[id]` — trip detail, event timeline, checklist (Flights/Acc/Transport/Insurance/Docs/SIM/Vax), edit & gap panel.
- `/add/parse` — large textarea, Parse, preview JSON (editable), Save.
- `/bucket` — map + list, filter by visited/planned/excluded, timeline slider over years.
- `/settings` — exclusions, AI provider + key, sync toggle, backup config, health, export/import.
- `/onboarding` — welcome, privacy choices, AI consent, optional connectors.

**Dark mode default.** Toggle in Settings; respect `prefers-color-scheme`.

---

## 11. Map Strategy

- **Primary:** Mapbox GL JS with `MAPBOX_TOKEN`. Vector tiles, clustering plugin, custom pin styles.
- **Fallback:** Leaflet + OSM tiles. Auto-engaged when no token.
- **Pin types:** `visited` (green), `upcoming` (blue), `bucket` (gold), `excluded` (grey).
- **Offline tiles:** cache last-N viewed tile bboxes in IndexedDB (`tiles` store, key=`{z}/{x}/{y}`). SW intercepts tile requests and serves from cache when offline.
- **Geocoding:** `lib/geocode.ts` calls Mapbox geocoder if token, else Nominatim (rate-limited), else airport-code table for IATA codes. Cache results 90 days.

---

## 12. PWA & Service Worker

- `public/manifest.json` with name, short_name, icons (192/512), `display: standalone`, `theme_color: #0B1220`, `background_color: #0B1220`.
- iOS meta tags in `app/layout.tsx`: `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-touch-icon` set.
- Service worker (`public/sw.js`):
  - Precache: app shell, fonts, icons.
  - Runtime cache: `/api/sync/pull` (SWR), tiles (cache-first), AI responses (cache-first 24h).
  - `BackgroundSync` queue for `/api/sync/push` and `/api/backups/upload`.
  - `periodicSync` for scheduled backups (where supported).

---

## 13. API Contracts (Next.js Route Handlers)

All under `app/api/*/route.ts`. Each handler:
1. Parses request via Zod.
2. Authenticates (Supabase session or stub local user).
3. Calls a `lib/` or `server/` function.
4. Returns `{ data, error: null }` or `{ data: null, error: { code, message, details } }` with appropriate status.

| Method+Path | Purpose | Body / Query | Response |
| --- | --- | --- | --- |
| POST `/api/auth/magic-link` | request magic link | `{email}` | `{sent:true}` |
| POST `/api/auth/oauth` | OAuth start | `{provider}` | `{url}` |
| GET `/api/trips` | list | — | `Trip[]` |
| POST `/api/trips` | create | `Trip` (no id) | `Trip` |
| GET `/api/trips/:id` | read | — | `Trip` |
| PUT `/api/trips/:id` | update | `Partial<Trip>` | `Trip` |
| DELETE `/api/trips/:id` | delete | — | `{deleted:true}` |
| POST `/api/events/parse` | parse text | `{raw_text}` | `ParsedEvent[]` |
| POST `/api/events` | create | `Event` | `Event` |
| GET `/api/events?trip_id=` | list | — | `Event[]` |
| PUT `/api/events/:id` | update | `Partial<Event>` | `Event` |
| DELETE `/api/events/:id` | delete | — | `{deleted:true}` |
| POST `/api/ai/parse` | AI parse | `{raw_text, provider?}` | `ParsedEvent[]` |
| POST `/api/ai/recommend` | recs | `RecInput` | `Recommendation[]` |
| POST `/api/sync/push` | push changes | `PushBody` | `PushResult` |
| GET `/api/sync/pull?since=` | pull | — | `PullResult` |
| POST `/api/backups/upload` | upload meta | `BackupMeta + ciphertext` | `{id}` |
| GET `/api/backups/list` | list | — | `BackupMeta[]` |
| GET `/api/backups/download/:id` | download | — | `ciphertext` (binary) |
| POST `/api/backups/restore` | server-driven restore | `{backupId, mode}` | `RestoreReport` |

Errors: `{ code: 'BAD_REQUEST'|'UNAUTHORIZED'|'NOT_FOUND'|'CONFLICT'|'AI_PROVIDER_FAILED'|'INTERNAL', message, details? }`.

---

## 14. Testing Strategy

**Unit (Jest + RTL).**
- `tests/parser.test.ts` — multi-sample emails (Air Canada, Marriott, Airbnb, mixed) → assert fields + confidence.
- `tests/gapDetector.test.ts` — accommodation gap, overlap, multi-leg/timezone, no-gap happy path.
- `tests/backupRestore.test.ts` — round-trip export→clear→import; encrypted round-trip with passphrase; tamper detection (bad SHA).
- Component tests for `TimelineCard`, `GapAlert`, `PasteParseModal`, `BackupRestorePanel`.

**E2E (Playwright).**
- `tests/e2e/mainFlow.spec.ts` — paste sample email → parse (regex mode) → save trip → see on dashboard → see on map → trigger gap → fix gap.
- `tests/e2e/backupRestore.spec.ts` — export → wipe IDB → import → verify state matches; encrypted round-trip; dry-run preview.

**CI.** GitHub Actions: `lint → typecheck → unit → build → e2e (headless)`. Backup tests run in sandbox `tmp/` dir.

---

## 15. Seed Data

`seed/seed.json` ships with:
- Trip A: upcoming Tokyo trip with 2 flights, no hotels (triggers gap).
- Trip B: past Lisbon trip, complete + visited pins.
- 6 bucket pins: Patagonia, Faroe Islands, Hokkaido, Namibia, Svalbard, Easter Island.
- 3 exclusions: Las Vegas, Cancún, Phuket (sample reasons).

Loader: `seed/seed.ts` → `npm run seed` → writes to Dexie.

---

## 16. Privacy & Consent

- First-run onboarding: explicit toggles for "Send emails to AI provider for parsing" and "Enable cloud sync".
- Settings page lists every external surface and what it sends.
- `Export my data` and `Delete my data` are first-class actions.
- iPhone PWA storage-eviction warning surfaced in Settings → Health page with recommended action ("set up scheduled backup").

---

## 17. Edge Cases (must be covered)

1. Multi-leg flights crossing midnight + timezone change.
2. Hotels with flexible/unspecified check-in time.
3. Group bookings with multiple passengers — preserve all names.
4. Duplicate confirmations (same PNR across emails) → dedupe by `(provider, pnr)` composite key.
5. Partial parsing (some fields missing) → mark `status: 'needs_review'`, `confidence < 0.6`.
6. Storage quota exceeded → graceful fallback, prompt for export.
7. Encrypted backup wrong passphrase → clear error, no data loss.
8. Restore mid-failure → preserve pre-restore snapshot, surface rollback CTA.

---

## 18. Build & Run

```
npm install
cp .env.example .env.local
npm run seed     # populate Dexie via headless script (or in-browser via /onboarding)
npm run dev      # http://localhost:3000
npm run test
npm run e2e
npm run build && npm run start
```

Switch AI provider: edit `.env.local` → `AI_PROVIDER=cloud|free|local|auto` and supply keys as needed.

---

## 19. Milestones (build order — Sonnet's roadmap)

1. **M1 — Scaffold.** Configs, schema, Dexie, seed, theme, layout shell, bottom nav, dashboard with seed data.
2. **M2 — Static UI.** All pages render with seed data; map shows pins; bucket page works; settings stub.
3. **M3 — Parser.** `lib/parser.ts` deterministic + `/api/events/parse` + `PasteParseModal` + parser tests.
4. **M4 — AI wrapper.** `lib/aiClient.ts` + `/api/ai/*` + recommendation panel + cache + provider switch.
5. **M5 — Sync + gaps.** Changelog, push/pull, conflict UI, gap detector + alerts, E2E happy path.
6. **M6 — Backup & restore.** export/import, encryption, scheduled backups, restore UI, snapshots, tests.
7. **M7 — PWA polish.** manifest, service worker, offline tile cache, iOS meta, install prompts, README runbook.

Each milestone ends with green tests + a working demo.

---

## 20. Open Decisions (deferred)

- Auth provider for v1: Supabase magic link recommended; can stub a local "single-user" mode for v1 demo.
- Mapbox vs Leaflet: ship Leaflet by default, upgrade to Mapbox if token present.
- Local LLM endpoint shape: assume OpenAI-compatible (`/v1/chat/completions`) so llama.cpp / Ollama / LM Studio all work.
- Native wrappers (Capacitor): documented but out of v1 scope.
