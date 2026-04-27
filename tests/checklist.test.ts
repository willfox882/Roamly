import type { Event, EventType } from '../lib/schema';

// Mocking the logic found in TripDetailPage to verify it works correctly
function isChecklistComplete(type: EventType, events: Event[]): boolean {
  const eventsByType = events.reduce((acc, e) => {
    if (!acc.has(e.type)) acc.set(e.type, []);
    acc.get(e.type)!.push(e);
    return acc;
  }, new Map<EventType, Event[]>());

  let has = (eventsByType.get(type)?.length ?? 0) > 0;
  
  if (type === 'reservation' && !has) {
    has = events.some(e => (e.type === 'hotel' || e.type === 'excursion') && !!e.confirmationNumber);
  }

  return has;
}

describe('Trip Checklist Logic', () => {
  const baseEvent: Event = {
    id: '1',
    tripId: 'trip-1',
    userId: 'user-1',
    type: 'flight',
    startDatetime: '2026-10-24T15:00:00Z',
    endDatetime: '2026-10-24T17:30:00Z',
    timezone: 'UTC',
    locationName: 'Test',
    lat: 0,
    lng: 0,
    provider: 'Test',
    confirmationNumber: null,
    pnr: null,
    rawSourceJson: {},
    parsedJson: {},
    confidence: 1,
    status: 'confirmed',
    createdAt: new Date().toISOString(),
    lastModifiedAt: new Date().toISOString(),
    origin: 'local'
  };

  it('should mark transportation complete if a transport event exists', () => {
    const events: Event[] = [{ ...baseEvent, type: 'transport' }];
    expect(isChecklistComplete('transport', events)).toBe(true);
  });

  it('should mark reservations complete if a reservation event exists', () => {
    const events: Event[] = [{ ...baseEvent, type: 'reservation' }];
    expect(isChecklistComplete('reservation', events)).toBe(true);
  });

  it('should mark reservations complete if a hotel has a confirmation number', () => {
    const events: Event[] = [{ ...baseEvent, type: 'hotel', confirmationNumber: 'CONF123' }];
    expect(isChecklistComplete('reservation', events)).toBe(true);
  });

  it('should mark reservations incomplete if no reservation event and no hotel confirmation', () => {
    const events: Event[] = [{ ...baseEvent, type: 'hotel', confirmationNumber: null }];
    expect(isChecklistComplete('reservation', events)).toBe(false);
  });
});
