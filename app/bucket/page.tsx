'use client';

import { useState, useCallback, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import { db, upsertBucketPin } from '@/lib/db';
import BucketListMap from '@/app/components/BucketListMap';

export default function BucketPage() {
  const pins = useLiveQuery(() => db.bucketPins.toArray(), []) ?? [];
  const trips = useLiveQuery(() => db.trips.toArray(), []) ?? [];
  const events = useLiveQuery(() => db.events.toArray(), []) ?? [];
  
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<'map' | 'list'>('map');

  const visitedCountries = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const countries = new Set<string>();

    // Countries from completed bucket pins
    pins.forEach(p => {
      if (p.completed && p.country) countries.add(p.country);
    });

    // Countries from past trips
    const pastTrips = trips.filter(t => t.endDate < today);
    const pastTripIds = new Set(pastTrips.map(t => t.id));
    
    events.forEach(e => {
      if (pastTripIds.has(e.tripId)) {
        // This is simplified; ideally we'd have a country field on events
        // For now, if it was an airport code in parsedJson, we might have lat/lng
        // but we'll stick to completed pins for the most reliable country data 
        // as per the user's specific "I put las vegas on my bucket list" comment.
      }
    });

    return Array.from(countries);
  }, [pins, trips, events]);

  const handleAddPin = useCallback(async (latlng: { lat: number; lng: number; name?: string }) => {
    const name = latlng.name ?? 'New destination';
    await upsertBucketPin({
      id: uuidv4(),
      userId: '00000000-0000-4000-a000-000000000001',
      name,
      lat: latlng.lat,
      lng: latlng.lng,
      priority: 2,
      completed: false,
      createdAt: new Date().toISOString(),
      lastModifiedAt: new Date().toISOString(),
      origin: 'local',
    });
  }, []);

  const handleDeletePin = useCallback(async (id: string) => {
    await db.bucketPins.delete(id);
  }, []);

  const selectedPin = pins.find((p) => p.id === selectedId);

  return (
    <div className="flex h-[calc(100dvh-4rem-4rem)] flex-col gap-3 px-4 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-ink">Bucket List</h1>
        <button 
          onClick={() => setView(view === 'map' ? 'list' : 'map')}
          className="rounded-pill bg-black/[0.06] px-2 py-0.5 text-xs text-muted hover:bg-black/[0.10] active:scale-95 transition-all"
        >
          {pins.length} {pins.length === 1 ? 'place' : 'places'} (click to {view === 'map' ? 'list' : 'map'})
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        <BucketListMap
          pins={pins}
          visitedCountries={visitedCountries}
          view={view}
          onViewChange={setView}
          onPinClick={setSelectedId}
          onAddPin={handleAddPin}
          onDeletePin={handleDeletePin}
        />
      </div>

      {/* Pin detail bottom sheet */}
      {selectedPin && (
        <div className="glass rounded-2xl p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-ink">{selectedPin.name}</p>
              {selectedPin.country && <p className="text-xs text-muted">{selectedPin.country}</p>}
              {selectedPin.notes && <p className="mt-1 text-sm text-muted">{selectedPin.notes}</p>}
            </div>
            <button
              onClick={() => setSelectedId(null)}
              className="text-muted hover:text-ink text-lg leading-none"
            >
              ×
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={async () => {
                await upsertBucketPin({
                  ...selectedPin,
                  completed: !selectedPin.completed,
                  completedDate: !selectedPin.completed ? new Date().toISOString().slice(0, 10) : undefined,
                  lastModifiedAt: new Date().toISOString(),
                });
              }}
              className="rounded-pill bg-primary/20 px-3 py-1 text-xs text-primary"
            >
              {selectedPin.completed ? 'Mark planned' : 'Mark visited'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
