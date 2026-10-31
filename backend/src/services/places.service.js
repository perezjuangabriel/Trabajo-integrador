import { withTransaction } from '../config/db.js';
import * as repo from '../repositories/places.repo.js';
import * as lookups from '../repositories/lookups.repo.js';
import * as common from '../repositories/catalogCommon.repo.js';
import * as cc from './catalogCommon.service.js';
import { absoluteUrl } from '../utils/urls.js';
import { pageOf, offsetOf } from '../utils/pagination.js';
import { badRequest, conflict, notFound } from '../utils/AppError.js';

const hhmm = (t) => String(t).slice(0, 5);

const card = (r, viewer) => ({
  id: r.id, name: r.name, slug: r.slug, zone: r.zone, status: r.status,
  category: { id: r.category_id, name: r.category_name }, city: { id: r.city_id, name: r.city_name },
  coverUrl: absoluteUrl(r.cover_url), avgRating: r.avg_rating, reviewCount: r.review_count, publishedAt: r.published_at,
  ...(viewer && (cc.isStaff(viewer) || r.submitted_by === viewer.id) && r.rejection_reason ? { rejectionReason: r.rejection_reason } : {}),
});

function detail(d, viewer) {
  const r = d.row;
  const privileged = viewer && (cc.isStaff(viewer) || r.submitted_by === viewer.id);
  return {
    id: r.id, name: r.name, slug: r.slug, description: r.description, status: r.status,
    category: { id: r.category_id, name: r.category_name }, extraCategories: d.extra,
    city: { id: r.city_id, name: r.city_name, region: r.city_region }, zone: r.zone, address: r.address,
    latitude: r.latitude, longitude: r.longitude, surfaceType: r.surface_type_id ? { id: r.surface_type_id, name: r.surface_name } : null,
    obstacles: d.obstacles, amenities: d.amenities,
    hours: d.hours.map((h) => ({ weekday: h.weekday, opensAt: hhmm(h.opens_at), closesAt: hhmm(h.closes_at) })),
    images: d.images.map((i) => ({ id: i.id, url: absoluteUrl(i.url), position: i.position })),
    avgRating: r.avg_rating, reviewCount: r.review_count, publishedAt: r.published_at, createdAt: r.created_at,
    submittedBy: r.submitted_by ? { id: r.submitted_by, displayName: r.submitter_name } : null,
    ...(privileged && r.rejection_reason ? { rejectionReason: r.rejection_reason } : {}),
    ...(viewer?.role === 'admin' && r.deleted_at ? { deletedAt: r.deleted_at } : {}),
    permissions: { canEdit: cc.canEdit(viewer, r), canDelete: cc.canDelete(viewer, r) }, // la app solo muestra los botones; el servidor igual valida
  };
}

export async function list(viewer, f) {
  const staff = cc.isStaff(viewer);
  const statuses = staff && f.status ? (f.status === 'all' ? null : [f.status]) : ['published'];
  const { total, rows } = await repo.search({ ...f, statuses, includeDeleted: viewer?.role === 'admin' && f.includeDeleted, limit: f.pageSize, offset: offsetOf(f.page, f.pageSize) });
  return pageOf(rows.map((r) => card(r, viewer)), total, f.page, f.pageSize);
}

export async function listOwn(user, f) {
  const { total, rows } = await repo.search({ ...f, statuses: f.status && f.status !== 'all' ? [f.status] : null, submittedBy: user.id, sort: 'newest', limit: f.pageSize, offset: offsetOf(f.page, f.pageSize) });
  return pageOf(rows.map((r) => card(r, user)), total, f.page, f.pageSize);
}

export async function get(viewer, ref) {
  const d = await repo.findDetail(ref);
  cc.assertVisible(viewer, d?.row);
  return detail(d, viewer);
}

async function validateRefs(input) {
  if (input.categoryId && !(await lookups.activeCategoryOfType(input.categoryId, 'place'))) throw badRequest('INVALID_CATEGORY', 'La categoría no existe, está inactiva o no es de lugares');
  for (const id of input.categoryIds ?? []) if (!(await lookups.activeCategoryOfType(id, 'place'))) throw badRequest('INVALID_CATEGORY', `La categoría secundaria ${id} no es válida`);
}
const resolveCity = async (input, conn) => (input.newCity ? lookups.findOrCreateCity(input.newCity, conn) : input.cityId);

export async function create(user, input) {
  await validateRefs(input);
  const status = await cc.initialStatus('place', user);
  if (status === 'pending') await cc.assertPendingQuota('place', user);
  const slug = await cc.uniqueSlug('place', input.name);
  const id = await withTransaction(async (conn) => {
    const cityId = await resolveCity(input, conn);
    if (await repo.duplicateExists(input.name, cityId, null, conn)) throw conflict('DUPLICATE_PLACE', 'Ya existe un lugar con ese nombre en esa ciudad');
    const newId = await repo.insert({ ...input, cityId, slug, status, submittedBy: user.id }, conn);
    await repo.replaceChildren(newId, { categoryIds: input.categoryIds ?? [], obstacleIds: input.obstacleIds ?? [], amenityIds: input.amenityIds ?? [], hours: input.hours ?? [] }, conn);
    return newId;
  });
  return get(user, String(id));
}

export async function update(user, id, input) {
  const row = await common.findRow('place', id);
  cc.assertEditable(user, row);
  await validateRefs(input);
  await withTransaction(async (conn) => {
    const cityId = input.cityId || input.newCity ? await resolveCity(input, conn) : undefined;
    const nextName = input.name ?? row.name; const nextCity = cityId ?? row.city_id;
    if ((input.name || cityId) && (await repo.duplicateExists(nextName, nextCity, id, conn))) throw conflict('DUPLICATE_PLACE', 'Ya existe un lugar con ese nombre en esa ciudad');
    await repo.updateFields(id, { ...input, cityId }, conn);
    await repo.replaceChildren(id, input, conn);
    if (cc.shouldResubmit(user, row)) await common.resubmit('place', id, conn); // corrigió una propuesta rechazada: vuelve a revisión
    await cc.logStaffEdit('place', user, id, Object.keys(input), conn);
  });
  return get(user, String(id));
}

export const remove = (user, id, ip) => cc.softDelete('place', user, id, ip);
export const restore = (user, id, ip) => cc.restoreDeleted('place', user, id, ip);

/** Tarjetas de un conjunto de ids (solo publicados). Lo usan los favoritos. */
export async function cardsByIds(viewer, ids) {
  if (!ids.length) return new Map();
  const { rows } = await repo.search({ ids, statuses: ['published'], sort: 'newest', limit: ids.length, offset: 0 });
  return new Map(rows.map((r) => [r.id, card(r, viewer)]));
}
