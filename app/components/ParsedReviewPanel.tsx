'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, X, ChevronDown, ChevronUp, Eye, Pencil } from 'lucide-react';
import type { Event, Gap, Trip } from '@/lib/schema';
import { db, upsertEvent, upsertTrip } from '@/lib/db';

interface ParsedReviewPanelProps {
  events: Event[];
  gaps?: Gap[];
  trip?: Trip;
}

export default function ParsedReviewPanel({ events, gaps = [], trip }: ParsedReviewPanelProps) {
  const router = useRouter();
  const [showIgnored, setShowIgnored] = useState(false);
  
  // Filter gaps based on ignoredWarnings meta
  const ignoredWarnings = (trip as any)?.meta?.ignoredWarnings || [];
  const visibleGaps = gaps.filter(g => !ignoredWarnings.includes(g.id));
  const ignoredGaps = gaps.filter(g => ignoredWarnings.includes(g.id));

  const needsReview = events.filter((e) => e.status === 'needs_review');

  if (needsReview.length === 0 && visibleGaps.length === 0 && ignoredGaps.length === 0) {
    return null;
  }

  const handleAccept = async (event: Event) => {
    await upsertEvent({ ...event, status: 'confirmed' });
  };

  const handleReject = async (event: Event) => {
    await upsertEvent({ ...event, status: 'confirmed' });
  };

  const handleIgnoreGap = async (gap: Gap) => {
    if (!trip) return;
    const meta = (trip as any).meta || {};
    const ignored = Array.from(new Set([...(meta.ignoredWarnings || []), gap.id]));
    
    await upsertTrip({
      ...trip,
      meta: { ...meta, ignoredWarnings: ignored },
      lastModifiedAt: new Date().toISOString()
    } as any);
  };

  const handleUndoIgnore = async (gapId: string) => {
    if (!trip) return;
    const meta = (trip as any).meta || {};
    const ignored = (meta.ignoredWarnings || []).filter((id: string) => id !== gapId);
    
    await upsertTrip({
      ...trip,
      meta: { ...meta, ignoredWarnings: ignored },
      lastModifiedAt: new Date().toISOString()
    } as any);
  };

  const handleEditTrip = (gap: Gap) => {
    if (!trip) return;
    let section = 'other';
    if (gap.id.startsWith('missing_hotel_coverage')) section = 'accommodation';
    if (gap.id.startsWith('missing_confirmation')) section = 'flights';
    
    router.push(`/add/parse?tripId=${trip.id}&focus=${section}`);
  };

  return (
    <div className="space-y-3">
      {/* Active Warnings & Reviews */}
      {(needsReview.length > 0 || visibleGaps.length > 0) && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 space-y-3">
          <div className="flex items-center gap-2 text-warning font-semibold">
            <AlertCircle size={18} />
            <h3 className="text-sm">Action items for this trip</h3>
          </div>
          
          <div className="space-y-2">
            {needsReview.map((ev) => (
              <div key={ev.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/40 dark:bg-black/20 p-2 text-sm backdrop-blur-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink truncate">{ev.locationName || ev.type}</p>
                  <p className="text-xs text-muted truncate">Geocode might be inaccurate</p>
                </div>
                <div className="flex items-center gap-1 text-ink">
                  <button onClick={() => handleAccept(ev)} className="p-1.5 hover:bg-success/20 rounded-md text-success" title="Accept">
                    <Check size={16} />
                  </button>
                  <button onClick={() => handleReject(ev)} className="p-1.5 hover:bg-danger/20 rounded-md text-danger" title="Reject">
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}

            {visibleGaps.map((gap: Gap) => (
              <div key={gap.id} className="flex items-start justify-between gap-3 rounded-lg bg-white/40 dark:bg-black/20 p-2 text-sm backdrop-blur-sm">
                <div className="min-w-0 flex-1">
                  <p className="text-ink/90">{gap.message}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button 
                    onClick={() => handleEditTrip(gap)}
                    className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-tight text-primary hover:text-primary/80 px-1.5 py-1"
                    aria-label={`Edit trip details to fix ${gap.id}`}
                  >
                    <Pencil size={12} />
                    <span>Edit</span>
                  </button>
                  <button 
                    onClick={() => handleIgnoreGap(gap)} 
                    className="shrink-0 text-[10px] font-bold uppercase tracking-tight text-muted hover:text-ink px-1.5 py-1"
                  >
                    Ignore
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ignored Warnings Section */}
      {ignoredGaps.length > 0 && (
        <div className="rounded-xl border border-subtle bg-card overflow-hidden">
          <button 
            onClick={() => setShowIgnored(!showIgnored)}
            className="flex w-full items-center justify-between px-4 py-2 text-xs font-medium text-muted hover:bg-black/[0.02] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Eye size={12} />
              <span>Ignored warnings ({ignoredGaps.length})</span>
            </div>
            {showIgnored ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          
          {showIgnored && (
            <div className="border-t border-subtle divide-y divide-subtle bg-black/[0.01]">
              {ignoredGaps.map((gap: Gap) => (
                <div key={gap.id} className="flex items-center justify-between gap-3 px-4 py-2 text-xs">
                  <span className="text-muted italic flex-1">{gap.message}</span>
                  <button 
                    onClick={() => handleUndoIgnore(gap.id)}
                    className="text-primary font-semibold hover:underline"
                  >
                    Undo
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
