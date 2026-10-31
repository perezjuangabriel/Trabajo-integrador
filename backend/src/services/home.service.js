import { pool } from '../config/db.js';
import { ensureCurrent } from './featured.service.js';
import * as places from './places.service.js';
import * as products from './products.service.js';
import * as videos from './videos.service.js';

const SVC = { place: places, product: products, video: videos };

async function featuredCard(viewer, slot) {
  const cur = await ensureCurrent(slot);
  if (!cur) return null;
  const cards = await SVC[slot].cardsByIds(viewer, [cur.targetId]);
  const card = cards.get(cur.targetId);
  return card ? { ...card, featured: { selection: cur.selection, since: cur.startsAt, until: cur.endsAt } } : null;
}

// Últimas reseñas visibles de contenido público (lugares, productos y videos).
async function recentReviews(limit = 10) {
  const part = (kind, rt, fk, et, name, slug) => `
    SELECT '${kind}' AS kind, r.${fk} AS target_id, e.${name} AS target_name, ${slug} AS target_slug, r.rating, r.comment, r.created_at, u.display_name
      FROM ${rt} r JOIN ${et} e ON e.id = r.${fk} AND e.status = 'published' AND e.deleted_at IS NULL JOIN users u ON u.id = r.user_id WHERE r.status = 'visible'`;
  const [rows] = await pool.query(
    `${part('place', 'reviews', 'place_id', 'places', 'name', 'e.slug')} UNION ALL ${part('product', 'reviews', 'product_id', 'products', 'name', 'e.slug')}
     UNION ALL ${part('video', 'video_reviews', 'video_id', 'videos', 'title', 'NULL')} ORDER BY created_at DESC LIMIT ?`, [limit]);
  return rows.map((r) => ({
    target: { kind: r.kind, id: r.target_id, name: r.target_name, slug: r.target_slug }, rating: r.rating,
    comment: r.comment.length > 160 ? `${r.comment.slice(0, 157)}…` : r.comment, author: r.display_name, createdAt: r.created_at,
  }));
}

export async function home(viewer) {
  const [featuredVideo, featuredProduct, featuredPlace, recent, popularPlaces, popularProducts] = await Promise.all([
    featuredCard(viewer, 'video'), featuredCard(viewer, 'product'), featuredCard(viewer, 'place'), recentReviews(),
    places.list(viewer, { page: 1, pageSize: 6, sort: 'reviews' }), products.list(viewer, { page: 1, pageSize: 6, sort: 'reviews' }),
  ]);
  return { featuredVideo, featuredProduct, featuredPlace, recentReviews: recent, popularPlaces: popularPlaces.items, popularProducts: popularProducts.items, generatedAt: new Date() };
}
