import { pool } from '../config/db.js';

export async function getRaw(key, db = pool) {
  const [rows] = await db.query('SELECT setting_value FROM app_settings WHERE setting_key = ?', [key]);
  return rows[0]?.setting_value ?? null;
}
export async function getInt(key, fallback, db = pool) {
  const n = Number.parseInt(await getRaw(key, db), 10);
  return Number.isNaN(n) ? fallback : n;
}
export async function getBool(key, fallback, db = pool) {
  const v = await getRaw(key, db);
  return v === null ? fallback : v === '1' || v === 'true';
}
export async function getAll(db = pool) {
  const [rows] = await db.query('SELECT setting_key, setting_value, updated_at FROM app_settings ORDER BY setting_key');
  return rows.map((r) => ({ key: r.setting_key, value: r.setting_value, updatedAt: r.updated_at }));
}
export const upsert = (key, value, userId, db = pool) =>
  db.query(
    'INSERT INTO app_settings (setting_key, setting_value, updated_by) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)',
    [key, value, userId],
  );
