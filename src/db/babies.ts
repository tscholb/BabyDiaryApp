import type { Baby } from '../types';
import { getDatabase } from './database';

type BabyRow = {
  id: number;
  name: string;
  birth_date: string;
  profile_image_uri: string | null;
  created_at: string;
};

const mapBaby = (row: BabyRow): Baby => ({
  id: row.id,
  name: row.name,
  birthDate: row.birth_date,
  profileImageUri: row.profile_image_uri,
  createdAt: row.created_at,
});

export async function listBabies(): Promise<Baby[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<BabyRow>(
    'SELECT * FROM babies ORDER BY created_at ASC'
  );
  return rows.map(mapBaby);
}

export async function getBaby(id: number): Promise<Baby | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<BabyRow>(
    'SELECT * FROM babies WHERE id = ?',
    [id]
  );
  return row ? mapBaby(row) : null;
}

export async function createBaby(input: {
  name: string;
  birthDate: string;
  profileImageUri?: string | null;
}): Promise<Baby> {
  const db = await getDatabase();
  const result = await db.runAsync(
    'INSERT INTO babies (name, birth_date, profile_image_uri) VALUES (?, ?, ?)',
    [input.name, input.birthDate, input.profileImageUri ?? null]
  );
  const created = await getBaby(result.lastInsertRowId);
  if (!created) throw new Error('Failed to create baby');
  return created;
}

export async function updateBaby(
  id: number,
  patch: Partial<Pick<Baby, 'name' | 'birthDate' | 'profileImageUri'>>
): Promise<void> {
  const db = await getDatabase();
  const fields: string[] = [];
  const values: (string | null)[] = [];
  if (patch.name !== undefined) {
    fields.push('name = ?');
    values.push(patch.name);
  }
  if (patch.birthDate !== undefined) {
    fields.push('birth_date = ?');
    values.push(patch.birthDate);
  }
  if (patch.profileImageUri !== undefined) {
    fields.push('profile_image_uri = ?');
    values.push(patch.profileImageUri);
  }
  if (fields.length === 0) return;
  values.push(String(id));
  await db.runAsync(
    `UPDATE babies SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

export async function deleteBaby(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM babies WHERE id = ?', [id]);
}
