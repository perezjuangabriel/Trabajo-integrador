import * as repo from '../repositories/favorites.repo.js';
import * as common from '../repositories/catalogCommon.repo.js';
import * as places from './places.service.js';
import * as products from './products.service.js';
import * as videos from './videos.service.js';
import { canView } from './catalogCommon.service.js';
import { pageOf, offsetOf } from '../utils/pagination.js';
import { notFound } from '../utils/AppError.js';

const SERVICES = { place: places, product: products, video: videos };

/** Solo se puede marcar como favorito lo que el usuario puede ver (publicado y vigente). */
async function assertFavoritable(user, kind, id) {
  const row = await common.findRow(kind, id);
  if (!row || row.status !== 'published' || !canView(user, row)) throw notFound();
}
export async function add(user, kind, id) {
  await assertFavoritable(user, kind, id);
  return { favorited: true, created: await repo.add(user.id, kind, id) };
}
export async function remove(user, kind, id) {
  await repo.remove(user.id, kind, id); // idempotente: quitar algo que no estaba no es un error
}
export const ids = (user) => repo.allIds(user.id);

export async function list(user, { kind, page, pageSize }) {
  const { total, rows } = await repo.page(user.id, kind, { limit: pageSize, offset: offsetOf(page, pageSize) });
  const cards = await SERVICES[kind].cardsByIds(user, rows.map((r) => r.id));
  const items = rows.filter((r) => cards.has(r.id)).map((r) => ({ ...cards.get(r.id), favoritedAt: r.created_at }));
  return pageOf(items, total, page, pageSize);
}
