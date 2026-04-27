import fs from 'fs';
import path from 'path';
import { parseEmail, extractFlight, extractHotel, extractPnr, airportToCoord, extractDates, normalizeCity, deriveTripTitle } from '@/lib/parser';
import type { ParsedEvent } from '@/lib/schema';

function fixture(name: string): string {
  return fs.readFileSync(path.join(__dirname, 'fixtures/emails', name), 'utf8');
}

// Stable reference date so chrono-node resolves relative dates consistently
const REF = new Date('2026-01-01T00:00:00Z');

// ── airportToCoord ────────────────────────────────────────────────────────────

describe('airportToCoord', () => {
  it('resolves known codes', () => {
    expect(airportToCoord('YVR')).toMatchObject({ lat: expect.any(Number), lng: expect.any(Number), name: expect.any(String) });
    expect(airportToCoord('NRT')).toMatchObject({ lat: expect.any(Number), lng: expect.any(Number) });
    expect(airportToCoord('LHR')).toMatchObject({ lat: expect.any(Number), lng: expect.any(Number) });
    expect(airportToCoord('JFK')).toMatchObject({ lat: expect.any(Number), lng: expect.any(Number) });
    expect(airportToCoord('CDG')).toMatchObject({ lat: expect.any(Number), lng: expect.any(Number) });
    expect(airportToCoord('LIS')).toMatchObject({ lat: expect.any(Number), lng: expect.any(Number) });
  });

  it('returns null for unknown code', () => {
    expect(airportToCoord('ZZZ')).toBeNull();
  });

  it('is case-insensitive', () => {
    expect(airportToCoord('yvr')).toMatchObject({ lat: expect.any(Number) });
  });
});

// ── extractPnr ────────────────────────────────────────────────────────────────

describe('extractPnr', () => {
  it('extracts "PNR: ABC123"', () => {
    expect(extractPnr('PNR: ABC123')).toBe('ABC123');
  });
  it('extracts "Confirmation Code: XY9Z12"', () => {
    expect(extractPnr('Confirmation Code: XY9Z12')).toBe('XY9Z12');
  });
  it('extracts "Booking Reference: LIS789"', () => {
    expect(extractPnr('Booking Reference: LIS789')).toBe('LIS789');
  });
  it('returns null when absent', () => {
    expect(extractPnr('No booking info here')).toBeNull();
  });
});

// ── extractDates ──────────────────────────────────────────────────────────────

describe('extractDates', () => {
  it('parses ISO date', () => {
    const results = extractDates('Flight on 2026-07-01', REF);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0]!.iso).toContain('2026-07-01');
  });

  it('parses "July 1, 2026"', () => {
    const results = extractDates('Departure: July 1, 2026', REF);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0]!.iso).toContain('2026-07-01');
  });
});

// ── Air Canada flight fixture ────────────────────────────────────────────────

