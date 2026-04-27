# FILL_MANIFEST.md — Per-File Implementation Spec for Sonnet

> This is your work order. Each entry lists: **what the file is**, **what it must export**, **its invariants/contracts**, and **its dependencies**. Do not improvise contracts; if something is ambiguous, prefer the spec in `ARCHITECTURE.md` and add a one-line note explaining the choice.
>
> **Process per file:**
> 1. Read the stub file (it has a header comment matching this entry).
> 2. Implement to the contract.
> 3. Run `npm run typecheck && npm run lint`. Fix.
> 4. If file has tests in `tests/`, run them. Fix.
> 5. Tick the checkbox here in your final reply.

## Milestone-ordered checklist

### M1 — Scaffold
- [x] `package.json` (already filled — verify) — pinned eslint to ^8.57.0; fixed jest.config.js `setupFilesAfterEach` → `setupFilesAfterEnv`
- [x] `tsconfig.json` (already filled)
- [x] `next.config.js` (already filled)
- [x] `tailwind.config.js` (already filled)
- [x] `postcss.config.js` (already filled)
- [x] `.env.example` (already filled)
- [x] `.gitignore` (already filled)
- [x] `.eslintrc.json` (already filled)
- [x] `.prettierrc` (already filled)
- [x] `app/layout.tsx`
- [x] `app/globals.css`
- [x] `lib/schema.ts`
- [x] `lib/db.ts`
- [x] `lib/store.ts`
- [x] `seed/seed.json`
- [x] `seed/seed.ts`

### M2 — Static UI
- [x] `app/page.tsx` (Dashboard)
- [x] `app/components/Header.tsx`
- [x] `app/components/BottomNav.tsx`
- [x] `app/components/TimelineCard.tsx`
- [x] `app/components/GapAlert.tsx`
- [x] `app/components/MapPin.tsx`
- [x] `app/components/BucketListMap.tsx`
- [x] `app/map/page.tsx`
- [x] `app/trips/[id]/page.tsx`
- [x] `app/bucket/page.tsx`
- [x] `app/settings/page.tsx`
- [x] `app/onboarding/page.tsx`
- [x] `lib/mapUtils.ts`
- [x] `lib/geocode.ts`

### M3 — Parser
- [x] `lib/parser.ts`
- [x] `lib/api.ts`
- [x] `app/add/parse/page.tsx`
- [x] `app/components/PasteParseModal.tsx`
- [x] `app/api/events/parse/route.ts`
- [x] `app/api/events/route.ts`
- [x] `app/api/events/[id]/route.ts`
- [x] `app/api/trips/route.ts`
- [x] `app/api/trips/[id]/route.ts`
- [x] `tests/parser.test.ts`
- [x] `config/prompts/email_parse_system.txt` (already filled)
- [x] `server/db/migrations.sql` (pulled early — needed by trip/event routes)
- [x] `server/db/sqlite.ts` (pulled early — needed by trip/event routes)

### M4 — AI wrapper
- [x] `lib/aiClient.ts`
- [x] `app/api/ai/parse/route.ts`
- [x] `app/api/ai/recommend/route.ts`
- [x] `app/components/RecommendationPanel.tsx`
- [x] `config/prompts/lowkey_recommend_system.txt` (already filled)

### M5 — Sync + gaps
- [x] `lib/gapDetector.ts`
- [x] `hooks/useSync.ts` — fixed syncEnabled tie (was using aiConsent.enabled as proxy)
- [x] `hooks/useOffline.ts`
- [x] `app/api/sync/push/route.ts` — LWW apply via sqlite tripsRepo/eventsRepo
- [x] `app/api/sync/pull/route.ts` — findModifiedSince via updated sqlite repos
- [x] `server/db/migrations.sql`
- [x] `server/db/sqlite.ts` — added findModifiedSince to tripsRepo + eventsRepo
- [x] `tests/gapDetector.test.ts` — 17 table-driven tests covering all 5 rules + happy path + ordering
- [x] `tests/e2e/mainFlow.spec.ts` — onboarding → parse Air Canada email → dashboard → gap alert
- [x] `lib/store.ts` — added syncEnabled/setSyncEnabled field

