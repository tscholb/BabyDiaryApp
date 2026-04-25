import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as VideoThumbnails from 'expo-video-thumbnails';

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

export async function persistVideo(
  sourceUri: string
): Promise<{ videoUri: string; thumbnailUri: string | null }> {
  await ensurePhotoDir();

  const ext = sourceUri.includes('.') ? sourceUri.split('.').pop() : 'mp4';
  const stem = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const videoUri = `${PHOTO_DIR}${stem}.${ext}`;

  await FileSystem.copyAsync({ from: sourceUri, to: videoUri });

  let thumbnailUri: string | null = null;
  try {
    const { uri: thumbRaw } = await VideoThumbnails.getThumbnailAsync(videoUri, {
      time: 500,
      quality: 0.8,
    });
    const compressed = await ImageManipulator.manipulateAsync(
      thumbRaw,
      [{ resize: { width: 1200 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );
    const thumbDest = `${PHOTO_DIR}${stem}_thumb.jpg`;
    await FileSystem.moveAsync({ from: compressed.uri, to: thumbDest });
    thumbnailUri = thumbDest;
  } catch {
    thumbnailUri = null;
  }

  return { videoUri, thumbnailUri };
}

export async function deletePhoto(uri: string): Promise<void> {
  if (!uri.startsWith(PHOTO_DIR)) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // ignore
  }
}

export async function deleteMedia(
  uri: string,
  thumbnailUri?: string | null
): Promise<void> {
  await deletePhoto(uri);
  if (thumbnailUri) await deletePhoto(thumbnailUri);
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
