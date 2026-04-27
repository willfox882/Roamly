import type { Trip } from './schema';
import { db, upsertBucketPin } from './db';

export interface BucketAction {
  shouldAdd: boolean;
  status: 'upcoming' | 'completed' | 'today';
}

/**
 * Determines the bucket list action for a trip based on its dates and metadata.
 */
export function determineBucketAction(trip: Trip, todayDate: string): BucketAction | null {
  const dest = (trip as any).meta?.primaryDestination;
  const autoAdd = (trip as any).meta?.autoAddToBucket ?? true;

  if (!dest || !autoAdd) {
    return { shouldAdd: false, status: 'upcoming' };
  }

  const { startDate, endDate } = trip;

  if (endDate < todayDate) {
    return { shouldAdd: true, status: 'completed' };
  } else if (startDate > todayDate) {
    return { shouldAdd: true, status: 'upcoming' };
  } else {
    // Current trip (start <= today <= end)
    return { shouldAdd: true, status: 'today' };
  }
}

/**
 * Syncs the trip destination to the bucket list.
 * Uses a deterministic ID based on tripId to ensure updates replace the same pin.
 */
export async function syncTripToBucketList(trip: Trip) {
  const todayDate = new Date().toISOString().slice(0, 10);
  const action = determineBucketAction(trip, todayDate);
  const dest = (trip as any).meta?.primaryDestination;
  const pinId = `${trip.id}-dest`;

  if (!action || !action.shouldAdd || !dest) {
    // If auto-add is disabled or destination removed, we might want to remove the auto-added pin
    const existing = await db.bucketPins.get(pinId);
    if (existing) {
      await db.bucketPins.delete(pinId);
    }
    return;
  }

  await upsertBucketPin({
    id: pinId,
    userId: trip.userId,
    name: dest.name,
    lat: dest.lat,
    lng: dest.lng,
    country: dest.country || '',
    priority: 2,
    completed: action.status === 'completed',
    completedDate: action.status === 'completed' ? trip.endDate : undefined,
    notes: `Automatically added from trip: ${trip.title}`,
    createdAt: new Date().toISOString(),
    lastModifiedAt: new Date().toISOString(),
    origin: 'local',
  });
}
