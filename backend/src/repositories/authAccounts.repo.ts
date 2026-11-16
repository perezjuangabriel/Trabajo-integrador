import { pool } from '../config/db.js';

export async function findByIdentity(provider, providerUserId, db = pool) {
  const [rows] = await db.query('SELECT * FROM auth_accounts WHERE provider = ? AND provider_user_id = ?', [provider, providerUserId]);
  return rows[0] ?? null;
}
export async function listForUser(userId, db = pool) {
  const [rows] = await db.query('SELECT provider, provider_email, created_at FROM auth_accounts WHERE user_id = ? ORDER BY created_at', [userId]);
  return rows.map((r) => ({ provider: r.provider, email: r.provider_email, linkedAt: r.created_at }));
}
export const link = ({ userId, provider, providerUserId, providerEmail }, db = pool) =>
  db.query('INSERT INTO auth_accounts (user_id, provider, provider_user_id, provider_email) VALUES (?, ?, ?, ?)', [userId, provider, providerUserId, providerEmail ?? null]);
export async function unlink(userId, provider, db = pool) {
  const [res] = await db.query('DELETE FROM auth_accounts WHERE user_id = ? AND provider = ?', [userId, provider]);
  return res.affectedRows === 1;
}
export async function countForUser(userId, db = pool) {
  const [[{ n }]] = await db.query('SELECT COUNT(*) AS n FROM auth_accounts WHERE user_id = ?', [userId]);
  return n;
}
