import { pool } from '../config/db.js';

export const SLOTS = ['video', 'product', 'place'];
// Por ranura: tabla de contenido, tabla de reseñas, clave foránea y columna de featured_content.
export const SLOT_CFG = {
  video:   { entity: 'videos',   reviews: 'video_reviews', fk: 'video_id',   col: 'video_id',   categoryType: 'video' },
  product: { entity: 'products', reviews: 'reviews',       fk: 'product_id', col: 'product_id', categoryType: 'product' },
  place:   { entity: 'places',   reviews: 'reviews',       fk: 'place_id',   col: 'place_id',   categoryType: 'place' },
};

export async function getSettings(slot, db = pool, lock = false) {
  const [rows] = await db.query(`SELECT * FROM featured_settings WHERE slot = ? ${lock ? 'FOR UPDATE' : ''}`, [slot]);
  const r = rows[0];
  return r && { slot, mode: r.mode, periodHours: r.period_hours, minReviews: r.min_reviews, recencyDays: r.recency_days, preferredCategoryId: r.preferred_category_id, updatedAt: r.updated_at };
}
export async function updateSettings(slot, f, userId, db = pool) {
  const map = { mode: 'mode', periodHours: 'period_hours', minReviews: 'min_reviews', recencyDays: 'recency_days', preferredCategoryId: 'preferred_category_id' };
  const sets = ['updated_by = ?']; const values = [userId];
  for (const [k, col] of Object.entries(map)) if (f[k] !== undefined) { sets.push(`${col} = ?`); values.push(f[k]); }
  await db.query(`UPDATE featured_settings SET ${sets.join(', ')} WHERE slot = ?`, [...values, slot]);
}

export async function currentRow(slot, db = pool) {
  const [rows] = await db.query('SELECT * FROM featured_content WHERE slot = ? AND is_current = 1 ORDER BY id DESC LIMIT 1', [slot]);
  const r = rows[0];
  return r && { id: r.id, targetId: r[SLOT_CFG[slot].col], selection: r.selection, score: r.score === null ? null : Number(r.score), startsAt: r.starts_at, endsAt: r.ends_at, selectedBy: r.selected_by };
}
export async function history(slot, limit = 10, db = pool) {
  const [rows] = await db.query('SELECT * FROM featured_content WHERE slot = ? ORDER BY id DESC LIMIT ?', [slot, limit]);
  return rows.map((r) => ({ id: r.id, targetId: r[SLOT_CFG[slot].col], selection: r.selection, score: r.score === null ? null : Number(r.score), startsAt: r.starts_at, endsAt: r.ends_at, isCurrent: Boolean(r.is_current) }));
}
export const closeCurrent = (slot, db = pool) => db.query('UPDATE featured_content SET is_current = 0 WHERE slot = ? AND is_current = 1', [slot]);
export const insert = ({ slot, targetId, selection, score = null, startsAt, endsAt = null, selectedBy = null }, db = pool) =>
  db.query(`INSERT INTO featured_content (slot, ${SLOT_CFG[slot].col}, selection, score, starts_at, ends_at, is_current, selected_by) VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
    [slot, targetId, selection, score, startsAt, endsAt, selectedBy]);

/** Estado público del contenido apuntado por un destacado. */
export async function entityState(slot, id, db = pool) {
  const [rows] = await db.query(`SELECT id, status, deleted_at, ${slot === 'video' ? 'title' : 'name'} AS label FROM ${SLOT_CFG[slot].entity} WHERE id = ?`, [id]);
  const e = rows[0];
  return e ? { id: e.id, label: e.label, isPublic: e.status === 'published' && !e.deleted_at } : null;
}

export async function candidates(slot, { categoryId, recencyDays }, db = pool) {
  const c = SLOT_CFG[slot];
  const params = [recencyDays]; let cat = '';
  if (categoryId) { cat = 'AND e.category_id = ?'; params.push(categoryId); }
  const [rows] = await db.query(
    `SELECT e.id, e.avg_rating, e.review_count,
            (SELECT COUNT(*) FROM ${c.reviews} r WHERE r.${c.fk} = e.id AND r.status = 'visible' AND r.created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)) AS recent
       FROM ${c.entity} e WHERE e.status = 'published' AND e.deleted_at IS NULL ${cat}`, params);
  return rows.map((r) => ({ id: r.id, avg: Number(r.avg_rating), count: r.review_count, recent: r.recent }));
}
export async function globalMean(slot, db = pool) {
  const c = SLOT_CFG[slot];
  const nonNull = slot === 'video' ? '' : `AND r.${c.fk} IS NOT NULL`;
  const [[row]] = await db.query(`SELECT AVG(r.rating) AS m FROM ${c.reviews} r WHERE r.status = 'visible' ${nonNull}`);
  return row.m === null ? 3 : Number(row.m);
}
