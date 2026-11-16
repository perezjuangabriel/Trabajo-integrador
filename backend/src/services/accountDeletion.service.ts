import { pool, withTransaction } from '../config/db.js';
import * as users from '../repositories/users.repo.js';
import * as ratings from '../repositories/ratings.repo.js';
import * as audit from '../repositories/audit.repo.js';
import * as settings from '../repositories/settings.repo.js';
import { verifyPassword } from '../utils/password.js';
import { deleteStoredFiles } from '../utils/storage.js';
import { conflict, forbidden } from '../utils/AppError.js';

/** Solicita la baja: la cuenta queda en período de gracia y se puede cancelar. */
export async function requestDeletion(user, { password }) {
  if (user.role === 'admin') throw conflict('ADMIN_CANNOT_DELETE', 'Un administrador no puede eliminar su cuenta desde la app');
  if (user.status === 'pending_deletion') throw conflict('ALREADY_REQUESTED', 'La baja ya fue solicitada');
  if (user.passwordHash && !(password && (await verifyPassword(password, user.passwordHash)))) {
    throw forbidden('WRONG_PASSWORD', 'La contraseña es incorrecta');
  }
  const graceDays = await settings.getInt('account_deletion_grace_days', 14);
  const scheduledFor = new Date(Date.now() + graceDays * 86_400_000);
  await users.requestDeletion(user.id, scheduledFor);
  return { deletionScheduledFor: scheduledFor, graceDays };
}

export async function cancelDeletion(user) {
  if (user.status !== 'pending_deletion') throw conflict('NOT_PENDING', 'No hay una baja pendiente');
  await users.cancelDeletion(user.id);
}

/**
 * Baja definitiva (decisión del cliente: se ELIMINAN las reseñas).
 * Todo ocurre en una transacción; los archivos de fotos se borran del disco solo después del commit.
 */
export async function purgeUser(userId) {
  const files = await withTransaction(async (conn) => {
    const affected = await ratings.entitiesReviewedBy(userId, conn);
    const [imgs] = await conn.query(
      'SELECT ri.storage_path FROM review_images ri JOIN reviews r ON r.id = ri.review_id WHERE r.user_id = ?', [userId]);
    await conn.query('DELETE FROM reviews WHERE user_id = ?', [userId]);        // cascada a review_images
    await conn.query('DELETE FROM video_reviews WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM favorites WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM auth_accounts WHERE user_id = ?', [userId]);
    await conn.query('DELETE FROM auth_tokens WHERE user_id = ?', [userId]);
    await conn.query('UPDATE reports SET reporter_id = NULL WHERE reporter_id = ?', [userId]);
    for (const [kind, ids] of Object.entries(affected)) for (const id of ids) await ratings.recompute(kind, id, conn);
    await users.anonymize(userId, conn);
    await audit.record({ actorId: null, action: 'account_purged', entityType: 'user', entityId: userId }, conn);
    return imgs.map((i) => i.storage_path);
  });
  await deleteStoredFiles(files);
}

export async function purgeDueAccounts() {
  const ids = await users.findDueForDeletion(pool);
  for (const id of ids) await purgeUser(id);
  return ids.length;
}