### M6 — Backup & restore
- [x] `lib/crypto.ts` — AES-GCM-256, PBKDF2-SHA256 250k iters, wrapEnvelope/unwrapEnvelope, constantTimeEqualHex
- [x] `lib/backup.ts` — exportAll, importBundle (merge/overwrite/dry_run/partial), createSnapshot, listLocalBackups, listSnapshots, scheduleBackup, runScheduledBackup, downloadBundle
- [x] `hooks/useBackup.ts` — exportNow, importFile, setSchedule, lastBackupAt, daysSinceLastBackup, nextScheduledAt
- [x] `app/components/BackupRestorePanel.tsx` — status, actions, schedule config, backups list, restore confirm
- [x] `app/components/ExportImportModal.tsx` — export/import tabs, passphrase, mode selector, ImportReport preview
- [x] `app/components/SettingsPanel.tsx` — already implemented
- [x] `app/api/backups/upload/route.ts` — SHA-256 verify, stores to tmp/backups/
- [x] `app/api/backups/list/route.ts` — lists from tmp/backups/
- [x] `app/api/backups/download/[id]/route.ts` — streams binary with X-Backup-SHA256 header
- [x] `app/api/backups/restore/route.ts` — returns ciphertext+meta for client to decrypt+apply
- [x] `tests/backupRestore.test.ts` — plain round-trip, encrypted round-trip, wrong passphrase, tampered ciphertext, dry-run, snapshot, partial restore, listLocalBackups
- [x] `tests/e2e/backupRestore.spec.ts` — export → wipe → import, encrypted wrong passphrase, dry-run preview

### M7 — PWA polish
- [x] `public/manifest.json` (already filled)
- [x] `public/sw.js`
- [x] `app/layout.tsx` (iOS meta tags — complete from M1, verified)
- [x] `README.md` (final pass)
- [x] `design/visuals.md` (final pass)
- [x] `.github/workflows/ci.yml` (already filled — verified)

---

## File specifications

### `lib/schema.ts`
**Purpose.** Single source of truth for all data shapes. Zod schemas → infer TS types.
**Exports.**
- `TripSchema, EventSchema, BucketPinSchema, ExclusionSchema, AttachmentSchema, ChangelogEntrySchema, BackupMetaSchema, BackupBundleSchema, ParsedEventSchema, RecommendationSchema, UserPrefsSchema, GapSchema, ConflictDescriptorSchema`
- Inferred types: `Trip, Event, BucketPin, ...`
- Enums: `EventTypeEnum`, `EventStatusEnum`, `OriginEnum`, `GapSeverityEnum`, `GapTypeEnum`.
**Invariants.** All ISO date strings. All IDs uuid. `confidence` ∈ [0,1]. Status enums are closed.
**Used by.** Everything.

---

### `lib/db.ts`
**Purpose.** Dexie schema, version, migrations, and typed table accessors. Canonical local store.
**Exports.**
- `db` (Dexie instance) with tables: `trips, events, bucketPins, exclusions, attachments, changelog, backupsMeta, snapshots, geocodeCache, aiCache, tiles`.
- Helpers: `upsertTrip(t), upsertEvent(e), softDelete(table, id), recordChange(entry), getChangesSince(ts), wipeAll()`.
**Invariants.** Every mutation appends a `ChangelogEntry`. Indexes on `tripId`, `userId`, `lastModifiedAt`, `lat+lng`.
**Migration policy.** Never edit a previous version block. Bump version + add upgrader.

---

### `lib/parser.ts`
**Purpose.** Deterministic regex/heuristic parser. **No network.** Always available fallback.
**Exports.**
- `parseEmail(rawText: string): ParsedEvent[]`
- `extractDates(text): { iso, tz, raw }[]`
- `extractFlight(text): Partial<ParsedEvent> | null`
- `extractHotel(text): Partial<ParsedEvent> | null`
- `extractPnr(text): string | null`
- `airportToCoord(iata: string): { lat, lng, name } | null` (uses static IATA table embedded as JSON).
**Invariants.** Pure. No `Date.now()` in core (pass `now` as opt arg for tests). Confidence scoring: 0.9 if all key fields present + airline+flight#+date; degrades by missing field.
**Patterns.**
- Flight number: `/\b([A-Z]{2})\s?(\d{1,4})\b/`
- Date: prefer `chrono-node` if dependency added, else regex covering `YYYY-MM-DD`, `Mon DD YYYY`, `DD Mon YYYY`.
- PNR: `/\b(?:PNR|Confirmation|Reservation)[:\s#]+([A-Z0-9]{5,8})\b/i`
- Hotel: keywords `check-in`, `check-out`, `reservation #`.

