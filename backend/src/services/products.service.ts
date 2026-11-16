import { withTransaction } from '../config/db.js';
import * as repo from '../repositories/products.repo.js';
import * as lookups from '../repositories/lookups.repo.js';
import * as common from '../repositories/catalogCommon.repo.js';
import * as cc from './catalogCommon.service.js';
import { absoluteUrl } from '../utils/urls.js';
import { pageOf, offsetOf } from '../utils/pagination.js';
import { badRequest, conflict } from '../utils/AppError.js';

const priceOf = (r) => (r.price_amount === null ? null : { amount: r.price_amount, currency: r.price_currency });

const card = (r, viewer) => ({
  id: r.id, name: r.name, slug: r.slug, status: r.status, brand: { id: r.brand_id, name: r.brand_name },
  category: { id: r.category_id, name: r.category_name }, price: priceOf(r), coverUrl: absoluteUrl(r.cover_url),
  avgRating: r.avg_rating, reviewCount: r.review_count, publishedAt: r.published_at,
  ...(viewer && (cc.isStaff(viewer) || r.submitted_by === viewer.id) && r.rejection_reason ? { rejectionReason: r.rejection_reason } : {}),
});

function detail(d, viewer) {
  const r = d.row;
  const privileged = viewer && (cc.isStaff(viewer) || r.submitted_by === viewer.id);
  return {
    id: r.id, name: r.name, slug: r.slug, description: r.description, status: r.status,
    brand: { id: r.brand_id, name: r.brand_name }, category: { id: r.category_id, name: r.category_name }, price: priceOf(r),
    specs: d.specs.map((s) => ({ key: s.spec_key, value: s.spec_value })),
    images: d.images.map((i) => ({ id: i.id, url: absoluteUrl(i.url), position: i.position })),
    avgRating: r.avg_rating, reviewCount: r.review_count, publishedAt: r.published_at, createdAt: r.created_at,
    submittedBy: r.submitted_by ? { id: r.submitted_by, displayName: r.submitter_name } : null,
    ...(privileged && r.rejection_reason ? { rejectionReason: r.rejection_reason } : {}),
    ...(viewer?.role === 'admin' && r.deleted_at ? { deletedAt: r.deleted_at } : {}),
    permissions: { canEdit: cc.canEdit(viewer, r), canDelete: cc.canDelete(viewer, r) },
  };
}

export async function list(viewer, f) {
  const statuses = cc.isStaff(viewer) && f.status ? (f.status === 'all' ? null : [f.status]) : ['published'];
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
  if (input.categoryId && !(await lookups.activeCategoryOfType(input.categoryId, 'product'))) throw badRequest('INVALID_CATEGORY', 'La categoría no existe, está inactiva o no es de productos');
  if (input.brandId && !(await lookups.activeBrand(input.brandId))) throw badRequest('INVALID_BRAND', 'La marca no existe o está inactiva');
}

export async function create(user, input) {
  await validateRefs(input);
  const status = await cc.initialStatus('product', user);
  if (status === 'pending') await cc.assertPendingQuota('product', user);
  const slug = await cc.uniqueSlug('product', input.name);
  const id = await withTransaction(async (conn) => {
    if (await repo.duplicateExists(input.brandId, input.name, null, conn)) throw conflict('DUPLICATE_PRODUCT', 'Ya existe ese producto para esa marca');
    const newId = await repo.insert({ ...input, slug, status, submittedBy: user.id }, conn);
    await repo.replaceSpecs(newId, input.specs ?? [], conn);
    return newId;
  });
  return get(user, String(id));
}

export async function update(user, id, input) {
  const row = await common.findRow('product', id);
  cc.assertEditable(user, row);
  await validateRefs(input);
  await withTransaction(async (conn) => {
    if ((input.name || input.brandId) && (await repo.duplicateExists(input.brandId ?? row.brand_id, input.name ?? row.name, id, conn))) throw conflict('DUPLICATE_PRODUCT', 'Ya existe ese producto para esa marca');
    await repo.updateFields(id, input, conn);
    await repo.replaceSpecs(id, input.specs, conn);
    if (cc.shouldResubmit(user, row)) await common.resubmit('product', id, conn);
    await cc.logStaffEdit('product', user, id, Object.keys(input), conn);
  });
  return get(user, String(id));
}
export const remove = (user, id, ip) => cc.softDelete('product', user, id, ip);
export const restore = (user, id, ip) => cc.restoreDeleted('product', user, id, ip);

/** Tarjetas de un conjunto de ids (solo publicados). Lo usan los favoritos. */
export async function cardsByIds(viewer, ids) {
  if (!ids.length) return new Map();
  const { rows } = await repo.search({ ids, statuses: ['published'], sort: 'newest', limit: ids.length, offset: 0 });
  return new Map(rows.map((r) => [r.id, card(r, viewer)]));
}
