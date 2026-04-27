'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import { Loader2 } from 'lucide-react';
import { db, upsertEvent, upsertTrip } from '@/lib/db';
import { parseEmail, deriveTripTitle } from '@/lib/parser';
import { useUIStore } from '@/lib/store';
import { syncTripToBucketList } from '@/lib/bucketUpdater';
import { getTripDisplayRange } from '@/lib/tripUtils';
import AddTripForm from '@/app/components/AddTripForm';
import ConsentModal from '@/app/components/ConsentModal';
import type { ParsedEvent, Trip, Event as TripEvent } from '@/lib/schema';

const STUB_USER = '00000000-0000-4000-a000-000000000001';

export default function ParsePage() {
  const router  = useRouter();
  const searchParams = useSearchParams();
  const existingTripId = searchParams.get('tripId');
  const consent       = useUIStore((s) => s.aiConsent);
  const setAiConsent  = useUIStore((s) => s.setAiConsent);

  // Consent gate: on the first paste-parse attempt where AI is not yet enabled,
  // show the modal and defer the parse until the user agrees or declines.
  const [consentOpen, setConsentOpen] = useState(false);
  const pendingResolve = useRef<((events: ParsedEvent[]) => void) | null>(null);
  const pendingText    = useRef<string>('');
  const consentDecided = useRef<boolean>(consent.enabled || consent.provider === 'none');

  // Fetch existing trip data if editing
  const existingTrip = useLiveQuery(
    (): Promise<Trip | undefined> => (existingTripId ? db.trips.get(existingTripId) : Promise.resolve(undefined)),
    [existingTripId]
  );
  
  const existingEvents = useLiveQuery(
    (): Promise<TripEvent[]> => (existingTripId ? db.events.where('tripId').equals(existingTripId).toArray() : Promise.resolve([])),
    [existingTripId]
  );

  const runParse = useCallback(
    async (rawText: string, useAi: boolean): Promise<ParsedEvent[]> => {
      if (useAi) {
        try {
          const res = await fetch('/api/events/parse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ raw_text: rawText, provider: consent.provider }),
          });
          if (res.ok) {
            const { data } = (await res.json()) as { data: ParsedEvent[] };
            if (Array.isArray(data) && data.length > 0) return data;
          }
        } catch {
          // fall through to deterministic
        }
      }
      // Deterministic fallback — always works offline
      return parseEmail(rawText);
    },
    [consent.provider],
  );

  const handleParse = useCallback(
    (rawText: string): Promise<ParsedEvent[]> => {
      // If the user has already decided (either way), just run.
      if (consentDecided.current) {
        const useAi = consent.enabled && consent.provider !== 'none';
        return runParse(rawText, useAi);
      }
      // Otherwise gate behind the modal; resolve once the user picks.
      return new Promise<ParsedEvent[]>((resolve) => {
        pendingText.current    = rawText;
        pendingResolve.current = resolve;
        setConsentOpen(true);
      });
    },
    [consent.enabled, consent.provider, runParse],
  );

  const handleConsentAgree = useCallback(() => {
    setAiConsent({ enabled: true, provider: 'cloud' });
    consentDecided.current = true;
    setConsentOpen(false);
    const text    = pendingText.current;
    const resolve = pendingResolve.current;
    pendingText.current    = '';
    pendingResolve.current = null;
    if (resolve) runParse(text, true).then(resolve);
  }, [setAiConsent, runParse]);

  const handleConsentDecline = useCallback(() => {
    setAiConsent({ enabled: false, provider: 'none' });
    consentDecided.current = true;
    setConsentOpen(false);
    const text    = pendingText.current;
    const resolve = pendingResolve.current;
    pendingText.current    = '';
    pendingResolve.current = null;
    if (resolve) runParse(text, false).then(resolve);
  }, [setAiConsent, runParse]);

  const handleSave = useCallback(
    async (events: ParsedEvent[], tripId: string | null, options: any) => {
      let resolvedTripId = tripId || existingTripId;
      const { manualTitle, primaryDestination, autoAddToBucket } = options;

      let finalTrip: Trip;

      if (resolvedTripId) {
        // Clear old events to ensure a clean state matching the form's current view
        await db.events.where('tripId').equals(resolvedTripId).delete();
        
        const trip = await db.trips.get(resolvedTripId);
        if (trip) {
          const chronoSorted = [...events].sort((a, b) => {
            if (!a.startDatetime) return 1;
            if (!b.startDatetime) return -1;
            return new Date(a.startDatetime).getTime() - new Date(b.startDatetime).getTime();
          });
          const firstEvent  = chronoSorted[0];
          const lastEvent   = chronoSorted[chronoSorted.length - 1];
          const startDate   = firstEvent?.startDatetime?.slice(0, 10) ?? trip.startDate;
          const endDate     = lastEvent?.endDatetime?.slice(0, 10) ?? startDate;

          const displayRange = getTripDisplayRange(trip, events as any);

          finalTrip = {
            ...trip,
            title: manualTitle || trip.title,
            startDate,
            endDate,
            lastModifiedAt: new Date().toISOString(),
            meta: {
              ...((trip as any).meta || {}),
              primaryDestination,
              autoAddToBucket,
              displayStart: displayRange.start,
              displayEnd: displayRange.end
            }
          } as any;
          await upsertTrip(finalTrip);
        } else {
          throw new Error('Trip not found');
        }
      } else {
        // Create a new trip
        const chronoSorted = [...events].sort((a, b) => {
          if (!a.startDatetime) return 1;
          if (!b.startDatetime) return -1;
          return new Date(a.startDatetime).getTime() - new Date(b.startDatetime).getTime();
        });
        const firstEvent  = chronoSorted[0];
        const startDate   = firstEvent?.startDatetime?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
        const lastEvent   = chronoSorted[chronoSorted.length - 1];
        const endDate     = lastEvent?.endDatetime?.slice(0, 10) ?? startDate;
        
        const displayRange = getTripDisplayRange({ startDate, endDate } as any, events as any);

        finalTrip = {
          id:             uuidv4(),
          userId:         STUB_USER,
          title:          manualTitle || deriveTripTitle(events),
          startDate,
          endDate,
          timezone:       firstEvent?.timezone ?? 'UTC',
          dataVersion:    1,
          createdAt:      new Date().toISOString(),
          lastModifiedAt: new Date().toISOString(),
          origin:         'local',
          meta: {
            primaryDestination,
            autoAddToBucket,
            displayStart: displayRange.start,
            displayEnd: displayRange.end
          }
        } as any;
        await upsertTrip(finalTrip);
        resolvedTripId = finalTrip.id;
      }

      // Sync to bucket list
      await syncTripToBucketList(finalTrip);

      const now = new Date().toISOString();
      for (const ev of events) {
        if (!resolvedTripId) continue;
        await upsertEvent({
          id:                 uuidv4(),
          tripId:             resolvedTripId,
          userId:             STUB_USER,
          type:               ev.type,
          startDatetime:      ev.startDatetime,
          endDatetime:        ev.endDatetime,
          // Carry over display fields for wall-clock time display
          displayStartDatetime: (ev as any).displayStartDatetime,
          displayEndDatetime:   (ev as any).displayEndDatetime,
          timezone:           ev.timezone,
          locationName:       ev.locationName,
          lat:                ev.lat,
          lng:                ev.lng,
          provider:           ev.provider,
          confirmationNumber: ev.confirmationNumber,
          pnr:                ev.pnr,
          rawSourceJson:      ev.rawSourceJson,
          parsedJson:         ev.parsedJson,
          confidence:         ev.confidence,
          status:             ev.status,
          createdAt:          now,
          lastModifiedAt:     now,
          origin:             'local',
        });
      }

      router.push(`/trips/${resolvedTripId}`);
    },
    [router, existingTripId],
  );

  // Loading state for edit mode
  if (existingTripId && (existingTrip === undefined || existingEvents === undefined)) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface p-4 text-muted">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-primary" />
          <p className="text-sm font-medium">Loading trip details…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <AddTripForm
        onClose={() => router.back()}
        onParse={handleParse}
        onSave={handleSave}
        initialTripId={existingTripId}
        initialEvents={existingEvents}
        initialTitle={existingTrip?.title}
        initialDestination={(existingTrip as any)?.meta?.primaryDestination}
        initialAutoAdd={(existingTrip as any)?.meta?.autoAddToBucket}
        initialMeta={(existingTrip as any)?.meta}
        aiConsent={consent.enabled && consent.provider !== 'none'}
        onShowConsent={() => setConsentOpen(true)}
      />
      <ConsentModal
        open={consentOpen}
        onAgree={handleConsentAgree}
        onDecline={handleConsentDecline}
      />
    </>
  );
}
