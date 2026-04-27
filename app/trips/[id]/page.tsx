'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { notFound, useRouter } from 'next/navigation';
import { useState, useMemo } from 'react';
import {
  Plane, Hotel, Compass, Bus, CalendarCheck, CheckCircle2, Circle, Trash2, Clock, Pencil, type LucideIcon,
} from 'lucide-react';
import { clsx } from 'clsx';
import { db } from '@/lib/db';
import { detectGaps } from '@/lib/gapDetector';
import { getLayover, formatDuration, getTripDisplayRange } from '@/lib/tripUtils';
import { formatToLocalDate } from '@/lib/dateUtils';
import TimelineCard from '@/app/components/TimelineCard';
import ParsedReviewPanel from '@/app/components/ParsedReviewPanel';
import type { UserPrefs, EventType } from '@/lib/schema';

const CHECKLIST_ITEMS: { label: string; type: EventType; icon: LucideIcon }[] = [
  { label: 'Flights',       type: 'flight',      icon: Plane         },
  { label: 'Accommodation', type: 'hotel',       icon: Hotel         },
  { label: 'Transport',     type: 'transport',   icon: Bus           },
  { label: 'Excursions',    type: 'excursion',   icon: Compass       },
  { label: 'Reservations',  type: 'reservation', icon: CalendarCheck },
];

export default function TripDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [localTitle, setLocalTitle] = useState('');

  const trip = useLiveQuery(() => db.trips.get(params.id), [params.id]);

  // Update localTitle when trip loads
  useMemo(() => {
    if (trip) setLocalTitle(trip.title);
  }, [trip]);

  const handleSaveTitle = async () => {
    if (trip) {
      await db.trips.update(trip.id, { title: localTitle, lastModifiedAt: new Date().toISOString() });
      setIsEditingTitle(false);
    }
  };
  const events = useLiveQuery(
    () => db.events.where('tripId').equals(params.id).toArray(),
    [params.id],
  ) ?? [];

  if (trip === null) notFound();
  if (trip === undefined) return <div className="p-4 text-muted">Loading…</div>;

  const gaps = detectGaps(events, {} as UserPrefs);
  const { start: displayStart, end: displayEnd } = getTripDisplayRange(trip, events);
  const eventsByType = new Map<EventType, typeof events>();
  for (const e of events) {
    const list = eventsByType.get(e.type) ?? [];
    list.push(e);
    eventsByType.set(e.type, list);
  }

  const sorted = [...events].sort((a, b) => {
    if (!a.startDatetime) return 1;
    if (!b.startDatetime) return -1;
    return a.startDatetime.localeCompare(b.startDatetime);
  });

  const handleDelete = async () => {
    setDeleting(true);
    try {
      // Remove from IndexedDB
      await db.events.where('tripId').equals(params.id).delete();
      await db.trips.delete(params.id);
      // Best-effort server delete
      await fetch(`/api/trips/${params.id}`, { method: 'DELETE' }).catch(() => null);
      router.push('/');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5 px-4 py-4">
      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-ink">Delete trip?</h2>
            <p className="mt-2 text-sm text-muted">
              This will permanently delete &quot;{trip.title}&quot; and all its events. This action cannot be undone.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 rounded-xl border border-subtle py-2 text-sm text-muted hover:bg-white/5"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDelete()}
                className="flex-1 rounded-xl bg-red-500 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {isEditingTitle ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={localTitle}
                onChange={(e) => setLocalTitle(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                className="w-full bg-transparent text-2xl font-bold text-ink outline-none border-b border-primary"
              />
            </div>
          ) : (
            <h1 
              onClick={() => setIsEditingTitle(true)}
              className="truncate text-2xl font-bold text-ink cursor-pointer hover:text-primary transition-colors flex items-center gap-2"
            >
              {trip.title}
              <Pencil size={14} className="text-muted/40" />
            </h1>
          )}
          <p className="mt-0.5 text-sm text-muted">
            {formatToLocalDate(displayStart)} — {formatToLocalDate(displayEnd)} · {trip.timezone}
          </p>
          {trip.notes && <p className="mt-2 text-sm text-muted/80">{trip.notes}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1 mt-1">
          <button
            onClick={() => router.push(`/add/parse?tripId=${params.id}`)}
            aria-label="Edit trip"
            className="rounded-xl p-2 text-muted hover:bg-black/[0.06]"
          >
            <Pencil size={18} />
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            aria-label="Delete trip"
            className="rounded-xl p-2 text-muted hover:bg-red-500/10 hover:text-red-400"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Checklist */}
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">Checklist</h3>
        <div className="space-y-2">
          {CHECKLIST_ITEMS.map(({ label, type, icon: Icon }) => {
            let has = (eventsByType.get(type)?.length ?? 0) > 0;
            
            // Special rule for Reservations: also complete if any hotel or excursion has a confirmation number
            if (type === 'reservation' && !has) {
              has = events.some(e => (e.type === 'hotel' || e.type === 'excursion') && !!e.confirmationNumber);
            }

            return (
              <div key={type} className="flex items-center gap-2 rounded-xl border border-subtle bg-card p-3">
                <Icon size={16} className="shrink-0 text-muted" />
                <span className={`flex-1 text-sm ${has ? 'text-ink' : 'text-muted'}`}>{label}</span>
                {has ? (
                  <CheckCircle2 size={16} className="text-success" />
                ) : (
                  <Circle size={16} className="text-muted/40" />
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Action items (Gaps & Reviews) */}
      <ParsedReviewPanel events={events} gaps={gaps} trip={trip} />

      {/* Timeline */}
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">
          Timeline ({events.length})
        </h3>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted">No events yet.</p>
        ) : (
          <div className="space-y-2">
            {sorted.map((ev, i) => {
              const prev = sorted[i - 1];
              const layover = prev ? getLayover(prev, ev) : null;
              return (
                <div key={ev.id} className="space-y-2">
                  {layover && (
                    <div className="flex items-center gap-3 px-2 py-1">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-subtle/30">
                        <Clock size={12} className={clsx("text-muted", layover.isTight && "text-danger")} />
                      </div>
                      <div className="h-px flex-1 bg-subtle/50" />
                      <span className={clsx("text-[10px] font-bold uppercase tracking-wider", layover.isTight ? "text-danger" : "text-muted")}>
                        {formatDuration(layover.durationMinutes)} layover in {layover.location}
                        {layover.isTight && " (TIGHT)"}
                      </span>
                      <div className="h-px flex-1 bg-subtle/50" />
                    </div>
                  )}
                  <TimelineCard event={ev} />
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
