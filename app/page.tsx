'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useMemo, useEffect } from 'react';
import { ChevronRight, Bell, Trash2, Map, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { uuidv4 } from '@/lib/uuid';
import { db } from '@/lib/db';
import { detectGaps } from '@/lib/gapDetector';
import TimelineCard from '@/app/components/TimelineCard';
import GapAlert from '@/app/components/GapAlert';
import type { Trip, Event, UserPrefs } from '@/lib/schema';

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
  } catch {
    return dateStr;
  }
}

function NextTripCard({ trip, events }: { trip: Trip; events: Event[] }) {
  const displayStart = (trip as any).meta?.displayStart || trip.startDate;
  const displayEnd   = (trip as any).meta?.displayEnd   || trip.endDate;
  const days = daysUntil(displayStart);
  const gaps = detectGaps(events, {} as UserPrefs);
  return (
    <Link href={`/trips/${trip.id}`} className="glass block rounded-2xl p-4 hover:bg-black/[0.04] active:scale-[0.99] transition-transform">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-primary">Next trip</p>
          <h2 className="mt-1 text-xl font-bold text-ink">{trip.title}</h2>
          <p className="mt-0.5 text-sm text-muted">
            {formatDate(displayStart)}
            {' — '}
            {formatDate(displayEnd)}
          </p>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-3xl font-bold text-ink">{days < 0 ? '—' : days}</span>
          <span className="text-xs text-muted">{days >= 0 ? 'days' : 'past'}</span>
        </div>
      </div>
      {gaps.length > 0 && (
        <div className="mt-3 flex items-center gap-1 text-xs text-warning">
          <Bell size={12} />
          {gaps.length} gap{gaps.length > 1 ? 's' : ''} detected
        </div>
      )}
    </Link>
  );
}

