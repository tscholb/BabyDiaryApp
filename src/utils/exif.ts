type ExifLike = Record<string, unknown> | null | undefined;

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function dmsToDecimal(dms: unknown): number | null {
  if (Array.isArray(dms) && dms.length >= 3) {
    const d = readNumber(dms[0]);
    const m = readNumber(dms[1]);
    const s = readNumber(dms[2]);
    if (d == null || m == null || s == null) return null;
    return d + m / 60 + s / 3600;
  }
  return readNumber(dms);
}

export type GpsCoords = { latitude: number; longitude: number };

export function parseExifGps(exif: ExifLike): GpsCoords | null {
  if (!exif) return null;

  const nestedGps = (exif as { GPS?: Record<string, unknown> }).GPS;
  const source = nestedGps && typeof nestedGps === 'object' ? nestedGps : exif;

  const rawLat =
    (source as Record<string, unknown>).GPSLatitude ??
    (source as Record<string, unknown>).Latitude ??
    (source as Record<string, unknown>).latitude;
  const rawLng =
    (source as Record<string, unknown>).GPSLongitude ??
    (source as Record<string, unknown>).Longitude ??
    (source as Record<string, unknown>).longitude;
  const latRef =
    (source as Record<string, unknown>).GPSLatitudeRef ??
    (source as Record<string, unknown>).LatitudeRef;
  const lngRef =
    (source as Record<string, unknown>).GPSLongitudeRef ??
    (source as Record<string, unknown>).LongitudeRef;

  let lat = dmsToDecimal(rawLat);
  let lng = dmsToDecimal(rawLng);
  if (lat == null || lng == null) return null;

  if (typeof latRef === 'string' && /S/i.test(latRef)) lat = -Math.abs(lat);
  if (typeof lngRef === 'string' && /W/i.test(lngRef)) lng = -Math.abs(lng);

  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;

  return { latitude: lat, longitude: lng };
}
