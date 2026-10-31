import { pool } from '../config/db.js';

// Mapea la fila SQL al modelo interno (camelCase). passwordHash nunca sale por la API.
export const toUser = (r) =>
  r && {
    id: r.id,
    email: r.email,
    passwordHash: r.password_hash,
    displayName: r.display_name,
    avatarUrl: r.avatar_url,
    bio: r.bio,
    role: r.role,
    status: r.status,
    themePreference: r.theme_preference,
    emailVerifiedAt: r.email_verified_at,
    failedLoginCount: r.failed_login_count,
    lockedUntil: r.locked_until,
    lastLoginAt: r.last_login_at,
    deletionScheduledFor: r.deletion_scheduled_for,
    suspendedReason: r.suspended_reason,
    createdAt: r.created_at,
  };

export const toPublicUser = (u) => ({
  id: u.id,
  email: u.email,
  displayName: u.displayName,
  avatarUrl: u.avatarUrl,
  bio: u.bio,
  role: u.role,
  status: u.status,
  themePreference: u.themePreference,
  emailVerified: Boolean(u.emailVerifiedAt),
  hasPassword: Boolean(u.passwordHash),
  deletionScheduledFor: u.deletionScheduledFor,
  createdAt: u.createdAt,
});

export async function findById(id, db = pool) {
  const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
  return toUser(rows[0]);
}
export async function findByEmail(email, db = pool) {
  const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
  return toUser(rows[0]);
}
export async function create({ email, passwordHash = null, displayName, avatarUrl = null, emailVerified = false }, db = pool) {
  const [res] = await db.query(
    'INSERT INTO users (email, password_hash, display_name, avatar_url, email_verified_at) VALUES (?, ?, ?, ?, ?)',
    [email, passwordHash, displayName, avatarUrl, emailVerified ? new Date() : null],
  );
  return findById(res.insertId, db);
}
export const markEmailVerified = (id, db = pool) =>
  db.query('UPDATE users SET email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = ?', [id]);
export const setPassword = (id, hash, db = pool) =>
  db.query('UPDATE users SET password_hash = ?, failed_login_count = 0, locked_until = NULL WHERE id = ?', [hash, id]);
export const clearPassword = (id, db = pool) => db.query('UPDATE users SET password_hash = NULL WHERE id = ?', [id]);

export async function registerFailedLogin(id, maxAttempts, lockMinutes, db = pool) {
  // Incremento atómico. OJO: MySQL evalúa las asignaciones de izquierda a derecha, por eso
  // locked_until va primero (usa el contador anterior) y luego se actualiza el contador.
  await db.query(
    `UPDATE users SET
       locked_until = IF(failed_login_count + 1 >= ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE), locked_until),
       failed_login_count = IF(failed_login_count + 1 >= ?, 0, failed_login_count + 1)
     WHERE id = ?`,
    [maxAttempts, lockMinutes, maxAttempts, id],
  );
}
export const registerSuccessfulLogin = (id, db = pool) =>
  db.query('UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login_at = NOW() WHERE id = ?', [id]);

const PROFILE_COLUMNS = { displayName: 'display_name', bio: 'bio', avatarUrl: 'avatar_url', themePreference: 'theme_preference' };
export async function updateProfile(id, fields, db = pool) {
  const sets = [];
  const values = [];
  for (const [key, column] of Object.entries(PROFILE_COLUMNS)) {
    if (fields[key] !== undefined) { sets.push(`${column} = ?`); values.push(fields[key]); }
  }
  if (sets.length) await db.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, [...values, id]);
  return findById(id, db);
}

export const setRole = (id, role, db = pool) => db.query('UPDATE users SET role = ? WHERE id = ?', [role, id]);
export const setSuspended = (id, reason, db = pool) =>
  db.query("UPDATE users SET status = 'suspended', suspended_reason = ? WHERE id = ?", [reason, id]);
export const setActive = (id, db = pool) =>
  db.query("UPDATE users SET status = 'active', suspended_reason = NULL WHERE id = ?", [id]);

export const requestDeletion = (id, scheduledFor, db = pool) =>
  db.query(
    "UPDATE users SET status = 'pending_deletion', deletion_requested_at = NOW(), deletion_scheduled_for = ? WHERE id = ?",
    [scheduledFor, id],
  );
export const cancelDeletion = (id, db = pool) =>
  db.query(
    "UPDATE users SET status = 'active', deletion_requested_at = NULL, deletion_scheduled_for = NULL WHERE id = ?",
    [id],
  );
export const findDueForDeletion = async (db = pool) => {
  const [rows] = await db.query(
    "SELECT id FROM users WHERE status = 'pending_deletion' AND deletion_scheduled_for <= UTC_TIMESTAMP()",
  );
  return rows.map((r) => r.id);
};
// Anonimiza la fila (conserva el id para no romper referencias históricas).
export const anonymize = (id, db = pool) =>
  db.query(
    `UPDATE users SET email = CONCAT('deleted-', id, '@deleted.invalid'), password_hash = NULL,
       display_name = 'Usuario eliminado', avatar_url = NULL, bio = NULL, status = 'deleted',
       deleted_at = NOW(), deletion_scheduled_for = NULL, suspended_reason = NULL WHERE id = ?`,
    [id],
  );

export async function list({ q, role, status, limit, offset }, db = pool) {
  const where = [];
  const params = [];
  if (q) { where.push('(email LIKE ? OR display_name LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  if (role) { where.push('role = ?'); params.push(role); }
  if (status) { where.push('status = ?'); params.push(status); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM users ${clause}`, params);
  const [rows] = await db.query(
    `SELECT * FROM users ${clause} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  return { total, rows: rows.map(toUser) };
}
