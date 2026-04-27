import { detectGaps } from '../lib/gapDetector';
import type { Event, UserPrefs } from '../lib/schema';

describe('Hotel Coverage - Exclude Last Day (Task B)', () => {
  const prefs: UserPrefs = {} as any;

  it('Case A: should NOT warn if hotel covers Jan 1 to Jan 5 (exclusive of Jan 5)', () => {
    const events: Event[] = [
      {
        id: 'f1', type: 'flight', startDatetime: '2023-01-01T10:00:00Z', status: 'confirmed', locationName: 'A to B'
      } as any,
      {
        id: 'f2', type: 'flight', startDatetime: '2023-01-05T18:00:00Z', status: 'confirmed', locationName: 'B to A'
      } as any,
      {
        id: 'h1', type: 'hotel', startDatetime: '2023-01-01T15:00:00Z', endDatetime: '2023-01-05T11:00:00Z',
        status: 'confirmed'
      } as any
    ];

    const gaps = detectGaps(events, prefs);
    const missing = gaps.filter(g => g.id.startsWith('missing_hotel_coverage'));
    expect(missing.length).toBe(0);
  });

  it('Case B: should warn for Jan 1 if hotel starts Jan 2', () => {
    const events: Event[] = [
      {
        id: 'f1', type: 'flight', startDatetime: '2023-01-01T10:00:00Z', status: 'confirmed'
      } as any,
      {
        id: 'f2', type: 'flight', startDatetime: '2023-01-05T18:00:00Z', status: 'confirmed'
      } as any,
      {
        id: 'h1', type: 'hotel', startDatetime: '2023-01-02T15:00:00Z', endDatetime: '2023-01-05T11:00:00Z',
        status: 'confirmed'
      } as any
    ];

    const gaps = detectGaps(events, prefs);
    const missingJan1 = gaps.find(g => g.id === 'missing_hotel_coverage:2023-01-01');
    expect(missingJan1).toBeDefined();
    
    // Should NOT warn for Jan 5
    const missingJan5 = gaps.find(g => g.id === 'missing_hotel_coverage:2023-01-05');
    expect(missingJan5).toBeUndefined();
  });

  it('Case C: should warn for intermediate gap on Jan 3', () => {
    const events: Event[] = [
      {
        id: 'f1', type: 'flight', startDatetime: '2023-01-01T10:00:00Z', status: 'confirmed'
      } as any,
      {
        id: 'f2', type: 'flight', startDatetime: '2023-01-05T18:00:00Z', status: 'confirmed'
      } as any,
      {
        id: 'h1', type: 'hotel', startDatetime: '2023-01-01T15:00:00Z', endDatetime: '2023-01-03T11:00:00Z',
        status: 'confirmed'
      } as any,
      {
        id: 'h2', type: 'hotel', startDatetime: '2023-01-04T15:00:00Z', endDatetime: '2023-01-05T11:00:00Z',
        status: 'confirmed'
      } as any
    ];

    const gaps = detectGaps(events, prefs);
    const missingJan3 = gaps.find(g => g.id === 'missing_hotel_coverage:2023-01-03');
    expect(missingJan3).toBeDefined();
    
    // Jan 1, 2, 4 covered. Jan 3 missing. Jan 5 excluded.
    const missing = gaps.filter(g => g.id.startsWith('missing_hotel_coverage'));
    expect(missing.length).toBe(1);
    expect(missing[0].id).toBe('missing_hotel_coverage:2023-01-03');
  });

  it('should NOT warn for same-day depart/return', () => {
    const events: Event[] = [
      {
        id: 'f1', type: 'flight', startDatetime: '2023-01-01T10:00:00Z', status: 'confirmed'
      } as any,
      {
        id: 'f2', type: 'flight', startDatetime: '2023-01-01T22:00:00Z', status: 'confirmed'
      } as any
    ];

    const gaps = detectGaps(events, prefs);
    const missing = gaps.filter(g => g.id.startsWith('missing_hotel_coverage'));
    expect(missing.length).toBe(0);
  });
});
