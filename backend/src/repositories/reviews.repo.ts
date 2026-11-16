import { pool } from '../config/db.js';

// place/product comparten la tabla `reviews` (columna distinta); los videos usan `video_reviews`.
const CFG = {
  place:   { table: 'reviews',       fk: 'place_id' },
  product: { table: 'reviews',       fk: 'product_id' },
  video:   { table: 'video_reviews', fk: 'video_id' },
};
export const TABLE_OF = { review: 'reviews', video_review: 'video_reviews' };
export const MAX_REVIEW_IMAGES = 4;

const SORTS = {
  newest: 'r.created_at DESC, r.id DESC',
  oldest: 'r.created_at ASC, r.id ASC',
  rating_desc: 'r.rating DESC, r.created_at DESC, r.id DESC',
  rating_asc: 'r.rating ASC, r.created_at DESC, r.id DESC',
};
const USER_COLS = 'u.display_name AS author_name, u.avatar_url AS author_avatar';

export async function listForEntity(kind, entityId, f, db = pool) {
  const c = CFG[kind];
  const where = [`r.${c.fk} = ?`, `r.status IN (${f.statuses.map(() => '?').join(',')})`];
  const params = [entityId, ...f.statuses];
  if (f.rating) { where.push('r.rating = ?'); params.push(f.rating); }
  const clause = where.join(' AND ');
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM ${c.table} r WHERE ${clause}`, params);
  const [rows] = await db.query(
    `SELECT r.*, ${USER_COLS} FROM ${c.table} r JOIN users u ON u.id = r.user_id WHERE ${clause} ORDER BY ${SORTS[f.sort] ?? SORTS.newest} LIMIT ? OFFSET ?`,
    [...params, f.limit, f.offset]);
  return { total, rows };
}
export async function distribution(kind, entityId, db = pool) {
  const c = CFG[kind];
  const [rows] = await db.query(`SELECT rating, COUNT(*) AS n FROM ${c.table} WHERE ${c.fk} = ? AND status = 'visible' GROUP BY rating`, [entityId]);
  const d = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of rows) d[r.rating] = r.n;
  return d;
}
export async function findMine(kind, entityId, userId, db = pool) {
  const c = CFG[kind];
  const [rows] = await db.query(`SELECT r.*, ${USER_COLS} FROM ${c.table} r JOIN users u ON u.id = r.user_id WHERE r.${c.fk} = ? AND r.user_id = ?`, [entityId, userId]);
  return rows[0] ?? null;
}
export async function findById(table, id, db = pool) {
  const [rows] = await db.query(`SELECT r.*, ${USER_COLS} FROM ${table} r JOIN users u ON u.id = r.user_id WHERE r.id = ?`, [id]);
  return rows[0] ?? null;
}
export async function insert(kind, { userId, entityId, rating, comment, status }, db = pool) {
  const c = CFG[kind];
  const [res] = await db.query(`INSERT INTO ${c.table} (user_id, ${c.fk}, rating, comment, status) VALUES (?, ?, ?, ?, ?)`, [userId, entityId, rating, comment, status]);
  return res.insertId;
}
export async function update(table, id, { rating, comment, status }, db = pool) {
  const sets = []; const values = [];
  if (rating !== undefined) { sets.push('rating = ?'); values.push(rating); }
  if (comment !== undefined) { sets.push('comment = ?'); values.push(comment); }
  if (status !== undefined) { sets.push('status = ?'); values.push(status); }
  if (sets.length) await db.query(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = ?`, [...values, id]);
}
export const setStatus = (table, id, status, db = pool) => db.query(`UPDATE ${table} SET status = ? WHERE id = ?`, [status, id]);
export const remove = (table, id, db = pool) => db.query(`DELETE FROM ${table} WHERE id = ?`, [id]);

// --- Fotos (solo reseñas de lugares/productos) ---
export async function imagesFor(reviewIds, db = pool) {
  if (!reviewIds.length) return new Map();
  const [rows] = await db.query('SELECT id, review_id, url, position FROM review_images WHERE review_id IN (?) ORDER BY position, id', [reviewIds]);
  const map = new Map();
  for (const r of rows) (map.get(r.review_id) ?? map.set(r.review_id, []).get(r.review_id)).push({ id: r.id, url: r.url, position: r.position });
  return map;
}
export async function storagePaths(reviewId, db = pool) {
  const [rows] = await db.query('SELECT storage_path FROM review_images WHERE review_id = ?', [reviewId]);
  return rows.map((r) => r.storage_path);
}
export async function countImages(reviewId, db = pool) {
  const [[{ n }]] = await db.query('SELECT COUNT(*) AS n FROM review_images WHERE review_id = ?', [reviewId]);
  return n;
}
export async function insertImage(reviewId, img, db = pool) {
  const [res] = await db.query('INSERT INTO review_images (review_id, url, storage_path, mime_type, size_bytes, position) VALUES (?, ?, ?, ?, ?, ?)',
    [reviewId, img.url, img.storagePath, img.mimeType, img.size, img.position]);
  return { id: res.insertId, url: img.url, position: img.position };
}
export async function findImage(reviewId, imageId, db = pool) {
  const [rows] = await db.query('SELECT id, storage_path FROM review_images WHERE id = ? AND review_id = ?', [imageId, reviewId]);
  return rows[0] ?? null;
}
export const deleteImage = (imageId, db = pool) => db.query('DELETE FROM review_images WHERE id = ?', [imageId]);

// Reseñas pendientes (cola de premoderación) con contexto de la entidad.
export async function listPending({ type, limit, offset }, db = pool) {
  const table = TABLE_OF[type];
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM ${table} WHERE status = 'pending'`);
  const ctx = type === 'video_review'
    ? "'video' AS target_type, r.video_id AS target_id, e.title AS target_name"
    : "IF(r.place_id IS NOT NULL, 'place', 'product') AS target_type, COALESCE(r.place_id, r.product_id) AS target_id, COALESCE(pl.name, pr.name) AS target_name";
  const joins = type === 'video_review' ? 'JOIN videos e ON e.id = r.video_id' : 'LEFT JOIN places pl ON pl.id = r.place_id LEFT JOIN products pr ON pr.id = r.product_id';
  const [rows] = await db.query(
    `SELECT r.id, r.rating, r.comment, r.created_at, r.user_id, ${USER_COLS}, ${ctx} FROM ${table} r JOIN users u ON u.id = r.user_id ${joins}
      WHERE r.status = 'pending' ORDER BY r.created_at ASC, r.id ASC LIMIT ? OFFSET ?`, [limit, offset]);
  return { total, rows };
}
