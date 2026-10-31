import { pool } from '../config/db.js';

// Recalcula la caché avg_rating/review_count SOLO con reseñas visibles.
// Se usa dentro de la misma transacción que modifica reseñas (también en la baja de cuenta).
const TABLES = {
  place: { entity: 'places', reviews: 'reviews', fk: 'place_id' },
  product: { entity: 'products', reviews: 'reviews', fk: 'product_id' },
  video: { entity: 'videos', reviews: 'video_reviews', fk: 'video_id' },
};

export async function recompute(kind, id, db = pool) {
  const t = TABLES[kind];
  await db.query(
    `UPDATE ${t.entity} e SET
       review_count = (SELECT COUNT(*) FROM ${t.reviews} r WHERE r.${t.fk} = e.id AND r.status = 'visible'),
       avg_rating   = COALESCE((SELECT ROUND(AVG(r.rating), 2) FROM ${t.reviews} r WHERE r.${t.fk} = e.id AND r.status = 'visible'), 0)
     WHERE e.id = ?`,
    [id],
  );
}

/** Entidades afectadas por las reseñas de un usuario (para recalcular tras borrarlas). */
export async function entitiesReviewedBy(userId, db = pool) {
  const [r1] = await db.query('SELECT DISTINCT place_id, product_id FROM reviews WHERE user_id = ?', [userId]);
  const [r2] = await db.query('SELECT DISTINCT video_id FROM video_reviews WHERE user_id = ?', [userId]);
  return {
    place: [...new Set(r1.map((r) => r.place_id).filter(Boolean))],
    product: [...new Set(r1.map((r) => r.product_id).filter(Boolean))],
    video: r2.map((r) => r.video_id),
  };
}

const ENTITY_TABLE = { place: 'places', product: 'products', video: 'videos' };
/** Bloquea la fila de la entidad hasta el commit: serializa los recálculos de promedio de reseñas simultáneas. */
export const lockEntity = (kind, id, db = pool) => db.query(`SELECT id FROM ${ENTITY_TABLE[kind]} WHERE id = ? FOR UPDATE`, [id]);
