import { pool, withTransaction } from '../config/db.js';
import * as repo from '../repositories/featured.repo.js';
import * as lookups from '../repositories/lookups.repo.js';
import * as audit from '../repositories/audit.repo.js';
import { AppError, badRequest, conflict, notFound } from '../utils/AppError.js';

const { SLOTS, SLOT_CFG } = repo;
export const RECENT_BONUS_MAX = 0.5;

/**
 * Puntuación ponderada (promedio bayesiano) + bonus por actividad reciente. Detalle en docs/FEATURED_ALGORITHM.md.
 *   bayes = v/(v+m)·R + m/(v+m)·C     R = promedio del elemento, v = reseñas válidas,
 *                                      m = mínimo configurable, C = promedio global
 *   bonus = 0.5 · r/(r+2)              r = reseñas válidas en los últimos `recencyDays`
 * Un 5.0 con 1 reseña NO le gana a un 4.6 con 30 reseñas: con pocas reseñas el puntaje se acerca a C.
 */
export function weightedScore({ avg, count, recent }, { m, C }) {
  const bayes = count + m === 0 ? C : (count / (count + m)) * avg + (m / (count + m)) * C;
  return bayes + RECENT_BONUS_MAX * (recent / (recent + 2));
}

/** Elige el mejor candidato. Solo son elegibles los que tienen >= minReviews; si no hay ninguno, se relaja (la Home no queda vacía). */
export function pickBest(cands, { minReviews, C, excludeId = null }) {
  let pool_ = cands;
  if (excludeId !== null && cands.length > 1) pool_ = cands.filter((c) => c.id !== excludeId); // rotación: no repetir el anterior si hay alternativa
  const eligible = pool_.filter((c) => c.count >= minReviews);
  const universe = eligible.length ? eligible : pool_;
  if (!universe.length) return null;
  const scored = universe.map((c) => ({ ...c, score: weightedScore(c, { m: minReviews, C }) }));
  scored.sort((a, b) => b.score - a.score || b.count - a.count || b.id - a.id); // desempate determinista
  return { id: scored[0].id, score: Number(scored[0].score.toFixed(4)), relaxed: eligible.length === 0 };
}

const isValid = (cur, state, now = new Date()) => Boolean(cur && state?.isPublic && (!cur.endsAt || new Date(cur.endsAt) > now));

async function autoPick(slot, st, prevId, conn) {
  let cands = await repo.candidates(slot, { categoryId: st.preferredCategoryId, recencyDays: st.recencyDays }, conn);
  if (!cands.length && st.preferredCategoryId) cands = await repo.candidates(slot, { recencyDays: st.recencyDays }, conn); // categoría preferida vacía: se ignora
  if (!cands.length) return null;
  return pickBest(cands, { minReviews: st.minReviews, C: await repo.globalMean(slot, conn), excludeId: prevId });
}

/**
 * Garantiza un destacado vigente. Es ATÓMICO: la fila de configuración se bloquea, así que pedidos simultáneos
 * no generan dos selecciones. Devuelve el destacado vigente o null.
 */
export async function ensureCurrent(slot, { force = false } = {}) {
  return withTransaction(async (conn) => {
    const st = await repo.getSettings(slot, conn, true);
    const cur = await repo.currentRow(slot, conn);
    const state = cur ? await repo.entityState(slot, cur.targetId, conn) : null;
    if (!force && isValid(cur, state)) return cur;
    if (st.mode === 'manual') {
      if (force) throw conflict('MANUAL_MODE', 'La ranura está en modo manual: elegí el contenido a mano o cambiá a automático');
      return null; // manual sin vigente: no se inventa uno; el admin lo ve en el panel
    }
    const prevId = cur?.targetId ?? null;
    const pick = await autoPick(slot, st, force ? prevId : null, conn);
    if (!pick) return null;
    await repo.closeCurrent(slot, conn);
    const now = new Date();
    await repo.insert({ slot, targetId: pick.id, selection: 'automatic', score: pick.score, startsAt: now, endsAt: new Date(now.getTime() + st.periodHours * 3_600_000) }, conn);
    return repo.currentRow(slot, conn);
  });
}
export const refreshAll = async () => { for (const s of SLOTS) await ensureCurrent(s).catch((e) => console.error(`[featured:${s}]`, e.message)); };

/** Reemplazo manual. En modo automático vence a las periodHours (o endsAt); en manual dura hasta reemplazarlo. */
export async function setManual(actor, slot, { id, endsAt }, ip) {
  const state = await repo.entityState(slot, id);
  if (!state || !state.isPublic) throw badRequest('INVALID_TARGET', 'El contenido no existe o no está publicado');
  if (endsAt && new Date(endsAt) <= new Date()) throw badRequest('INVALID_END', 'La fecha de fin debe ser futura');
  await withTransaction(async (conn) => {
    const st = await repo.getSettings(slot, conn, true);
    const now = new Date();
    const end = endsAt ? new Date(endsAt) : st.mode === 'automatic' ? new Date(now.getTime() + st.periodHours * 3_600_000) : null;
    await repo.closeCurrent(slot, conn);
    await repo.insert({ slot, targetId: id, selection: 'manual', startsAt: now, endsAt: end, selectedBy: actor.id }, conn);
    await audit.record({ actorId: actor.id, action: 'featured.set_manual', entityType: `featured_${slot}`, entityId: id, details: { endsAt: end }, ip }, conn);
  });
  return adminSlot(slot);
}

export async function updateSettings(actor, slot, fields, ip) {
  if (fields.preferredCategoryId && !(await lookups.activeCategoryOfType(fields.preferredCategoryId, SLOT_CFG[slot].categoryType))) {
    throw badRequest('INVALID_CATEGORY', 'La categoría no existe, está inactiva o no corresponde a esta ranura');
  }
  await withTransaction(async (conn) => {
    await repo.getSettings(slot, conn, true);
    await repo.updateSettings(slot, fields, actor.id, conn);
    await audit.record({ actorId: actor.id, action: 'featured.settings_updated', entityType: `featured_${slot}`, details: fields, ip }, conn);
  });
  return adminSlot(slot);
}

export async function forceRefresh(actor, slot, ip) {
  await ensureCurrent(slot, { force: true });
  await audit.record({ actorId: actor.id, action: 'featured.refreshed', entityType: `featured_${slot}`, ip });
  return adminSlot(slot);
}

export async function adminSlot(slot) {
  const [settings, cur, hist] = await Promise.all([repo.getSettings(slot), repo.currentRow(slot), repo.history(slot, 10)]);
  let current = null;
  if (cur) {
    const state = await repo.entityState(slot, cur.targetId);
    const status = !state?.isPublic ? 'unavailable' : cur.endsAt && new Date(cur.endsAt) <= new Date() ? 'expired' : 'valid';
    current = { ...cur, label: state?.label ?? null, status };
  }
  return { slot, settings, current: current ?? null, history: hist };
}
export const adminAll = async () => Object.fromEntries(await Promise.all(SLOTS.map(async (s) => [s, await adminSlot(s)])));

export const assertSlot = (slot) => { if (!SLOTS.includes(slot)) throw notFound(); };
export { pool };
