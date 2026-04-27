# Roamly - Top 10 Patch Plan & Handoff Pack

This document outlines the immediate next steps for the engineering team (or AI agents like Sonnet/Opus) to harden Roamly for production and App Store release.

## Top 10 Files to Implement/Update Next

1.  **`lib/crypto.ts`**
    *   *Goal:* Implement true E2E encryption for the sync engine.
    *   *Chunking Hint:* Implement `deriveKey(passphrase)` using WebCrypto PBKDF2 first. Then implement `encryptPayload(data, key)` and `decryptPayload(blob, key)` using AES-GCM.
2.  **`app/api/sync/route.ts`**
    *   *Goal:* Lock down the cloud sync endpoint.
    *   *Chunking Hint:* Add middleware for JWT authentication. Add a schema validator to ensure the incoming payload is an opaque encrypted blob, not plaintext.
3.  **`public/sw.js`**
    *   *Goal:* Resilient offline syncing.
    *   *Chunking Hint:* Use Workbox BackgroundSync. Hook into the `sync` event to flush a local IndexedDB queue of mutations to `/api/sync/push`.
4.  **`app/components/ConsentModal.tsx` (New)**
    *   *Goal:* GDPR/Privacy compliance for AI parsing.
    *   *Chunking Hint:* Simple React modal that writes `aiConsent: true` to `useUIStore`. Gate the `handlePasteParse` function behind this.
5.  **`lib/gapDetector.ts`**
    *   *Goal:* Timezone perfection.
    *   *Chunking Hint:* Refactor `nightOf()` to accept a timezone string. Convert UTC `endDatetime` to the destination's local time before calculating the arrival night.
6.  **`app/api/events/parse/route.ts`**
    *   *Goal:* Parser resilience.
    *   *Chunking Hint:* Wrap the Anthropic call in an `AbortController` with a 10s timeout. Add a Zod strict-parse catch block that feeds into the deterministic fallback.
7.  **`capacitor.config.ts` (New)**
    *   *Goal:* iOS Native Wrapper.
    *   *Chunking Hint:* Initialize Capacitor. Set `webDir` to `out` (requires `output: 'export'` in Next config, or using a live server approach).
8.  **`ios/App/App/Info.plist`**
    *   *Goal:* App Store Permissions.
    *   *Chunking Hint:* Add `NSLocationWhenInUseUsageDescription` for the map, and set up App Transport Security (ATS) for local dev.
9.  **`playwright.config.ts`**
    *   *Goal:* CI stability.
    *   *Chunking Hint:* Update `webServer` to wait for a specific HTTP 200 on `/api/health` before starting tests.
10. **`app/settings/page.tsx`**
    *   *Goal:* Data Management.
    *   *Chunking Hint:* Add a "Delete Account & Cloud Data" button that wipes IndexedDB and sends a DELETE to `/api/account`.

## Test Fixtures

### Fixture 1: Standard Flight Email (For `parser.test.ts`)
```text
Your flight is confirmed!
Booking Reference: QWERTY
Flight AC8081
From: Vancouver (YVR)
To: Las Vegas (LAS)
Depart: Oct 24, 2026 08:00 AM
Arrive: Oct 24, 2026 10:30 AM
```

### Expected Output JSON
```json
[
  {
    "type": "flight",
    "startDatetime": "2026-10-24T15:00:00Z", 
    "endDatetime": "2026-10-24T17:30:00Z",
    "provider": "AC8081",
    "confirmationNumber": "QWERTY",
    "parsedJson": { "from": "YVR", "to": "LAS" }
  }
]
```