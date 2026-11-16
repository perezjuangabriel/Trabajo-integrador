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
  await ensureVideoProviders(db);
  await seedCatalogIfEmpty(db);
}

// Bases creadas antes de soportar Instagram: amplía el ENUM de `videos.provider` (solo agrega un valor, no toca datos). Idempotente.
export async function ensureVideoProviders(db = pool) {
  const [rows] = await db.query("SELECT COLUMN_TYPE AS t FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'videos' AND COLUMN_NAME = 'provider'");
  if (rows[0] && !String(rows[0].t).includes("'instagram'")) {
    await db.query("ALTER TABLE videos MODIFY provider ENUM('youtube','vimeo','instagram','other') NOT NULL DEFAULT 'other'");
  }
}

// Catálogos básicos para una base nueva (db:setup no carga datos). Solo si la tabla está VACÍA: lo que el admin borre después no vuelve.
const BASE_CATALOG = {
  categories: [['type', 'name', 'slug'], [['place', 'Street', 'street'], ['place', 'Skatepark', 'skatepark'], ['place', 'Plaza / Skate plaza', 'plaza'], ['place', 'Indoor', 'indoor'],
    ['product', 'Tablas', 'tablas'], ['product', 'Trucks / Ejes', 'trucks'], ['product', 'Ruedas', 'ruedas'], ['product', 'Rulemanes', 'rulemanes'], ['product', 'Zapatillas', 'zapatillas'],
    ['product', 'Grip', 'grip'], ['product', 'Accesorios y protecciones', 'accesorios'], ['product', 'Ropa de skate', 'ropa'],
    ['video', 'Clips', 'clips'], ['video', 'Full parts', 'full-parts'], ['video', 'Tutoriales', 'tutoriales'], ['video', 'Eventos', 'eventos']]],
  surface_types: [['name'], ['Hormigón liso', 'Hormigón rugoso', 'Asfalto', 'Granito', 'Madera', 'Baldosa'].map((n) => [n])],
  obstacle_types: [['name'], ['Escalera', 'Baranda', 'Cajón / Ledge', 'Manual pad', 'Bowl', 'Banco', 'Quarter', 'Rampa', 'Gap', 'Funbox', 'Mini rampa', 'Pirámide'].map((n) => [n])],
  amenities: [['name'], ['Iluminación', 'Baños', 'Agua potable', 'Estacionamiento', 'Bancos', 'Acceso gratuito', 'Sombra', 'Techado'].map((n) => [n])],
};
async function seedCatalogIfEmpty(db) {
  for (const [table, [cols, rows]] of Object.entries(BASE_CATALOG)) {
    const [[{ n }]] = await db.query(`SELECT COUNT(*) AS n FROM ${table}`);
    if (n === 0) await db.query(`INSERT INTO ${table} (${cols.join(', ')}) VALUES ?`, [rows]);
  }
}
