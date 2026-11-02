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

// Valores por defecto de producción. Se insertan solo si faltan (INSERT IGNORE): `db:setup` crea tablas vacías y los datos de
// prueba (seed.sql) no se cargan en producción, pero /home y la moderación necesitan estas filas.
export async function ensureDefaults(db = pool) {
  await db.query(
    "INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES ('require_moderation_places','1'),('require_moderation_products','1'),('require_moderation_videos','1'),('premoderate_reviews','0'),('account_deletion_grace_days','14')",
  );
  await db.query(
    "INSERT IGNORE INTO featured_settings (slot, mode, period_hours, min_reviews, recency_days) VALUES ('video','automatic',168,2,30),('product','automatic',24,3,30),('place','automatic',24,3,30)",
  );
}

