import { withTransaction } from '../config/db.js';
import * as users from '../repositories/users.repo.js';
import * as refreshRepo from '../repositories/refreshTokens.repo.js';
import * as audit from '../repositories/audit.repo.js';
import { conflict, forbidden, notFound } from '../utils/AppError.js';

export async function list({ q, role, status, page, pageSize }) {
  const { total, rows } = await users.list({ q, role, status, limit: pageSize, offset: (page - 1) * pageSize });
  return { items: rows.map(users.toPublicUser), page, pageSize, total };
}

// Reglas comunes: el objetivo existe, no es uno mismo y no es otro administrador.
async function loadTarget(actor, id) {
  const target = await users.findById(id);
  if (!target || target.status === 'deleted') throw notFound('Usuario no encontrado');
  if (target.id === actor.id) throw forbidden('SELF_ACTION', 'No podés aplicar esta acción sobre tu propia cuenta');
  if (target.role === 'admin') throw forbidden('TARGET_IS_ADMIN', 'No se puede modificar a otro administrador');
  return target;
}

export async function setRole(actor, id, role, ip) {
  const target = await loadTarget(actor, id);
  if (target.role === role) throw conflict('NO_CHANGE', `El usuario ya tiene el rol ${role}`);
  return withTransaction(async (conn) => {
    await users.setRole(id, role, conn);
    await audit.record({ actorId: actor.id, action: 'user.role_changed', entityType: 'user', entityId: id, details: { from: target.role, to: role }, ip }, conn);
    return users.toPublicUser(await users.findById(id, conn));
  });
}

export async function suspend(actor, id, reason, ip) {
  const target = await loadTarget(actor, id);
  if (target.status === 'suspended') throw conflict('NO_CHANGE', 'El usuario ya está suspendido');
  return withTransaction(async (conn) => {
    await users.setSuspended(id, reason, conn);
    await refreshRepo.revokeAllForUser(id, conn); // cierra sus sesiones de inmediato
    await audit.record({ actorId: actor.id, action: 'user.suspended', entityType: 'user', entityId: id, details: { reason }, ip }, conn);
    return users.toPublicUser(await users.findById(id, conn));
  });
}

export async function reactivate(actor, id, ip) {
  const target = await loadTarget(actor, id);
  if (target.status !== 'suspended') throw conflict('NO_CHANGE', 'El usuario no está suspendido');
  return withTransaction(async (conn) => {
    await users.setActive(id, conn);
    await audit.record({ actorId: actor.id, action: 'user.reactivated', entityType: 'user', entityId: id, ip }, conn);
    return users.toPublicUser(await users.findById(id, conn));
  });
}
