import type { Event, Trip } from './schema';
import { getZonedLocalDate } from './dateUtils';
import iataTable from './data/iata.json';

export interface LayoverInfo {
  durationMinutes: number;
  location: string;
  isTight: boolean;
}

/**
 * Computes layover duration between two consecutive flight events.
 */
export function getLayover(prev: Event, next: Event): LayoverInfo | null {
  if (prev.type !== 'flight' || next.type !== 'flight') return null;
  if (!prev.endDatetime || !next.startDatetime) return null;

  const prevTo = (prev.parsedJson as any)?.to?.toLowerCase().trim();
  const nextFrom = (next.parsedJson as any)?.from?.toLowerCase().trim();
  const prevToName = prev.locationName?.split(' to ')[1]?.toLowerCase().trim();
  const nextFromName = next.locationName?.split(' to ')[0]?.toLowerCase().trim();

  const isSameLocation = (prevTo && nextFrom && prevTo === nextFrom) || 
                         (prevToName && nextFromName && prevToName === nextFromName);

  if (!isSameLocation) return null;

  const arrival = new Date(prev.endDatetime).getTime();
  const departure = new Date(next.startDatetime).getTime();
  if (isNaN(arrival) || isNaN(departure)) return null;

  const diffMs = departure - arrival;
  if (diffMs < 0) return null;

  const durationMinutes = Math.floor(diffMs / (1000 * 60));
  return {
    durationMinutes,
    location: (prev.parsedJson as any)?.to || prev.locationName?.split(' to ')[1] || 'Unknown',
    isTight: durationMinutes < 30
  };
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

/**
 * Computes the display date range for a trip based on flight departures.
 */
export function getTripDisplayRange(trip: Trip, events: Event[]): { start: string, end: string } {
  const flights = events
    .filter(e => e.type === 'flight' && !!e.startDatetime)
    .sort((a, b) => a.startDatetime!.localeCompare(b.startDatetime!));

  if (flights.length === 0) {
    return { start: trip.startDate, end: trip.endDate };
  }

  const firstFlight = flights[0];
  const lastFlight  = flights[flights.length - 1];

  const startStr = (firstFlight as any).displayStartDatetime || firstFlight.startDatetime;
  const endStr   = (lastFlight as any).displayStartDatetime  || lastFlight.startDatetime;

  const start = startStr?.slice(0, 10) || trip.startDate;
  const end   = endStr?.slice(0, 10)   || trip.endDate;

  return { start, end };
}

/**
 * Parses a date/time string as a local wall-clock date and returns a Date object.
 * Does not perform timezone conversion.
 */
export function parseLocalDateTimeStringAsLocal(s: string | null): Date | null {
  if (!s) return null;
  // If it's already an ISO string without timezone (or with Z), we parse it.
  // Common formats: "2026-04-30T11:00", "2026-04-30 11:00", "04/30/2026 11:00"
  try {
    // Attempt to normalize to a format Date constructor likes as local
    let normalized = s.replace(' ', 'T');
    if (normalized.includes('/')) {
      // MM/DD/YYYY to YYYY-MM-DD
      const [datePart, timePart] = normalized.split('T');
      const [m, d, y] = datePart.split('/');
      normalized = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}${timePart ? 'T' + timePart : ''}`;
    }
    
    // Remove any trailing Z or offset to force local parsing
    normalized = normalized.replace(/Z|[+-]\d{2}:?\d{2}$/, '');
    
    const d = new Date(normalized);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/**
 * Computes the trip span from earliest flight departure to latest flight departure.
 * Treats dates as wall-clock (no timezone conversion).
 */
export function computeTripDateRangeFromFlights(events: Event[]): { startDate: string, endDate: string } | null {
  const flights = events
    .filter(e => e.type === 'flight' && !!e.startDatetime)
    .sort((a, b) => a.startDatetime!.localeCompare(b.startDatetime!));

  if (flights.length === 0) return null;

  const first = flights[0];
  const last  = flights[flights.length - 1];

  const start = ((first as any).displayStartDatetime || first.startDatetime!)?.slice(0, 10);
  const end   = ((last as any).displayStartDatetime  || last.startDatetime!)?.slice(0, 10);

  return { startDate: start, endDate: end };
}

/**
 * Computes the range of nights that require hotel coverage.
 * Inclusive of the first flight departure date, exclusive of the last flight departure date.
 */
export function computeTripNightRangeFromFlights(events: Event[]): { startDate: string, endDate: string } | null {
  const departures = events
    .filter(e => e.type === 'flight' && (e.startDatetime || (e as any).displayStartDatetime))
    .map(f => {
      const s = (f as any).displayStartDatetime || f.startDatetime;
      const dt = parseLocalDateTimeStringAsLocal(s);
      if (!dt) return null;
      // Get YYYY-MM-DD from the Date object as if it were local time
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const d = String(dt.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    })
    .filter((s): s is string => !!s);

  if (departures.length === 0) return null;

  const start = departures.reduce((a, b) => a < b ? a : b);
  const end = departures.reduce((a, b) => a > b ? a : b);

  return { startDate: start, endDate: end };
}

