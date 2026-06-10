/**
 * Local SQLite cache — photos load instantly from disk on every open.
 *
 * Pattern:
 *  1. Read from SQLite immediately → show cached data (zero network wait)
 *  2. Fetch from Supabase in background → merge + update cache
 *  3. Realtime inserts → written to cache as they arrive
 *  4. Optimistic photos → written to cache with is_optimistic=1,
 *     replaced once the real record arrives from Supabase
 */
import * as SQLite from 'expo-sqlite';

let _db = null;

async function getDB() {
  if (_db) return _db;

  _db = await SQLite.openDatabaseAsync('candid_cache.db');

  await _db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS events (
      id          TEXT PRIMARY KEY,
      code        TEXT UNIQUE NOT NULL,
      name        TEXT NOT NULL,
      max_photos  INTEGER NOT NULL DEFAULT 10,
      host_id     TEXT NOT NULL,
      is_active   INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT
    );

    CREATE TABLE IF NOT EXISTS photos (
      id            TEXT PRIMARY KEY,
      event_id      TEXT NOT NULL,
      user_id       TEXT NOT NULL,
      url           TEXT NOT NULL,
      filter_id     TEXT NOT NULL DEFAULT 'natural',
      taken_at      TEXT,
      is_optimistic INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_photos_event_time
      ON photos (event_id, taken_at);
  `);

  return _db;
}

// ── Events ─────────────────────────────────────────────────────────

export async function saveEvent(event) {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO events (id, code, name, max_photos, host_id, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      event.id, event.code, event.name, event.max_photos,
      event.host_id, event.is_active ? 1 : 0, event.created_at,
    ]
  );
}

export async function getCachedEvent(code) {
  const db = await getDB();
  return db.getFirstAsync('SELECT * FROM events WHERE code = ?', [code]);
}

// ── Photos ─────────────────────────────────────────────────────────

export async function getCachedPhotos(eventId) {
  const db = await getDB();
  return db.getAllAsync(
    'SELECT * FROM photos WHERE event_id = ? ORDER BY taken_at ASC',
    [eventId]
  );
}

export async function savePhoto(photo, isOptimistic = false) {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO photos (id, event_id, user_id, url, filter_id, taken_at, is_optimistic)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      photo.id,
      photo.event_id,
      photo.user_id,
      photo.url,
      photo.filter_id ?? 'natural',
      photo.taken_at ?? new Date().toISOString(),
      isOptimistic ? 1 : 0,
    ]
  );
}

export async function savePhotos(photos) {
  const db = await getDB();
  for (const p of photos) {
    await db.runAsync(
      `INSERT OR REPLACE INTO photos (id, event_id, user_id, url, filter_id, taken_at, is_optimistic)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [p.id, p.event_id, p.user_id, p.url, p.filter_id ?? 'natural', p.taken_at ?? new Date().toISOString()]
    );
  }
}

// Replace a temp (optimistic) row with the real server record
export async function resolveOptimistic(tempId, realPhoto) {
  const db = await getDB();
  await db.runAsync('DELETE FROM photos WHERE id = ?', [tempId]);
  await savePhoto(realPhoto, false);
}

export async function deletePhoto(id) {
  const db = await getDB();
  await db.runAsync('DELETE FROM photos WHERE id = ?', [id]);
}
