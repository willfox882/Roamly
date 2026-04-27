'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { pinStyle, type PinType } from '@/lib/mapUtils';

interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  type: PinType;
  label?: string;
}

interface MapboxMapProps {
  pins: MapMarker[];
  visitedCountries?: string[];
  onPinClick?: (id: string) => void;
  onMapClick?: (latlng: { lat: number; lng: number }) => void;
  className?: string;
  globe?: boolean;
}

export default function MapboxMap({ 
  pins, 
  visitedCountries,
  onPinClick, 
  onMapClick, 
  className = 'h-full w-full',
  globe = false 
}: MapboxMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());

  useEffect(() => {
    if (!containerRef.current) return;
    
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [0, 20],
      zoom: 1.5,
      projection: globe ? 'globe' : 'mercator'
    });

    if (globe) {
      map.on('style.load', () => {
        map.setFog({
          color: 'rgb(186, 210, 247)', // Lower atmosphere
          'high-color': 'rgb(36, 92, 223)', // Upper atmosphere
          'horizon-blend': 0.02, // Atmosphere thickness
          'space-color': 'rgb(11, 11, 25)', // Background color
          'star-intensity': 0.6 // Background star brightness
        });

        // Add countries source
        map.addSource('countries', {
          type: 'geojson',
          data: '/lib/data/countries.geojson'
        });

        // Add layer for visited countries
        map.addLayer({
          id: 'visited-countries',
          type: 'fill',
          source: 'countries',
          paint: {
            'fill-color': '#0A84FF',
            'fill-opacity': 0.3
          },
          filter: ['in', ['get', 'ISO_A3'], ['literal', visitedCountries ?? []]]
        });

        // Add outline for all countries
        map.addLayer({
          id: 'countries-outline',
          type: 'line',
          source: 'countries',
          paint: {
            'line-color': '#000000',
            'line-width': 0.5,
            'line-opacity': 0.1
          }
        });
      });
    }

    map.on('click', (e) => {
      if (onMapClick) onMapClick(e.lngLat);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [globe, onMapClick, visitedCountries]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove stale markers
    for (const [id, marker] of markersRef.current.entries()) {
      if (!pins.find((p) => p.id === id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }

    // Add / update markers
    pins.forEach((pin) => {
      let marker = markersRef.current.get(pin.id);
      
      if (!marker) {
        const style = pinStyle(pin.type);
        const el = document.createElement('div');
        el.className = 'custom-marker';
        el.innerHTML = `<svg width="28" height="36" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 2C10.477 2 6 6.477 6 12c0 7 10 18 10 18s10-11 10-18c0-5.523-4.477-10-10-10z" fill="${style.color}" stroke="rgba(0,0,0,0.4)" stroke-width="1.5"/><circle cx="16" cy="12" r="4" fill="rgba(0,0,0,0.3)"/></svg>`;
        el.style.cursor = 'pointer';
        
        marker = new mapboxgl.Marker(el)
          .setLngLat([pin.lng, pin.lat])
          .addTo(map);

        if (onPinClick) {
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            onPinClick(pin.id);
          });
        }
        
        markersRef.current.set(pin.id, marker);
      } else {
        marker.setLngLat([pin.lng, pin.lat]);
      }
    });

    // Auto-fit if requested or just pins change
    if (pins.length > 0 && !globe) {
      const bounds = new mapboxgl.LngLatBounds();
      pins.forEach(p => bounds.extend([p.lng, p.lat]));
      map.fitBounds(bounds, { padding: 50, maxZoom: 10, duration: 1000 });
    }
  }, [pins, onPinClick, globe]);

  return <div ref={containerRef} className={className} />;
}
