import type { Anniversary, AnniversaryCategory } from '../types';
import { getDatabase } from './database';

type AnniversaryRow = {
  id: number;
  baby_id: number;
  name: string;
  icon: string;
  category: string | null;
  date: string;
  diary_id: number | null;
  notes: string | null;
  created_at: string;
};

const VALID_CATEGORIES: AnniversaryCategory[] = [
  'date',
  'physical',
  'language',
  'social',
  'event',
  'custom',
];

function normalizeCategory(value: string | null): AnniversaryCategory | null {
  if (!value) return null;
  return VALID_CATEGORIES.includes(value as AnniversaryCategory)
    ? (value as AnniversaryCategory)
    : null;
}

const mapAnniversary = (row: AnniversaryRow): Anniversary => ({
  id: row.id,
  babyId: row.baby_id,
  name: row.name,
  icon: row.icon,
  category: normalizeCategory(row.category),
  date: row.date,
  diaryId: row.diary_id,
  notes: row.notes,
  createdAt: row.created_at,
});

export async function listAnniversaries(babyId: number): Promise<Anniversary[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<AnniversaryRow>(
    'SELECT * FROM anniversaries WHERE baby_id = ? ORDER BY date DESC, id DESC',
    [babyId]
  );
  return rows.map(mapAnniversary);
}

export async function listAnniversariesInRange(
  babyId: number,
  startDate: string,
  endDate: string
): Promise<Anniversary[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<AnniversaryRow>(
    `SELECT * FROM anniversaries
     WHERE baby_id = ? AND date >= ? AND date <= ?
     ORDER BY date DESC, id DESC`,
    [babyId, startDate, endDate]
  );
  return rows.map(mapAnniversary);
}

export async function listAnniversariesForDiary(
  diaryId: number
): Promise<Anniversary[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<AnniversaryRow>(
    'SELECT * FROM anniversaries WHERE diary_id = ? ORDER BY id ASC',
    [diaryId]
  );
  return rows.map(mapAnniversary);
}

export async function createAnniversary(input: {
  babyId: number;
  name: string;
  icon: string;
  category?: AnniversaryCategory | null;
  date: string;
  diaryId?: number | null;
  notes?: string | null;
}): Promise<Anniversary> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO anniversaries (baby_id, name, icon, category, date, diary_id, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.babyId,
      input.name,
      input.icon || '🎉',
      input.category ?? null,
      input.date,
      input.diaryId ?? null,
      input.notes ?? null,
    ]
  );
  const row = await db.getFirstAsync<AnniversaryRow>(
    'SELECT * FROM anniversaries WHERE id = ?',
    [result.lastInsertRowId]
  );
  if (!row) throw new Error('Failed to create anniversary');
  return mapAnniversary(row);
}

export async function updateAnniversary(
  id: number,
  patch: Partial<{
    name: string;
    icon: string;
    category: AnniversaryCategory | null;
    date: string;
    diaryId: number | null;
    notes: string | null;
  }>
): Promise<void> {
  const db = await getDatabase();
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  if (patch.name !== undefined) {
    fields.push('name = ?');
    values.push(patch.name);
  }
  if (patch.icon !== undefined) {
    fields.push('icon = ?');
    values.push(patch.icon);
  }
  if (patch.category !== undefined) {
    fields.push('category = ?');
    values.push(patch.category);
  }
  if (patch.date !== undefined) {
    fields.push('date = ?');
    values.push(patch.date);
  }
  if (patch.diaryId !== undefined) {
    fields.push('diary_id = ?');
    values.push(patch.diaryId);
  }
  if (patch.notes !== undefined) {
    fields.push('notes = ?');
    values.push(patch.notes);
  }
  if (fields.length === 0) return;
  values.push(id);
  await db.runAsync(
    `UPDATE anniversaries SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

export async function deleteAnniversary(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM anniversaries WHERE id = ?', [id]);
}
