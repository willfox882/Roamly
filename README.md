# Roamly

A privacy-first, offline-capable, mobile-first PWA that consolidates personal travel data, shows it on a timeline + map, detects gaps, and surfaces lowkey local recommendations.

## What it does

- **Paste & Parse.** Drop a flight/hotel email in; get a structured event back (regex first, AI optional).
- **Dashboard.** Next-up trip, timeline, gap alerts ("flight without accommodation").
- **Map.** Visited / upcoming / bucket / excluded pins, clustered, offline-cached.
- **Lowkey recs.** Non-touristy suggestions for a location + date range.
- **Bucket list.** Persistent, customizable, filterable by year.
- **Export & restore.** One click, optionally encrypted with your passphrase.
- **Sync (optional).** Encrypted cloud sync — sensitive fields (PNR, confirmation #) never leave your device in plaintext.

## Quickstart

```bash
npm install
cp .env.example .env.local
npm run seed       # populate demo data
npm run dev        # http://localhost:3000
```

## Tests

```bash
npm run lint
npm run typecheck
npm run test        # Jest unit
npm run e2e         # Playwright
```

## Stack

Next.js 14 (App Router) · TypeScript (strict) · Tailwind · Dexie (IndexedDB) · React Query · Zustand · Mapbox/Leaflet · Framer Motion · Lucide · Web Crypto · Workbox · Jest + RTL · Playwright. Optional: Supabase (Postgres + Storage + Auth) or local SQLite fallback.

## AI providers

Set `AI_PROVIDER` in `.env.local`:

| Mode | Behavior | Setup |
| --- | --- | --- |
| `cloud` | Uses Anthropic API for parsing & recs. | `ANTHROPIC_API_KEY=sk-ant-...` |
| `free` | Uses a configured public free endpoint. | `FREE_AI_URL=...`, `FREE_AI_KEY=` (optional) |
| `local` | Calls a local OpenAI-compatible server (llama.cpp / Ollama / LM Studio). | `LOCAL_LLM_URL=http://localhost:8080/v1` |
| `auto` | Tries cloud → free → local → deterministic. | combine the above |
| `none` | Deterministic regex only. | (default) |

The deterministic parser is always available. Setting `AI_PROVIDER=none` is supported and tested.

### Run a local LLM (optional)

```bash
# Example with Ollama
ollama pull llama3.1:8b-instruct
ollama serve            # listens on :11434
# .env.local
AI_PROVIDER=local
LOCAL_LLM_URL=http://localhost:11434/v1
LOCAL_LLM_MODEL=llama3.1:8b-instruct
```

## PWA / iPhone install

1. `npm run build && npm run start`
2. Open the URL on iPhone Safari.
3. Share → Add to Home Screen.
4. Confirm offline reading by toggling Airplane mode and reopening.

## Backup & restore

- **Manual export.** Settings → Backup & Restore → "Export now". Optionally encrypt with a passphrase.
- **Manual import.** Same panel → "Import file". Choose merge / overwrite / dry run.
- **Scheduled.** Settings → Backups → schedule (Off / Daily / Weekly / Monthly), pick destination (download / Supabase / S3 / Google Drive).
- **Restore.** Backups list shows local + remote backups with checksum + size + timestamp. Restore supports full / partial / dry run; a pre-restore snapshot is always created so you can roll back.
- **iPhone caveat.** iOS Safari evicts IndexedDB after ~7 days of inactivity. **Enable scheduled backups.** A nag appears if no backup has happened in N days (configurable).

## Privacy

- Local-first: Dexie (IndexedDB) is the canonical store.
- Sensitive fields (PNR, confirmation #) are AES-GCM-256 encrypted on-device before any remote upload (PBKDF2-SHA256, 250k iters).
- AI usage and cloud sync are **opt-in**, with explicit consent in onboarding.
- `Export my data` and `Delete my data` are first-class actions in Settings.

## Repo layout

```
app/             # Next.js App Router (pages, components, API routes)
lib/             # Client business logic (db, parser, aiClient, backup, crypto, schema)
hooks/           # React hooks (useSync, useOffline, useBackup)
server/          # Server-only code (db, optional workers)
config/prompts/  # Verbatim AI prompt templates
public/          # PWA manifest, icons, service worker
seed/            # Demo data + loader
tests/           # Jest unit + Playwright E2E
design/          # visuals.md (UI reference)
```

## Contributing / extending

Read `CLAUDE.md` and `ARCHITECTURE.md` first. The architecture has hard rules around module boundaries, local-first writes, and encryption that are easy to violate by accident.

## License

Personal project — no license declared yet.
