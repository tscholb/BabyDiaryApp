import type { Diary, DiaryWithPhotos, Photo } from '../types';
import { getDatabase } from './database';

type DiaryRow = {
  id: number;
  baby_id: number;
  entry_date: string;
  body: string;
  mood: string | null;
  ai_generated: number;
  created_at: string;
  updated_at: string;
};

type PhotoRow = {
  id: number;
  diary_id: number;
  uri: string;
  order_index: number;
  session_index: number;
  captured_at: string | null;
  created_at: string;
};

const mapDiary = (row: DiaryRow): Diary => ({
  id: row.id,
  babyId: row.baby_id,
  entryDate: row.entry_date,
  body: row.body,
  mood: row.mood,
  aiGenerated: row.ai_generated,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapPhoto = (row: PhotoRow): Photo => ({
  id: row.id,
  diaryId: row.diary_id,
  uri: row.uri,
  orderIndex: row.order_index,
  sessionIndex: row.session_index ?? 0,
  capturedAt: row.captured_at ?? null,
  createdAt: row.created_at,
});

const PHOTO_ORDER = 'session_index ASC, order_index ASC';

export async function listDiaries(babyId: number): Promise<DiaryWithPhotos[]> {
  const db = await getDatabase();
  const diaryRows = await db.getAllAsync<DiaryRow>(
    'SELECT * FROM diaries WHERE baby_id = ? ORDER BY entry_date DESC, created_at DESC',
    [babyId]
  );
  if (diaryRows.length === 0) return [];

  const ids = diaryRows.map(d => d.id);
  const placeholders = ids.map(() => '?').join(',');
  const photoRows = await db.getAllAsync<PhotoRow>(
    `SELECT * FROM photos WHERE diary_id IN (${placeholders}) ORDER BY diary_id, ${PHOTO_ORDER}`,
    ids
  );

  const photosByDiary = new Map<number, Photo[]>();
  for (const p of photoRows) {
    const photo = mapPhoto(p);
    const list = photosByDiary.get(photo.diaryId) ?? [];
    list.push(photo);
    photosByDiary.set(photo.diaryId, list);
  }

  return diaryRows.map(d => ({
    ...mapDiary(d),
    photos: photosByDiary.get(d.id) ?? [],
  }));
}

export async function getDiary(id: number): Promise<DiaryWithPhotos | null> {
  const db = await getDatabase();
  const diaryRow = await db.getFirstAsync<DiaryRow>(
    'SELECT * FROM diaries WHERE id = ?',
    [id]
  );
  if (!diaryRow) return null;
  const photoRows = await db.getAllAsync<PhotoRow>(
    `SELECT * FROM photos WHERE diary_id = ? ORDER BY ${PHOTO_ORDER}`,
    [id]
  );
  return { ...mapDiary(diaryRow), photos: photoRows.map(mapPhoto) };
}

export async function createDiary(input: {
  babyId: number;
  entryDate: string;
  body: string;
  mood?: string | null;
  aiGenerated?: boolean;
  photoSessions: string[][];
  capturedAtByUri?: Record<string, string | null>;
}): Promise<DiaryWithPhotos> {
  const db = await getDatabase();
  let diaryId = 0;
  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      'INSERT INTO diaries (baby_id, entry_date, body, mood, ai_generated) VALUES (?, ?, ?, ?, ?)',
      [
        input.babyId,
        input.entryDate,
        input.body,
        input.mood ?? null,
        input.aiGenerated ? 1 : 0,
      ]
    );
    diaryId = result.lastInsertRowId;

    for (let s = 0; s < input.photoSessions.length; s++) {
      const session = input.photoSessions[s];
      for (let i = 0; i < session.length; i++) {
        const uri = session[i];
        const capturedAt = input.capturedAtByUri?.[uri] ?? null;
        await db.runAsync(
          'INSERT INTO photos (diary_id, uri, order_index, session_index, captured_at) VALUES (?, ?, ?, ?, ?)',
          [diaryId, uri, i, s, capturedAt]
        );
      }
    }
  });

  const created = await getDiary(diaryId);
  if (!created) throw new Error('Failed to create diary');
  return created;
}

export async function updateDiary(
  id: number,
  patch: {
    body?: string;
    mood?: string | null;
    entryDate?: string;
    photoSessions?: string[][];
    capturedAtByUri?: Record<string, string | null>;
  }
): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    if (patch.body !== undefined) {
      fields.push('body = ?');
      values.push(patch.body);
    }
    if (patch.mood !== undefined) {
      fields.push('mood = ?');
      values.push(patch.mood);
    }
    if (patch.entryDate !== undefined) {
      fields.push('entry_date = ?');
      values.push(patch.entryDate);
    }
    if (fields.length > 0) {
      fields.push(`updated_at = datetime('now')`);
      values.push(id);
      await db.runAsync(
        `UPDATE diaries SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
    }

    if (patch.photoSessions) {
      await db.runAsync('DELETE FROM photos WHERE diary_id = ?', [id]);
      for (let s = 0; s < patch.photoSessions.length; s++) {
        const session = patch.photoSessions[s];
        for (let i = 0; i < session.length; i++) {
          const uri = session[i];
          const capturedAt = patch.capturedAtByUri?.[uri] ?? null;
          await db.runAsync(
            'INSERT INTO photos (diary_id, uri, order_index, session_index, captured_at) VALUES (?, ?, ?, ?, ?)',
            [id, uri, i, s, capturedAt]
          );
        }
      }
    }
  });
}

export async function deleteDiary(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM diaries WHERE id = ?', [id]);
}

export async function listDiariesInRange(
  babyId: number,
  startDate: string,
  endDate: string
): Promise<DiaryWithPhotos[]> {
  const db = await getDatabase();
  const diaryRows = await db.getAllAsync<DiaryRow>(
    `SELECT * FROM diaries
     WHERE baby_id = ? AND entry_date >= ? AND entry_date <= ?
     ORDER BY entry_date DESC, created_at DESC`,
    [babyId, startDate, endDate]
  );
  if (diaryRows.length === 0) return [];

  const ids = diaryRows.map(d => d.id);
  const placeholders = ids.map(() => '?').join(',');
  const photoRows = await db.getAllAsync<PhotoRow>(
    `SELECT * FROM photos WHERE diary_id IN (${placeholders}) ORDER BY diary_id, ${PHOTO_ORDER}`,
    ids
  );

  const photosByDiary = new Map<number, Photo[]>();
  for (const p of photoRows) {
    const photo = mapPhoto(p);
    const list = photosByDiary.get(photo.diaryId) ?? [];
    list.push(photo);
    photosByDiary.set(photo.diaryId, list);
  }

  return diaryRows.map(d => ({
    ...mapDiary(d),
    photos: photosByDiary.get(d.id) ?? [],
  }));
}
