'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, upsertBucketPin } from '@/lib/db';
import type { PinType } from '@/lib/mapUtils';
import { v4 as uuidv4 } from 'uuid';

import MapFilterBar, { type Filter } from '@/app/components/MapFilterBar';

const LeafletMap = dynamic(() => import('@/app/components/LeafletMap'), { ssr: false });

export default function MapPage() {
  const [activeFilters, setActiveFilters] = useState<Set<Filter>>(new Set(['all']));

  const events = useLiveQuery(() => db.events.filter((e) => !!e.lat && !!e.lng).toArray(), []) ?? [];
  const bucketPins = useLiveQuery(() => db.bucketPins.toArray(), []) ?? [];

  const today = new Date().toISOString();

  const allPins = [
    ...events.map((e) => ({
      id: e.id,
      lat: e.lat!,
      lng: e.lng!,
      type: (e.startDatetime && e.startDatetime < today ? 'visited' : 'upcoming') as PinType,
      label: e.locationName ?? e.type,
    })),
    ...bucketPins.map((p) => ({
      id: p.id, lat: p.lat, lng: p.lng,
      type: (p.completed ? 'visited' : 'bucket') as PinType,
      label: p.name,
    })),
  ];

  const filteredPins = allPins.filter(
    (p) => activeFilters.has('all') || activeFilters.has(p.type),
  );

  const toggleFilter = (f: Filter) => {
    if (f === 'all') { setActiveFilters(new Set(['all'])); return; }
    const next = new Set(activeFilters);
    next.delete('all');
    if (next.has(f)) { next.delete(f); if (next.size === 0) next.add('all'); }
    else next.add(f);
    setActiveFilters(next);
  };

  const handleAddPin = useCallback(async (latlng: { lat: number; lng: number }) => {
    const name = prompt('Name this bucket list destination:');
    if (!name) return;
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

  return (
    <div className="relative flex h-[calc(100dvh-4rem-4rem)] flex-col overflow-hidden">
      {/* Persistent Filter Overlay */}
      <div className="absolute inset-x-0 top-0 z-[1000] pointer-events-none">
        <MapFilterBar 
          activeFilters={activeFilters} 
          onToggleFilter={toggleFilter} 
        />
      </div>

      <LeafletMap
        pins={filteredPins}
        onMapClick={handleAddPin}
        className="h-full w-full"
      />
    </div>
  );
}
