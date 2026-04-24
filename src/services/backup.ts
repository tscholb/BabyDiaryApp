import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import JSZip from 'jszip';

import { createBaby, listBabies } from '../db/babies';
import { resetDatabase } from '../db/database';
import { createDiary, listDiaries } from '../db/diaries';
import { groupPhotosBySession } from '../utils/sessions';

const BACKUP_VERSION = 3;

type BackupManifest = {
  version: number;
  exportedAt: string;
  babies: Array<{
    name: string;
    birthDate: string;
    profileImageUri: string | null;
    diaries: Array<{
      entryDate: string;
      body: string;
      mood: string | null;
      aiGenerated: boolean;
      createdAt: string;
      // v1 kept a flat list here
      photoFiles?: string[];
      // v2+ groups files by session, preserving the diary structure
      sessions?: string[][];
      // v3+ per-file EXIF capture time, keyed by zip filename
      capturedAt?: Record<string, string | null>;
    }>;
  }>;
};

export type BackupResult =
  | { ok: true; uri: string; stats: { babies: number; diaries: number; photos: number } }
  | { ok: false; message: string };

export type RestoreResult =
  | { ok: true; stats: { babies: number; diaries: number; photos: number } }
  | { ok: false; message: string };

function photoFilename(uri: string): string {
  const idx = uri.lastIndexOf('/');
  return idx >= 0 ? uri.substring(idx + 1) : uri;
}

export async function exportBackup(): Promise<BackupResult> {
  try {
    const babies = await listBabies();
    if (babies.length === 0) {
      return { ok: false, message: '백업할 데이터가 없어요' };
    }

    const manifest: BackupManifest = {
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      babies: [],
    };
    let photoCount = 0;
    let diaryCount = 0;

    const zip = new JSZip();
    const photosDir = zip.folder('photos')!;

    for (const baby of babies) {
      const diaries = await listDiaries(baby.id);
      const babyEntry: BackupManifest['babies'][number] = {
        name: baby.name,
        birthDate: baby.birthDate,
        profileImageUri: baby.profileImageUri,
        diaries: [],
      };

      for (const diary of diaries) {
        const uriToFilename = new Map<string, string>();
        const capturedAt: Record<string, string | null> = {};
        for (const photo of diary.photos) {
          const info = await FileSystem.getInfoAsync(photo.uri);
          if (!info.exists) continue;
          const base64 = await FileSystem.readAsStringAsync(photo.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const fname = photoFilename(photo.uri);
          photosDir.file(fname, base64, { base64: true });
          uriToFilename.set(photo.uri, fname);
          capturedAt[fname] = photo.capturedAt;
          photoCount++;
        }
        const sessionUris = groupPhotosBySession(diary.photos);
        const sessions = sessionUris.map(uris =>
          uris.map(u => uriToFilename.get(u)).filter((x): x is string => Boolean(x))
        );
        babyEntry.diaries.push({
          entryDate: diary.entryDate,
          body: diary.body,
          mood: diary.mood,
          aiGenerated: diary.aiGenerated === 1,
          createdAt: diary.createdAt,
          sessions,
          capturedAt,
        });
        diaryCount++;
      }
      manifest.babies.push(babyEntry);
    }

    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    const zipBase64 = await zip.generateAsync({
      type: 'base64',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const target = `${FileSystem.cacheDirectory}babydiary-backup-${stamp}.zip`;
    await FileSystem.writeAsStringAsync(target, zipBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(target, {
        UTI: 'public.zip-archive',
        mimeType: 'application/zip',
        dialogTitle: '백업 파일 저장',
      });
    }

    return {
      ok: true,
      uri: target,
      stats: { babies: babies.length, diaries: diaryCount, photos: photoCount },
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : '백업 실패',
    };
  }
}

async function copyPhotoFromZip(
  zip: JSZip,
  zipPath: string
): Promise<string | null> {
  const file = zip.file(zipPath);
  if (!file) return null;
  const base64 = await file.async('base64');

  const photoDir = `${FileSystem.documentDirectory}photos/`;
  const dirInfo = await FileSystem.getInfoAsync(photoDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(photoDir, { intermediates: true });
  }

  const filename = photoPath(zipPath);
  const dest = `${photoDir}restored_${Date.now()}_${filename}`;
  await FileSystem.writeAsStringAsync(dest, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return dest;
}

function photoPath(zipPath: string): string {
  const idx = zipPath.lastIndexOf('/');
  return idx >= 0 ? zipPath.substring(idx + 1) : zipPath;
}

export async function importBackup(zipUri: string): Promise<RestoreResult> {
  try {
    const base64 = await FileSystem.readAsStringAsync(zipUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const zip = await JSZip.loadAsync(base64, { base64: true });

    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) {
      return { ok: false, message: '올바른 백업 파일이 아닌 것 같아요' };
    }
    const manifest: BackupManifest = JSON.parse(
      await manifestFile.async('string')
    );
    if (manifest.version > BACKUP_VERSION) {
      return {
        ok: false,
        message: `지원하지 않는 백업 버전입니다 (v${manifest.version})`,
      };
    }

    await resetDatabase();

    let diaryCount = 0;
    let photoCount = 0;

    for (const babyEntry of manifest.babies) {
      const baby = await createBaby({
        name: babyEntry.name,
        birthDate: babyEntry.birthDate,
        profileImageUri: babyEntry.profileImageUri,
      });

      for (const diaryEntry of babyEntry.diaries) {
        const sessionsInput: string[][] = diaryEntry.sessions
          ? diaryEntry.sessions
          : diaryEntry.photoFiles
          ? [diaryEntry.photoFiles]
          : [[]];

        const capturedAtByUri: Record<string, string | null> = {};
        const restoredSessions: string[][] = [];
        for (const session of sessionsInput) {
          const restoredSession: string[] = [];
          for (const zipFile of session) {
            const restored = await copyPhotoFromZip(zip, `photos/${zipFile}`);
            if (restored) {
              restoredSession.push(restored);
              capturedAtByUri[restored] =
                diaryEntry.capturedAt?.[zipFile] ?? null;
              photoCount++;
            }
          }
          restoredSessions.push(restoredSession);
        }

        await createDiary({
          babyId: baby.id,
          entryDate: diaryEntry.entryDate,
          body: diaryEntry.body,
          mood: diaryEntry.mood,
          aiGenerated: diaryEntry.aiGenerated,
          photoSessions: restoredSessions.length > 0 ? restoredSessions : [[]],
          capturedAtByUri,
        });
        diaryCount++;
      }
    }

    return {
      ok: true,
      stats: {
        babies: manifest.babies.length,
        diaries: diaryCount,
        photos: photoCount,
      },
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : '복원 실패',
    };
  }
}
