# GEMINI AUDIT REPORT: Roamly

**Date:** April 27, 2026
**Target:** Roamly Repository
**Scope:** Architecture, UX, Security, Privacy, App Store Readiness, Testing

---

## A. Executive Summary

Roamly exhibits a strong, modern architecture centered on a privacy-first, local-first (IndexedDB/Dexie) paradigm. Recent remediations have successfully stabilized core UX flows: the "Add Trip" flow now prioritizes manual entry, gap alerts correctly handle context-aware routing (`tripId`), the map initialization race condition is resolved, and inline editing empowers users to easily manage trip names.

**Top 5 Risks:**
1.  **Unencrypted Cloud Sync:** If the `/api/sync` endpoints are implemented without client-side E2E encryption (AES-GCM), server compromise exposes all user travel data.
2.  **iOS PWA Storage Eviction:** Apple Safari aggressively clears IndexedDB data if a PWA goes unused for 7 days. Users relying entirely on local storage risk catastrophic data loss without a robust backup/sync mechanism.
3.  **AI Provider PII Leakage:** Pasting confirmation emails sends PII (names, booking refs) to Anthropic. Explicit user consent flows are legally required but currently stubbed.
4.  **Timezone Edge Cases in Gap Detector:** `gapDetector.ts` relies heavily on calendar days (`slice(0,10)`). Flights crossing the International Date Line or timezone boundaries may trigger false gaps.
5.  **App Store Rejection Risks:** Using Capacitor to wrap a PWA requires specific entitlements (`NSLocationWhenInUseUsageDescription`) and a native-feeling UI to avoid "App Design - Minimum Functionality" (Guideline 4.2) rejections.

**Top 5 Recommended Fixes:**
1.  Implement PBKDF2/AES-GCM encryption in `lib/crypto.ts` prior to cloud synchronization.
2.  Add a strict, legally compliant AI Consent Modal before allowing the "Paste Email" function.
3.  Implement Workbox BackgroundSync in `public/sw.js` to ensure offline edits are pushed reliably.
4.  Refactor `gapDetector.ts` to utilize robust timezone libraries (e.g., `date-fns-tz`) for arrival night calculations.
5.  Generate a comprehensive App Store Privacy Manifest (`PrivacyInfo.xcprivacy`) detailing local and remote data usage.

**Estimated Total Effort:** ~40-50 Hours (Medium)

---

## B. Detailed Audit

### 1. Architecture & Data Flow
*   **Findings:** The architecture strictly adheres to a local-first design. `db.ts` acts as the source of truth. Data flows from User -> React State -> Dexie (IndexedDB) -> (Optional) Sync Server.
*   **Risk Level:** Low. The base architecture is highly resilient.
*   **Remediation:** Ensure `dataVersion` migrations are robustly tested to prevent schema downgrade panics.
*   **Effort:** 2 hours.

### 2. Parser & AI Integration
*   **Findings:** The `/api/events/parse` endpoint correctly proxies Anthropic, shielding the API key. Geocoding now fires server-side post-parse, which is excellent. However, there is no timeout on the LLM call.
*   **Risk Level:** Medium. A hanging LLM call will tie up Next.js worker threads (as seen in previous dev server hangs).
*   **Remediation:** Add an `AbortController` to the Anthropic SDK call with a strict 8-second timeout, falling back to regex.
*   **Effort:** 3 hours.

### 3. Gap Detector & Trip Logic
*   **Findings:** Rule 1 (Arrival Night) and Rule 2 (Return Flight) function well for standard trips. However, the reliance on `.slice(0, 10)` for `isoDatetime` assumes UTC dates align with local dates.
*   **Risk Level:** High (Functional). A flight arriving in Tokyo at 01:00 Local Time might have a UTC date of the previous day, breaking accommodation checks.
*   **Remediation:** Pass the destination timezone (derived from `iataTable`) to `nightOf()` to calculate the true local arrival date.
*   **Effort:** 5 hours.

### 4. Map & Bucket List
*   **Findings:** Mapbox and Leaflet components dynamically load and now include a strict `_leaflet_id` guard. Visited country highlighting successfully uses GeoJSON.
*   **Risk Level:** Low.
*   **Remediation:** Cache the downloaded `countries.geojson` via the Service Worker to ensure the map renders highlights offline.
*   **Effort:** 2 hours.

### 5. PWA, Offline & Service Worker
*   **Findings:** The app works offline, but mutations (adding a trip offline) rely entirely on the browser maintaining the sync interval when it comes back online.
*   **Risk Level:** Medium.
*   **Remediation:** Implement Workbox BackgroundSync. Hook IndexedDB mutation events to a sync queue that the SW flushes. Add a user warning about iOS 7-day storage eviction.
*   **Effort:** 6 hours.

