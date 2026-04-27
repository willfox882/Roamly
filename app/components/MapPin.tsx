'use client';

import { clsx } from 'clsx';
import { pinStyle, type PinType } from '@/lib/mapUtils';

interface MapPinProps {
  type: PinType;
  size?: 'sm' | 'md' | 'lg';
  selected?: boolean;
}

const sizeMap = { sm: 24, md: 32, lg: 44 };

export default function MapPin({ type, size = 'md', selected = false }: MapPinProps) {
  const style = pinStyle(type);
  const px = sizeMap[size];

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 32 32"
      fill="none"
      className={clsx('drop-shadow-lg', selected && 'scale-125')}
      aria-label={style.label}
    >
      {/* Teardrop pin shape */}
      <path
        d="M16 2C10.477 2 6 6.477 6 12c0 7 10 18 10 18s10-11 10-18c0-5.523-4.477-10-10-10z"
        fill={style.color}
        stroke={selected ? '#fff' : 'rgba(0,0,0,0.3)'}
        strokeWidth={selected ? 2.5 : 1.5}
      />
      {/* Inner dot */}
      <circle cx="16" cy="12" r="4" fill="rgba(0,0,0,0.3)" />
    </svg>
  );
}