---

### `lib/aiClient.ts`
**Purpose.** Provider abstraction over Claude / free / local LLM / deterministic fallback.
**Exports.**
- `parseEmail(rawText, opts?: { provider?: 'cloud'|'free'|'local'|'auto'|'none', signal? }): Promise<ParsedEvent[]>`
- `recommend(input: RecInput, opts?): Promise<Recommendation[]>`
- `getProviderInfo(): { mode, model, available: boolean }`
**Behavior.**
- Reads `process.env.AI_PROVIDER` server-side; client calls go through `/api/ai/*` (key never leaves server).
- 24h cache via Dexie `aiCache` keyed by `sha256(prompt)`.
- On any provider failure → next in chain → finally `parser.parseEmail` (returns lower confidence).
- Loads prompt templates from `config/prompts/*.txt` at init.
**Cloud provider.** Anthropic SDK. Default model `claude-haiku-4-5-20251001` for parse, `claude-sonnet-4-6` for recommend. Use prompt caching on the system prompt.
**Local provider.** Assume OpenAI-compatible HTTP at `LOCAL_LLM_URL`.
**Determinism.** `temperature: 0`. Strict JSON output via response prefill (`{`).

---

### `lib/gapDetector.ts`
**Purpose.** Pure rules engine. See ARCHITECTURE §9.
**Exports.** `detectGaps(events: Event[], prefs: UserPrefs): Gap[]`.
**Invariants.** Pure, sortable output (stable order: severity desc, then type, then earliest related event).

---

### `lib/geocode.ts`
**Purpose.** Cached geocoding with provider fallback chain.
**Exports.** `geocode(query: string): Promise<{lat, lng, name, country} | null>`.
**Behavior.** Try Mapbox if `MAPBOX_TOKEN` → Nominatim (1 req/sec) → IATA static table → null. Cache 90 days in Dexie `geocodeCache`.

---

### `lib/mapUtils.ts`
**Purpose.** Pin styling, clustering helpers, bounding box math, "fit to pins" zoom.
**Exports.** `pinStyle(type), clusterPins(pins, zoom), boundsForPins(pins), tileUrlFor(z,x,y)`.

---

### `lib/crypto.ts`
**Purpose.** Web Crypto wrappers for backup/restore + sensitive-field encryption.
**Exports.**
- `deriveKey(passphrase: string, salt: Uint8Array, iterations=250000): Promise<CryptoKey>`
- `encrypt(plaintext: string|Uint8Array, key: CryptoKey): Promise<{iv, ciphertext}>`
- `decrypt({iv, ciphertext}, key): Promise<Uint8Array>`
- `sha256(data): Promise<string>` (hex)
- `randomBytes(n): Uint8Array`
- `wrapEnvelope(plaintext, passphrase): Promise<EncryptedEnvelope>`
- `unwrapEnvelope(env, passphrase): Promise<string>`
**Invariants.** AES-GCM-256, IV=12 bytes, salt=16 bytes, PBKDF2-SHA256, 250k iters. Constant-time comparisons.

---

### `lib/backup.ts`
**Purpose.** Export/import + scheduled backups. See ARCHITECTURE §8.
**Exports.**
- `exportAll(opts?: { passphrase?: string }): Promise<BackupBundle | EncryptedEnvelope>`
- `importBundle(input: BackupBundle | EncryptedEnvelope, opts: { passphrase?: string, mode: 'merge'|'overwrite'|'dry_run' }): Promise<ImportReport>`
- `createSnapshot(reason: string): Promise<BackupMeta>` (writes to local `snapshots` table)
- `listLocalBackups(): Promise<BackupMeta[]>`
- `scheduleBackup(cadence: 'off'|'daily'|'weekly'|'monthly', destination): Promise<void>` (registers periodicSync where supported, else stores schedule and uses foreground timer)
- `runScheduledBackup(): Promise<BackupMeta>` (called by SW or hook)
**Invariants.** Always create pre-import snapshot. Always verify SHA-256 after import. Encrypted envelope MUST embed `kdf, iterations, salt, iv, alg, ciphertext, sha256(plaintext)`.

