import { syncTripToBucketList } from '../lib/bucketUpdater';
import { db } from '../lib/db';
import type { Trip, Event } from '../lib/schema';

// Mock Dexie
jest.mock('../lib/db', () => {
  const mockTable = {
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    where: jest.fn().mockReturnThis(),
    equals: jest.fn().mockReturnThis(),
    toArray: jest.fn().mockResolvedValue([]),
  };
  return {
    db: {
      bucketPins: mockTable,
      trips: mockTable,
      events: mockTable,
    },
    upsertBucketPin: jest.fn().mockResolvedValue(undefined),
  };
});

import { upsertBucketPin } from '../lib/db';

describe('Bucket Auto-add Removal (Task 4)', () => {
  const STUB_USER = '00000000-0000-4000-a000-000000000001';
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should NOT create bucket pins from flights alone', async () => {
    const trip: Trip = {
      id: 'trip-123',
      userId: STUB_USER,
      title: 'Test Trip',
      startDate: '2023-02-02',
      endDate: '2023-02-07',
      timezone: 'UTC',
      dataVersion: 1,
      createdAt: '',
      lastModifiedAt: '',
      origin: 'local',
      meta: {
        autoAddToBucket: true,
        // NO primaryDestination
      }
    } as any;

    await syncTripToBucketList(trip);

    // Should NOT call upsertBucketPin because primaryDestination is missing
    expect(upsertBucketPin).not.toHaveBeenCalled();
  });

  it('should ONLY create bucket pin from primaryDestination', async () => {
    const trip: Trip = {
      id: 'trip-456',
      userId: STUB_USER,
      title: 'Hawaii Trip',
      startDate: '2023-02-02',
      endDate: '2023-02-07',
      timezone: 'UTC',
      dataVersion: 1,
      createdAt: '',
      lastModifiedAt: '',
      origin: 'local',
      meta: {
        autoAddToBucket: true,
        primaryDestination: {
          name: 'Honolulu',
          lat: 21.3069,
          lng: -157.8583,
          country: 'US'
        }
      }
    } as any;

    await syncTripToBucketList(trip);

    // Should call upsertBucketPin EXACTLY once for the primary destination
    expect(upsertBucketPin).toHaveBeenCalledTimes(1);
    const pin = (upsertBucketPin as jest.Mock).mock.calls[0][0];
    expect(pin.name).toBe('Honolulu');
    expect(pin.id).toBe('trip-456-dest');
  });

  it('should NOT create bucket pin if autoAddToBucket is false', async () => {
    const trip: Trip = {
      id: 'trip-789',
      userId: STUB_USER,
      title: 'Manual Trip',
      startDate: '2023-02-02',
      endDate: '2023-02-07',
      timezone: 'UTC',
      dataVersion: 1,
      createdAt: '',
      lastModifiedAt: '',
      origin: 'local',
      meta: {
        autoAddToBucket: false,
        primaryDestination: {
          name: 'Honolulu',
          lat: 21.3069,
          lng: -157.8583
        }
      }
    } as any;

    await syncTripToBucketList(trip);

    // Should NOT call upsertBucketPin
    expect(upsertBucketPin).not.toHaveBeenCalled();
  });
});
