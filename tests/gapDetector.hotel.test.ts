import { detectGaps } from '../lib/gapDetector';
import type { Event, UserPrefs } from '../lib/schema';

describe('Gap Detector - Hotel Coverage', () => {
  const prefs: UserPrefs = {} as any;

  it('should detect missing hotel night for flight arrival', () => {
    const events: Event[] = [
      {
        id: 'f1',
        tripId: 't1',
        userId: 'u1',
        type: 'flight',
        startDatetime: '2023-02-02T16:00:00-08:00', // Victoria
        endDatetime: '2023-02-02T22:00:00-10:00',   // Honolulu
        timezone: 'Pacific/Honolulu',
        locationName: 'YYJ to HNL',
        lat: 0, lng: 0, provider: 'AC', confirmationNumber: null, pnr: null,
        rawSourceJson: {},
        parsedJson: { from: 'YYJ', to: 'HNL', destination: 'HNL' },
        confidence: 1, status: 'confirmed', createdAt: '', lastModifiedAt: '', origin: 'local'
      },
      {
        id: 'h1',
        tripId: 't1',
        userId: 'u1',
        type: 'hotel',
        startDatetime: '2023-02-03T15:00:00-10:00', // Hotel starts Feb 3
        endDatetime: '2023-02-07T11:00:00-10:00',
        timezone: 'Pacific/Honolulu',
        locationName: 'Waikiki Hotel',
        lat: 0, lng: 0, provider: 'Marriott', confirmationNumber: '123', pnr: null,
        rawSourceJson: {}, parsedJson: {},
        confidence: 1, status: 'confirmed', createdAt: '', lastModifiedAt: '', origin: 'local'
      },
      {
        id: 'f2',
        tripId: 't1',
        userId: 'u1',
        type: 'flight',
        startDatetime: '2023-02-07T16:00:00-10:00', // Return flight Feb 7
        endDatetime: '2023-02-08T01:00:00-08:00',
        timezone: 'America/Vancouver',
        locationName: 'HNL to YYJ',
        lat: 0, lng: 0, provider: 'AC', confirmationNumber: null, pnr: null,
        rawSourceJson: {},
        parsedJson: { from: 'HNL', to: 'YYJ', origin: 'YYJ' },
        confidence: 1, status: 'confirmed', createdAt: '', lastModifiedAt: '', origin: 'local'
      }
    ];

    const gaps = detectGaps(events, prefs);
    
    // Expect gap for Feb 2 night
    const missingHotelGap = gaps.find(g => g.type === 'missing_accommodation');
    expect(missingHotelGap).toBeDefined();
    expect(missingHotelGap?.message).toContain('2023-02-02');
  });

  it('should not detect gap if hotel covers arrival night', () => {
    const events: Event[] = [
      {
        id: 'f1',
        tripId: 't1',
        userId: 'u1',
        type: 'flight',
        startDatetime: '2023-02-02T16:00:00-08:00',
        endDatetime: '2023-02-02T22:00:00-10:00',
        timezone: 'Pacific/Honolulu',
        locationName: 'YYJ to HNL',
        lat: 0, lng: 0, provider: 'AC', confirmationNumber: null, pnr: null,
        rawSourceJson: {},
        parsedJson: { from: 'YYJ', to: 'HNL', destination: 'HNL' },
        confidence: 1, status: 'confirmed', createdAt: '', lastModifiedAt: '', origin: 'local'
      },
      {
        id: 'h1',
        tripId: 't1',
        userId: 'u1',
        type: 'hotel',
        startDatetime: '2023-02-02T15:00:00-10:00', // Hotel starts Feb 2
        endDatetime: '2023-02-07T11:00:00-10:00',
        timezone: 'Pacific/Honolulu',
        locationName: 'Honolulu Resort', // Matches HNL
        lat: 0, lng: 0, provider: 'Marriott', confirmationNumber: '123', pnr: null,
        rawSourceJson: {}, parsedJson: {},
        confidence: 1, status: 'confirmed', createdAt: '', lastModifiedAt: '', origin: 'local'
      }
    ];

    const gaps = detectGaps(events, prefs);
    const missingHotelGap = gaps.find(g => g.type === 'missing_accommodation');
    expect(missingHotelGap).toBeUndefined();
  });
});
