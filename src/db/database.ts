import * as SQLite from 'expo-sqlite';
import { MIGRATIONS, SCHEMA_VERSION } from './schema';

const DB_NAME = 'baby_diary.db';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  await runMigrations(db);
  dbInstance = db;
  return db;
}

async function runMigrations(db: SQLite.SQLiteDatabase) {
  const result = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version'
  );
  const currentVersion = result?.user_version ?? 0;

  for (let v = currentVersion + 1; v <= SCHEMA_VERSION; v++) {
    const sql = MIGRATIONS[v];
    if (!sql) continue;
    await db.execAsync(sql);
    await db.execAsync(`PRAGMA user_version = ${v}`);
  }
}

export async function resetDatabase() {
  const db = await getDatabase();
  await db.execAsync(`
    DROP TABLE IF EXISTS photos;
    DROP TABLE IF EXISTS diaries;
    DROP TABLE IF EXISTS babies;
    DROP TABLE IF EXISTS kv_store;
    PRAGMA user_version = 0;
  `);
  dbInstance = null;
  await getDatabase();
}
