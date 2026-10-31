import { pool } from '../config/db.js';
import { escapeLike, whereBuilder } from '../utils/pagination.js';

const SORTS = {
  oldest: 'p.created_at ASC, p.id ASC',
  newest: 'COALESCE(p.published_at, p.created_at) DESC, p.id DESC',
  rating: 'p.avg_rating DESC, p.review_count DESC, p.id DESC',
  reviews: 'p.review_count DESC, p.avg_rating DESC, p.id DESC',
  name: 'p.name ASC, p.id ASC',
};

export async function search(f, db = pool) {
  const w = whereBuilder();
  if (f.statuses) w.add(`p.status IN (${f.statuses.map(() => '?').join(',')})`, ...f.statuses);
  if (!f.includeDeleted) w.add('p.deleted_at IS NULL');
  if (f.submittedBy) w.add('p.submitted_by = ?', f.submittedBy);
  if (f.q) { const like = `%${escapeLike(f.q)}%`; w.add('(p.name LIKE ? OR p.zone LIKE ? OR p.description LIKE ?)', like, like, like); }
  // La categoría vale si es la principal o una de las secundarias.
  if (f.categoryId) w.add('(p.category_id = ? OR EXISTS (SELECT 1 FROM place_categories pc WHERE pc.place_id = p.id AND pc.category_id = ?))', f.categoryId, f.categoryId);
  if (f.cityId) w.add('p.city_id = ?', f.cityId);
  if (f.zone) w.add('p.zone LIKE ?', `%${escapeLike(f.zone)}%`);
  if (f.minRating !== undefined) w.add('p.avg_rating >= ?', f.minRating);
  if (f.minReviews !== undefined) w.add('p.review_count >= ?', f.minReviews);
  if (f.publishedAfter) w.add('p.published_at >= ?', f.publishedAfter);
  if (f.publishedBefore) w.add('p.published_at < DATE_ADD(?, INTERVAL 1 DAY)', f.publishedBefore);
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM places p ${w.sql}`, w.params);
  const [rows] = await db.query(
    `SELECT p.id, p.name, p.slug, p.zone, p.status, p.rejection_reason, p.submitted_by, p.avg_rating, p.review_count, p.published_at, p.created_at,
            c.id AS category_id, c.name AS category_name, ci.id AS city_id, ci.name AS city_name,
            (SELECT i.url FROM place_images i WHERE i.place_id = p.id ORDER BY i.position, i.id LIMIT 1) AS cover_url
       FROM places p JOIN categories c ON c.id = p.category_id JOIN cities ci ON ci.id = p.city_id
       ${w.sql} ORDER BY ${SORTS[f.sort] ?? SORTS.newest} LIMIT ? OFFSET ?`,
    [...w.params, f.limit, f.offset],
  );
  return { total, rows };
}

export async function findDetail(ref, db = pool) {
  const byId = /^\d+$/.test(ref);
  const [rows] = await db.query(
    `SELECT p.*, c.name AS category_name, ci.name AS city_name, ci.region AS city_region, st.name AS surface_name, u.display_name AS submitter_name
       FROM places p JOIN categories c ON c.id = p.category_id JOIN cities ci ON ci.id = p.city_id
       LEFT JOIN surface_types st ON st.id = p.surface_type_id LEFT JOIN users u ON u.id = p.submitted_by
      WHERE ${byId ? 'p.id' : 'p.slug'} = ?`, [ref]);
  const row = rows[0];
  if (!row) return null;
  const [[extra], [obstacles], [amenities], [hours], [images]] = await Promise.all([
    db.query('SELECT c.id, c.name FROM place_categories pc JOIN categories c ON c.id = pc.category_id WHERE pc.place_id = ? ORDER BY c.name', [row.id]),
    db.query('SELECT o.id, o.name FROM place_obstacles po JOIN obstacle_types o ON o.id = po.obstacle_type_id WHERE po.place_id = ? ORDER BY o.name', [row.id]),
    db.query('SELECT a.id, a.name FROM place_amenities pa JOIN amenities a ON a.id = pa.amenity_id WHERE pa.place_id = ? ORDER BY a.name', [row.id]),
    db.query('SELECT weekday, opens_at, closes_at FROM place_hours WHERE place_id = ? ORDER BY weekday', [row.id]),
    db.query('SELECT id, url, position FROM place_images WHERE place_id = ? ORDER BY position, id', [row.id]),
  ]);
  return { row, extra, obstacles, amenities, hours, images };
}

export async function duplicateExists(name, cityId, exceptId = null, db = pool) {
  const [rows] = await db.query('SELECT 1 FROM places WHERE name = ? AND city_id = ? AND deleted_at IS NULL AND id <> ? LIMIT 1', [name, cityId, exceptId ?? 0]);
  return rows.length > 0;
}

export async function insert(d, db = pool) {
  const [res] = await db.query(
    `INSERT INTO places (name, slug, description, category_id, city_id, zone, address, latitude, longitude, surface_type_id, status, submitted_by, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [d.name, d.slug, d.description ?? null, d.categoryId, d.cityId, d.zone ?? null, d.address ?? null, d.latitude ?? null, d.longitude ?? null,
      d.surfaceTypeId ?? null, d.status, d.submittedBy, d.status === 'published' ? new Date() : null]);
  return res.insertId;
}

const COLUMNS = { name: 'name', description: 'description', categoryId: 'category_id', cityId: 'city_id', zone: 'zone', address: 'address', latitude: 'latitude', longitude: 'longitude', surfaceTypeId: 'surface_type_id' };
export async function updateFields(id, d, db = pool) {
  const sets = []; const values = [];
  for (const [key, col] of Object.entries(COLUMNS)) if (d[key] !== undefined) { sets.push(`${col} = ?`); values.push(d[key]); }
  if (sets.length) await db.query(`UPDATE places SET ${sets.join(', ')} WHERE id = ?`, [...values, id]);
}

// Reemplaza solo las colecciones que vienen en la petición (undefined = no tocar).
export async function replaceChildren(id, d, db = pool) {
  const swap = async (table, col, values, build) => {
    if (values === undefined) return;
    await db.query(`DELETE FROM ${table} WHERE place_id = ?`, [id]);
    if (values.length) await db.query(`INSERT INTO ${table} (place_id, ${col}) VALUES ?`, [values.map((v) => [id, v])]);
  };
  await swap('place_categories', 'category_id', d.categoryIds);
  await swap('place_obstacles', 'obstacle_type_id', d.obstacleIds);
  await swap('place_amenities', 'amenity_id', d.amenityIds);
  if (d.hours !== undefined) {
    await db.query('DELETE FROM place_hours WHERE place_id = ?', [id]);
    if (d.hours.length) await db.query('INSERT INTO place_hours (place_id, weekday, opens_at, closes_at) VALUES ?', [d.hours.map((h) => [id, h.weekday, h.opensAt, h.closesAt])]);
  }
}
