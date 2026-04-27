'use client';

import { useState, useEffect, useRef } from 'react';
import { MapPin, Check, Search, Loader2 } from 'lucide-react';
import { geocode, type GeocodeResult } from '@/lib/geocode';

interface Destination {
  name: string;
  lat: number;
  lng: number;
  placeId?: string;
  admin1?: string;
  country?: string;
}

interface BucketAutoUpdateControlProps {
  selectedDestination: Destination | null;
  onDestinationChange: (dest: Destination | null) => void;
  autoAdd: boolean;
  onAutoAddChange: (val: boolean) => void;
}

export default function BucketAutoUpdateControl({
  selectedDestination,
  onDestinationChange,
  autoAdd,
  onAutoAddChange,
}: BucketAutoUpdateControlProps) {
  const [query, setQuery] = useState(selectedDestination?.name || '');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (selectedDestination) setQuery(selectedDestination.name);
  }, [selectedDestination]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async (text: string) => {
    setQuery(text);
    if (!text.trim() || text.length < 3) {
      setResults([]);
      return;
    }

    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    
    searchTimeout.current = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await geocode(text);
        setResults(result ? [result] : []); // Geocode returns one result currently
        setIsOpen(true);
      } finally {
        setLoading(false);
      }
    }, 500);
  };

  const selectResult = (r: GeocodeResult) => {
    onDestinationChange({
      name: r.name,
      lat: r.lat,
      lng: r.lng,
      country: r.country
    });
    setQuery(r.name);
    setIsOpen(false);
    setResults([]);
  };

  return (
    <div ref={containerRef} className="space-y-4 rounded-xl border border-subtle bg-black/[0.02] p-4 dark:bg-white/[0.02]">
      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase text-muted">Primary Destination</label>
        <div className="relative">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Where are you going?"
              className="roamly-input w-full pl-9 pr-10 text-sm focus:border-primary focus:outline-none"
            />
            {loading && (
              <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-primary" />
            )}
            {selectedDestination && !loading && (
              <Check size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-success" />
            )}
          </div>

          {isOpen && results.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-subtle bg-white shadow-xl dark:bg-card">
              {results.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectResult(r)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
                >
                  <MapPin size={14} className="text-primary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{r.name}</p>
                    <p className="truncate text-[10px] text-muted uppercase">{r.country}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 px-1">
        <input
          type="checkbox"
          id="autoAddToBucket"
          checked={autoAdd}
          onChange={(e) => onAutoAddChange(e.target.checked)}
          className="h-4 w-4 rounded border-subtle bg-surface text-primary focus:ring-primary"
        />
        <label htmlFor="autoAddToBucket" className="text-xs text-muted cursor-pointer select-none">
          Auto-add to Bucket List (as Upcoming or Visited)
        </label>
      </div>
    </div>
  );
}
