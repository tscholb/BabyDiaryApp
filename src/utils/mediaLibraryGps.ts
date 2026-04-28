import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';

import type { GpsCoords } from './exif';

// expo-image-picker on some Android versions (notably API 36) returns EXIF
// with GPS redacted to (0, 0) even when ACCESS_MEDIA_LOCATION is granted.
// expo-media-library reads through MediaStore directly and DOES honor the
// permission, so we use it as the canonical GPS source on Android.
//
// Returns null on iOS (picker EXIF is reliable there) and whenever the lookup
// can't find or extract coordinates.
export async function lookupAssetLocation(
  assetId: string | null | undefined,
  fileName: string | null | undefined
): Promise<GpsCoords | null> {
  if (Platform.OS !== 'android') return null;

  try {
    if (assetId) {
      const info = await MediaLibrary.getAssetInfoAsync(assetId);
      if (info?.location) {
        return {
          latitude: info.location.latitude,
          longitude: info.location.longitude,
        };
      }
    }
    if (fileName) {
      const result = await MediaLibrary.getAssetsAsync({
        mediaType: ['photo', 'video'],
        first: 200,
        sortBy: [MediaLibrary.SortBy.modificationTime],
      });
      const match = result.assets.find(a => a.filename === fileName);
      if (match) {
        const info = await MediaLibrary.getAssetInfoAsync(match);
        if (info?.location) {
          return {
            latitude: info.location.latitude,
            longitude: info.location.longitude,
          };
        }
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
  permissionGranted: boolean;
  byIdLookup: string;
  byNameLookup: string;
  finalLocation: string;
};

// Verbose variant for debugging — never throws, returns a structured report.
export async function debugLookupAssetLocation(
  assetId: string | null | undefined,
  fileName: string | null | undefined
): Promise<GpsLookupDebug> {
  const out: GpsLookupDebug = {
    assetId: assetId ?? '(없음)',
    fileName: fileName ?? '(없음)',
    permissionGranted: false,
    byIdLookup: 'not-attempted',
    byNameLookup: 'not-attempted',
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

  if (assetId) {
    try {
      const info = await MediaLibrary.getAssetInfoAsync(assetId);
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

  if (fileName) {
    try {
      const result = await MediaLibrary.getAssetsAsync({
        mediaType: ['photo', 'video'],
        first: 200,
        sortBy: [MediaLibrary.SortBy.modificationTime],
      });
      const match = result.assets.find(a => a.filename === fileName);
      if (!match) {
        out.byNameLookup = `no-match (scanned ${result.assets.length})`;
      } else {
        const info = await MediaLibrary.getAssetInfoAsync(match);
        if (!info) {
          out.byNameLookup = 'matched-but-no-info';
        } else if (info.location) {
          out.byNameLookup = `loc=${info.location.latitude.toFixed(4)},${info.location.longitude.toFixed(4)}`;
          out.finalLocation = out.byNameLookup;
        } else {
          out.byNameLookup = 'matched-but-no-location';
        }
      }
    } catch (e) {
      out.byNameLookup = `err: ${e instanceof Error ? e.message : String(e)}`;
    }
  } else {
    out.byNameLookup = 'no-fileName';
  }

  return out;
}

// Request MediaLibrary permission. Calling this also implicitly requests
// ACCESS_MEDIA_LOCATION when the plugin is configured with
// isAccessMediaLocationEnabled, which is what we need to read original EXIF.
export async function requestMediaLibraryPermission(): Promise<boolean> {
  try {
    const result = await MediaLibrary.requestPermissionsAsync();
    return result.granted;
  } catch {
    return false;
  }
}