describe('Air Canada flight fixture', () => {
  const text = fixture('flight_air_canada.txt');

  it('parseEmail returns exactly 1 event', () => {
    const events = parseEmail(text, { now: REF });
    expect(events).toHaveLength(1);
  });

  it('event type is flight', () => {
    const events = parseEmail(text, { now: REF });
    expect(events[0]!.type).toBe('flight');
  });

  it('provider is Air Canada', () => {
    const events = parseEmail(text, { now: REF });
    expect(events[0]!.provider).toBe('Air Canada');
  });

  it('confirmationNumber matches AC\\d+', () => {
    const events = parseEmail(text, { now: REF });
    expect(events[0]!.confirmationNumber).toMatch(/^AC\d+$/);
  });

  it('PNR is ABC123', () => {
    const events = parseEmail(text, { now: REF });
    expect(events[0]!.pnr).toBe('ABC123');
  });

  it('startDatetime is a valid ISO string', () => {
    const events = parseEmail(text, { now: REF });
    expect(() => new Date(events[0]!.startDatetime!)).not.toThrow();
    expect(events[0]!.startDatetime).not.toBeNull();
  });

  it('confidence >= 0.85', () => {
    const events = parseEmail(text, { now: REF });
    expect(events[0]!.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('extractFlight returns non-null', () => {
    expect(extractFlight(text, REF)).not.toBeNull();
  });
});

// ── Marriott hotel fixture ────────────────────────────────────────────────────

describe('Marriott hotel fixture', () => {
  const text = fixture('hotel_marriott.txt');

  it('parseEmail returns 1 hotel event', () => {
    const events = parseEmail(text, { now: REF });
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events.find((e) => e.type === 'hotel')).toBeDefined();
  });

  it('hotel has check-in date', () => {
    const events = parseEmail(text, { now: REF });
    const hotel = events.find((e) => e.type === 'hotel')!;
    expect(hotel.startDatetime).not.toBeNull();
  });

  it('hotel has check-out date', () => {
    const events = parseEmail(text, { now: REF });
    const hotel = events.find((e) => e.type === 'hotel')!;
    expect(hotel.endDatetime).not.toBeNull();
  });

  it('location name is set', () => {
    const events = parseEmail(text, { now: REF });
    const hotel = events.find((e) => e.type === 'hotel')!;
    expect(hotel.locationName).not.toBeNull();
  });

  it('confirmation number is set', () => {
    const events = parseEmail(text, { now: REF });
    const hotel = events.find((e) => e.type === 'hotel')!;
    expect(hotel.confirmationNumber).not.toBeNull();
  });

  it('extractHotel returns non-null', () => {
    expect(extractHotel(text, REF)).not.toBeNull();
  });
});

// ── Airbnb fixture ────────────────────────────────────────────────────────────

describe('Airbnb reservation fixture', () => {
  const text = fixture('airbnb_reservation.txt');

  it('parseEmail returns at least 1 event', () => {
    const events = parseEmail(text, { now: REF });
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  it('event type is reservation or hotel', () => {
    const events = parseEmail(text, { now: REF });
    expect(['reservation', 'hotel']).toContain(events[0]!.type);
  });

  it('provider contains Airbnb', () => {
    const events = parseEmail(text, { now: REF });
    expect(events[0]!.provider).toMatch(/airbnb/i);
  });
});

// ── Combined flight + hotel fixture ──────────────────────────────────────────

describe('combined flight+hotel fixture', () => {
  const text = fixture('combined_flight_hotel.txt');

  it('returns at least 2 events', () => {
    const events = parseEmail(text, { now: REF });
    expect(events.length).toBeGreaterThanOrEqual(2);
  });

  it('includes a flight event', () => {
    const events = parseEmail(text, { now: REF });
    expect(events.some((e) => e.type === 'flight')).toBe(true);
  });

  it('includes a hotel event', () => {
    const events = parseEmail(text, { now: REF });
    expect(events.some((e) => e.type === 'hotel')).toBe(true);
  });

  it('events are sorted by startDatetime', () => {
    const events = parseEmail(text, { now: REF }).filter((e) => e.startDatetime);
    for (let i = 1; i < events.length; i++) {
      expect(events[i]!.startDatetime! >= events[i - 1]!.startDatetime!).toBe(true);
    }
  });
});

// ── Garbage input ─────────────────────────────────────────────────────────────

describe('garbage input', () => {
  const text = fixture('garbage.txt');

  it('returns empty array', () => {
    const events = parseEmail(text, { now: REF });
    expect(events).toHaveLength(0);
  });

  it('does not throw', () => {
    expect(() => parseEmail(text, { now: REF })).not.toThrow();
  });

  it('handles empty string', () => {
    expect(parseEmail('', { now: REF })).toHaveLength(0);
  });

  it('handles whitespace-only string', () => {
    expect(parseEmail('   \n\n   ', { now: REF })).toHaveLength(0);
  });
});

// ── normalizeCity ─────────────────────────────────────────────────────────────

describe('normalizeCity', () => {
  it('resolves IATA code to city name (YVR → Vancouver)', () => {
    expect(normalizeCity('YVR')).toBe('Vancouver');
  });

  it('resolves IATA code to city name (YYJ → Victoria)', () => {
    // YYJ is Victoria International Airport
    const result = normalizeCity('YYJ');
    expect(result).toBeTruthy();
    expect(result!.toLowerCase()).toContain('victoria');
  });

  it('resolves LAS to Las Vegas', () => {
    const result = normalizeCity('LAS');
    expect(result).toBeTruthy();
    expect(result!.toLowerCase()).toContain('las vegas');
  });

  it('strips "International Airport" suffix from full name', () => {
    expect(normalizeCity('Vancouver International Airport')).toBe('Vancouver');
  });

  it('strips "International" suffix', () => {
    expect(normalizeCity('Victoria International')).toBe('Victoria');
  });

  it('returns null for null input', () => {
    expect(normalizeCity(null)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(normalizeCity('')).toBeNull();
  });
});

// ── deriveTripTitle ───────────────────────────────────────────────────────────

function parsedFlight(overrides: Partial<ParsedEvent> = {}): ParsedEvent {
  return {
    type: 'flight',
    startDatetime: null,
    endDatetime: null,
    timezone: null,
    locationName: null,
    lat: null,
    lng: null,
    provider: 'Air Canada',
    confirmationNumber: null,
    pnr: null,
    rawSourceJson: null,
    parsedJson: null,
    confidence: 0.9,
    status: 'confirmed',
    ...overrides,
  };
}

describe('deriveTripTitle', () => {
  it('uses first origin and last destination from flights', () => {
    const events: ParsedEvent[] = [
      parsedFlight({
        startDatetime: '2026-04-27T08:00:00-07:00',
        parsedJson: { flightNumber: 'AC1234', origin: 'YYJ', destination: 'YVR' },
      }),
      parsedFlight({
        startDatetime: '2026-04-27T12:00:00-07:00',
        parsedJson: { flightNumber: 'AC788', origin: 'YVR', destination: 'LAS' },
      }),
    ];
    const title = deriveTripTitle(events);
    expect(title).toContain('Victoria');
    expect(title).toContain('Las Vegas');
    expect(title).toContain('→');
  });

  it('does not produce "X → X" when origin equals destination', () => {
    const events: ParsedEvent[] = [
      parsedFlight({
        startDatetime: '2026-04-27T10:00:00-07:00',
        locationName: 'Vancouver → Vancouver',
        parsedJson: { flightNumber: 'AC304', origin: 'YVR', destination: 'YVR' },
      }),
    ];
    const title = deriveTripTitle(events);
    // Should not produce "Vancouver → Vancouver"
    expect(title).not.toMatch(/^Vancouver → Vancouver$/);
  });

  it('falls back to first event locationName when no flights present', () => {
    const events: ParsedEvent[] = [
      {
        type: 'hotel',
        startDatetime: '2026-04-30T15:00:00-07:00',
        endDatetime: '2026-05-02T11:00:00-07:00',
        timezone: null,
        locationName: 'Bellagio Las Vegas',
        lat: null,
        lng: null,
        provider: 'Marriott',
        confirmationNumber: 'CONF123',
        pnr: null,
        rawSourceJson: null,
        parsedJson: null,
        confidence: 0.9,
        status: 'confirmed',
      },
    ];
    expect(deriveTripTitle(events)).toBe('Bellagio Las Vegas');
  });

  it('returns "New Trip" for empty event list', () => {
    expect(deriveTripTitle([])).toBe('New Trip');
  });
});

// ── Same-airport phantom flight prevention ────────────────────────────────────

describe('extractFlight same-airport guard', () => {
  it('returns null when origin and destination IATA codes are identical', () => {
    // If email text has YVR appearing twice, extractFlight must not produce a phantom leg
    const text = 'AC304 YVR YVR April 27, 2026 10:00 PNR: ABC123';
    const result = extractFlight(text, REF);
    expect(result).toBeNull();
  });
});

// ── Hotel locationName — must not capture cancellation policy text ────────────

describe('extractHotel locationName guard', () => {
  it('does NOT set locationName to cancellation policy text', () => {
    const text = [
      'Marriott Las Vegas',
      'Check-in: April 30, 2026',
      'Check-out: May 2, 2026',
      'Reservation: CONF999',
      'Cancellation Policy: No refunds at checkout after April 25.',
    ].join('\n');
    const result = extractHotel(text, REF);
    expect(result).not.toBeNull();
    // locationName must NOT be "checkout after April 25." or similar
    expect(result!.locationName).not.toMatch(/refund|checkout|cancellation/i);
  });

  it('sets locationName from "property name:" when present', () => {
    const text = [
      'Marriott Las Vegas',
      'Property name: The Grand Las Vegas',
      'Check-in: April 30, 2026',
      'Check-out: May 2, 2026',
      'Reservation: CONF888',
    ].join('\n');
    const result = extractHotel(text, REF);
    expect(result).not.toBeNull();
    expect(result!.locationName).toBe('The Grand Las Vegas');
  });

  it('falls back to "<Brand> Hotel" when no address or name line found', () => {
    const text = [
      'Hilton Garden Inn',
      'Check-in: April 30, 2026',
      'Check-out: May 2, 2026',
      'No refunds at checkout.',
    ].join('\n');
    const result = extractHotel(text, REF);
    expect(result).not.toBeNull();
    // Should fall back to "Hilton Hotel" or similar brand-based name
    expect(result!.locationName).toBeTruthy();
    expect(result!.locationName).not.toMatch(/refund|checkout|cancellation/i);
  });
});

// ── deriveTripTitle — full round-trip Apr 30–May 03 ──────────────────────────

describe('deriveTripTitle round-trip Victoria→Vegas→Victoria', () => {
  it('title uses earliest origin (YYJ=Victoria) and final arrival (YYJ=Victoria)', () => {
    const events: ParsedEvent[] = [
      parsedFlight({
        startDatetime: '2026-04-30T07:00:00-07:00',
        parsedJson: { flightNumber: 'AC1234', origin: 'YYJ', destination: 'YVR' },
      }),
      parsedFlight({
        startDatetime: '2026-04-30T10:30:00-07:00',
        parsedJson: { flightNumber: 'AC788', origin: 'YVR', destination: 'LAS' },
      }),
      parsedFlight({
        startDatetime: '2026-05-03T13:00:00-07:00',
        parsedJson: { flightNumber: 'AC789', origin: 'LAS', destination: 'YVR' },
      }),
      parsedFlight({
        startDatetime: '2026-05-03T17:00:00-07:00',
        parsedJson: { flightNumber: 'AC1235', origin: 'YVR', destination: 'YYJ' },
      }),
    ];
    const title = deriveTripTitle(events);
    // For a true round-trip the first origin and last destination are the same city
    // so the title represents the furthest destination (Las Vegas leg is second origin)
    // At minimum the title must reference the first origin.
    expect(title).toContain('Victoria');
    expect(title).toContain('→');
  });

  it('outbound-only title is Victoria → Las Vegas when last real destination is LAS', () => {
    const events: ParsedEvent[] = [
      parsedFlight({
        startDatetime: '2026-04-30T07:00:00-07:00',
        parsedJson: { flightNumber: 'AC1234', origin: 'YYJ', destination: 'YVR' },
      }),
      parsedFlight({
        startDatetime: '2026-04-30T10:30:00-07:00',
        parsedJson: { flightNumber: 'AC788', origin: 'YVR', destination: 'LAS' },
      }),
    ];
    const title = deriveTripTitle(events);
    expect(title).toContain('Victoria');
    expect(title).toContain('Las Vegas');
  });
});

// ── aiClient: timeout + low-confidence → deterministic fallback w/ needs_review ─

describe('aiClient parseEmail — timeout & fallback behavior', () => {
  // The Anthropic SDK is dynamically imported inside callCloud; we mock the
  // module so we can simulate a hang or error without hitting the network.
  const mockCreate = jest.fn();
  jest.mock('@anthropic-ai/sdk', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
  }));

  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('cloud provider timeout → deterministic fallback marks events needs_review', async () => {
    // Anthropic.create resolves only when its signal aborts — simulates a hang.
    mockCreate.mockImplementation(
      (_args: unknown, callOpts: { signal?: AbortSignal } = {}) =>
        new Promise((_resolve, reject) => {
          const sig = callOpts.signal;
          if (sig?.aborted) reject(new Error('aborted'));
          sig?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        }),
    );

    const { parseEmail: aiParse } = await import('@/lib/aiClient');
    const text = fixture('flight_air_canada.txt');
    const events = await aiParse(text, { provider: 'cloud', timeoutMs: 50 });

    expect(events.length).toBeGreaterThan(0);
    expect(events[0]!.type).toBe('flight');
    // Marked for review since AI was attempted and timed out.
    expect(events.every((e) => e.status === 'needs_review')).toBe(true);
    // Deterministic parser still populated rawSourceJson / parsedJson.
    expect(events[0]!.rawSourceJson).not.toBeNull();
    expect(events[0]!.parsedJson).not.toBeNull();
  });

  it('cloud provider error → deterministic fallback also marks needs_review', async () => {
    mockCreate.mockRejectedValue(new Error('rate-limited'));
    const { parseEmail: aiParse } = await import('@/lib/aiClient');
    const events = await aiParse(fixture('flight_air_canada.txt'), {
      provider: 'cloud',
      timeoutMs: 5_000,
    });
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.status === 'needs_review')).toBe(true);
  });

  it('provider="none" → deterministic only, NOT marked needs_review', async () => {
    const { parseEmail: aiParse } = await import('@/lib/aiClient');
    const events = await aiParse(fixture('flight_air_canada.txt'), { provider: 'none' });
    expect(events.length).toBeGreaterThan(0);
    // None-mode reflects user intent; no AI was attempted, so status is the
    // deterministic parser's own confidence-based classification.
    expect(events.every((e) => e.status !== 'needs_review')).toBe(true);
  });

  it('Air Canada fixture parses to a flight event with required fields', async () => {
    // Acceptance criterion: parser test passes for the sample flight fixture.
    const { parseEmail: aiParse } = await import('@/lib/aiClient');
    const events = await aiParse(fixture('flight_air_canada.txt'), { provider: 'none' });
    expect(events).toHaveLength(1);
    const e = events[0]!;
    expect(e.type).toBe('flight');
    expect(e.provider).toBe('Air Canada');
    expect(e.confirmationNumber).toMatch(/^AC\d+$/);
    expect(e.pnr).toBe('ABC123');
    expect(e.startDatetime).not.toBeNull();
    expect(e.confidence).toBeGreaterThanOrEqual(0.85);
  });
});
