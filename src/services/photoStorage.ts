import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

const PHOTO_DIR = `${FileSystem.documentDirectory}photos/`;

async function ensurePhotoDir() {
  const info = await FileSystem.getInfoAsync(PHOTO_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PHOTO_DIR, { intermediates: true });
  }
}

export async function persistPhoto(sourceUri: string): Promise<string> {
  await ensurePhotoDir();

  const compressed = await ImageManipulator.manipulateAsync(
    sourceUri,
    [{ resize: { width: 1600 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
  );

  const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
  const destUri = `${PHOTO_DIR}${filename}`;

  await FileSystem.moveAsync({ from: compressed.uri, to: destUri });
  return destUri;
}

export async function deletePhoto(uri: string): Promise<void> {
  if (!uri.startsWith(PHOTO_DIR)) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
  }
}

export async function getPhotoDirSize(): Promise<number> {
  await ensurePhotoDir();
  const files = await FileSystem.readDirectoryAsync(PHOTO_DIR);
  let total = 0;
  for (const f of files) {
    const info = await FileSystem.getInfoAsync(`${PHOTO_DIR}${f}`);
    if (info.exists && 'size' in info && typeof info.size === 'number') {
      total += info.size;
    }
  }
  return total;
}
