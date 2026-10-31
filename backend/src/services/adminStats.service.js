import { pool } from '../config/db.js';
import { pageOf, offsetOf } from '../utils/pagination.js';

const group = async (sql, params = []) => Object.fromEntries((await pool.query(sql, params))[0].map((r) => [r.k, r.n]));
const one = async (sql, params = []) => Object.values((await pool.query(sql, params))[0][0])[0];

export async function stats() {
  const content = {};
  for (const t of ['places', 'products', 'videos']) {
    content[t] = { ...(await group(`SELECT status AS k, COUNT(*) AS n FROM ${t} WHERE deleted_at IS NULL GROUP BY status`)), deleted: await one(`SELECT COUNT(*) FROM ${t} WHERE deleted_at IS NOT NULL`) };
  }
  const rv = await group(`SELECT k, SUM(n) AS n FROM (SELECT status AS k, COUNT(*) AS n FROM reviews GROUP BY status UNION ALL SELECT status, COUNT(*) FROM video_reviews GROUP BY status) t GROUP BY k`);
  const [perDay] = await pool.query(
    `SELECT DATE_FORMAT(d, '%Y-%m-%d') AS day, SUM(n) AS n FROM (
       SELECT DATE(created_at) AS d, COUNT(*) AS n FROM reviews WHERE created_at >= DATE_SUB(UTC_DATE(), INTERVAL 13 DAY) GROUP BY DATE(created_at)
       UNION ALL SELECT DATE(created_at), COUNT(*) FROM video_reviews WHERE created_at >= DATE_SUB(UTC_DATE(), INTERVAL 13 DAY) GROUP BY DATE(created_at)) t GROUP BY d ORDER BY d`);
  const top = async (t) => (await pool.query(`SELECT id, ${t === 'videos' ? 'title' : 'name'} AS name, avg_rating, review_count FROM ${t} WHERE status = 'published' AND deleted_at IS NULL AND review_count >= 3 ORDER BY avg_rating DESC, review_count DESC LIMIT 5`))[0]
    .map((r) => ({ id: r.id, name: r.name, avgRating: r.avg_rating, reviewCount: r.review_count }));
  return {
    users: { total: await one("SELECT COUNT(*) FROM users WHERE status <> 'deleted'"), byRole: await group('SELECT role AS k, COUNT(*) AS n FROM users GROUP BY role'),
      byStatus: await group('SELECT status AS k, COUNT(*) AS n FROM users GROUP BY status'),
      new7d: await one('SELECT COUNT(*) FROM users WHERE created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY)'),
      new30d: await one('SELECT COUNT(*) FROM users WHERE created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY)') },
    content,
    reviews: { visible: Number(rv.visible ?? 0), pending: Number(rv.pending ?? 0), hidden: Number(rv.hidden ?? 0) },
    reviewsPerDay: perDay.map((r) => ({ day: r.day, count: Number(r.n) })),
    reports: { open: await one("SELECT COUNT(*) FROM reports WHERE status = 'open'"), total: await one('SELECT COUNT(*) FROM reports') },
    favorites: await one('SELECT COUNT(*) FROM favorites'),
    pendingModeration: { places: content.places.pending ?? 0, products: content.products.pending ?? 0, videos: content.videos.pending ?? 0, reviews: Number(rv.pending ?? 0) },
    topRated: { places: await top('places'), products: await top('products'), videos: await top('videos') },
    generatedAt: new Date(),
  };
}

export async function audit({ actorId, action, entityType, page, pageSize }) {
  const where = []; const params = [];
  if (actorId) { where.push('a.actor_id = ?'); params.push(actorId); }
  if (action) { where.push('a.action LIKE ?'); params.push(`${action}%`); }
  if (entityType) { where.push('a.entity_type = ?'); params.push(entityType); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM audit_logs a ${clause}`, params);
  const [rows] = await pool.query(
    `SELECT a.*, u.display_name AS actor_name FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id ${clause} ORDER BY a.id DESC LIMIT ? OFFSET ?`, [...params, pageSize, offsetOf(page, pageSize)]);
  return pageOf(rows.map((r) => ({
    id: r.id, action: r.action, entityType: r.entity_type, entityId: r.entity_id, ip: r.ip_address, createdAt: r.created_at,
    details: typeof r.details === 'string' ? JSON.parse(r.details) : r.details, actor: r.actor_id ? { id: r.actor_id, displayName: r.actor_name } : null,
  })), total, page, pageSize);
}
