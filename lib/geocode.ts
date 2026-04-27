import iataTable from '@/lib/data/iata.json';

export interface GeocodeResult {
  lat: number;
  lng: number;
  name: string;
  country: string;
}

type IataEntry = { name: string; city: string; country: string; lat: number; lng: number; tz: string };
const IATA = iataTable as Record<string, IataEntry>;

const CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
let nominatimLastCall = 0;

export async function geocode(query: string): Promise<GeocodeResult | null> {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return null;

  // ── 1. Dexie cache (browser only) ─────────────────────────────────────────
  if (typeof window !== 'undefined') {
    try {
      const { db } = await import('@/lib/db');
      const cached = await db.geocodeCache.get(normalized);
      if (cached) {
        const age = Date.now() - new Date(cached.cachedAt).getTime();
        if (age < CACHE_TTL_MS) {
          return { lat: cached.lat, lng: cached.lng, name: cached.name, country: cached.country };
        }
      }
    } catch {
      // Dexie unavailable (SSR/test) — continue
    }
  }

  let result: GeocodeResult | null = null;

  // ── 2. Mapbox ──────────────────────────────────────────────────────────────
  const token =
    typeof window !== 'undefined'
      ? (window as unknown as Record<string, unknown>)['__NEXT_PUBLIC_MAPBOX_TOKEN__'] ??
        process.env['NEXT_PUBLIC_MAPBOX_TOKEN']
      : process.env['NEXT_PUBLIC_MAPBOX_TOKEN'];

  if (token) {
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${String(token)}&limit=1`;
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as {
          features?: Array<{ center: [number, number]; place_name: string; context?: Array<{ id: string; text: string }> }>;
        };
        const feat = data.features?.[0];
        if (feat) {
          const countryCtx = feat.context?.find((c) => c.id.startsWith('country'));
          result = {
            lat: feat.center[1],
            lng: feat.center[0],
            name: feat.place_name,
            country: countryCtx?.text ?? '',
          };
        }
      }
    } catch {
      // fall through
    }
  }

  // ── 3. Nominatim (1 req/sec) ───────────────────────────────────────────────
  if (!result) {
    const now = Date.now();
    const wait = 1000 - (now - nominatimLastCall);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    nominatimLastCall = Date.now();

    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
      const res = await fetch(url, { headers: { 'User-Agent': 'NomadVault/0.1 (nomadvault.local)' } });
      if (res.ok) {
        const data = (await res.json()) as Array<{ lat: string; lon: string; display_name: string; address?: { country?: string } }>;
        const hit = data[0];
        if (hit) {
          result = {
            lat: parseFloat(hit.lat),
            lng: parseFloat(hit.lon),
            name: hit.display_name,
            country: hit.address?.country ?? '',
          };
        }
      }
    } catch {
      // fall through
    }
  }

  // ── 4. IATA static table ───────────────────────────────────────────────────
  if (!result) {
    const upper = query.trim().toUpperCase();
    const entry = IATA[upper];
    if (entry) {
      result = { lat: entry.lat, lng: entry.lng, name: entry.name, country: entry.country };
    }
  }

  // ── Cache the result ───────────────────────────────────────────────────────
  if (result && typeof window !== 'undefined') {
    try {
      const { db } = await import('@/lib/db');
      await db.geocodeCache.put({
        query: normalized,
        lat: result.lat,
        lng: result.lng,
        name: result.name,
        country: result.country,
        cachedAt: new Date().toISOString(),
      });
    } catch {
      // ignore cache write failures
    }
  }

  return result;
}
