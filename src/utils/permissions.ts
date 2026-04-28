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

export type MediaLocationDebug = {
  apiLevel: number | null;
  granted: boolean;
  requestResult: string;
};

export async function debugMediaLocation(): Promise<MediaLocationDebug> {
  if (Platform.OS !== 'android') {
    return { apiLevel: null, granted: true, requestResult: 'not-android' };
  }
  const apiLevel = Number(Platform.Version);
  if (apiLevel < 29) {
    return { apiLevel, granted: true, requestResult: 'api<29' };
  }
  let granted = false;
  let requestResult = 'not-requested';
  try {
    granted = await PermissionsAndroid.check(
      PERM as Parameters<typeof PermissionsAndroid.check>[0]
    );
  } catch (e) {
    requestResult = `check-error: ${e instanceof Error ? e.message : String(e)}`;
  }
  if (!granted) {
    try {
      const result = await PermissionsAndroid.request(
        PERM as Parameters<typeof PermissionsAndroid.request>[0],
        {
          title: '사진 위치 정보',
          message: '사진의 촬영 위치를 표시하려면 권한이 필요해요.',
          buttonPositive: '허용',
          buttonNegative: '나중에',
        }
      );
      requestResult = String(result);
      granted = result === PermissionsAndroid.RESULTS.GRANTED;
    } catch (e) {
      requestResult = `request-error: ${
        e instanceof Error ? e.message : String(e)
      }`;
    }
  } else {
    requestResult = 'already-granted';
  }
  return { apiLevel, granted, requestResult };
}
