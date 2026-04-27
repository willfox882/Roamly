'use client';

import { useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { List, Map as MapIcon, Search, X, Plus, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { BucketPin } from '@/lib/schema';
import { pinStyle } from '@/lib/mapUtils';
import { geocode } from '@/lib/geocode';

const MapView = dynamic(() => import('@/app/components/MapView'), { ssr: false });

interface BucketListMapProps {
  pins: BucketPin[];
  visitedCountries?: string[];
  view?: ViewMode;
  onViewChange?: (view: ViewMode) => void;
  onPinClick?: (id: string) => void;
  onAddPin?: (latlng: { lat: number; lng: number; name?: string }) => void;
  onDeletePin?: (id: string) => void;
}

type ViewMode = 'map' | 'list';
type Filter = 'all' | 'planned' | 'completed';

interface SearchResult {
  name: string;
  lat: number;
  lng: number;
}

export default function BucketListMap({ pins, visitedCountries, view: propsView, onViewChange, onPinClick, onAddPin, onDeletePin }: BucketListMapProps) {
  const [internalView, setInternalView] = useState<ViewMode>('map');
  const view = propsView ?? internalView;
  const setView = onViewChange ?? setInternalView;
  const [filter, setFilter] = useState<Filter>('all');
  const [yearRange, setYearRange] = useState<[number, number]>(() => {
    const years = pins.filter((p) => p.completedDate).map((p) => parseInt(p.completedDate!.slice(0, 4)));
    const min = years.length ? Math.min(...years) : new Date().getFullYear() - 5;
    const max = years.length ? Math.max(...years) : new Date().getFullYear();
    return [min, max];
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filtered = pins.filter((p) => {
    if (filter === 'planned'   && p.completed) return false;
    if (filter === 'completed' && !p.completed) return false;
    if (p.completedDate) {
      const yr = parseInt(p.completedDate.slice(0, 4));
      if (yr < yearRange[0] || yr > yearRange[1]) return false;
    }
    return true;
  });

  const completedYears = pins
    .filter((p) => p.completedDate)
    .map((p) => parseInt(p.completedDate!.slice(0, 4)));
  const minYear = completedYears.length ? Math.min(...completedYears) : new Date().getFullYear() - 5;
  const maxYear = completedYears.length ? Math.max(...completedYears) : new Date().getFullYear();

  const handleSearchChange = useCallback((q: string) => {
    setSearchQuery(q);
    setSearchResults([]);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!q.trim()) return;
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const result = await geocode(q.trim());
        if (result) setSearchResults([{ name: result.name, lat: result.lat, lng: result.lng }]);
      } finally {
        setSearching(false);
      }
    }, 600);
  }, []);

  const handleSelectSearchResult = useCallback((r: SearchResult) => {
    onAddPin?.({ lat: r.lat, lng: r.lng, name: r.name });
    setSearchQuery('');
    setSearchResults([]);
  }, [onAddPin]);

  // Map clicks do NOT auto-add pins — require explicit search + select to avoid accidental additions.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleMapClick = useCallback((_latlng: { lat: number; lng: number }) => { /* no-op */ }, []);

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Search bar */}
      <div className="relative">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
          <Search size={14} className="shrink-0 text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search a destination to add…"
            className="flex-1 bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(''); setSearchResults([]); }}>
              <X size={14} className="text-muted" />
            </button>
          )}
          {searching && <span className="text-xs text-muted">…</span>}
        </div>
        {searchResults.length > 0 && (
          <div className="absolute inset-x-0 top-full z-10 mt-1 rounded-xl border border-white/10 bg-card shadow-lg">
            {searchResults.map((r, i) => (
              <button
                key={i}
                onClick={() => handleSelectSearchResult(r)}
                className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-ink hover:bg-white/10"
              >
                <Plus size={14} className="shrink-0 text-primary" />
                <span className="line-clamp-1 flex-1">{r.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1">
          {(['all', 'planned', 'completed'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                'rounded-pill px-3 py-1 text-xs font-medium capitalize transition-colors',
                filter === f
                  ? 'bg-primary text-white'
                  : 'bg-white/10 text-muted hover:bg-white/20',
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg border border-white/10 bg-white/5 p-0.5">
          <button
            onClick={() => setView('map')}
            className={clsx('rounded-md p-1.5 transition-colors', view === 'map' ? 'bg-white/20 text-white' : 'text-muted')}
            aria-label="Map view"
          >
            <MapIcon size={14} />
          </button>
          <button
            onClick={() => setView('list')}
            className={clsx('rounded-md p-1.5 transition-colors', view === 'list' ? 'bg-white/20 text-white' : 'text-muted')}
            aria-label="List view"
          >
            <List size={14} />
          </button>
        </div>
      </div>

      {/* Year slider */}
      {completedYears.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>{minYear}</span>
          <input
            type="range"
            min={minYear}
            max={maxYear}
            value={yearRange[1]}
            onChange={(e) => setYearRange([yearRange[0], parseInt(e.target.value)])}
            className="flex-1 accent-primary"
          />
          <span>{yearRange[1]}</span>
        </div>
      )}

      {view === 'map' ? (
        <div className="relative min-h-[200px] flex-1 overflow-hidden rounded-xl">
          <MapView
            globe={true}
            pins={filtered.map((p) => ({
              id: p.id,
              lat: p.lat,
              lng: p.lng,
              type: p.completed ? ('visited' as const) : ('bucket' as const),
              label: p.name,
            }))}
            visitedCountries={visitedCountries}
            onPinClick={onPinClick}
            onMapClick={handleMapClick}
          />
        </div>
      ) : (
        <ul className="flex-1 space-y-2 overflow-y-auto">
          {filtered.map((pin) => {
            const style = pinStyle(pin.completed ? 'visited' : 'bucket');
            return (
              <li key={pin.id} className="flex gap-2">
                <button
                  onClick={() => onPinClick?.(pin.id)}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 p-3 text-left hover:bg-white/10"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: style.color }}
                    />
                    <span className="flex-1 truncate text-sm font-medium text-ink">{pin.name}</span>
                    {pin.country && (
                      <span className="shrink-0 text-xs text-muted">{pin.country}</span>
                    )}
                  </div>
                  {pin.notes && (
                    <p className="mt-1 truncate text-xs text-muted">{pin.notes}</p>
                  )}
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${pin.name}" from your bucket list?`)) {
                      onDeletePin?.(pin.id);
                    }
                  }}
                  className="flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-3 text-muted hover:bg-danger/10 hover:text-danger active:scale-95 transition-all"
                  aria-label="Delete pin"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-muted">No pins match this filter.</p>
          )}
        </ul>
      )}
    </div>
  );
}
