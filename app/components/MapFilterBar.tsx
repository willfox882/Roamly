'use client';

import { clsx } from 'clsx';
import type { PinType } from '@/lib/mapUtils';

export type Filter = PinType | 'all';
export const FILTERS: Filter[] = ['all', 'visited', 'upcoming', 'bucket'];

interface MapFilterBarProps {
  activeFilters: Set<Filter>;
  onToggleFilter: (f: Filter) => void;
  className?: string;
}

export default function MapFilterBar({ activeFilters, onToggleFilter, className }: MapFilterBarProps) {
  return (
    <div className={clsx("flex justify-center gap-1.5 px-4 py-3 pointer-events-auto", className)}>
      {FILTERS.map((f) => (
        <button
          key={f}
          onClick={() => onToggleFilter(f)}
          className={clsx(
            'rounded-pill px-3 py-1 text-xs font-medium capitalize shadow-lg transition-all active:scale-95',
            activeFilters.has(f)
              ? 'bg-primary text-white'
              : 'glass text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.04]',
          )}
        >
          {f}
        </button>
      ))}
    </div>
  );
}
