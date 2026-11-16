import { pool } from '../config/db.js';
import { escapeLike, whereBuilder } from '../utils/pagination.js';

// Grupos de catálogos de apoyo. `usedBy` lista dónde se referencia cada uno (para decidir baja física o desactivación).
export const GROUPS = {
  categories: { table: 'categories', active: true, cols: ['type', 'name', 'slug', 'is_active'],
    usedBy: [['places', 'category_id'], ['place_categories', 'category_id'], ['products', 'category_id'], ['videos', 'category_id'], ['featured_settings', 'preferred_category_id']] },
  brands: { table: 'brands', active: true, cols: ['name', 'slug', 'website', 'is_active'], usedBy: [['products', 'brand_id']] },
  cities: { table: 'cities', cols: ['name', 'region', 'country'], usedBy: [['places', 'city_id']] },
  'surface-types': { table: 'surface_types', cols: ['name'], usedBy: [['places', 'surface_type_id']] },
  'obstacle-types': { table: 'obstacle_types', cols: ['name'], usedBy: [['place_obstacles', 'obstacle_type_id']] },
  amenities: { table: 'amenities', cols: ['name'], usedBy: [['place_amenities', 'amenity_id']] },
};

const toItem = (g, r) => {
  const item = { id: r.id, name: r.name };
  if (g === 'categories') Object.assign(item, { type: r.type, slug: r.slug, isActive: Boolean(r.is_active) });
  if (g === 'brands') Object.assign(item, { slug: r.slug, website: r.website, isActive: Boolean(r.is_active) });
  if (g === 'cities') Object.assign(item, { region: r.region, country: r.country });
  return item;
};

export async function list(group, { q, type, includeInactive, limit, offset }, db = pool) {
  const cfg = GROUPS[group];
  const w = whereBuilder();
  if (q) w.add('name LIKE ?', `%${escapeLike(q)}%`);
  if (group === 'categories' && type) w.add('type = ?', type);
  if (cfg.active && !includeInactive) w.add('is_active = 1');
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM ${cfg.table} ${w.sql}`, w.params);
  const [rows] = await db.query(`SELECT * FROM ${cfg.table} ${w.sql} ORDER BY name ASC, id ASC LIMIT ? OFFSET ?`, [...w.params, limit, offset]);
  return { total, items: rows.map((r) => toItem(group, r)) };
}
export async function findById(group, id, db = pool) {
  const [rows] = await db.query(`SELECT * FROM ${GROUPS[group].table} WHERE id = ?`, [id]);
  return rows[0] ? toItem(group, rows[0]) : null;
}
export async function insert(group, data, db = pool) {
  const cols = GROUPS[group].cols.filter((c) => data[c] !== undefined);
  const [res] = await db.query(
    `INSERT INTO ${GROUPS[group].table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, cols.map((c) => data[c]));
  return findById(group, res.insertId, db);
}
export async function update(group, id, data, db = pool) {
  const cols = GROUPS[group].cols.filter((c) => data[c] !== undefined);
  if (cols.length) await db.query(`UPDATE ${GROUPS[group].table} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [...cols.map((c) => data[c]), id]);
  return findById(group, id, db);
}
export async function isUsed(group, id, db = pool) {
  for (const [table, col] of GROUPS[group].usedBy) {
    const [rows] = await db.query(`SELECT 1 FROM ${table} WHERE ${col} = ? LIMIT 1`, [id]);
    if (rows.length) return true;
  }
  return false;
}
export const remove = (group, id, db = pool) => db.query(`DELETE FROM ${GROUPS[group].table} WHERE id = ?`, [id]);
export const slugExists = async (group, slug, type, db = pool) => {
  const [rows] = group === 'categories'
    ? await db.query('SELECT 1 FROM categories WHERE type = ? AND slug = ? LIMIT 1', [type, slug])
    : await db.query(`SELECT 1 FROM ${GROUPS[group].table} WHERE slug = ? LIMIT 1`, [slug]);
  return rows.length > 0;
};

// Validaciones que usa el catálogo al crear/editar contenido.
export async function activeCategoryOfType(id, type, db = pool) {
  const [rows] = await db.query('SELECT id FROM categories WHERE id = ? AND type = ? AND is_active = 1', [id, type]);
  return rows.length > 0;
}
export async function activeBrand(id, db = pool) {
  const [rows] = await db.query('SELECT id FROM brands WHERE id = ? AND is_active = 1', [id]);
  return rows.length > 0;
}
export async function findOrCreateCity({ name, region = null, country = 'AR' }, db = pool) {
  const [rows] = await db.query('SELECT id FROM cities WHERE name = ? AND country = ? AND (region <=> ?) LIMIT 1', [name, country, region]);
  if (rows[0]) return rows[0].id;
  const [res] = await db.query('INSERT INTO cities (name, region, country) VALUES (?, ?, ?)', [name, region, country]);
  return res.insertId;
}
export async function allOptions(db = pool) {
  const [[s], [o], [a]] = await Promise.all([
    db.query('SELECT id, name FROM surface_types ORDER BY name'),
    db.query('SELECT id, name FROM obstacle_types ORDER BY name'),
    db.query('SELECT id, name FROM amenities ORDER BY name'),
  ]);
  return { surfaceTypes: s, obstacleTypes: o, amenities: a };
}
