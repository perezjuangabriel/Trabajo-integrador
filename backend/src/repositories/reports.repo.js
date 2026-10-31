import { pool } from '../config/db.js';

export const TARGET_COL = { place: 'place_id', product: 'product_id', video: 'video_id', review: 'review_id', video_review: 'video_review_id' };
export const TARGET_TYPES = Object.keys(TARGET_COL);

export async function insert({ reporterId, targetType, targetId, reason, details }, db = pool) {
  const [res] = await db.query(`INSERT INTO reports (reporter_id, ${TARGET_COL[targetType]}, reason, details) VALUES (?, ?, ?, ?)`, [reporterId, targetId, reason, details ?? null]);
  return res.insertId;
}
export async function openByReporter(reporterId, targetType, targetId, db = pool) {
  const [rows] = await db.query(`SELECT id FROM reports WHERE reporter_id = ? AND ${TARGET_COL[targetType]} = ? AND status = 'open' LIMIT 1`, [reporterId, targetId]);
  return rows[0] ?? null;
}

const SELECT = `
  SELECT r.*, ru.display_name AS reporter_name, hu.display_name AS handler_name,
         pl.name AS place_name, pl.status AS place_status, pr.name AS product_name, pr.status AS product_status,
         v.title AS video_title, v.status AS video_status,
         rv.comment AS review_comment, rv.rating AS review_rating, rv.status AS review_status,
         vr.comment AS vreview_comment, vr.rating AS vreview_rating, vr.status AS vreview_status
    FROM reports r
    LEFT JOIN users ru ON ru.id = r.reporter_id LEFT JOIN users hu ON hu.id = r.handled_by
    LEFT JOIN places pl ON pl.id = r.place_id LEFT JOIN products pr ON pr.id = r.product_id LEFT JOIN videos v ON v.id = r.video_id
    LEFT JOIN reviews rv ON rv.id = r.review_id LEFT JOIN video_reviews vr ON vr.id = r.video_review_id`;

export async function search({ status, targetType, reporterId, limit, offset }, db = pool) {
  const where = []; const params = [];
  if (status) { where.push('r.status = ?'); params.push(status); }
  if (reporterId) { where.push('r.reporter_id = ?'); params.push(reporterId); }
  if (targetType) { where.push(`r.${TARGET_COL[targetType]} IS NOT NULL`); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM reports r ${clause}`, params);
  // Abiertos: el más antiguo primero (cola de trabajo); resueltos: el más reciente primero.
  const order = status === 'open' ? 'r.created_at ASC, r.id ASC' : 'r.id DESC';
  const [rows] = await db.query(`${SELECT} ${clause} ORDER BY ${order} LIMIT ? OFFSET ?`, [...params, limit, offset]);
  return { total, rows };
}
export async function findById(id, db = pool) {
  const [rows] = await db.query(`${SELECT} WHERE r.id = ?`, [id]);
  return rows[0] ?? null;
}
export async function close(id, { status, handledBy, note }, db = pool) {
  const [res] = await db.query("UPDATE reports SET status = ?, handled_by = ?, resolution_note = ?, handled_at = UTC_TIMESTAMP() WHERE id = ? AND status = 'open'", [status, handledBy, note ?? null, id]);
  return res.affectedRows === 1;
}
// Al ocultar el objetivo, los demás reportes abiertos sobre él quedan resueltos.
export const closeOthersForTarget = (targetType, targetId, exceptId, { handledBy, note }, db = pool) =>
  db.query(`UPDATE reports SET status = 'resolved', handled_by = ?, resolution_note = ?, handled_at = UTC_TIMESTAMP() WHERE ${TARGET_COL[targetType]} = ? AND status = 'open' AND id <> ?`,
    [handledBy, note ?? 'Resuelto junto con otro reporte sobre el mismo contenido', targetId, exceptId]);
