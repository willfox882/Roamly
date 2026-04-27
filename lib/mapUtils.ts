export type PinType = 'visited' | 'upcoming' | 'bucket' | 'excluded';

export interface PinStyle {
  color: string;
  icon: string;
  label: string;
}

export interface ClusterFeature {
  lat: number;
  lng: number;
  count: number;
  pinIds: string[];
  type: PinType | 'mixed';
}

export interface Bounds {
  ne: [number, number]; // [lng, lat]
  sw: [number, number];
}

const PIN_STYLES: Record<PinType, PinStyle> = {
  visited:  { color: '#30D158', icon: 'check-circle', label: 'Visited' },
  upcoming: { color: '#0A84FF', icon: 'plane',        label: 'Upcoming' },
  bucket:   { color: '#FFD60A', icon: 'star',          label: 'Bucket list' },
  excluded: { color: '#8E8E93', icon: 'x-circle',     label: 'Excluded' },
};

export function pinStyle(type: PinType): PinStyle {
  return PIN_STYLES[type];
}

interface LatLngPin {
  id: string;
  lat: number;
  lng: number;
  type?: PinType;
}

// Grid-based clustering: each cell is ~(360 / 2^zoom) degrees wide
export function clusterPins(pins: LatLngPin[], zoom: number): ClusterFeature[] {
  const cellSize = 360 / Math.pow(2, zoom);
  const cells = new Map<string, LatLngPin[]>();

  for (const pin of pins) {
    const col = Math.floor(pin.lng / cellSize);
    const row = Math.floor(pin.lat / cellSize);
    const key = `${col}:${row}`;
    const cell = cells.get(key) ?? [];
    cell.push(pin);
    cells.set(key, cell);
  }

  const clusters: ClusterFeature[] = [];

  for (const group of cells.values()) {
    const lat = group.reduce((s, p) => s + p.lat, 0) / group.length;
    const lng = group.reduce((s, p) => s + p.lng, 0) / group.length;
    const types = [...new Set(group.map((p) => p.type ?? 'bucket'))];
    clusters.push({
      lat,
      lng,
      count: group.length,
      pinIds: group.map((p) => p.id),
      type: types.length === 1 && types[0] != null ? types[0] : 'mixed',
    });
  }

  return clusters;
}

export function boundsForPins(pins: LatLngPin[]): Bounds | null {
  if (pins.length === 0) return null;

  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;

  for (const p of pins) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }

  return { ne: [maxLng, maxLat], sw: [minLng, minLat] };
}

export function tileUrlFor(
  z: number,
  x: number,
  y: number,
  opts: { provider?: 'mapbox' | 'osm' } = {},
): string {
  if (opts.provider === 'mapbox') {
    const token = process.env['NEXT_PUBLIC_MAPBOX_TOKEN'] ?? '';
    return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/256/${z}/${x}/${y}?access_token=${token}`;
  }
  // OSM default — round-robin a/b/c subdomains
  const sub = ['a', 'b', 'c'][(x + y) % 3];
  return `https://${sub}.tile.openstreetmap.org/${z}/${x}/${y}.png`;
}
