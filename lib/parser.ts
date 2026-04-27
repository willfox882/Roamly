import * as chrono from 'chrono-node';
import iataTable from '@/lib/data/iata.json';
import type { ParsedEvent } from '@/lib/schema';

type IataEntry = { name: string; city: string; country: string; lat: number; lng: number; tz: string };
const IATA = iataTable as Record<string, IataEntry>;

// ── City / airport normalization ──────────────────────────────────────────────

/**
 * Resolves an IATA code or raw airport name to a clean city name.
 * - 3-letter IATA code → looks up the city field ("YVR" → "Vancouver")
 * - Full airport name  → strips "International Airport" suffixes
 */
export function normalizeCity(codeOrName: string | null | undefined): string | null {
  if (!codeOrName) return null;
  const trimmed = codeOrName.trim();
  const upper = trimmed.toUpperCase();
  const entry = IATA[upper];
  if (entry?.city) return entry.city;
  // Strip common suffixes from full airport names
  const stripped = trimmed
    .replace(/\s+International(?:\s+Airport)?$/i, '')
    .replace(/\s+Airport$/i, '')
    .trim();
  return stripped || null;
}

/**
 * Derives a human-readable trip title from parsed events.
 * Uses the true first origin and final destination across all real (non-phantom) flights.
 * Falls back to non-flight event locationName, or "New Trip".
 */
export function deriveTripTitle(events: ParsedEvent[]): string {
  const sortedFlights = events
    .filter((e) => e.type === 'flight')
    .sort((a, b) => {
      if (!a.startDatetime) return 1;
      if (!b.startDatetime) return -1;
      return new Date(a.startDatetime).getTime() - new Date(b.startDatetime).getTime();
    });

  // Filter out phantom same-origin-destination flights before building the title
  const realFlights = sortedFlights.filter((e) => {
    const pj = e.parsedJson as { origin?: string; destination?: string } | null;
    return !(pj?.origin && pj.origin === pj?.destination);
  });

  if (realFlights.length > 0) {
    const first = realFlights[0]!;
    const last  = realFlights[realFlights.length - 1]!;
    const pj0 = first.parsedJson as Record<string, unknown> | null;
    const pjN = last.parsedJson  as Record<string, unknown> | null;
    const originCode = typeof pj0?.['origin']      === 'string' ? pj0['origin']      : null;
    const destCode   = typeof pjN?.['destination'] === 'string' ? pjN['destination'] : null;
    const originCity = normalizeCity(originCode);
    const destCity   = normalizeCity(destCode);
    if (originCity && destCity && originCity !== destCity) {
      return `${originCity} → ${destCity}`;
    }
    // Round trip (origin === final destination): find the furthest outbound destination —
    // the last unique city that is not the trip origin, scanning flights in order.
    if (originCity && originCity === destCity) {
      const midCity = [...realFlights].reverse().find((f) => {
        const pj = f.parsedJson as Record<string, unknown> | null;
        const d = typeof pj?.['destination'] === 'string' ? pj['destination'] : null;
        const c = normalizeCity(d);
        return c && c !== originCity;
      });
      if (midCity) {
        const pjM = midCity.parsedJson as Record<string, unknown> | null;
        const midCode = typeof pjM?.['destination'] === 'string' ? pjM['destination'] : null;
        const midCityName = normalizeCity(midCode);
        if (midCityName) return `${originCity} → ${midCityName}`;
      }
    }
    if (first.locationName) return first.locationName;
  }

  // Non-flight events (hotels, reservations) can also inform the title
  const nonFlight = events.find((e) => e.type !== 'flight');
  if (nonFlight?.locationName) return nonFlight.locationName;

  return 'New Trip';
}

// ── Regex patterns ────────────────────────────────────────────────────────────

// Two-letter airline IATA code + 1-4 digits, not preceded by more letters
const FLIGHT_RE = /(?<![A-Z])([A-Z]{2})\s?(\d{1,4})(?!\d)/g;

