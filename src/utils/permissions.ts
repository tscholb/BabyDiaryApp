import { PermissionsAndroid, Platform } from 'react-native';

const PERM = 'android.permission.ACCESS_MEDIA_LOCATION';

// On Android 11+ (API 30+), ACCESS_MEDIA_LOCATION is a runtime permission that
// expo-image-picker does NOT automatically request. Without it, MediaStore
// strips GPS from EXIF before we can read it. Call this once before launching
// the picker so the OS prompts the user (no-op on subsequent grants).
export async function ensureMediaLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if (Number(Platform.Version) < 29) return true;

  try {
    const already = await PermissionsAndroid.check(
      PERM as Parameters<typeof PermissionsAndroid.check>[0]
    );
    if (already) return true;
    const result = await PermissionsAndroid.request(
      PERM as Parameters<typeof PermissionsAndroid.request>[0],
      {
        title: '사진 위치 정보',
        message:
          '사진의 촬영 위치를 일기에 함께 보여주려면 위치 정보 접근 권한이 필요해요. 위치는 기기 안에만 저장됩니다.',
        buttonPositive: '허용',
        buttonNegative: '나중에',
      }
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

