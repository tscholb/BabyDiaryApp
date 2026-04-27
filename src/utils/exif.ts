type ExifLike = Record<string, unknown> | null | undefined;

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

// Parses a single rational like "37/1" or a plain number string like "37".
function parseRational(input: unknown): number | null {
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const slash = trimmed.indexOf('/');
  if (slash === -1) {
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  const num = Number(trimmed.slice(0, slash));
  const den = Number(trimmed.slice(slash + 1));
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
  return num / den;
}

// Convert any of the EXIF coordinate forms to decimal degrees.
// Handles:
// - Direct number: 37.5
// - Number-string: "37.5"
// - DMS array: [37, 30, 0]
// - Rational array: ["37/1", "30/1", "0/1"]
// - Rational triplet string (Android ExifInterface): "37/1,30/1,0/1"
// - Mixed-spaced string: "37/1, 30/1, 0/1"
function coordToDecimal(value: unknown): number | null {
  if (value == null) return null;

  if (Array.isArray(value)) {
    if (value.length < 3) return null;
    const d = parseRational(value[0]);
    const m = parseRational(value[1]);
    const s = parseRational(value[2]);
    if (d == null || m == null || s == null) return null;
    return d + m / 60 + s / 3600;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    // First, try plain decimal.
    const direct = Number(trimmed);
    if (Number.isFinite(direct) && !trimmed.includes(',') && !trimmed.includes('/')) {
      return direct;
    }
    // Then, try rational triplet.
    const parts = trimmed.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 3) {
      const d = parseRational(parts[0]);
      const m = parseRational(parts[1]);
      const s = parseRational(parts[2]);
      if (d != null && m != null && s != null) {
        return d + m / 60 + s / 3600;
      }
    }
    // Finally, single-rational fallback like "37/1".
    return parseRational(trimmed);
  }

  return null;
}

export type GpsCoords = { latitude: number; longitude: number };

export function parseExifGps(exif: ExifLike): GpsCoords | null {
  if (!exif) return null;

  // iOS sometimes nests under "{GPS}" or "GPS"; Android is flat.
  const nestedGps =
    (exif as Record<string, unknown>).GPS ??
    (exif as Record<string, unknown>)['{GPS}'];
  const source =
    nestedGps && typeof nestedGps === 'object'
      ? (nestedGps as Record<string, unknown>)
      : (exif as Record<string, unknown>);

  const rawLat =
    source.GPSLatitude ?? source.Latitude ?? source.latitude;
  const rawLng =
    source.GPSLongitude ?? source.Longitude ?? source.longitude;
  const latRef =
    source.GPSLatitudeRef ?? source.LatitudeRef;
  const lngRef =
    source.GPSLongitudeRef ?? source.LongitudeRef;

  let lat = coordToDecimal(rawLat);
  let lng = coordToDecimal(rawLng);
  if (lat == null || lng == null) return null;

  if (typeof latRef === 'string' && /S/i.test(latRef)) lat = -Math.abs(lat);
  if (typeof lngRef === 'string' && /W/i.test(lngRef)) lng = -Math.abs(lng);

  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;

  return { latitude: lat, longitude: lng };
}

// Re-export for tests / unused-import friendliness.
export const _internals = { parseRational, coordToDecimal, readNumber };
