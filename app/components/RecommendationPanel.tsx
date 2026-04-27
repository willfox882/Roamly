'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Loader2, RefreshCw, MapPin, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { v4 as uuidv4 } from 'uuid';
import { db, upsertEvent } from '@/lib/db';
import type { Recommendation } from '@/lib/schema';

interface RecommendationPanelProps {
  lat: number;
  lng: number;
  startDate: string;
  endDate: string;
  tripId?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  food: '🍜 Food', hike: '🥾 Hike', market: '🛒 Market',
  viewpoint: '🌄 View', day_trip: '🚌 Day trip', museum: '🏛 Museum',
};

const PRICE_DOTS: Record<string, string> = {
  free: '·', cheap: '··', moderate: '···', expensive: '····',
};

const STUB_USER = '00000000-0000-4000-a000-000000000001';

export default function RecommendationPanel({
  lat, lng, startDate, endDate, tripId,
}: RecommendationPanelProps) {
  const [recs, setRecs]     = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [added, setAdded]   = useState<Set<string>>(new Set());

  const EMPTY_ARR: string[] = [];
  const exclusions = useLiveQuery(
    () => db.exclusions.toArray().then((rows) => rows.map((r) => r.placeName)),
    [],
  ) ?? EMPTY_ARR;

  const exclusionsRef = useRef(exclusions);
  useEffect(() => { exclusionsRef.current = exclusions; }, [exclusions]);

  const fetch = useCallback(
    async (bust = false) => {
      setLoading(true);
      setError(null);
      const currentExclusions = exclusionsRef.current;
      try {
        const res = await window.fetch('/api/ai/recommend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat, lng, startDate, endDate, exclusions: currentExclusions, preferences: {} }),
          cache: bust ? 'no-store' : 'default',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { data, error: apiErr } = await res.json() as { data: Recommendation[] | null; error: unknown };
        if (apiErr || !data) throw new Error(String(apiErr));
        setRecs(data);
        setLoaded(true);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    },
    [lat, lng, startDate, endDate],
  );

  const addToTrip = useCallback(
    async (rec: Recommendation) => {
      if (!tripId) return;
      const now = new Date().toISOString();
      await upsertEvent({
        id: uuidv4(),
        tripId,
        userId: STUB_USER,
        type: 'excursion',
        startDatetime: startDate ? `${startDate}T10:00:00Z` : null,
        endDatetime: null,
        timezone: null,
        locationName: rec.name,
        lat: rec.lat ?? null,
        lng: rec.lng ?? null,
        provider: null,
        confirmationNumber: null,
        pnr: null,
        rawSourceJson: rec,
        parsedJson: rec,
        confidence: rec.confidence,
        status: 'tentative',
        createdAt: now,
        lastModifiedAt: now,
        origin: 'local',
      });
      setAdded((prev) => new Set([...prev, rec.id]));
    },
    [tripId, startDate],
  );

  if (!loaded && !loading) {
    return (
      <div className="rounded-xl border border-subtle bg-card p-4 text-center">
        <p className="mb-3 text-sm text-muted">Get lowkey local recommendations for this area.</p>
        <button
          onClick={() => fetch()}
          className="touch-target rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
        >
          Get recommendations
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-muted">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">Finding hidden gems…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-danger/30 bg-danger/10 p-4">
        <p className="text-sm text-danger">{error}</p>
        <button onClick={() => fetch()} className="mt-2 text-xs text-primary hover:underline">
          Try again
        </button>
      </div>
    );
  }

  if (recs.length === 0) {
    return (
      <div className="rounded-xl border border-subtle bg-card p-4 text-center">
        <p className="text-sm text-muted">No recommendations available for this location.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Lowkey picks
        </h3>
        <button
          onClick={() => fetch(true)}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      {recs.map((rec) => {
        const isAdded = added.has(rec.id);
        return (
          <div key={rec.id} className="glass rounded-xl p-3 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-semibold text-ink">{rec.name}</span>
                  <span className="text-xs text-muted">
                    {CATEGORY_LABELS[rec.category] ?? rec.category}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted/80">{rec.description}</p>
              </div>

              {tripId && (
                <button
                  onClick={() => addToTrip(rec)}
                  disabled={isAdded}
                  aria-label={isAdded ? 'Added' : 'Add to trip'}
                  className={clsx(
                    'touch-target flex shrink-0 items-center justify-center rounded-lg p-1.5 transition-colors',
                    isAdded
                      ? 'bg-success/20 text-success'
                      : 'bg-primary/20 text-primary hover:bg-primary/30',
                  )}
                >
                  <Plus size={14} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-muted">
              {rec.lat && rec.lng && <MapPin size={10} />}
              {rec.reasoning && (
                <span className="truncate italic">&ldquo;{rec.reasoning}&rdquo;</span>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-muted">
              <span>Confidence {Math.round(rec.confidence * 100)}%</span>
              {PRICE_DOTS[rec.category] && (
                <span className="font-mono text-accent">{PRICE_DOTS[rec.category]}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
