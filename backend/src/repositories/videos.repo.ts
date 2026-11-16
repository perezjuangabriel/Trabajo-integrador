import { pool } from '../config/db.js';
import { escapeLike, whereBuilder } from '../utils/pagination.js';

const SORTS = {
  oldest: 'v.created_at ASC, v.id ASC',
  newest: 'COALESCE(v.published_at, v.created_at) DESC, v.id DESC',
  rating: 'v.avg_rating DESC, v.review_count DESC, v.id DESC',
  reviews: 'v.review_count DESC, v.avg_rating DESC, v.id DESC',
  title: 'v.title ASC, v.id ASC',
};

export async function search(f, db = pool) {
  const w = whereBuilder();
  if (f.statuses) w.add(`v.status IN (${f.statuses.map(() => '?').join(',')})`, ...f.statuses);
  if (!f.includeDeleted) w.add('v.deleted_at IS NULL');
  if (f.submittedBy) w.add('v.submitted_by = ?', f.submittedBy);
  if (f.ids) w.add('v.id IN (?)', f.ids);
  if (f.q) { const like = `%${escapeLike(f.q)}%`; w.add('(v.title LIKE ? OR v.description LIKE ?)', like, like); }
  if (f.categoryId) w.add('v.category_id = ?', f.categoryId);
  if (f.minRating !== undefined) w.add('v.avg_rating >= ?', f.minRating);
  if (f.minReviews !== undefined) w.add('v.review_count >= ?', f.minReviews);
  if (f.publishedAfter) w.add('v.published_at >= ?', f.publishedAfter);
  if (f.publishedBefore) w.add('v.published_at < DATE_ADD(?, INTERVAL 1 DAY)', f.publishedBefore);
  const from = 'FROM videos v JOIN categories c ON c.id = v.category_id';
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total ${from} ${w.sql}`, w.params);
  const [rows] = await db.query(
    `SELECT v.id, v.title, v.description, v.url, v.provider, v.external_id, v.thumbnail_url, v.status, v.rejection_reason, v.submitted_by, v.avg_rating, v.review_count,
            v.published_at, v.created_at, c.id AS category_id, c.name AS category_name
       ${from} ${w.sql} ORDER BY ${SORTS[f.sort] ?? SORTS.newest} LIMIT ? OFFSET ?`,
    [...w.params, f.limit, f.offset]);
  return { total, rows };
}

export async function findDetail(id, db = pool) {
  const [rows] = await db.query(
    `SELECT v.*, c.name AS category_name, u.display_name AS submitter_name FROM videos v JOIN categories c ON c.id = v.category_id LEFT JOIN users u ON u.id = v.submitted_by WHERE v.id = ?`, [id]);
  return rows[0] ?? null;
}
export async function urlOwner(url, exceptId = null, db = pool) {
  const [rows] = await db.query('SELECT id, deleted_at FROM videos WHERE url = ? AND id <> ? LIMIT 1', [url, exceptId ?? 0]);
  return rows[0] ?? null;
}
export async function insert(d, db = pool) {
  const [res] = await db.query(
    `INSERT INTO videos (title, description, url, provider, external_id, thumbnail_url, category_id, status, submitted_by, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [d.title, d.description ?? null, d.url, d.provider, d.externalId, d.thumbnailUrl, d.categoryId, d.status, d.submittedBy, d.status === 'published' ? new Date() : null]);
  return res.insertId;
}
export async function updateFields(id, d, db = pool) {
  const map = { title: 'title', description: 'description', categoryId: 'category_id', url: 'url', provider: 'provider', externalId: 'external_id', thumbnailUrl: 'thumbnail_url' };
  const sets = []; const values = [];
  for (const [k, col] of Object.entries(map)) if (d[k] !== undefined) { sets.push(`${col} = ?`); values.push(d[k]); }
  if (sets.length) await db.query(`UPDATE videos SET ${sets.join(', ')} WHERE id = ?`, [...values, id]);
}
