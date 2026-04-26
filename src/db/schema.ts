export const SCHEMA_VERSION = 6;

export const MIGRATIONS: Record<number, string> = {
  1: `
    CREATE TABLE IF NOT EXISTS babies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      birth_date TEXT NOT NULL,
      profile_image_uri TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS diaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      baby_id INTEGER NOT NULL REFERENCES babies(id) ON DELETE CASCADE,
      entry_date TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      mood TEXT,
      ai_generated INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_diaries_baby_date
      ON diaries(baby_id, entry_date DESC);

    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      diary_id INTEGER NOT NULL REFERENCES diaries(id) ON DELETE CASCADE,
      uri TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_photos_diary
      ON photos(diary_id, order_index);

    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `,
  2: `
    ALTER TABLE photos ADD COLUMN session_index INTEGER NOT NULL DEFAULT 0;

    CREATE INDEX IF NOT EXISTS idx_photos_diary_session
      ON photos(diary_id, session_index, order_index);
  `,
  3: `
    ALTER TABLE photos ADD COLUMN captured_at TEXT;
  `,
  4: `
    ALTER TABLE diaries ADD COLUMN photo_layout TEXT NOT NULL DEFAULT 'polaroid';
    ALTER TABLE photos ADD COLUMN media_type TEXT NOT NULL DEFAULT 'photo';
    ALTER TABLE photos ADD COLUMN thumbnail_uri TEXT;
  `,
  5: `
    ALTER TABLE diaries ADD COLUMN session_bodies TEXT;
  `,
  6: `
    CREATE TABLE IF NOT EXISTS anniversaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      baby_id INTEGER NOT NULL REFERENCES babies(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '🎉',
      category TEXT,
      date TEXT NOT NULL,
      diary_id INTEGER REFERENCES diaries(id) ON DELETE SET NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_anniversaries_baby_date
      ON anniversaries(baby_id, date DESC);

    CREATE INDEX IF NOT EXISTS idx_anniversaries_diary
      ON anniversaries(diary_id);
  `,
};
