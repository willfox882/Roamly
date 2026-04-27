# CLAUDE.md — Repo Guide for Claude

> This file is automatically loaded into every Claude session in this repo. Keep it dense and current.

## What this repo is

Roamly (codename: NomadVault — see "Names" below): a privacy-first, offline-first travel dashboard PWA. Single user, runs on iPhone Safari "Add to Home Screen". Local-first canonical store (IndexedDB via Dexie); optional encrypted cloud sync; AI parsing optional with deterministic fallback.

## Names

The product is **Roamly** in user-facing surfaces (manifest, headers, App Store, docs). The legacy name **NomadVault** survives as a stable identifier in:

- Dexie database name (`new Dexie('nomadvault')` in `lib/db.ts`)
- localStorage / zustand persist keys (`nomadvault-ui`, `nomadvault-backup-*`)
- Backup-format `app` literal (`z.literal('NomadVault')` in `lib/schema.ts`, matched by `seed/seed.json`)
- Backup file extension (`.nomadvault`)
- Service-worker sync tag (`nomadvault-sync-queue`)
- npm package name (`package.json`)
- SQLite filename and Nominatim User-Agent

**Do not rename these.** Changing any of them breaks existing user data, in-flight queued mutations, or backup imports. UI strings and docs use Roamly; storage / wire identifiers stay NomadVault.

## Where to look first

1. **`ARCHITECTURE.md`** — the authoritative design. Read it before doing anything non-trivial.
2. **`FILL_MANIFEST.md`** — per-file specs. When implementing a file, read its entry first.
3. **`SONNET_PROMPT.md`** — the original handoff briefing (kept as a reference contract).
4. **`lib/schema.ts`** — single source of truth for types (Zod + inferred TS). DB DDL must match.

## Hard rules

- **Do not change the public surface of `lib/aiClient.ts` or `lib/db.ts`** without updating ARCHITECTURE.md sections 6 and 5.
- **Do not import `app/` from `lib/` or `server/`.** Module boundaries are enforced (see ARCHITECTURE §4).
- **Encrypt sensitive fields before any remote upload.** `confirmationNumber`, `pnr`, `rawSourceJson` (may contain payment refs). See ARCHITECTURE §5 + §8.4.
- **The app must work with `AI_PROVIDER=none`.** Deterministic regex parser + heuristic recommender are always available.
- **Local-first.** Every write hits Dexie first, sync is best-effort. No UI ever blocks on the network.
- **TypeScript strict.** No `any` without a `// reason:` comment.

## Stack at a glance

Next.js 14 (App Router) · TypeScript · Tailwind · Dexie · React Query · Zustand · Mapbox/Leaflet · Framer Motion · Lucide · Web Crypto · Workbox · Jest + RTL · Playwright.

## Conventions

- Files: `kebab-case` for routes (`add/parse`), `PascalCase.tsx` for components, `camelCase.ts` for lib.
- Imports: absolute via `@/` alias (configured in `tsconfig.json`).
- Errors: lib functions throw typed errors (`AppError extends Error` with `code`); API handlers convert to `{error}` responses.
- Dates: ISO 8601 with timezone in storage. Display via `Intl.DateTimeFormat`. Never store `Date` objects.
- IDs: UUID v4. Generated client-side for local-first.
- Comments: only when *why* is non-obvious. Don't restate the code.

## Commands

```
npm install
npm run dev          # Next dev on :3000
npm run build
npm run start
npm run lint
npm run typecheck
npm run test         # Jest unit
npm run e2e          # Playwright
npm run seed         # populate Dexie with demo data
```

## When adding a feature, in order

1. Update `lib/schema.ts` if data shape changes.
2. Update `server/db/migrations.sql` if remote schema changes (add a new migration, never edit existing).
3. Update `lib/db.ts` Dexie schema (with version bump + migration).
4. Implement the lib logic with unit tests.
5. Wire the API handler (Zod validation in/out).
6. Build the UI.
7. Update ARCHITECTURE.md if a contract changed.

## Things that have bitten people

- iOS Safari aggressively evicts IndexedDB after ~7 days of inactivity. Surface backup nags in Settings. (See ARCHITECTURE §16.)
- Mapbox without a token will silently 401. Always check the token before instantiating.
- Workbox + Next.js: route handlers are not cached by default; runtime cache rules must be added explicitly.
- Dexie migrations are version-numbered; downgrades are not supported. Always bump `db.version()`.
