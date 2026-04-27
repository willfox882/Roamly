import { getTripDisplayRange } from '../lib/tripUtils';
import type { Trip, Event } from '../lib/schema';

describe('Trip Detail Date Range', () => {
  const mockTrip: Trip = {
    id: 'trip-1',
    userId: 'user-1',
    title: 'YYJ to HNL Trip',
    startDate: '2023-01-01', // raw dates
    endDate: '2023-01-10',
    timezone: 'UTC',
    dataVersion: 1,
    createdAt: new Date().toISOString(),
    lastModifiedAt: new Date().toISOString(),
    origin: 'local'
  };

  it('should compute range from earliest to latest flight departures', () => {
    const events: Event[] = [
      {
        id: 'e1',
        tripId: 'trip-1',
        userId: 'user-1',
        type: 'flight',
        startDatetime: '2023-02-02T16:00:00-08:00', // YYJ departure
        endDatetime: '2023-02-02T22:00:00-10:00',
        timezone: 'UTC',
        locationName: 'YYJ to HNL',
        lat: 0, lng: 0, provider: 'AC', confirmationNumber: null, pnr: null,
        rawSourceJson: {},
        parsedJson: { from: 'YYJ', to: 'HNL' },
        confidence: 1, status: 'confirmed', createdAt: '', lastModifiedAt: '', origin: 'local'
      },
      {
        id: 'e2',
        tripId: 'trip-1',
        userId: 'user-1',
        type: 'flight',
        startDatetime: '2023-02-07T16:00:00-10:00', // HNL departure
        endDatetime: '2023-02-08T00:00:00-08:00',
        timezone: 'UTC',
        locationName: 'HNL to YYJ',
        lat: 0, lng: 0, provider: 'AC', confirmationNumber: null, pnr: null,
        rawSourceJson: {},
        parsedJson: { from: 'HNL', to: 'YYJ' },
        confidence: 1, status: 'confirmed', createdAt: '', lastModifiedAt: '', origin: 'local'
      },
      {
        id: 'e3',
        tripId: 'trip-1',
        userId: 'user-1',
        type: 'hotel',
        startDatetime: '2023-02-03T15:00:00-10:00',
        endDatetime: '2023-02-07T11:00:00-10:00',
        timezone: 'UTC',
        locationName: 'Waikiki Hotel',
        lat: 0, lng: 0, provider: 'Marriott', confirmationNumber: null, pnr: null,
        rawSourceJson: {}, parsedJson: {},
        confidence: 1, status: 'confirmed', createdAt: '', lastModifiedAt: '', origin: 'local'
      }
    ];

    const range = getTripDisplayRange(mockTrip, events);
    
    // Earliest flight departure: Feb 2
    // Latest flight departure: Feb 7
    expect(range.start).toBe('2023-02-02');
    expect(range.end).toBe('2023-02-07');
  });

  it('should fall back to trip dates if no flights exist', () => {
    const range = getTripDisplayRange(mockTrip, []);
    expect(range.start).toBe('2023-01-01');
    expect(range.end).toBe('2023-01-10');
  });
});
