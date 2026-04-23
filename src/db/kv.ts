import { getDatabase } from './database';

export async function kvGet(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM kv_store WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}

export async function kvSet(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO kv_store (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  );
}

export async function kvDelete(key: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM kv_store WHERE key = ?', [key]);
}

export async function kvGetJSON<T>(key: string): Promise<T | null> {
  const raw = await kvGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function kvSetJSON<T>(key: string, value: T): Promise<void> {
  await kvSet(key, JSON.stringify(value));
}
