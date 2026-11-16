import { withTransaction } from '../config/db.js';
import * as repo from '../repositories/reviews.repo.js';
import * as ratings from '../repositories/ratings.repo.js';
import * as common from '../repositories/catalogCommon.repo.js';
import { AppError, badRequest, notFound } from '../utils/AppError.js';

// Estados de una reseña: visible | pending | hidden. Solo las visibles cuentan en los promedios.
const RT = {
  approve: { from: ['pending'], to: 'visible' },
  hide: { from: ['visible', 'pending'], to: 'hidden' },
  restore: { from: ['hidden'], to: 'visible' },
};
const kindOf = (table, row) => (table === 'video_reviews' ? 'video' : row.place_id ? 'place' : 'product');
const entityOf = (table, row) => (table === 'video_reviews' ? row.video_id : row.place_id ?? row.product_id);

/** Cambia el estado de una reseña dentro de la transacción `conn` y recalcula el promedio. Devuelve false si no había nada que hacer. */
export async function applyReviewTransition(conn, user, type, id, action, note, { strict = true } = {}) {
  const t = RT[action];
  const table = repo.TABLE_OF[type];
  const row = await repo.findById(table, id, conn);
  if (!row) throw notFound();
  const kind = kindOf(table, row); const entityId = entityOf(table, row);
  await ratings.lockEntity(kind, entityId, conn);              // orden de bloqueo: entidad -> reseña (igual que crear/editar/borrar)
  const [[cur]] = await conn.query(`SELECT status FROM ${table} WHERE id = ? FOR UPDATE`, [id]);
  if (!cur) throw notFound();
  if (!t.from.includes(cur.status)) {
    if (strict) throw new AppError(409, 'INVALID_TRANSITION', `No se puede ${action} una reseña en estado "${cur.status}"`);
    return false;
  }
  await repo.setStatus(table, id, t.to, conn);
  await ratings.recompute(kind, entityId, conn);
  await common.insertModerationLog({ moderatorId: user.id, action, targetType: type, targetId: id, note: note ?? null }, conn);
  return t.to;
}

export async function moderateReview(user, type, id, action, note) {
  if (!RT[action]) throw badRequest('INVALID_ACTION', 'Para reseñas las acciones son approve, hide y restore');
  const status = await withTransaction((conn) => applyReviewTransition(conn, user, type, id, action, note));
  return { id, kind: type, status };
}
