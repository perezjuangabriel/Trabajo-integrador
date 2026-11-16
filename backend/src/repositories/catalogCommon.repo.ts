import { pool } from '../config/db.js';
import { KINDS } from '../config/catalog.js';

// Operaciones comunes a lugares, productos y videos. `kind` se valida contra KINDS (nunca viene crudo del usuario).
const t = (kind) => KINDS[kind].table;

export async function findRow(kind, id, db = pool) {
  const [rows] = await db.query(`SELECT * FROM ${t(kind)} WHERE id = ?`, [id]);
  return rows[0] ?? null;
}
export async function slugExists(kind, slug, db = pool) {
  const [rows] = await db.query(`SELECT 1 FROM ${t(kind)} WHERE slug = ? LIMIT 1`, [slug]);
  return rows.length > 0;
}
export async function countPendingBy(kind, userId, db = pool) {
  const [[{ n }]] = await db.query(`SELECT COUNT(*) AS n FROM ${t(kind)} WHERE submitted_by = ? AND status = 'pending' AND deleted_at IS NULL`, [userId]);
  return n;
}
export const setDeleted = (kind, id, deleted, db = pool) =>
  db.query(`UPDATE ${t(kind)} SET deleted_at = ${deleted ? 'UTC_TIMESTAMP()' : 'NULL'} WHERE id = ?`, [id]);
export const setStatus = (kind, id, { status, rejectionReason = null, publish = false }, db = pool) =>
  db.query(
    `UPDATE ${t(kind)} SET status = ?, rejection_reason = ?, published_at = ${publish ? 'COALESCE(published_at, UTC_TIMESTAMP())' : 'published_at'} WHERE id = ?`,
    [status, rejectionReason, id],
  );
export const resubmit = (kind, id, db = pool) =>
  db.query(`UPDATE ${t(kind)} SET status = 'pending', rejection_reason = NULL, published_at = NULL WHERE id = ?`, [id]);

// --- Imágenes (lugares y productos) ---
export async function listImages(kind, entityId, db = pool) {
  const k = KINDS[kind];
  const [rows] = await db.query(`SELECT id, url, position FROM ${k.imageTable} WHERE ${k.imageFk} = ? ORDER BY position, id`, [entityId]);
  return rows;
}
export async function countImages(kind, entityId, db = pool) {
  const k = KINDS[kind];
  const [[{ n }]] = await db.query(`SELECT COUNT(*) AS n FROM ${k.imageTable} WHERE ${k.imageFk} = ?`, [entityId]);
  return n;
}
export async function insertImage(kind, entityId, img, db = pool) {
  const k = KINDS[kind];
  const [res] = await db.query(
    `INSERT INTO ${k.imageTable} (${k.imageFk}, url, storage_path, mime_type, size_bytes, position, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [entityId, img.url, img.storagePath, img.mimeType, img.size, img.position, img.uploadedBy],
  );
  return { id: res.insertId, url: img.url, position: img.position };
}
export async function findImage(kind, entityId, imageId, db = pool) {
  const k = KINDS[kind];
  const [rows] = await db.query(`SELECT id, storage_path FROM ${k.imageTable} WHERE id = ? AND ${k.imageFk} = ?`, [imageId, entityId]);
  return rows[0] ?? null;
}
export const deleteImage = (kind, imageId, db = pool) => db.query(`DELETE FROM ${KINDS[kind].imageTable} WHERE id = ?`, [imageId]);

export async function insertModerationLog({ moderatorId, action, targetType, targetId, note = null }, db = pool) {
  await db.query('INSERT INTO moderation_logs (moderator_id, action, target_type, target_id, note) VALUES (?, ?, ?, ?, ?)', [moderatorId, action, targetType, targetId, note]);
}
