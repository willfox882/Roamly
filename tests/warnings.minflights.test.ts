import { detectGaps } from '../lib/gapDetector';
import type { Event, UserPrefs, Trip } from '../lib/schema';

describe('Minimum Flights Warning (Task A)', () => {
  const prefs: UserPrefs = {} as any;

  it('should produce missing_return_flight warning for trip with 1 flight', () => {
    const events: Event[] = [
      {
        id: 'f1', tripId: 't1', userId: 'u1', type: 'flight',
        startDatetime: '2023-01-01T10:00:00Z',
        status: 'confirmed', locationName: 'YVR to LHR',
        rawSourceJson: {}, parsedJson: { from: 'YVR', to: 'LHR' }, confidence: 1, createdAt: '', lastModifiedAt: '', origin: 'local'
      } as any
    ];

    const gaps = detectGaps(events, prefs);
    const warning = gaps.find(g => g.id === 'missing_return_flight');
    expect(warning).toBeDefined();
    expect(warning?.message).toBe('This trip has fewer than 2 flights. Add a return flight or ignore this warning.');
  });

  it('should NOT produce warning for trip with 2 flights', () => {
    const events: Event[] = [
      {
        id: 'f1', type: 'flight', startDatetime: '2023-01-01T10:00:00Z', status: 'confirmed'
      } as any,
      {
        id: 'f2', type: 'flight', startDatetime: '2023-01-05T10:00:00Z', status: 'confirmed'
      } as any
    ];

    const gaps = detectGaps(events, prefs);
    const warning = gaps.find(g => g.id === 'missing_return_flight');
    expect(warning).toBeUndefined();
  });

  it('should simulate ignoring and undoing the warning', () => {
    // This part of the logic is in the UI (ParsedReviewPanel)
    // We simulate the metadata changes here
    let trip: Trip = {
      id: 't1',
      meta: {
        ignoredWarnings: []
      }
    } as any;

    const warningId = 'missing_return_flight';

    // Simulate Ignore
    trip.meta = trip.meta || {};
    trip.meta.ignoredWarnings = Array.from(new Set([...(trip.meta.ignoredWarnings || []), warningId]));
    expect(trip.meta.ignoredWarnings).toContain(warningId);

    // Simulate Filtering logic (which is in ParsedReviewPanel)
    const gaps = [{ id: 'missing_return_flight' }];
    const visibleGaps = gaps.filter(g => !trip.meta?.ignoredWarnings?.includes(g.id));
    expect(visibleGaps.length).toBe(0);

    // Simulate Undo
    trip.meta.ignoredWarnings = (trip.meta.ignoredWarnings || []).filter(id => id !== warningId);
    expect(trip.meta.ignoredWarnings).not.toContain(warningId);
    
    const visibleGapsAfterUndo = gaps.filter(g => !trip.meta?.ignoredWarnings?.includes(g.id));
    expect(visibleGapsAfterUndo.length).toBe(1);
  });
});