---

### `lib/api.ts`
**Purpose.** Typed `fetch` wrappers around `/api/*`. Handles offline → enqueue.
**Exports.** `apiClient.trips.list(), .create(), .get(id), .update(id, p), .delete(id)`, similarly for `events, ai, sync, backups`.

---

### `lib/store.ts`
**Purpose.** Zustand stores for *UI state only* (modal open, theme, current trip filter). Never duplicate DB state.
**Exports.** `useUIStore` with slices `theme, navOpen, lastViewedTripId, syncStatus, backupNudgeDismissedAt`.

---

### `hooks/useSync.ts`
**Purpose.** Background sync orchestrator. On mount: pull since last; on interval (30s) + on `online`: push pending. Exposes `{ status, lastSyncAt, pushNow, pullNow }`.

### `hooks/useOffline.ts`
**Purpose.** Online/offline state via `navigator.onLine` + ping heartbeat. Returns `{ online, since }`.

### `hooks/useBackup.ts`
**Purpose.** Wraps `lib/backup.ts` for components. Exposes mutations + `nextScheduledAt`, `lastBackupAt`, `daysSinceLastBackup`.

---

### `app/layout.tsx`
**Purpose.** Root layout. iOS meta tags, theme color, font, providers (React Query, theme), Header + BottomNav slots, SafeArea.
**Important.** Set:
```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<link rel="apple-touch-icon" href="/icons/icon-192.png" />
```

### `app/globals.css`
**Purpose.** Tailwind base + a few CSS vars for safe-area + the glass utility.

### `app/page.tsx` (Dashboard)
**Purpose.** Next-trip card, timeline (TimelineCard list), gap alerts, sync status. Uses `db` directly via React Query.

### `app/map/page.tsx`
**Purpose.** Full-screen map with filter chips. Mapbox if token, else Leaflet. Long-press → add bucket pin (mobile).

### `app/trips/[id]/page.tsx`
**Purpose.** Trip detail: events timeline, checklist, GapAlert panel, edit affordances.

### `app/add/parse/page.tsx`
**Purpose.** Hosts `PasteParseModal` content as a full page on mobile. Uses `lib/parser.ts` first; if user enabled AI, calls `lib/aiClient.ts`.

### `app/bucket/page.tsx`
**Purpose.** Bucket list map + list with filters and a year-slider.

### `app/settings/page.tsx`
**Purpose.** Sections: Account, AI provider, Sync, Backups, Exclusions, Privacy, Health, Export/Import, Danger zone.

### `app/onboarding/page.tsx`
**Purpose.** First-run flow. Privacy choices, AI consent, optional connectors.

---

### Components (`app/components/*`)

- **`Header.tsx`** — app name, sync pill (Idle/Syncing/Error/LastSyncedAt), offline indicator. Glass surface.
- **`BottomNav.tsx`** — 5 tabs: Home, Map, Add (center, primary pill), Bucket, Settings. Active state w/ Framer.
- **`TimelineCard.tsx`** — props: `event: Event`, shows icon, title, datetime, location, confidence badge, edit button. Mini map thumbnail for events with coords.
- **`GapAlert.tsx`** — props: `gap: Gap`, severity styling, suggestedActions buttons.
- **`PasteParseModal.tsx`** — textarea → parse → editable JSON preview → save. Pure controlled component; parsing handler injected via prop.
- **`RecommendationPanel.tsx`** — fetches via `aiClient.recommend`, lists cards with "Add to trip" CTA.
- **`MapPin.tsx`** — typed pin renderer (visited/upcoming/bucket/excluded).
- **`BucketListMap.tsx`** — clustered map + year slider + list view toggle.
- **`SettingsPanel.tsx`** — reusable settings group.
- **`ExportImportModal.tsx`** — passphrase prompt, file picker, mode selector (merge/overwrite/dry-run), preview diff.
- **`BackupRestorePanel.tsx`** — list backups, create backup, restore, schedule config, health stats.

