import { detectGaps } from '../lib/gapDetector';
import type { Event, UserPrefs } from '../lib/schema';

describe('Gap Detector - Hotel Coverage Span', () => {
  const prefs: UserPrefs = {} as any;

  it('should warn for missing first night (Jan 1)', () => {
    const events: Event[] = [
      {
        id: 'f1', tripId: 't1', userId: 'u1', type: 'flight',
        startDatetime: '2023-01-01T10:00:00Z',
        endDatetime: '2023-01-01T14:00:00Z',
        status: 'confirmed', provider: 'AC', locationName: 'YVR to LHR',
        rawSourceJson: {}, parsedJson: { from: 'YVR', to: 'LHR' }, confidence: 1, createdAt: '', lastModifiedAt: '', origin: 'local'
      } as any,
      {
        id: 'h1', tripId: 't1', userId: 'u1', type: 'hotel',
        startDatetime: '2023-01-02T15:00:00Z',
        endDatetime: '2023-01-05T11:00:00Z',
        status: 'confirmed', locationName: 'Hotel',
        rawSourceJson: {}, parsedJson: {}, confidence: 1, createdAt: '', lastModifiedAt: '', origin: 'local'
      } as any,
      {
        id: 'f2', tripId: 't1', userId: 'u1', type: 'flight',
        startDatetime: '2023-01-05T18:00:00Z',
        endDatetime: '2023-01-06T10:00:00Z',
        status: 'confirmed', provider: 'AC', locationName: 'LHR to YVR',
        rawSourceJson: {}, parsedJson: { from: 'LHR', to: 'YVR' }, confidence: 1, createdAt: '', lastModifiedAt: '', origin: 'local'
      } as any
    ];

    const gaps = detectGaps(events, prefs);
    const missingJan1 = gaps.find(g => g.id === 'missing_hotel_coverage:2023-01-01');
    expect(missingJan1).toBeDefined();
    expect(missingJan1?.message).toContain('2023-01-01');
  });

  it('should NOT warn if full span is covered', () => {
    const events: Event[] = [
      {
        id: 'f1', type: 'flight', startDatetime: '2023-01-01T10:00:00Z',
        status: 'confirmed', locationName: 'A to B'
      } as any,
      {
        id: 'h1', type: 'hotel', startDatetime: '2023-01-01T15:00:00Z', endDatetime: '2023-01-03T11:00:00Z',
        status: 'confirmed'
      } as any,
      {
        id: 'f2', type: 'flight', startDatetime: '2023-01-02T18:00:00Z',
        status: 'confirmed', locationName: 'B to A'
      } as any
    ];

    const gaps = detectGaps(events, prefs);
    const missing = gaps.filter(g => g.id.startsWith('missing_hotel_coverage'));
    expect(missing.length).toBe(0);
  });
});
