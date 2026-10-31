import { withTransaction } from '../config/db.js';
import * as repo from '../repositories/lookups.repo.js';
import * as audit from '../repositories/audit.repo.js';
import { slugify } from '../utils/slug.js';
import { pageOf, offsetOf } from '../utils/pagination.js';
import { notFound } from '../utils/AppError.js';

export async function list(group, query, user) {
  const includeInactive = Boolean(query.includeInactive && user?.role === 'admin'); // solo el admin ve los inactivos
  const { items, total } = await repo.list(group, { ...query, includeInactive, limit: query.pageSize, offset: offsetOf(query.page, query.pageSize) });
  return pageOf(items, total, query.page, query.pageSize);
}

export async function get(group, id) {
  const item = await repo.findById(group, id);
  if (!item) throw notFound();
  return item;
}

async function uniqueSlug(group, name, type) {
  const base = slugify(name);
  let slug = base;
  for (let n = 2; await repo.slugExists(group, slug, type); n++) slug = `${base}-${n}`;
  return slug;
}

export async function create(group, actor, input, ip) {
  const data = { ...input };
  if (repo.GROUPS[group].cols.includes('slug')) data.slug = await uniqueSlug(group, input.name, input.type);
  return withTransaction(async (conn) => {
    const item = await repo.insert(group, data, conn);
    await audit.record({ actorId: actor.id, action: `${group}.created`, entityType: group, entityId: item.id, details: input, ip }, conn);
    return item;
  });
}

export async function update(group, actor, id, input, ip) {
  await get(group, id);
  const data = {};
  for (const [k, v] of Object.entries(input)) data[k === 'isActive' ? 'is_active' : k] = typeof v === 'boolean' ? Number(v) : v;
  return withTransaction(async (conn) => {
    const item = await repo.update(group, id, data, conn);
    await audit.record({ actorId: actor.id, action: `${group}.updated`, entityType: group, entityId: id, details: input, ip }, conn);
    return item;
  });
}

/** Baja: física si nadie lo usa; si está en uso se DESACTIVA (conserva la trazabilidad) o se rechaza (409) si no admite desactivar. */
export async function remove(group, actor, id, ip) {
  await get(group, id);
  const used = await repo.isUsed(group, id);
  const canDeactivate = Boolean(repo.GROUPS[group].active);
  if (used && !canDeactivate) {
    const e = new Error('En uso'); e.code = 'ER_ROW_IS_REFERENCED_2'; throw e; // el manejador de errores lo traduce a 409 IN_USE
  }
  return withTransaction(async (conn) => {
    if (used) await repo.update(group, id, { is_active: 0 }, conn); else await repo.remove(group, id, conn);
    await audit.record({ actorId: actor.id, action: `${group}.${used ? 'deactivated' : 'deleted'}`, entityType: group, entityId: id, ip }, conn);
    return { result: used ? 'deactivated' : 'deleted' };
  });
}
