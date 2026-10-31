import { pool, withTransaction } from '../config/db.js';
import * as repo from '../repositories/reviews.repo.js';
import * as ratings from '../repositories/ratings.repo.js';
import * as common from '../repositories/catalogCommon.repo.js';
import * as settings from '../repositories/settings.repo.js';
import * as audit from '../repositories/audit.repo.js';
import * as cc from './catalogCommon.service.js';
import { storeImage } from './image.service.js';
import { deleteStoredFiles } from '../utils/storage.js';
import { absoluteUrl } from '../utils/urls.js';
import { pageOf, offsetOf } from '../utils/pagination.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/AppError.js';

const kindOfRow = (table, row) => (table === 'video_reviews' ? 'video' : row.place_id ? 'place' : 'product');
const entityIdOf = (table, row) => (table === 'video_reviews' ? row.video_id : row.place_id ?? row.product_id);

const serialize = (table, row, viewer, images = []) => ({
  id: row.id, type: table === 'video_reviews' ? 'video_review' : 'review',
  target: { kind: kindOfRow(table, row), id: entityIdOf(table, row) },
  rating: row.rating, comment: row.comment, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at,
  author: { id: row.user_id, displayName: row.author_name, avatarUrl: absoluteUrl(row.author_avatar) },
  images: images.map((i) => ({ id: i.id, url: absoluteUrl(i.url) })),
  isMine: Boolean(viewer && viewer.id === row.user_id),
});

async function withImages(table, rows, viewer) {
  const imgs = table === 'reviews' ? await repo.imagesFor(rows.map((r) => r.id)) : new Map();
  return rows.map((r) => serialize(table, r, viewer, imgs.get(r.id)));
}

/** Reseñas de una entidad. El público solo ve las visibles; el staff puede pedir otros estados. */
export async function list(viewer, kind, entityId, q) {
  const entity = await common.findRow(kind, entityId);
  cc.assertVisible(viewer, entity);
  const statuses = cc.isStaff(viewer) && q.status ? (q.status === 'all' ? ['visible', 'pending', 'hidden'] : [q.status]) : ['visible'];
  const { total, rows } = await repo.listForEntity(kind, entityId, { ...q, statuses, limit: q.pageSize, offset: offsetOf(q.page, q.pageSize) });
  const table = kind === 'video' ? 'video_reviews' : 'reviews';
  const mine = viewer ? await repo.findMine(kind, entityId, viewer.id) : null;
  return {
    ...pageOf(await withImages(table, rows, viewer), total, q.page, q.pageSize),
    summary: { avgRating: entity.avg_rating, reviewCount: entity.review_count, distribution: await repo.distribution(kind, entityId) },
    myReview: mine ? (await withImages(table, [mine], viewer))[0] : null, // incluye mi reseña aunque esté pendiente u oculta
  };
}

/** La entidad debe estar publicada para poder reseñarla. */
async function assertReviewable(kind, entityId) {
  const e = await common.findRow(kind, entityId);
  if (!e || e.deleted_at || e.status !== 'published') throw notFound();
}

export async function create(user, kind, entityId, { rating, comment }) {
  await assertReviewable(kind, entityId);
  const table = kind === 'video' ? 'video_reviews' : 'reviews';
  if (await repo.findMine(kind, entityId, user.id)) throw conflict('REVIEW_EXISTS', 'Ya reseñaste esto. Podés editar tu reseña.');
  const premoderate = !cc.isStaff(user) && (await settings.getBool('premoderate_reviews', false));
  const id = await withTransaction(async (conn) => {
    await ratings.lockEntity(kind, entityId, conn);                    // serializa promedios de reseñas simultáneas
    try {
      const newId = await repo.insert(kind, { userId: user.id, entityId, rating, comment, status: premoderate ? 'pending' : 'visible' }, conn);
      await ratings.recompute(kind, entityId, conn);
      return newId;
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') throw conflict('REVIEW_EXISTS', 'Ya reseñaste esto. Podés editar tu reseña.'); // dos envíos a la vez
      throw e;
    }
  });
  return get(user, table, id);
}

export async function get(viewer, table, id) {
  const row = await repo.findById(table, id);
  if (!row) throw notFound();
  const kind = kindOfRow(table, row);
  const parent = await common.findRow(kind, entityIdOf(table, row));
  const own = viewer && viewer.id === row.user_id;
  // Visible para todos si la reseña es visible y su entidad está publicada; si no, solo autor y staff.
  const publicOk = row.status === 'visible' && cc.canView(null, parent);
  if (!publicOk && !own && !cc.isStaff(viewer)) throw notFound();
  return (await withImages(table, [row], viewer))[0];
}

