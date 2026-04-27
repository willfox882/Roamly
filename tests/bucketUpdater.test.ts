import { determineBucketAction } from '../lib/bucketUpdater';
import type { Trip } from '../lib/schema';

describe('determineBucketAction', () => {
  const baseTrip: Trip = {
    id: 'trip-1',
    userId: 'user-1',
    title: 'Test Trip',
    startDate: '2025-01-01',
    endDate: '2025-01-05',
    timezone: 'UTC',
    dataVersion: 1,
    createdAt: new Date().toISOString(),
    lastModifiedAt: new Date().toISOString(),
    origin: 'local'
  };

  const today = '2025-01-03';

  it('should return shouldAdd: false if destination is missing', () => {
    const trip = { ...baseTrip };
    const result = determineBucketAction(trip, today);
    expect(result?.shouldAdd).toBe(false);
  });

  it('should return shouldAdd: false if autoAddToBucket is false', () => {
    const trip = { 
      ...baseTrip, 
      meta: { 
        primaryDestination: { name: 'HNL', lat: 0, lng: 0 },
        autoAddToBucket: false 
      } 
    } as any;
    const result = determineBucketAction(trip, today);
    expect(result?.shouldAdd).toBe(false);
  });

  it('should return status completed if trip is in the past', () => {
    const trip = { 
      ...baseTrip, 
      startDate: '2024-12-01',
      endDate: '2024-12-10',
      meta: { primaryDestination: { name: 'HNL', lat: 0, lng: 0 } } 
    } as any;
    const result = determineBucketAction(trip, today);
    expect(result?.shouldAdd).toBe(true);
    expect(result?.status).toBe('completed');
  });

  it('should return status upcoming if trip is in the future', () => {
    const trip = { 
      ...baseTrip, 
      startDate: '2025-02-01',
      endDate: '2025-02-10',
      meta: { primaryDestination: { name: 'HNL', lat: 0, lng: 0 } } 
    } as any;
    const result = determineBucketAction(trip, today);
    expect(result?.shouldAdd).toBe(true);
    expect(result?.status).toBe('upcoming');
  });

  it('should return status today if trip includes today', () => {
    const trip = { 
      ...baseTrip, 
      startDate: '2025-01-01',
      endDate: '2025-01-10',
      meta: { primaryDestination: { name: 'HNL', lat: 0, lng: 0 } } 
    } as any;
    const result = determineBucketAction(trip, today);
    expect(result?.shouldAdd).toBe(true);
    expect(result?.status).toBe('today');
  });
});
