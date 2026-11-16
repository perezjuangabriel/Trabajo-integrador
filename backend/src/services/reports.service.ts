import { withTransaction } from '../config/db.js';
import * as repo from '../repositories/reports.repo.js';
import * as reviewsRepo from '../repositories/reviews.repo.js';
import * as common from '../repositories/catalogCommon.repo.js';
import * as cc from './catalogCommon.service.js';
import { applyReviewTransition } from './reviewModeration.service.js';
import { pageOf, offsetOf } from '../utils/pagination.js';
import { AppError, conflict, notFound, badRequest } from '../utils/AppError.js';

const CONTENT = ['place', 'product', 'video'];
const targetOf = (r) => {
  const type = repo.TARGET_TYPES.find((t) => r[repo.TARGET_COL[t]] != null);
  const id = r[repo.TARGET_COL[type]];
  const label = { place: r.place_name, product: r.product_name, video: r.video_title,
    review: r.review_comment && `★${r.review_rating} ${r.review_comment.slice(0, 80)}`, video_review: r.vreview_comment && `★${r.vreview_rating} ${r.vreview_comment.slice(0, 80)}` }[type];
  const status = { place: r.place_status, product: r.product_status, video: r.video_status, review: r.review_status, video_review: r.vreview_status }[type];
  return { type, id, label, status };
};
const serialize = (r) => ({
  id: r.id, target: targetOf(r), reason: r.reason, details: r.details, status: r.status, createdAt: r.created_at,
  reporter: r.reporter_id ? { id: r.reporter_id, displayName: r.reporter_name } : null,
  handledBy: r.handled_by ? { id: r.handled_by, displayName: r.handler_name } : null, resolutionNote: r.resolution_note, handledAt: r.handled_at,
});

// ---- Usuario ----
/** Un reporte exige que el objetivo exista, sea visible para el usuario y no sea suyo. */
async function loadReportable(user, type, id) {
  if (CONTENT.includes(type)) {
    const row = await common.findRow(type, id);
    if (!row || row.status !== 'published' || row.deleted_at) throw notFound();
    if (row.submitted_by === user.id) throw badRequest('SELF_REPORT', 'No podés reportar tu propio contenido');
    return;
  }
  const table = reviewsRepo.TABLE_OF[type];
  const row = await reviewsRepo.findById(table, id);
  if (!row || row.status !== 'visible') throw notFound();
  if (row.user_id === user.id) throw badRequest('SELF_REPORT', 'No podés reportar tu propia reseña');
}

export async function create(user, { targetType, targetId, reason, details }) {
  await loadReportable(user, targetType, targetId);
  if (await repo.openByReporter(user.id, targetType, targetId)) throw conflict('ALREADY_REPORTED', 'Ya reportaste esto y está en revisión');
  try {
    const id = await repo.insert({ reporterId: user.id, targetType, targetId, reason, details });
    return serialize(await repo.findById(id));
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw conflict('ALREADY_REPORTED', 'Ya reportaste esto y está en revisión');
    throw e;
  }
}
export async function listMine(user, { status, page, pageSize }) {
  const { total, rows } = await repo.search({ status, reporterId: user.id, limit: pageSize, offset: offsetOf(page, pageSize) });
  return pageOf(rows.map(serialize), total, page, pageSize);
}

// ---- Moderación ----
export async function list(f) {
  const { total, rows } = await repo.search({ ...f, limit: f.pageSize, offset: offsetOf(f.page, f.pageSize) });
  return pageOf(rows.map(serialize), total, f.page, f.pageSize);
}
export async function get(id) {
  const r = await repo.findById(id);
  if (!r) throw notFound();
  return serialize(r);
}

async function hideTarget(conn, user, type, id, note) {
  if (CONTENT.includes(type)) {
    const [[row]] = await conn.query(`SELECT status, deleted_at FROM ${({ place: 'places', product: 'products', video: 'videos' })[type]} WHERE id = ? FOR UPDATE`, [id]);
    if (!row || row.deleted_at || row.status !== 'published') return; // ya no está publicado: nada que ocultar
    await common.setStatus(type, id, { status: 'hidden' }, conn);
    await common.insertModerationLog({ moderatorId: user.id, action: 'hide', targetType: type, targetId: id, note }, conn);
  } else {
    await applyReviewTransition(conn, user, type, id, 'hide', note, { strict: false });
  }
}

/** Resuelve un reporte; con hideTarget también oculta el contenido y cierra los demás reportes abiertos sobre él. */
export async function resolve(user, id, { note, hideTarget: hide }) {
  const rep = await repo.findById(id);
  if (!rep) throw notFound();
  const target = targetOf(rep);
  await withTransaction(async (conn) => {
    if (hide) { await hideTarget(conn, user, target.type, target.id, note ?? 'Ocultado por reporte'); await repo.closeOthersForTarget(target.type, target.id, id, { handledBy: user.id }, conn); }
    if (!(await repo.close(id, { status: 'resolved', handledBy: user.id, note }, conn))) throw new AppError(409, 'ALREADY_HANDLED', 'El reporte ya fue resuelto');
    await common.insertModerationLog({ moderatorId: user.id, action: 'resolve_report', targetType: 'report', targetId: id, note: note ?? null }, conn);
  });
  return get(id);
}
export async function dismiss(user, id, { note }) {
  if (!(await repo.findById(id))) throw notFound();
  await withTransaction(async (conn) => {
    if (!(await repo.close(id, { status: 'dismissed', handledBy: user.id, note }, conn))) throw new AppError(409, 'ALREADY_HANDLED', 'El reporte ya fue resuelto');
    await common.insertModerationLog({ moderatorId: user.id, action: 'dismiss_report', targetType: 'report', targetId: id, note: note ?? null }, conn);
  });
  return get(id);
}