async function ownedOrFail(user, table, id) {
  const row = await repo.findById(table, id);
  if (!row) throw notFound();
  if (row.user_id !== user.id) throw row.status === 'visible' ? forbidden('FORBIDDEN', 'Solo podés modificar tus propias reseñas') : notFound();
  return row;
}

export async function update(user, table, id, input) {
  const row = await ownedOrFail(user, table, id);
  const kind = kindOfRow(table, row); const entityId = entityIdOf(table, row);
  const premoderate = !cc.isStaff(user) && (await settings.getBool('premoderate_reviews', false));
  // Una reseña oculta por moderación sigue oculta aunque el autor la edite; con premoderación, editar vuelve a revisión.
  const status = row.status === 'hidden' ? undefined : premoderate ? 'pending' : undefined;
  await withTransaction(async (conn) => {
    await ratings.lockEntity(kind, entityId, conn);
    await repo.update(table, id, { ...input, status }, conn);
    await ratings.recompute(kind, entityId, conn);
  });
  return get(user, table, id);
}

/** Baja de una reseña (física: permite volver a reseñar). La borra su autor o un administrador. */
export async function remove(user, table, id, ip) {
  const row = await repo.findById(table, id);
  if (!row) throw notFound();
  const own = row.user_id === user.id;
  if (!own && user.role !== 'admin') throw row.status === 'visible' ? forbidden('FORBIDDEN', 'No podés eliminar reseñas ajenas') : notFound();
  const kind = kindOfRow(table, row); const entityId = entityIdOf(table, row);
  const files = await withTransaction(async (conn) => {
    await ratings.lockEntity(kind, entityId, conn);
    const paths = table === 'reviews' ? await repo.storagePaths(id, conn) : [];
    await repo.remove(table, id, conn);                                  // review_images cae en cascada
    await ratings.recompute(kind, entityId, conn);
    if (!own) await audit.record({ actorId: user.id, action: 'review.deleted', entityType: table, entityId: id, details: { authorId: row.user_id }, ip }, conn);
    return paths;
  });
  await deleteStoredFiles(files);                                        // los archivos se borran solo tras confirmar la BD
}

// --- Fotos de la reseña (solo el autor; reseñas de lugares y productos) ---
export async function addImage(user, id, file) {
  if (!file) throw badRequest('FILE_REQUIRED', 'Falta el archivo (campo "image")');
  const row = await ownedOrFail(user, 'reviews', id);
  if ((await repo.countImages(id)) >= repo.MAX_REVIEW_IMAGES) throw conflict('TOO_MANY_IMAGES', `Máximo ${repo.MAX_REVIEW_IMAGES} fotos por reseña`);
  const stored = await storeImage(file.buffer, 'reviews');
  try {
    const img = await repo.insertImage(row.id, { ...stored, position: await repo.countImages(id) });
    return { id: img.id, url: absoluteUrl(img.url) };
  } catch (e) { await deleteStoredFiles([stored.storagePath]); throw e; }
}
export async function removeImage(user, id, imageId) {
  await ownedOrFail(user, 'reviews', id);
  const img = await repo.findImage(id, imageId);
  if (!img) throw notFound('Imagen no encontrada');
  await repo.deleteImage(imageId);
  await deleteStoredFiles([img.storage_path]);
}

// --- Mis reseñas ---
export async function listMine(user, { kind, page, pageSize }) {
  const table = kind === 'video' ? 'video_reviews' : 'reviews';
  const fkClause = kind === 'place' ? 'r.place_id IS NOT NULL' : kind === 'product' ? 'r.product_id IS NOT NULL' : '1 = 1';
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM ${table} r WHERE r.user_id = ? AND ${fkClause}`, [user.id]);
  const [rows] = await pool.query(
    `SELECT r.*, u.display_name AS author_name, u.avatar_url AS author_avatar FROM ${table} r JOIN users u ON u.id = r.user_id WHERE r.user_id = ? AND ${fkClause} ORDER BY r.created_at DESC, r.id DESC LIMIT ? OFFSET ?`,
    [user.id, pageSize, offsetOf(page, pageSize)]);
  const items = await withImages(table, rows, user);
  // Nombre del contenido reseñado, para mostrarlo en la lista.
  for (const it of items) {
    const e = await common.findRow(it.target.kind, it.target.id);
    it.target.name = e?.name ?? e?.title ?? null;
    it.target.slug = e?.slug ?? null;
  }
  return pageOf(items, total, page, pageSize);
}

export async function pendingQueue({ type, page, pageSize }) {
  const { total, rows } = await repo.listPending({ type, limit: pageSize, offset: offsetOf(page, pageSize) });
  return pageOf(rows.map((r) => ({
    id: r.id, type, rating: r.rating, comment: r.comment, createdAt: r.created_at,
    author: { id: r.user_id, displayName: r.author_name }, target: { kind: r.target_type, id: r.target_id, name: r.target_name },
  })), total, page, pageSize);
}
