import { getTripDisplayRange } from '../lib/tripUtils';
import type { Trip, Event } from '../lib/schema';

describe('getTripDisplayRange', () => {
  const mockTrip: Trip = {
    id: 'trip-1',
    userId: 'user-1',
    title: 'Test Trip',
    startDate: '2026-10-24',
    endDate: '2026-10-30',
    timezone: 'UTC',
    dataVersion: 1,
    createdAt: new Date().toISOString(),
    lastModifiedAt: new Date().toISOString(),
    origin: 'local'
  };

  const mockEvents: Event[] = [
    {
      id: 'e1',
      tripId: 'trip-1',
      userId: 'user-1',
      type: 'flight',
      startDatetime: '2026-10-25T08:00:00Z',
      endDatetime: '2026-10-25T10:00:00Z',
      timezone: 'UTC',
      locationName: 'YVR to LAS',
      lat: 0, lng: 0,
      provider: 'AC',
      confirmationNumber: null, pnr: null,
      rawSourceJson: {}, parsedJson: {},
      confidence: 1, status: 'confirmed',
      createdAt: '', lastModifiedAt: '', origin: 'local'
    },
    {
      id: 'e2',
      tripId: 'trip-1',
      userId: 'user-1',
      type: 'flight',
      startDatetime: '2026-10-28T18:00:00Z',
      endDatetime: '2026-10-28T20:00:00Z',
      timezone: 'UTC',
      locationName: 'LAS to YVR',
      lat: 0, lng: 0,
      provider: 'AC',
      confirmationNumber: null, pnr: null,
      rawSourceJson: {}, parsedJson: {},
      confidence: 1, status: 'confirmed',
      createdAt: '', lastModifiedAt: '', origin: 'local'
    }
  ];

  it('should use earliest and latest flight departure dates', () => {
    const range = getTripDisplayRange(mockTrip, mockEvents);
    expect(range.start).toBe('2026-10-25');
    expect(range.end).toBe('2026-10-28');
  });

  it('should fall back to trip dates if no flights exist', () => {
    const range = getTripDisplayRange(mockTrip, []);
    expect(range.start).toBe('2026-10-24');
    expect(range.end).toBe('2026-10-30');
  });
});
