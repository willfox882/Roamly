'use client';

import {
  Plane, Hotel, Compass, Bus, CalendarCheck, HelpCircle, Pencil, AlertCircle, type LucideIcon,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useState } from 'react';
import { upsertEvent } from '@/lib/db';
import type { Event, EventType } from '@/lib/schema';
import { formatWallClock } from '@/lib/dateUtils';
import iataTable from '@/lib/data/iata.json';

interface TimelineCardProps {
  event: Event;
  compact?: boolean;
  onEdit?: () => void;
}

const typeIcon: Record<EventType, LucideIcon> = {
  flight:      Plane,
  hotel:       Hotel,
  excursion:   Compass,
  transport:   Bus,
  reservation: CalendarCheck,
  other:       HelpCircle,
};

function confidenceBadge(c: number) {
  if (c >= 0.8) return null;
  const label = c >= 0.6 ? 'review' : 'low';
  return (
    <span className="rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-semibold text-warning">
      {label}
    </span>
  );
}

export default function TimelineCard({ event, compact, onEdit }: TimelineCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(event.locationName ?? '');

  const Icon = typeIcon[event.type];
  const isReview = event.status === 'needs_review';
  const isCancelled = event.status === 'cancelled';

  const formatDt = (iso: string | null, isEnd: boolean = false): string => {
    const displayField = isEnd ? (event as any).displayEndDatetime : (event as any).displayStartDatetime;
    if (displayField) return formatWallClock(displayField);
    
    if (!iso) return '—';
    // Roamly mandate: No automatic timezone conversion. 
    // Display the wall-clock time as entered by the user.
    return formatWallClock(iso);
  };

  const handleSave = async () => {
    await upsertEvent({ ...event, locationName: name });
    setIsEditing(false);
  };

  return (
    <div
      className={clsx(
        'glass rounded-xl p-3 transition-colors',
        isReview && 'ring-1 ring-warning/60',
        isCancelled && 'opacity-50',
        !compact && 'space-y-2',
      )}
    >
      {/* Header row */}
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/[0.06]">
          <Icon size={16} className="text-primary" />
        </span>

        <div className="min-w-0 flex-1">
          {isEditing ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              className="w-full bg-transparent text-sm font-semibold text-ink outline-none border-b border-primary"
            />
          ) : (
            <p className={clsx('truncate text-sm font-semibold text-ink', isCancelled && 'line-through')}>
              {event.locationName ?? event.provider ?? event.type}
            </p>
          )}
          {event.provider && event.locationName && (
            <p className="truncate text-xs text-muted">{event.provider}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {isReview && <AlertCircle size={14} className="text-warning" />}
          {confidenceBadge(event.confidence)}
          <button
            onClick={() => onEdit ? onEdit() : setIsEditing(!isEditing)}
            aria-label="Edit event"
            className="touch-target flex items-center justify-center rounded-lg p-1.5 hover:bg-black/[0.06]"
          >
            <Pencil size={14} className="text-muted" />
          </button>
        </div>
      </div>

      {/* Datetime */}
      {!compact && (
        <p className="text-xs text-muted">
          {formatDt(event.startDatetime)}
          {event.endDatetime && ` → ${formatDt(event.endDatetime, true)}`}
        </p>
      )}
    </div>
  );
}
