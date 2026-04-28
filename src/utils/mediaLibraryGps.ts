import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';

import type { GpsCoords } from './exif';

type LookupHints = {
  assetId?: string | null;
  fileName?: string | null;
  // ISO datetime from EXIF; used to match by capture time when filename fails.
  capturedAt?: string | null;
};

async function findAssetByHints(
  hints: LookupHints
): Promise<MediaLibrary.Asset | null> {
  const { fileName, capturedAt } = hints;
  if (!fileName && !capturedAt) return null;

  const result = await MediaLibrary.getAssetsAsync({
    mediaType: ['photo', 'video'],
    first: 1000,
    sortBy: [[MediaLibrary.SortBy.modificationTime, false]],
  });

  if (fileName) {
    const exact = result.assets.find(a => a.filename === fileName);
    if (exact) return exact;
    const digits = fileName.replace(/\D/g, '');
    if (digits.length >= 6) {
      const tail = digits.slice(-8);
      const partial = result.assets.find(a => a.filename.includes(tail));
      if (partial) return partial;
    }
  }

  if (capturedAt) {
    const target = new Date(capturedAt).getTime();
    if (Number.isFinite(target)) {
      const closest = result.assets
        .map(a => ({
          asset: a,
          delta: Math.min(
            Math.abs((a.creationTime ?? 0) - target),
            Math.abs((a.modificationTime ?? 0) - target)
          ),
        }))
        .filter(x => x.delta < 60_000)
        .sort((a, b) => a.delta - b.delta)[0];
      if (closest) return closest.asset;
    }
  }

  return null;
}

export async function lookupAssetLocation(
  hints: LookupHints
): Promise<GpsCoords | null> {
  if (Platform.OS !== 'android') return null;
  try {
    if (hints.assetId) {
      const info = await MediaLibrary.getAssetInfoAsync(hints.assetId);
      if (info?.location) {
        return {
          latitude: info.location.latitude,
          longitude: info.location.longitude,
        };
      }
    }
    const match = await findAssetByHints(hints);
    if (match) {
      const info = await MediaLibrary.getAssetInfoAsync(match);
      if (info?.location) {
        return {
          latitude: info.location.latitude,
          longitude: info.location.longitude,
        };
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export type GpsLookupDebug = {
  assetId: string;
  fileName: string;
  capturedAt: string;
  permissionGranted: boolean;
  byIdLookup: string;
  byNameOrTimeLookup: string;
  finalLocation: string;
};

export async function debugLookupAssetLocation(
  hints: LookupHints
): Promise<GpsLookupDebug> {
  const out: GpsLookupDebug = {
    assetId: hints.assetId ?? '(없음)',
    fileName: hints.fileName ?? '(없음)',
    capturedAt: hints.capturedAt ?? '(없음)',
    permissionGranted: false,
    byIdLookup: 'not-attempted',
    byNameOrTimeLookup: 'not-attempted',
    finalLocation: 'none',
  };
  if (Platform.OS !== 'android') {
    out.byIdLookup = 'ios-skip';
    return out;
  }
  try {
    const perm = await MediaLibrary.getPermissionsAsync();
    out.permissionGranted = perm.granted;
  } catch (e) {
    out.byIdLookup = `perm-err: ${e instanceof Error ? e.message : String(e)}`;
    return out;
  }

  if (hints.assetId) {
    try {
      const info = await MediaLibrary.getAssetInfoAsync(hints.assetId);
      if (!info) {
        out.byIdLookup = 'no-info';
      } else if (info.location) {
        out.byIdLookup = `loc=${info.location.latitude.toFixed(4)},${info.location.longitude.toFixed(4)}`;
        out.finalLocation = out.byIdLookup;
        return out;
      } else {
        out.byIdLookup = 'info-but-no-location';
      }
    } catch (e) {
      out.byIdLookup = `err: ${e instanceof Error ? e.message : String(e)}`;
    }
  } else {
    out.byIdLookup = 'no-assetId';
  }

  try {
    const match = await findAssetByHints(hints);
    if (!match) {
      out.byNameOrTimeLookup = 'no-match';
    } else {
      const info = await MediaLibrary.getAssetInfoAsync(match);
      if (!info) {
        out.byNameOrTimeLookup = `matched(${match.filename})-but-no-info`;
      } else if (info.location) {
        out.byNameOrTimeLookup = `matched(${match.filename}) loc=${info.location.latitude.toFixed(4)},${info.location.longitude.toFixed(4)}`;
        out.finalLocation = `loc=${info.location.latitude.toFixed(4)},${info.location.longitude.toFixed(4)}`;
      } else {
        out.byNameOrTimeLookup = `matched(${match.filename})-but-no-location`;
      }
    }
  } catch (e) {
    out.byNameOrTimeLookup = `err: ${e instanceof Error ? e.message : String(e)}`;
  }

  return out;
}

export async function requestMediaLibraryPermission(): Promise<boolean> {
  try {
    const result = await MediaLibrary.requestPermissionsAsync();
    return result.granted;
  } catch {
    return false;
  }
}
