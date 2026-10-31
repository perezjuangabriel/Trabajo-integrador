import { pool } from '../config/db.js';
import { pageOf, offsetOf } from '../utils/pagination.js';

/**
 * Línea de tiempo del usuario: reseñas, favoritos y propuestas, de la más reciente a la más antigua.
 * Los favoritos solo se muestran si el contenido sigue siendo público.
 */
const UNION = `
  SELECT 'review' AS type, IF(r.place_id IS NOT NULL, 'place', 'product') AS target_kind, COALESCE(r.place_id, r.product_id) AS target_id,
         COALESCE(pl.name, pr.name) AS target_name, r.rating AS rating, r.status AS status, r.created_at AS at
    FROM reviews r LEFT JOIN places pl ON pl.id = r.place_id LEFT JOIN products pr ON pr.id = r.product_id WHERE r.user_id = ?
  UNION ALL
  SELECT 'review', 'video', vr.video_id, v.title, vr.rating, vr.status, vr.created_at FROM video_reviews vr JOIN videos v ON v.id = vr.video_id WHERE vr.user_id = ?
  UNION ALL
  SELECT 'favorite', 'place', f.place_id, p.name, NULL, NULL, f.created_at FROM favorites f JOIN places p ON p.id = f.place_id WHERE f.user_id = ? AND p.status = 'published' AND p.deleted_at IS NULL
  UNION ALL
  SELECT 'favorite', 'product', f.product_id, p.name, NULL, NULL, f.created_at FROM favorites f JOIN products p ON p.id = f.product_id WHERE f.user_id = ? AND p.status = 'published' AND p.deleted_at IS NULL
  UNION ALL
  SELECT 'favorite', 'video', f.video_id, v.title, NULL, NULL, f.created_at FROM favorites f JOIN videos v ON v.id = f.video_id WHERE f.user_id = ? AND v.status = 'published' AND v.deleted_at IS NULL
  UNION ALL
  SELECT 'submission', 'place', p.id, p.name, NULL, p.status, p.created_at FROM places p WHERE p.submitted_by = ? AND p.deleted_at IS NULL
  UNION ALL
  SELECT 'submission', 'product', p.id, p.name, NULL, p.status, p.created_at FROM products p WHERE p.submitted_by = ? AND p.deleted_at IS NULL
  UNION ALL
  SELECT 'submission', 'video', v.id, v.title, NULL, v.status, v.created_at FROM videos v WHERE v.submitted_by = ? AND v.deleted_at IS NULL`;
const PARAMS = (id) => Array(8).fill(id);

export async function list(user, { page, pageSize }) {
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM (${UNION}) t`, PARAMS(user.id));
  const [rows] = await pool.query(`SELECT * FROM (${UNION}) t ORDER BY t.at DESC, t.type, t.target_id LIMIT ? OFFSET ?`, [...PARAMS(user.id), pageSize, offsetOf(page, pageSize)]);
  return pageOf(rows.map((r) => ({
    type: r.type, target: { kind: r.target_kind, id: r.target_id, name: r.target_name },
    ...(r.rating !== null ? { rating: r.rating } : {}), ...(r.status ? { status: r.status } : {}), at: r.at,
  })), total, page, pageSize);
}
