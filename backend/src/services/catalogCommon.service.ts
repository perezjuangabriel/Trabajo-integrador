import { withTransaction } from '../config/db.js';
import { KINDS, STAFF_ROLES, MAX_PENDING_PER_USER } from '../config/catalog.js';
import * as common from '../repositories/catalogCommon.repo.js';
import * as settings from '../repositories/settings.repo.js';
import * as audit from '../repositories/audit.repo.js';
import { slugify } from '../utils/slug.js';
import { AppError, conflict, forbidden, notFound } from '../utils/AppError.js';

export const isStaff = (u) => Boolean(u && STAFF_ROLES.includes(u.role));
const isOwner = (u, row) => Boolean(u && row.submitted_by === u.id);
const OWNER_EDITABLE = ['pending', 'rejected'];

/** Quién puede ver un registro: público si está publicado; si no, su autor y el staff; los dados de baja, solo el admin. */
export function canView(user, row) {
  if (row.deleted_at) return user?.role === 'admin';
  if (row.status === 'published') return true;
  return isStaff(user) || isOwner(user, row);
}
/** Editar: el staff siempre (corrige el catálogo); el autor solo mientras su propuesta está pendiente o rechazada. */
export const canEdit = (user, row) => Boolean(user) && !row.deleted_at && (isStaff(user) || (isOwner(user, row) && OWNER_EDITABLE.includes(row.status)));
export const canDelete = (user, row) => Boolean(user) && !row.deleted_at && (user.role === 'admin' || (isOwner(user, row) && OWNER_EDITABLE.includes(row.status)));

export function assertVisible(user, row) {
  if (!row || !canView(user, row)) throw notFound(); // 404 también cuando no tiene permiso: no revela que existe
}
export function assertEditable(user, row) {
  assertVisible(user, row);
  if (!canEdit(user, row)) throw forbidden('FORBIDDEN', 'No podés modificar este contenido');
}

/** Estado inicial de una alta: el staff publica directo; el resto depende de la configuración de moderación. */
export async function initialStatus(kind, user) {
  if (isStaff(user)) return 'published';
  return (await settings.getBool(KINDS[kind].settingKey, true)) ? 'pending' : 'published';
}
export async function assertPendingQuota(kind, user) {
  if ((await common.countPendingBy(kind, user.id)) >= MAX_PENDING_PER_USER) {
    throw conflict('TOO_MANY_PENDING', `Ya tenés ${MAX_PENDING_PER_USER} propuestas pendientes de revisión. Esperá a que se resuelvan.`);
  }
}
export async function uniqueSlug(kind, text) {
  const base = slugify(text);
  let slug = base;
  for (let n = 2; await common.slugExists(kind, slug); n++) slug = `${base}-${n}`;
  return slug;
}

/** Si el autor corrige una propuesta rechazada, vuelve a la cola de revisión. */
export const shouldResubmit = (user, row) => !isStaff(user) && row.status === 'rejected';

export async function softDelete(kind, user, id, ip) {
  const row = await common.findRow(kind, id);
  if (!row || !canView(user, row)) throw notFound();       // lo que no puede ver, "no existe" (no se filtra su existencia)
  if (!canDelete(user, row)) throw isOwnerOrNot(user, row);
  await withTransaction(async (conn) => {
    await common.setDeleted(kind, id, true, conn);
    await audit.record({ actorId: user.id, action: `${kind}.deleted`, entityType: kind, entityId: id, details: { status: row.status }, ip }, conn);
  });
}
const isOwnerOrNot = (user, row) =>
  (isOwner(user, row) ? new AppError(409, 'NOT_DELETABLE', 'Un contenido ya publicado solo puede darlo de baja un administrador')
    : forbidden('FORBIDDEN', 'No tenés permisos para eliminar este contenido'));

export async function restoreDeleted(kind, user, id, ip) {
  const row = await common.findRow(kind, id);
  if (!row || !row.deleted_at) throw notFound();
  await withTransaction(async (conn) => {
    await common.setDeleted(kind, id, false, conn);
    await audit.record({ actorId: user.id, action: `${kind}.restored`, entityType: kind, entityId: id, ip }, conn);
  });
}

export const logStaffEdit = (kind, user, id, fields, conn) =>
  isStaff(user) ? common.insertModerationLog({ moderatorId: user.id, action: 'edit', targetType: kind, targetId: id, note: `Campos: ${fields.join(', ')}`.slice(0, 500) }, conn) : null;
