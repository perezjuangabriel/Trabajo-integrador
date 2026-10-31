import { pool } from '../config/db.js';

export const insert = ({ userId, tokenHash, familyId, expiresAt, userAgent }, db = pool) =>
  db.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at, user_agent) VALUES (?, ?, ?, ?, ?)',
    [userId, tokenHash, familyId, expiresAt, userAgent ? userAgent.slice(0, 255) : null],
  );
export async function findByHash(hash, db = pool) {
  const [rows] = await db.query('SELECT * FROM refresh_tokens WHERE token_hash = ?', [hash]);
  return rows[0] ?? null;
}
// Devuelve true solo si ESTA llamada revocó el token (protege contra uso concurrente).
export async function revokeIfActive(id, db = pool) {
  const [res] = await db.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ? AND revoked_at IS NULL', [id]);
  return res.affectedRows === 1;
}
export const revokeFamily = (familyId, db = pool) =>
  db.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE family_id = ? AND revoked_at IS NULL', [familyId]);
export const revokeAllForUser = (userId, db = pool) =>
  db.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL', [userId]);
export const deleteExpired = (db = pool) =>
  db.query('DELETE FROM refresh_tokens WHERE expires_at < UTC_TIMESTAMP() - INTERVAL 7 DAY');
