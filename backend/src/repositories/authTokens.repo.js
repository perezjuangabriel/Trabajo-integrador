import { pool } from '../config/db.js';

export const insert = ({ userId, purpose, tokenHash, expiresAt, payload = null }, db = pool) =>
  db.query(
    'INSERT INTO auth_tokens (user_id, purpose, token_hash, expires_at, payload) VALUES (?, ?, ?, ?, ?)',
    [userId, purpose, tokenHash, expiresAt, payload],
  );
// Invalida los códigos anteriores sin usar del mismo propósito (solo vale el último).
export const invalidateOpen = (userId, purpose, db = pool) =>
  db.query('UPDATE auth_tokens SET used_at = NOW() WHERE user_id = ? AND purpose = ? AND used_at IS NULL', [userId, purpose]);
export async function findLatestOpen(userId, purpose, db = pool) {
  const [rows] = await db.query(
    `SELECT * FROM auth_tokens WHERE user_id = ? AND purpose = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()
     ORDER BY id DESC LIMIT 1`,
    [userId, purpose],
  );
  return rows[0] ?? null;
}
export async function findLatestCreatedAt(userId, purpose, db = pool) {
  const [rows] = await db.query('SELECT created_at FROM auth_tokens WHERE user_id = ? AND purpose = ? ORDER BY id DESC LIMIT 1', [userId, purpose]);
  return rows[0]?.created_at ?? null;
}
// Suma un intento solo si el token sigue abierto y no superó el máximo.
export async function bumpAttempt(id, maxAttempts, db = pool) {
  const [res] = await db.query('UPDATE auth_tokens SET attempts = attempts + 1 WHERE id = ? AND used_at IS NULL AND attempts < ?', [id, maxAttempts]);
  return res.affectedRows === 1;
}
export async function consume(id, db = pool) {
  const [res] = await db.query('UPDATE auth_tokens SET used_at = NOW() WHERE id = ? AND used_at IS NULL', [id]);
  return res.affectedRows === 1;
}
export async function findOpenByHash(purpose, tokenHash, db = pool) {
  const [rows] = await db.query(
    'SELECT * FROM auth_tokens WHERE purpose = ? AND token_hash = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP() LIMIT 1',
    [purpose, tokenHash],
  );
  return rows[0] ?? null;
}
export const deleteExpired = (db = pool) =>
  db.query('DELETE FROM auth_tokens WHERE expires_at < UTC_TIMESTAMP() - INTERVAL 1 DAY');
