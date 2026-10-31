import { withTransaction } from '../config/db.js';
import * as repo from '../repositories/videos.repo.js';
import * as lookups from '../repositories/lookups.repo.js';
import * as common from '../repositories/catalogCommon.repo.js';
import * as cc from './catalogCommon.service.js';
import { parseVideoUrl, embedUrlFor } from '../utils/videoUrl.js';
import { pageOf, offsetOf } from '../utils/pagination.js';
import { badRequest, conflict } from '../utils/AppError.js';

// embedUrl solo existe para proveedores que permiten embeber (YouTube, Vimeo); en otro caso la app abre `url`.
const card = (r, viewer) => ({
  id: r.id, title: r.title, url: r.url, provider: r.provider, embedUrl: embedUrlFor(r.provider, r.external_id), thumbnailUrl: r.thumbnail_url,
  category: { id: r.category_id, name: r.category_name }, status: r.status, avgRating: r.avg_rating, reviewCount: r.review_count, publishedAt: r.published_at,
  ...(viewer && (cc.isStaff(viewer) || r.submitted_by === viewer.id) && r.rejection_reason ? { rejectionReason: r.rejection_reason } : {}),
});
const detail = (r, viewer) => ({
  ...card(r, viewer), description: r.description, createdAt: r.created_at,
  submittedBy: r.submitted_by ? { id: r.submitted_by, displayName: r.submitter_name } : null,
  ...(viewer?.role === 'admin' && r.deleted_at ? { deletedAt: r.deleted_at } : {}),
  permissions: { canEdit: cc.canEdit(viewer, r), canDelete: cc.canDelete(viewer, r) },
});

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
  if (!/^\d+$/.test(ref)) cc.assertVisible(viewer, null);
  const r = await repo.findDetail(Number(ref));
  cc.assertVisible(viewer, r);
  return detail(r, viewer);
}

async function assertCategory(id) {
  if (id && !(await lookups.activeCategoryOfType(id, 'video'))) throw badRequest('INVALID_CATEGORY', 'La categoría no existe, está inactiva o no es de videos');
}
async function assertUrlFree(url, exceptId, conn) {
  const owner = await repo.urlOwner(url, exceptId, conn);
  if (owner) throw conflict('VIDEO_ALREADY_EXISTS', owner.deleted_at ? 'Ese video ya fue cargado y dado de baja' : 'Ese video ya fue cargado');
}

export async function create(user, input) {
  await assertCategory(input.categoryId);
  const parsed = parseVideoUrl(input.url);
  const status = await cc.initialStatus('video', user);
  if (status === 'pending') await cc.assertPendingQuota('video', user);
  const id = await withTransaction(async (conn) => {
    await assertUrlFree(parsed.url, null, conn);
    return repo.insert({ ...input, ...parsed, status, submittedBy: user.id }, conn);
  });
  return get(user, String(id));
}

export async function update(user, id, input) {
  const row = await common.findRow('video', id);
  cc.assertEditable(user, row);
  await assertCategory(input.categoryId);
  const parsed = input.url ? parseVideoUrl(input.url) : null;
  await withTransaction(async (conn) => {
    if (parsed) await assertUrlFree(parsed.url, id, conn);
    const { url: _ignored, ...rest } = input;
    await repo.updateFields(id, { ...rest, ...(parsed ? { url: parsed.url, provider: parsed.provider, externalId: parsed.externalId, thumbnailUrl: parsed.thumbnailUrl } : {}) }, conn);
    if (cc.shouldResubmit(user, row)) await common.resubmit('video', id, conn);
    await cc.logStaffEdit('video', user, id, Object.keys(input), conn);
  });
  return get(user, String(id));
}
export const remove = (user, id, ip) => cc.softDelete('video', user, id, ip);
export const restore = (user, id, ip) => cc.restoreDeleted('video', user, id, ip);
