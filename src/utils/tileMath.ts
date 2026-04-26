// OSM slippy map tile math.
// https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames

export const TILE_SIZE = 256;

export type TileCoords = { x: number; y: number; z: number };

export function lngLatToTileFloat(
  lng: number,
  lat: number,
  zoom: number
): { x: number; y: number } {
  const latRad = (lat * Math.PI) / 180;
  const n = Math.pow(2, zoom);
  const x = ((lng + 180) / 360) * n;
  const y =
    ((1 -
      Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) /
      2) *
    n;
  return { x, y };
}

export function lngLatToTile(
  lng: number,
  lat: number,
  zoom: number
): TileCoords {
  const { x, y } = lngLatToTileFloat(lng, lat, zoom);
  return { x: Math.floor(x), y: Math.floor(y), z: zoom };
}

// Returns the position (in 0..1) of (lng, lat) WITHIN the tile that contains it.
export function lngLatPositionInTile(
  lng: number,
  lat: number,
  zoom: number
): { fx: number; fy: number } {
  const { x, y } = lngLatToTileFloat(lng, lat, zoom);
  return { fx: x - Math.floor(x), fy: y - Math.floor(y) };
}

export function osmTileUrl(coords: TileCoords): string {
  // Subdomains a/b/c are the official multi-host tile servers.
  const sub = ['a', 'b', 'c'][(coords.x + coords.y) % 3];
  return `https://${sub}.tile.openstreetmap.org/${coords.z}/${coords.x}/${coords.y}.png`;
}

// Average of multiple coordinates.
export function averageCoords(
  points: Array<{ latitude: number; longitude: number }>
): { latitude: number; longitude: number } | null {
  if (points.length === 0) return null;
  let sumLat = 0;
  let sumLng = 0;
  for (const p of points) {
    sumLat += p.latitude;
    sumLng += p.longitude;
  }
  return {
    latitude: sumLat / points.length,
    longitude: sumLng / points.length,
  };
}
