import { withTransaction, pool } from '../config/db.js';
import * as common from '../repositories/catalogCommon.repo.js';
import { pageOf, offsetOf } from '../utils/pagination.js';
import * as places from './places.service.js';
import * as products from './products.service.js';
import * as videos from './videos.service.js';
import { AppError, notFound } from '../utils/AppError.js';

// Máquina de estados de la moderación. Solo se permiten estas transiciones.
const TRANSITIONS = {
  approve: { from: ['pending', 'rejected'], to: 'published', publish: true, noteRequired: false },
  reject:  { from: ['pending'],             to: 'rejected',  publish: false, noteRequired: true },
  hide:    { from: ['published'],           to: 'hidden',    publish: false, noteRequired: false },
  restore: { from: ['hidden'],              to: 'published', publish: true, noteRequired: false },
};
export const ACTIONS = Object.keys(TRANSITIONS);
const SERVICES = { place: places, product: products, video: videos };

export async function moderate(user, kind, id, action, note) {
  const t = TRANSITIONS[action];
  return withTransaction(async (conn) => {
    // FOR UPDATE evita que dos moderadores resuelvan el mismo elemento a la vez.
    const [[row]] = await conn.query(`SELECT id, status, deleted_at FROM ${({ place: 'places', product: 'products', video: 'videos' })[kind]} WHERE id = ? FOR UPDATE`, [id]);
    if (!row || row.deleted_at) throw notFound();
    if (!t.from.includes(row.status)) throw new AppError(409, 'INVALID_TRANSITION', `No se puede ${action} un elemento en estado "${row.status}"`);
    await common.setStatus(kind, id, { status: t.to, rejectionReason: action === 'reject' ? note : null, publish: t.publish }, conn);
    await common.insertModerationLog({ moderatorId: user.id, action, targetType: kind, targetId: id, note: note ?? null }, conn);
    return { id, kind, status: t.to };
  });
}

// Cola de revisión: lo pendiente más antiguo primero.
export const queue = (user, kind, q) => SERVICES[kind].list(user, { ...q, status: q.status ?? 'pending', sort: 'oldest' });

export async function logs(user, f) {
  const where = []; const params = [];
  if (user.role !== 'admin') { where.push('l.moderator_id = ?'); params.push(user.id); } // el moderador solo ve su propio historial
  else if (f.moderatorId) { where.push('l.moderator_id = ?'); params.push(f.moderatorId); }
  if (f.action) { where.push('l.action = ?'); params.push(f.action); }
  if (f.targetType) { where.push('l.target_type = ?'); params.push(f.targetType); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM moderation_logs l ${clause}`, params);
  const [rows] = await pool.query(
    `SELECT l.id, l.action, l.target_type, l.target_id, l.note, l.created_at, l.moderator_id, u.display_name AS moderator_name
       FROM moderation_logs l LEFT JOIN users u ON u.id = l.moderator_id ${clause} ORDER BY l.id DESC LIMIT ? OFFSET ?`,
    [...params, f.pageSize, offsetOf(f.page, f.pageSize)]);
  return pageOf(rows.map((r) => ({ id: r.id, action: r.action, targetType: r.target_type, targetId: r.target_id, note: r.note, createdAt: r.created_at, moderator: r.moderator_id ? { id: r.moderator_id, displayName: r.moderator_name } : null })), total, f.page, f.pageSize);
}