---

### API route handlers (`app/api/**/route.ts`)

Each follows: Zod-validate → auth → call lib/server → return `{data}` or `{error}`. See ARCHITECTURE §13 for the contracts.

- `auth/magic-link/route.ts` — Supabase magic link if configured, else stub returns `{sent:true}`.
- `trips/route.ts` — GET list, POST create.
- `trips/[id]/route.ts` — GET/PUT/DELETE.
- `events/route.ts` — GET (filter `trip_id`), POST.
- `events/[id]/route.ts` — PUT/DELETE.
- `events/parse/route.ts` — `{raw_text}` → tries `aiClient.parseEmail` (mode `auto`).
- `ai/parse/route.ts` — direct AI call (server-side key).
- `ai/recommend/route.ts` — direct recommend.
- `sync/push/route.ts` — accepts `PushBody`, applies LWW, returns `{accepted, conflicts}`.
- `sync/pull/route.ts` — `?since=` returns `{records, deletedIds, serverTs}`.
- `backups/upload/route.ts` — accepts encrypted blob + meta; stores in Supabase Storage or local fs.
- `backups/list/route.ts` — list user's backups.
- `backups/download/[id]/route.ts` — stream ciphertext.
- `backups/restore/route.ts` — server-driven restore (returns bundle for client to apply).

---

### Server (`server/*`)

- **`server/db/migrations.sql`** — Postgres-flavored DDL + migration markers. Begin with `001_initial.sql` content. Compatible with SQLite where possible (else use a `--sqlite:` block).
- **`server/db/sqlite.ts`** — `better-sqlite3` connection + helper queries (used when `SUPABASE_URL` unset). Mirrors the same surface as the Supabase client.
- **`server/workers/parseWorker.ts`** — optional Web Worker hosting `lib/parser.ts` for hot paths. Implement only if M3 leaves time.

---

### Tests

- **`tests/parser.test.ts`** — fixtures in `tests/fixtures/emails/*.txt` (3+ samples). Assertions on parsed fields and confidence ranges.
- **`tests/gapDetector.test.ts`** — table-driven cases covering all 5 rules + happy path.
- **`tests/backupRestore.test.ts`** — round-trip plain + encrypted; tampered ciphertext; wrong passphrase; partial restore; dry-run report shape.
- **`tests/e2e/mainFlow.spec.ts`** — full user flow.
- **`tests/e2e/backupRestore.spec.ts`** — export → wipe → import → assert.

---

### Public PWA

- **`public/manifest.json`** — already filled.
- **`public/sw.js`** — Workbox-style: precache shell, cache-first for tiles, SWR for `/api/sync/pull`, BackgroundSync queue for push & backups, periodicSync for scheduled backups.

---

### Seed

- **`seed/seed.json`** — see ARCHITECTURE §15.
- **`seed/seed.ts`** — script that opens Dexie (in jsdom or node + fake-indexeddb) and writes seed.json. Also exposes a `runSeedInBrowser()` helper called from `/onboarding`.

---

## Acceptance criteria checklist (run before declaring done)

- [ ] `npm run dev` boots without errors.
- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run test` green.
- [ ] `npm run e2e` green in CI.
- [ ] `POST /api/events/parse` with `tests/fixtures/emails/flight_air_canada.txt` returns `ParsedEvent[]` matching schema.
- [ ] PWA installable on iPhone (manual smoke; document evidence in `design/visuals.md`).
- [ ] Export → wipe → import round-trip preserves all records, by checksum.
- [ ] Encrypted backup with wrong passphrase rejects cleanly with no data loss.
- [ ] App functions with `AI_PROVIDER=none` (deterministic only).

---

## When you finish a milestone

Reply to the user with:
1. List of files implemented (tick boxes here).
2. Test results.
3. Any contract changes (and the matching ARCHITECTURE.md edit).
4. The next milestone you'll start.