// Handles "PNR: X", "Confirmation Code: X", "Booking Reference (PNR): X", etc.
const PNR_RE =
  /(?:PNR|Confirmation\s*(?:Code|#|Number)?|Booking\s*(?:Ref(?:erence)?\s*)?(?:\([^)]*\))?|Reservation\s*(?:#|Number)?)[:\s#]+([A-Z0-9]{5,8})\b/gi;

const IATA_CODE_RE = /\b([A-Z]{3})\b/g;

// Colon required so "Check-in opens 24h prior to departure" does NOT match
const HOTEL_CHECKIN_RE  = /check[\s-]?in\s*(?:date|time)?:\s*([^\n\r]+)/i;
const HOTEL_CHECKOUT_RE = /check[\s-]?out\s*(?:date|time)?:\s*([^\n\r]+)/i;

// Known airline codes (subset — enough to avoid false positives on common 2-letter words)
const KNOWN_AIRLINES = new Set([
  'AC','AA','DL','UA','WN','AS','B6','NK','F9','G4','HA','MX',
  'AF','BA','KL','LH','EK','QR','TK','SQ','CX','JL','NH','KE','OZ',
  'QF','EY','WY','MS','AI','ET','SA','TG','MH','CI','BR','GA','PR',
  'IB','VY','U2','FR','W6','TP','LX','AY','SK','OS','LO','OK','AZ',
  'AT','RO','BT','A3','S7','SU','PS','PC','WF','DY','BE','EI',
]);

// ── IATA helper ───────────────────────────────────────────────────────────────

export function airportToCoord(iata: string): { lat: number; lng: number; name: string } | null {
  const entry = IATA[iata.toUpperCase()];
  if (!entry) return null;
  return { lat: entry.lat, lng: entry.lng, name: entry.name };
}

// ── Date extraction ───────────────────────────────────────────────────────────

export function extractDates(
  text: string,
  refDate?: Date,
): Array<{ iso: string; tz: string | null; raw: string }> {
  const results: Array<{ iso: string; tz: string | null; raw: string }> = [];
  const parsed = chrono.parse(text, refDate ?? new Date(), { forwardDate: false });

  for (const result of parsed) {
    const date = result.start.date();
    // Try to detect timezone offset in the surrounding text (±HH:mm, EDT, PST, etc.)
    const surrounding = text.slice(Math.max(0, result.index - 30), result.index + result.text.length + 30);
    const tzMatch = surrounding.match(/([+-]\d{2}:\d{2}|[A-Z]{2,5}(?:[-+]\d+)?)\s*$/);
    const tz = tzMatch?.[1] ?? null;

    let iso: string;
    if (tz && /^[+-]\d{2}:\d{2}$/.test(tz)) {
      iso = date.toISOString().replace('Z', tz);
    } else {
      iso = date.toISOString();
    }

    results.push({ iso, tz, raw: result.text });
  }

  return results;
}

// ── PNR extraction ────────────────────────────────────────────────────────────

export function extractPnr(text: string): string | null {
  PNR_RE.lastIndex = 0;
  const match = PNR_RE.exec(text);
  return match?.[1]?.toUpperCase() ?? null;
}

// ── Flight extraction ─────────────────────────────────────────────────────────

export function extractFlight(text: string, now?: Date): Partial<ParsedEvent> | null {
  FLIGHT_RE.lastIndex = 0;
  const matches = [...text.matchAll(FLIGHT_RE)];
  const flightMatch = matches.find((m) => KNOWN_AIRLINES.has(m[1]!));
  if (!flightMatch) return null;

  const airline = flightMatch[1]!;
  const flightNum = `${airline}${flightMatch[2]}`;

  // Find IATA codes (origin/destination)
  IATA_CODE_RE.lastIndex = 0;
  const iataCodes = [...text.matchAll(IATA_CODE_RE)]
    .map((m) => m[1]!)
    .filter((code) => IATA[code]);

  const origin = iataCodes[0] ?? null;
  const dest   = iataCodes[1] ?? null;

  // Skip phantom self-transfer legs where the parser found the same airport code twice
  if (origin && dest && origin === dest) return null;

  const destCoord = dest ? airportToCoord(dest) : null;

  // Dates
  const dates = extractDates(text, now);
  const startDt = dates[0] ?? null;
  const endDt   = dates[1] ?? null;

  const pnr = extractPnr(text);

  // Provider — look for airline name near the flight number
  const airlineNames: Record<string, string> = {
    AC: 'Air Canada', AA: 'American Airlines', DL: 'Delta Air Lines',
    UA: 'United Airlines', BA: 'British Airways', AF: 'Air France',
    LH: 'Lufthansa', KL: 'KLM', EK: 'Emirates', QR: 'Qatar Airways',
    SQ: 'Singapore Airlines', JL: 'Japan Airlines', NH: 'All Nippon Airways',
    QF: 'Qantas', TK: 'Turkish Airlines', TG: 'Thai Airways',
    TP: 'TAP Air Portugal', IB: 'Iberia',
  };
  const provider = airlineNames[airline] ?? airline;

  // Confidence: start with 0.4, +0.1 per present field
  let confidence = 0.4;
  if (provider)    confidence += 0.1;
  if (flightNum)   confidence += 0.1;
  if (startDt)     confidence += 0.1;
  if (endDt)       confidence += 0.1;
  if (origin && dest) confidence += 0.1;
  if (pnr)         confidence += 0.1;
  confidence = Math.min(confidence, 1.0);

  // Use city names (not full airport names) for human-readable location
  const originCity = origin ? (IATA[origin]?.city ?? origin) : null;
  const destCity   = dest   ? (IATA[dest]?.city   ?? dest)   : null;
  const locationName = (originCity && destCity)
    ? `${originCity} → ${destCity}`
    : destCity ?? (dest ? destCoord?.name ?? dest : null);

  return {
    type: 'flight',
    startDatetime: startDt?.iso ?? null,
    endDatetime:   endDt?.iso  ?? null,
    timezone:      startDt?.tz ?? null,
    locationName,
    lat:  destCoord?.lat ?? null,
    lng:  destCoord?.lng ?? null,
    provider,
    confirmationNumber: flightNum,
    pnr,
    parsedJson: { flightNumber: flightNum, origin, destination: dest },
    confidence,
    status: confidence >= 0.8 ? 'confirmed' : confidence >= 0.6 ? 'tentative' : 'needs_review',
  };
}

// ── Hotel extraction ──────────────────────────────────────────────────────────

export function extractHotel(text: string, now?: Date): Partial<ParsedEvent> | null {
  // Require an explicit hotel brand OR both check-in + check-out date patterns
  const HOTEL_BRANDS_RE =
    /\b(Marriott|Hilton|Hyatt|IHG|Radisson|Best\s*Western|Accor|Wyndham|Holiday\s*Inn|Sheraton|Westin|Renaissance|Ritz[\s-]Carlton|Four\s*Seasons|Intercontinental|Airbnb|VRBO|HomeAway|Booking\.com|Expedia|hotel|resort|inn|lodge)\b/i;
  const hasBrand    = HOTEL_BRANDS_RE.test(text);
  const hasCheckIn  = HOTEL_CHECKIN_RE.test(text);
  const hasCheckOut = HOTEL_CHECKOUT_RE.test(text);
  // Reset lastIndex after test
  HOTEL_CHECKIN_RE.lastIndex  = 0;
  HOTEL_CHECKOUT_RE.lastIndex = 0;

  // Must have a brand name, OR explicitly have both check-in and check-out date lines
  if (!hasBrand && !(hasCheckIn && hasCheckOut)) return null;

  const checkInMatch  = HOTEL_CHECKIN_RE.exec(text);
  const checkOutMatch = HOTEL_CHECKOUT_RE.exec(text);

  let startDt: string | null = null;
  let endDt:   string | null = null;

  if (checkInMatch?.[1]) {
    const parsed = chrono.parseDate(checkInMatch[1], now ?? new Date());
    if (parsed) startDt = parsed.toISOString();
  }
  if (checkOutMatch?.[1]) {
    const parsed = chrono.parseDate(checkOutMatch[1], now ?? new Date());
    if (parsed) endDt = parsed.toISOString();
  }

  // Fallback: just grab first two dates from chrono
  if (!startDt || !endDt) {
    const dates = extractDates(text, now);
    if (!startDt && dates[0]) startDt = dates[0].iso;
    if (!endDt   && dates[1]) endDt   = dates[1].iso;
  }

  if (!startDt) return null;

  // Confirmation number — fresh regex each call to avoid lastIndex state
  const hotelResRe = /(?:reservation|confirmation|booking)\s*(?:code|#|number|id|ref(?:erence)?)?[:\s]+([A-Z0-9-]{4,16})/gi;
  const resMatch = hotelResRe.exec(text);
  const confirmationNumber = resMatch?.[1] ?? null;

  // Provider — look for hotel brand names
  const HOTEL_BRANDS =
    /\b(Marriott|Hilton|Hyatt|Airbnb|Booking\.com|Expedia|IHG|Radisson|Best\s*Western|Accor|Wyndham|Holiday\s*Inn|Sheraton|Westin|Renaissance|Ritz[\s-]Carlton|Four\s*Seasons|Intercontinental)\b/i;
  const brandMatch = text.match(HOTEL_BRANDS);
  const provider   = brandMatch?.[1] ?? null;

  // Location — prefer explicit name/address keywords; avoid generic "at" which
  // matches cancellation language ("No refunds at checkout", etc.)
  const hotelNameRe = /(?:property\s*name|hotel\s*name|stay(?:ing)?\s*at)[:\s]+([^\n\r,]{3,60})/i;
  const addrRe      = /(?:address|located\s*at|property\s*address)[:\s]+([^\n\r,]{3,80})/i;
  const nameMatch   = text.match(hotelNameRe);
  const addrMatch   = text.match(addrRe);
  const locationName = nameMatch?.[1]?.trim() ?? addrMatch?.[1]?.trim() ?? (provider ? `${provider} Hotel` : null);

  let confidence = 0.4;
  if (startDt)            confidence += 0.15;
  if (endDt)              confidence += 0.1;
  if (provider)           confidence += 0.1;
  if (confirmationNumber) confidence += 0.1;
  if (locationName)       confidence += 0.05;
  confidence = Math.min(confidence, 1.0);

  return {
    type: 'hotel',
    startDatetime: startDt,
    endDatetime:   endDt,
    timezone:      null,
    locationName,
    lat:  null,
    lng:  null,
    provider,
    confirmationNumber,
    pnr: null,
    parsedJson: { checkIn: startDt?.slice(0, 10), checkOut: endDt?.slice(0, 10) },
    confidence,
    status: confidence >= 0.7 ? 'confirmed' : 'needs_review',
  };
}

// ── Airbnb / generic reservation ──────────────────────────────────────────────

function extractReservation(text: string, now?: Date): Partial<ParsedEvent> | null {
  const hasAirbnb = /\b(?:airbnb|vrbo|homeaway|booking\.com|vacation\s*rental)\b/i.test(text);
  if (!hasAirbnb) return null;

  const dates = extractDates(text, now);
  const resRe2 = /(?:confirmation|booking)\s*(?:code|#|number)?[:\s]+([A-Z0-9]{5,10})/gi;
  const resMatch = resRe2.exec(text);

  return {
    type: 'reservation',
    startDatetime: dates[0]?.iso ?? null,
    endDatetime:   dates[1]?.iso ?? null,
    timezone:      dates[0]?.tz  ?? null,
    locationName:  text.match(/(?:property|host|home|place)[:\s]+([^\n\r]+)/i)?.[1]?.trim() ?? null,
    lat:  null,
    lng:  null,
    provider: text.match(/\b(Airbnb|VRBO|HomeAway)\b/i)?.[1] ?? null,
    confirmationNumber: resMatch?.[1] ?? null,
    pnr: null,
    parsedJson: {},
    confidence: dates.length >= 2 ? 0.75 : 0.5,
    status: 'confirmed',
  };
}

// ── Top-level parseEmail ──────────────────────────────────────────────────────

const BASE_FIELDS: (keyof Omit<ParsedEvent, 'type' | 'confidence' | 'status'>)[] = [
  'startDatetime', 'endDatetime', 'timezone', 'locationName',
  'lat', 'lng', 'provider', 'confirmationNumber', 'pnr', 'rawSourceJson', 'parsedJson',
];

function applyDefaults(partial: Partial<ParsedEvent>, rawText: string): ParsedEvent {
  const base: ParsedEvent = {
    type:              partial.type              ?? 'other',
    startDatetime:     partial.startDatetime     ?? null,
    endDatetime:       partial.endDatetime       ?? null,
    timezone:          partial.timezone          ?? null,
    locationName:      partial.locationName      ?? null,
    lat:               partial.lat               ?? null,
    lng:               partial.lng               ?? null,
    provider:          partial.provider          ?? null,
    confirmationNumber: partial.confirmationNumber ?? null,
    pnr:               partial.pnr               ?? null,
    rawSourceJson:     rawText,
    parsedJson:        partial.parsedJson        ?? null,
    confidence:        partial.confidence        ?? 0.4,
    status:            partial.status            ?? 'needs_review',
  };
  void BASE_FIELDS; // suppress lint — used above
  return base;
}

export function parseEmail(rawText: string, opts?: { now?: Date }): ParsedEvent[] {
  if (!rawText?.trim()) return [];

  const now = opts?.now;
  const results: ParsedEvent[] = [];

  // Extract global metadata from the full text (often in header, not per booking segment)
  const globalPnr = extractPnr(rawText);
  const globalConfRe = /(?:confirmation|booking|reservation)\s*(?:code|#|number|id|ref(?:erence)?)?[:\s]+([A-Z0-9-]{4,16})/gi;
  const globalConfMatch = globalConfRe.exec(rawText);
  const globalConf = globalConfMatch?.[1] ?? null;

  // Split on long horizontal rules (8+ dashes/equals on their own line) or 4+ blank lines.
  // Short underlines (e.g. "FLIGHT DETAILS\n-----------") are NOT treated as separators.
  const segments = rawText.split(/\n{4,}|(?:^|\n)={8,}(?:\n|$)|(?:^|\n)-{8,}(?:\n|$)/);

  for (const segment of segments) {
    const text = segment.trim();
    if (!text) continue;

    const flight      = extractFlight(text, now);
    const hotel       = extractHotel(text, now);
    const reservation = extractReservation(text, now);

    // Apply global metadata to events missing it (metadata often lives in a header segment)
    if (flight && !flight.pnr && globalPnr)                         flight.pnr = globalPnr;
    if (hotel  && !hotel.confirmationNumber && globalConf)          hotel.confirmationNumber = globalConf;
    if (reservation && !reservation.confirmationNumber && globalConf) reservation.confirmationNumber = globalConf;

    if (flight)      results.push(applyDefaults(flight, text));
    if (hotel)       results.push(applyDefaults(hotel,  text));
    if (reservation && !hotel) results.push(applyDefaults(reservation, text));
  }

  // Deduplicate by (type + confirmationNumber), keeping highest confidence version.
  // Handles the case where a header segment and a details segment both yield the same flight.
  const byKey = new Map<string, ParsedEvent>();
  for (const ev of results) {
    // Events with no confirmation number get a unique placeholder to avoid cross-merging
    const confKey = ev.confirmationNumber ?? `__null_${ev.startDatetime ?? Math.random()}`;
    const key = `${ev.type}::${confKey}`;
    const existing = byKey.get(key);
    if (!existing || ev.confidence > existing.confidence) {
      byKey.set(key, ev);
    }
  }
  const deduped = [...byKey.values()];

  // Sort by startDatetime ascending
  return deduped.sort((a, b) => {
    if (!a.startDatetime) return 1;
    if (!b.startDatetime) return -1;
    return a.startDatetime.localeCompare(b.startDatetime);
  });
}
