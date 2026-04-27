# Static data tables

- `iata.json` — minimum 200 major airport codes used by `lib/parser.ts::airportToCoord` and `lib/geocode.ts` fallback.
  Schema: `Record<IATACode, { name: string; city: string; country: string; lat: number; lng: number; tz: string }>`.

Sonnet: ship a curated list. The parser tests will pin a known subset (e.g., YVR, NRT, LAX, JFK, LHR, CDG, FRA, SIN, HND, YYZ).
