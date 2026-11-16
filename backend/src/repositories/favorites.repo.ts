import { pool } from '../config/db.js';

const COL = { place: 'place_id', product: 'product_id', video: 'video_id' };
const TABLE = { place: 'places', product: 'products', video: 'videos' };

// INSERT IGNORE + UNIQUE(user, entidad): agregar dos veces es idempotente y nunca duplica.
export async function add(userId, kind, id, db = pool) {
  const [res] = await db.query(`INSERT IGNORE INTO favorites (user_id, ${COL[kind]}) VALUES (?, ?)`, [userId, id]);
  return res.affectedRows === 1;
}
export async function remove(userId, kind, id, db = pool) {
  const [res] = await db.query(`DELETE FROM favorites WHERE user_id = ? AND ${COL[kind]} = ?`, [userId, id]);
  return res.affectedRows === 1;
}
export async function allIds(userId, db = pool) {
  const [rows] = await db.query('SELECT place_id, product_id, video_id FROM favorites WHERE user_id = ? ORDER BY created_at DESC, id DESC', [userId]);
  return {
    place: rows.filter((r) => r.place_id).map((r) => r.place_id),
    product: rows.filter((r) => r.product_id).map((r) => r.product_id),
    video: rows.filter((r) => r.video_id).map((r) => r.video_id),
  };
}
// Solo cuenta lo que sigue siendo público: si un contenido se oculta o da de baja, deja de aparecer pero el favorito se conserva.
export async function page(userId, kind, { limit, offset }, db = pool) {
  const col = COL[kind]; const t = TABLE[kind];
  const base = `FROM favorites f JOIN ${t} e ON e.id = f.${col} WHERE f.user_id = ? AND e.status = 'published' AND e.deleted_at IS NULL`;
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total ${base}`, [userId]);
  const [rows] = await db.query(`SELECT f.${col} AS id, f.created_at ${base} ORDER BY f.created_at DESC, f.id DESC LIMIT ? OFFSET ?`, [userId, limit, offset]);
  return { total, rows };
}