### 6. Backup, Sync & Restore
*   **Findings:** Export/Import logic is solid.
*   **Risk Level:** Critical (if cloud sync is deployed without E2EE).
*   **Remediation:** Implement client-side AES-GCM encryption in `lib/crypto.ts` so the server only stores opaque blobs.
*   **Effort:** 8 hours.

### 7. Security & Secrets
*   **Findings:** `.env` variables (`NEXT_PUBLIC_MAPBOX_TOKEN`, `ANTHROPIC_PARSE_MODEL`) are well separated.
*   **Risk Level:** Medium.
*   **Remediation:** Restrict the Mapbox token by HTTP referrer in the Mapbox console to prevent quota theft.
*   **Effort:** 1 hour.

---

## E. Security & Privacy Report

### Threat Model
1.  **Device Theft/Loss:** Since data is local-first, physical device access compromises all travel history. *Mitigation:* App lock (FaceID/TouchID via WebAuthn) for sensitive screens.
2.  **Server Compromise (Cloud Sync):** A breached remote DB could expose user itineraries. *Mitigation:* Zero-knowledge encryption. The server must never possess the decryption key.
3.  **Third-Party Data Leakage:** Parsing emails sends booking PNRs and names to an LLM. *Mitigation:* Explicit consent required. Ephemeral LLM APIs (no data retention for training).

### Data Flow Diagram (Sync)
`User Device (IndexedDB) -> JSON Serialize -> AES-GCM Encrypt(Key) -> HTTPS POST -> Next.js API -> Remote DB (Opaque Blob)`

### Draft Privacy Policy Snippet
> "Roamly is designed with a local-first philosophy. Your travel data, including flight numbers and hotel reservations, lives exclusively on your device within your browser's local storage. If you choose to use our Cloud Sync feature, your data is encrypted on your device using a passphrase only you know before it is transmitted to our servers. We cannot read your travel data. When using the 'Paste Email' parsing feature, the text is temporarily sent to a third-party AI provider (Anthropic) solely for extraction and is not stored or used for training."

---

## F. App Store Readiness Checklist (iOS Capacitor)

To successfully pass Apple's App Review with a wrapped PWA:
*   [ ] **Guideline 4.2 (Minimum Functionality):** The app must feel native. Ensure no text is selectable (unless it's an input), remove web highlighting tap colors (`-webkit-tap-highlight-color: transparent`), and ensure smooth page transitions.
*   [ ] **Guideline 5.1.1 (Data Collection):** Provide a `PrivacyInfo.xcprivacy` manifest. You must disclose the use of UserDefaults/IndexedDB and network access.
*   [ ] **Location Permissions:** Include `NSLocationWhenInUseUsageDescription` in `Info.plist` explaining *why* you need location (e.g., "Roamly uses your location to show your current position on the travel map.").
*   [ ] **Account Deletion:** If users can create an account for Cloud Sync, you MUST provide an in-app "Delete Account" button that immediately purges remote data.
*   [ ] **Offline Capability:** Apple testers will put the device in Airplane mode. Roamly passes this natively, but ensure no infinite loading spinners occur when maps fail to fetch tiles.

---

## G. Testing Plan & CI Changes

**Commands to run locally:**
```bash
# Unit Tests (Fast, no browser required)
npm run test:unit

# E2E Tests (Requires Playwright browsers)
npx playwright install chromium webkit
npm run e2e
```

**CI Workflow Update (GitHub Actions):**
Ensure `.github/workflows/ci.yml` includes a step to cache Playwright browsers to avoid the `ECONNRESET` timeout issues observed during development.

---

## H. UX Recommendations

1.  **Consent Dialog (High Priority):** Before the first AI parse, show a modal: "To magically extract your itinerary, we securely send this text to our AI partner. It is not saved or used for training." [Agree] / [Use Manual Entry].
2.  **Sync Status Clarity (Medium Priority):** The current `SyncPill` is good, but users need to know *what* to do on error. If `status === 'error'`, clicking the pill should open a diagnostic modal (e.g., "Passphrase incorrect" or "Network unreachable").
3.  **iOS Storage Warning (Medium Priority):** Detect iOS Safari standalone mode. If detected, show a one-time toast: "iOS may clear your data if you don't open the app for 7 days. Turn on Cloud Sync or regularly export your data."

---

## I. Implementation Estimates & Timeline

**Total Estimated Time:** 37 Hours (Approx. 1 Two-Week Sprint)

*   **Sprint 1, Week 1 (Security & Core Fixes):**
    *   E2EE Crypto Implementation: 8 hours
    *   Auth & Sync Endpoint Lockdown: 6 hours
    *   AI Consent Modal: 3 hours
*   **Sprint 1, Week 2 (Robustness & Polish):**
    *   Gap Detector Timezone Refactor: 5 hours
    *   BackgroundSync Service Worker: 6 hours
    *   Capacitor iOS Setup: 5 hours
    *   Test Stabilization & CI: 4 hours
