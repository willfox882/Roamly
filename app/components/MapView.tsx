'use client';

import dynamic from 'next/dynamic';
import type { PinType } from '@/lib/mapUtils';

const LeafletMap = dynamic(() => import('./LeafletMap'), { ssr: false });
const MapboxMap = dynamic(() => import('./MapboxMap'), { ssr: false });

interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  type: PinType;
  label?: string;
}

interface MapViewProps {
  pins: MapMarker[];
  visitedCountries?: string[]; // ISO 3166-1 alpha-3 or A3 codes
  onPinClick?: (id: string) => void;
  onMapClick?: (latlng: { lat: number; lng: number }) => void;
  className?: string;
  globe?: boolean;
}

export default function MapView(props: MapViewProps) {
  const hasToken = !!process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (hasToken) {
    return <MapboxMap {...props} />;
  }

  return <LeafletMap {...props} />;
}
