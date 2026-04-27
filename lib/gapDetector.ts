import type { Event, Gap, UserPrefs, Trip } from '@/lib/schema';
import { normalizeCity } from '@/lib/parser';
import { computeTripNightRangeFromFlights } from './tripUtils';

const SEV_ORDER = { high: 0, medium: 1, low: 2 } as const;

/**
 * Calendar date (YYYY-MM-DD) of an ISO datetime.
 */
function nightOf(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Main gap detection logic.
 */
export function detectGaps(events: Event[], prefs: UserPrefs, trip?: Trip): Gap[] {
  const gaps: Gap[] = [];
  const flights = events.filter((e) => e.type === 'flight' && e.startDatetime && e.status !== 'cancelled');
  const accommodation = events.filter((e) => e.type === 'hotel' && e.startDatetime && e.status !== 'cancelled');

  // 0. Minimum Flights Warning
  if (flights.length < 2) {
    gaps.push({
      id: 'missing_return_flight',
      type: 'missing_transport' as any,
      severity: 'medium',
      message: 'This trip has fewer than 2 flights. Add a return flight or ignore this warning.',
      relatedEventIds: flights.map(f => f.id),
      suggestedActions: [
        { label: 'Add flight', actionId: 'add_flight' }
      ],
    });
  }

  // 1. Hotel Coverage: first flight departure -> last flight departure (exclusive of last day)
  const range = computeTripNightRangeFromFlights(events);
  if (range && range.startDate !== range.endDate) {
    let current = range.startDate;
    const end = range.endDate; // stop BEFORE this date
    
    while (current < end) {
      const night = current;
      const isCovered = accommodation.some(h => {
        const checkIn = nightOf(h.startDatetime);
        const checkOut = nightOf(h.endDatetime);
        return night >= checkIn && night < checkOut;
      });

      if (!isCovered) {
        gaps.push({
          id: `missing_hotel_coverage:${night}`,
          type: 'missing_accommodation' as any,
          severity: 'high',
          message: `No hotel covers the night of ${night}.`,
          relatedEventIds: [],
          suggestedActions: [
            { label: 'Add hotel', actionId: 'add_hotel' }
          ],
        });
      }
      current = addDays(current, 1);
    }
  }

  // 2. Flight Confirmation Gaps
  for (const f of flights) {
    if (!f.confirmationNumber && !f.ignoreConfirmation) {
      gaps.push({
        id: `missing_confirmation:${f.id}`,
        type: 'missing_confirmation' as any,
        severity: 'medium',
        message: `Flight ${f.provider || ''} ${f.locationName} is missing a confirmation number.`,
        relatedEventIds: [f.id],
        suggestedActions: [{ label: 'Edit flight', actionId: 'add_flight' }],
      });
    }
  }

  return gaps.sort((a, b) => {
    const sevDiff = SEV_ORDER[a.severity] - SEV_ORDER[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return a.id.localeCompare(b.id);
  });
}