function TripBucket({ trip, events }: { trip: Trip; events: Event[] }) {
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(trip.title);

  const handleSaveTitle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await db.trips.update(trip.id, { title, lastModifiedAt: new Date().toISOString() });
    setIsEditing(false);
  };

  return (
    <div className="space-y-2">
      <div
        onClick={() => !isEditing && setExpanded(!expanded)}
        className="glass flex w-full items-center justify-between rounded-xl p-4 hover:bg-black/[0.04] transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Map size={20} />
          </div>
          <div className="text-left min-w-0 flex-1">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full bg-transparent font-bold text-ink outline-none border-b border-primary"
                />
                <button
                  onClick={handleSaveTitle}
                  className="p-1 text-primary hover:bg-primary/10 rounded"
                >
                  Save
                </button>
              </div>
            ) : (
              <h3 className="font-bold text-ink truncate flex items-center gap-2">
                {trip.title}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditing(true);
                  }}
                  className="p-1 text-muted hover:text-primary transition-colors"
                >
                  <Pencil size={12} />
                </button>
              </h3>
            )}
            <p className="text-xs text-muted">{events.length} events</p>
          </div>
        </div>
        {expanded ? <ChevronUp size={20} className="text-muted" /> : <ChevronDown size={20} className="text-muted" />}
      </div>
      {expanded && (
        <div className="ml-4 space-y-2 border-l-2 border-primary/20 pl-4 py-2">
          {events.map((ev) => (
            <TimelineCard key={ev.id} event={ev} compact />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);

  const trips = useLiveQuery(
    () => db.trips.orderBy('startDate').toArray(),
    [],
  ) ?? [];

  const upcomingTrips = trips.filter((t) => t.endDate >= today);
  const nextTrip = upcomingTrips[0] ?? null;

  const nextTripEvents = useLiveQuery(
    // reason: useLiveQuery can't infer the union; explicit Promise<Event[]> cast needed
    (): Promise<Event[]> => (nextTrip ? db.events.where('tripId').equals(nextTrip.id).toArray() : Promise.resolve([])),
    [nextTrip?.id],
  ) ?? [];

  const nearestEvents = useLiveQuery(
    () =>
      db.events
        .filter((e) => !!e.startDatetime && e.startDatetime >= new Date().toISOString())
        .limit(10)
        .toArray(),
    [],
  ) ?? [];

  const groupedEvents = useMemo(() => {
    return nearestEvents.reduce((acc, ev) => {
      if (!acc[ev.tripId]) acc[ev.tripId] = [];
      acc[ev.tripId]!.push(ev);
      return acc;
    }, {} as Record<string, Event[]>);
  }, [nearestEvents]);

  const gaps = nextTrip ? detectGaps(nextTripEvents, {} as UserPrefs) : [];

  const handleGapAction = async (actionId: string, relatedEventIds: string[]) => {
    if (actionId === 'ignore_confirmation') {
      const eventId = relatedEventIds[0];
      if (eventId) {
        await db.events.update(eventId, { ignoreConfirmation: true });
      }
    } else if (['add_flight', 'add_train', 'add_hotel', 'add_airbnb'].includes(actionId)) {
      const eventId = relatedEventIds[0];
      let tId = nextTrip?.id;
      if (eventId) {
        const ev = nextTripEvents.find(e => e.id === eventId);
        if (ev) tId = ev.tripId;
      }
      router.push(`/add/parse?tripId=${tId}`);
    }
  };

  const handleDeleteTrip = async (e: React.MouseEvent, tripId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this trip?')) return;
    
    await db.events.where('tripId').equals(tripId).delete();
    await db.trips.delete(tripId);
    await fetch(`/api/trips/${tripId}`, { method: 'DELETE' }).catch(() => null);
  };

  return (
    <div className="space-y-5 px-4 py-4">
      {/* Greeting */}
      <div>
        <p className="text-sm text-muted">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        <h1 className="text-2xl font-bold text-ink">Dashboard</h1>
      </div>

      {/* Next trip card */}
      {nextTrip ? (
        <NextTripCard trip={nextTrip} events={nextTripEvents} />
      ) : (
        <div className="glass rounded-2xl p-6 text-center">
          <p className="text-muted">No upcoming trips.</p>
          <Link href="/add/parse" className="mt-2 inline-block text-sm font-medium text-primary hover:underline">
            Add your first trip →
          </Link>
        </div>
      )}

      {/* Gap alerts */}
      {gaps.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">
            Gaps detected
          </h3>
          <div className="space-y-2">
            {gaps.map((gap, i) => (
              <GapAlert 
                key={i} 
                gap={gap} 
                onAction={(actionId) => handleGapAction(actionId, gap.relatedEventIds)} 
              />
            ))}
          </div>
        </section>
      )}

      {/* Timeline */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">
            Upcoming events
          </h3>
          {upcomingTrips[0] && (
            <Link href={`/trips/${upcomingTrips[0].id}`} className="flex items-center gap-0.5 text-xs text-primary">
              See all <ChevronRight size={12} />
            </Link>
          )}
        </div>
        {nearestEvents.length === 0 ? (
          <p className="text-sm text-muted">No upcoming events.</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(groupedEvents).map(([tripId, evs]) => {
              const trip = trips.find(t => t.id === tripId);
              if (!trip) return null;
              return <TripBucket key={tripId} trip={trip} events={evs} />;
            })}
          </div>
        )}
      </section>

      {/* All trips list */}
      {trips.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">All trips</h3>
          <div className="space-y-2">
            {trips.map((trip) => {
              const displayStart = (trip as any).meta?.displayStart || trip.startDate;
              const displayEnd   = (trip as any).meta?.displayEnd   || trip.endDate;
              return (
                <Link
                  key={trip.id}
                  href={`/trips/${trip.id}`}
                  className="glass flex items-center justify-between rounded-xl p-3 hover:bg-black/[0.04] group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">{trip.title}</p>
                    <p className="text-xs text-muted">
                      {displayStart} – {displayEnd}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleDeleteTrip(e, trip.id)}
                      className="p-2 text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Delete trip"
                    >
                      <Trash2 size={16} />
                    </button>
                    <ChevronRight size={16} className="text-muted" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
