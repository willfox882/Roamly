'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { Map as LeafletMapInstance, Marker, DivIcon } from 'leaflet';
import { pinStyle, boundsForPins, type PinType } from '@/lib/mapUtils';

interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  type: PinType;
  label?: string;
}

interface LeafletMapProps {
  pins: MapMarker[];
  visitedCountries?: string[];
  onPinClick?: (id: string) => void;
  onMapClick?: (latlng: { lat: number; lng: number }) => void;
  className?: string;
}

export default function LeafletMap({ pins, visitedCountries, onPinClick, onMapClick, className = 'h-full w-full' }: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMapInstance | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const geojsonRef = useRef<any>(null);

  const initMap = useCallback(async () => {
    if (!containerRef.current) return;
    if (mapRef.current) return; // already initialized in this component instance

    const L = (await import('leaflet')).default;

    const container = containerRef.current as HTMLElement & { _leaflet_id?: number };
    if (container._leaflet_id !== undefined) {
      // If we find a stale ID, it means Leaflet was here before but didn't clean up correctly.
      // We don't just delete it, we try to find if there is an instance and remove it.
      // But usually, deleting it is enough if we also call map.remove() in cleanup.
    }

    // Check again if mapRef.current was set by a concurrent call
    if (mapRef.current) return;
    
    // STRICT GUARD: If the DOM element already has a Leaflet ID, it's already initialized.
    // This handles cases where React/HMR might trigger this function twice on the same element.
    if ((container as any)._leaflet_id) return;

    const map = L.map(container, {
      center: [20, 0],
      zoom: 2,
      zoomControl: false,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    if (onMapClick) {
      map.on('click', (e) => { onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng }); });
    }

    // Load countries GeoJSON for highlighting
    try {
      const res = await fetch('/lib/data/countries.geojson');
      if (res.ok) {
        const countriesData = await res.json();
        geojsonRef.current = L.geoJSON(countriesData, {
          style: (feature) => {
            const iso = feature?.properties?.ISO_A3 || feature?.properties?.iso_a3;
            const visited = visitedCountries?.includes(iso);
            return {
              fillColor: visited ? '#0A84FF' : '#FFFFFF',
              weight: 1,
              opacity: 0.1,
              color: '#000000',
              fillOpacity: visited ? 0.3 : 0.05,
            };
          }
        }).addTo(map);
      }
    } catch (e) {
      console.error('Failed to load countries.geojson', e);
    }

    mapRef.current = map;
  }, [onMapClick, visitedCountries]);

  const syncMarkers = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;

    const Leaflet = (await import('leaflet')).default;

    // Remove stale markers
    for (const [id, marker] of markersRef.current.entries()) {
      if (!pins.find((p) => p.id === id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }

    // Add / update markers
    for (const pin of pins) {
      const existing = markersRef.current.get(pin.id);
      if (existing) {
        existing.setLatLng([pin.lat, pin.lng]);
        continue;
      }

      const style = pinStyle(pin.type);
      const icon: DivIcon = Leaflet.divIcon({
        html: `<svg width="28" height="36" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 2C10.477 2 6 6.477 6 12c0 7 10 18 10 18s10-11 10-18c0-5.523-4.477-10-10-10z" fill="${style.color}" stroke="rgba(0,0,0,0.4)" stroke-width="1.5"/><circle cx="16" cy="12" r="4" fill="rgba(0,0,0,0.3)"/></svg>`,
        className: '',
        iconSize: [28, 36],
        iconAnchor: [14, 36],
        popupAnchor: [0, -36],
      });

      const marker = Leaflet.marker([pin.lat, pin.lng], { icon });
      if (pin.label) marker.bindPopup(pin.label);
      if (onPinClick) marker.on('click', () => { onPinClick(pin.id); });
      marker.addTo(map);
      markersRef.current.set(pin.id, marker);
    }

    // Fit bounds if pins
    if (pins.length > 0) {
      const bounds = boundsForPins(pins);
      if (bounds) {
        map.fitBounds([[bounds.sw[1], bounds.sw[0]], [bounds.ne[1], bounds.ne[0]]], { padding: [40, 40], maxZoom: 10 });
      }
    }
  }, [pins, onPinClick]);

  useEffect(() => {
    void initMap().then(() => syncMarkers());
  }, [initMap, syncMarkers]);

  // Sync markers when pins change (after map is init)
  useEffect(() => {
    if (mapRef.current) void syncMarkers();
  }, [syncMarkers]);

  // Cleanup — copy refs before async teardown so the closure captures current values
  useEffect(() => {
    const map = mapRef;
    const markers = markersRef;
    return () => {
      map.current?.remove();
      map.current = null;
      markers.current.clear();
    };
  }, []);

  return <div ref={containerRef} className={className} />;
}
