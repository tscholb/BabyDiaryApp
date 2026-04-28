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
    // Best path: the picker handed us a MediaStore id.
    if (assetId) {
      const info = await MediaLibrary.getAssetInfoAsync(assetId);
      if (info?.location) {
        return {
          latitude: info.location.latitude,
          longitude: info.location.longitude,
        };
      }
    }

    // Fallback: scan the most recent assets and match by filename.
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
    // Permission missing, asset gone, etc. — silently fall back to no GPS.
  }
  return null;
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
