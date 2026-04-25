import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import type { RefObject } from 'react';
import type { View } from 'react-native';

import type { Baby, DiaryWithPhotos } from '../types';
import { groupPhotosBySession } from '../utils/sessions';

export type ShareSlide = {
  body: string;
  photos: { uri: string; mediaType: 'photo' | 'video'; thumbnailUri: string | null }[];
  sessionLabel?: string;
};

export function buildShareSlides(diary: DiaryWithPhotos): ShareSlide[] {
  const sessionUris = groupPhotosBySession(diary.photos).filter(s => s.length > 0);
  const photoByUri = new Map(diary.photos.map(p => [p.uri, p]));

  const toMediaItems = (uris: string[]) =>
    uris.map(u => {
      const p = photoByUri.get(u);
      return {
        uri: u,
        mediaType: (p?.mediaType ?? 'photo') as 'photo' | 'video',
        thumbnailUri: p?.thumbnailUri ?? null,
      };
    });

  if (sessionUris.length === 0) {
    return [{ body: diary.body, photos: [] }];
  }

  if (sessionUris.length === 1) {
    return [
      {
        body: diary.sessionBodies[0] || diary.body,
        photos: toMediaItems(sessionUris[0]),
      },
    ];
  }

  return sessionUris.map((uris, i) => ({
    body:
      diary.sessionBodies[i] ||
      (i === 0 ? diary.body : ''),
    photos: toMediaItems(uris),
    sessionLabel: `${i + 1} / ${sessionUris.length}`,
  }));
}

export async function captureShareSlides(
  refs: RefObject<View | null>[]
): Promise<string[]> {
  const uris: string[] = [];
  for (const ref of refs) {
    if (!ref.current) continue;
    const uri = await captureRef(ref, {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
    });
    uris.push(uri);
  }
  return uris;
}

export async function shareDiarySlides(
  uris: string[],
  baby: Baby,
  entryDate: string
): Promise<{ ok: boolean; message?: string }> {
  if (uris.length === 0) {
    return { ok: false, message: '공유할 이미지가 없어요' };
  }

  if (!(await Sharing.isAvailableAsync())) {
    return { ok: false, message: '공유 기능을 사용할 수 없는 기기예요' };
  }

  try {
    const safeName = `${baby.name}-${entryDate}`.replace(/[/\\:*?"<>|]/g, '_');
    const stamp = Date.now();
    for (let i = 0; i < uris.length; i++) {
      const dest = `${FileSystem.cacheDirectory}${safeName}-${stamp}-${i + 1}.png`;
      await FileSystem.copyAsync({ from: uris[i], to: dest });
      await Sharing.shareAsync(dest, {
        mimeType: 'image/png',
        dialogTitle: `${safeName} (${i + 1}/${uris.length})`,
        UTI: 'public.png',
      });
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : '공유 실패',
    };
  }
}
