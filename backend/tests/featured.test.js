import { describe, it, expect, afterAll, afterEach } from 'vitest';
import { api, verifiedUser, asUser, staffAuth, freshContent, db } from './helpers.js';
import { weightedScore, pickBest } from '../src/services/featured.service.js';

afterAll(() => db.end());
const A = '/api/v1/admin';
const settings = (auth, slot, body) => api().patch(`${A}/featured/${slot}/settings`).set(auth).send(body);
const current = async (slot) => (await db.query('SELECT * FROM featured_content WHERE slot = ? AND is_current = 1', [slot]))[0];
const expire = (slot) => db.query("UPDATE featured_content SET ends_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 MINUTE) WHERE slot = ? AND is_current = 1", [slot]);

afterEach(async () => { // deja la configuración como en la semilla
  const admin = await staffAuth('admin');
  await settings(admin, 'video', { mode: 'manual', periodHours: 168, minReviews: 2, preferredCategoryId: null });
  await settings(admin, 'product', { mode: 'automatic', periodHours: 24, minReviews: 3, preferredCategoryId: null });
  await settings(admin, 'place', { mode: 'automatic', periodHours: 24, minReviews: 3, preferredCategoryId: null });
});

describe('puntuación ponderada (función pura)', () => {
  const ctx = { m: 5, C: 3.5 };
  it('un 5.0 con 1 reseña NO supera a un 4.6 con 30 reseñas', () => {
    expect(weightedScore({ avg: 5, count: 1, recent: 0 }, ctx)).toBeLessThan(weightedScore({ avg: 4.6, count: 30, recent: 0 }, ctx));
  });
  it('sin reseñas el puntaje es el promedio global; la actividad reciente suma como máximo 0.5', () => {
    expect(weightedScore({ avg: 0, count: 0, recent: 0 }, ctx)).toBeCloseTo(3.5);
    expect(weightedScore({ avg: 4, count: 10, recent: 1000 }, ctx) - weightedScore({ avg: 4, count: 10, recent: 0 }, ctx)).toBeLessThan(0.5);
    expect(weightedScore({ avg: 4, count: 10, recent: 5 }, ctx)).toBeGreaterThan(weightedScore({ avg: 4, count: 10, recent: 0 }, ctx));
    expect(weightedScore({ avg: 4, count: 0, recent: 0 }, { m: 0, C: 3 })).toBe(3); // m = 0 sin reseñas no divide por cero
  });
  it('pickBest: exige el mínimo, rota, desempata siempre igual y relaja si nadie cumple', () => {
    const c = [{ id: 1, avg: 5, count: 1, recent: 0 }, { id: 2, avg: 4.6, count: 30, recent: 2 }, { id: 3, avg: 4.5, count: 30, recent: 0 }];
    expect(pickBest(c, { minReviews: 5, C: 3.5 })).toMatchObject({ id: 2, relaxed: false });   // el 1 no es elegible
    expect(pickBest(c, { minReviews: 5, C: 3.5, excludeId: 2 }).id).toBe(3);                    // rotación
    expect(pickBest([c[0]], { minReviews: 5, C: 3.5, excludeId: 1 }).id).toBe(1);               // única opción: se repite
    expect(pickBest(c, { minReviews: 999, C: 3.5 })).toMatchObject({ relaxed: true });          // nadie cumple: se relaja
    expect(pickBest([], { minReviews: 1, C: 3 })).toBeNull();
    const tie = [{ id: 7, avg: 4, count: 10, recent: 0 }, { id: 9, avg: 4, count: 10, recent: 0 }];
    expect(pickBest(tie, { minReviews: 1, C: 3 }).id).toBe(pickBest([...tie].reverse(), { minReviews: 1, C: 3 }).id);
  });
});

describe('selección automática persistida', () => {
  it('todos ven el mismo destacado mientras está vigente y queda una sola fila vigente', async () => {
    const [a, b] = await Promise.all([api().get('/api/v1/home'), api().get('/api/v1/home').set(asUser((await verifiedUser()).accessToken))]);
    expect(a.body.data.featuredPlace.id).toBe(b.body.data.featuredPlace.id);
    expect((await current('place')).length).toBe(1);
    expect(a.body.data.featuredPlace.featured).toMatchObject({ selection: expect.stringMatching(/automatic|manual/) });
  });
  it('al vencer el período se elige otro; con pedidos simultáneos se crea UNA sola selección', async () => {
    await api().get('/api/v1/home');
    const [[{ n: before }]] = await db.query("SELECT COUNT(*) n FROM featured_content WHERE slot = 'place'");
    await expire('place');
    const res = await Promise.all(Array.from({ length: 8 }, () => api().get('/api/v1/home')));
    expect(new Set(res.map((r) => r.body.data.featuredPlace.id)).size).toBe(1);
    const [[{ n: after }]] = await db.query("SELECT COUNT(*) n FROM featured_content WHERE slot = 'place'");
    expect(after - before).toBe(1);
    const cur = await current('place');
    expect(cur).toHaveLength(1);
    expect(cur[0].selection).toBe('automatic');
    expect(Number(cur[0].score)).toBeGreaterThan(0);
    expect(new Date(cur[0].ends_at).getTime()).toBeGreaterThan(Date.now() + 23 * 3600_000);   // vigencia = periodHours
  });
  it('el refresco forzado rota (no repite) y respeta el período configurado', async () => {
    const admin = await staffAuth('admin');
    await settings(admin, 'place', { periodHours: 6 });
    const r1 = (await api().post(`${A}/featured/place/refresh`).set(admin)).body.data.slot.current;
    const r2 = (await api().post(`${A}/featured/place/refresh`).set(admin)).body.data.slot.current;
    expect(r1.targetId).not.toBe(r2.targetId);
    const hours = (new Date(r2.endsAt) - new Date(r2.startsAt)) / 3_600_000;
    expect(hours).toBeCloseTo(6, 1);
    expect((await current('place'))).toHaveLength(1);
  });
  it('categoría preferida: solo compite esa categoría; categorías de otro tipo se rechazan', async () => {
    const admin = await staffAuth('admin');
    expect((await settings(admin, 'place', { preferredCategoryId: 5 })).body.error.code).toBe('INVALID_CATEGORY');   // categoría de productos
    await settings(admin, 'place', { preferredCategoryId: 4, minReviews: 1 });                                     // Indoor
    const r = await api().post(`${A}/featured/place/refresh`).set(admin);
    const [[p]] = await db.query('SELECT category_id FROM places WHERE id = ?', [r.body.data.slot.current.targetId]);
    expect(p.category_id).toBe(4);
  });
  it('si nadie alcanza el mínimo de reseñas se relaja y la Home no queda vacía', async () => {
    const admin = await staffAuth('admin');
    await settings(admin, 'product', { minReviews: 500 });
    const r = await api().post(`${A}/featured/product/refresh`).set(admin);
    expect(r.body.data.slot.current.targetId).toBeGreaterThan(0);
  });
  it('si el destacado se oculta, la Home lo reemplaza de inmediato', async () => {
    const mod = await staffAuth('moderator');
    const first = (await api().get('/api/v1/home')).body.data.featuredPlace.id;
    await api().post(`/api/v1/moderation/place/${first}/hide`).set(mod).send({ note: 'prueba' });
    try {
      const next = (await api().get('/api/v1/home')).body.data.featuredPlace;
      expect(next.id).not.toBe(first);
      expect(next.status).toBe('published');
    } finally { await api().post(`/api/v1/moderation/place/${first}/restore`).set(mod).send({}); }
  });
});

describe('selección manual', () => {
  it('reemplaza el destacado, vence según el período en modo automático y se audita', async () => {
    const admin = await staffAuth('admin');
    const r = await api().put(`${A}/featured/product/`.replace(/\/$/, '')).set(admin).send({ id: 2 });
    expect(r.body.data.slot.current).toMatchObject({ targetId: 2, selection: 'manual', status: 'valid' });
    expect((await api().get('/api/v1/home')).body.data.featuredProduct.id).toBe(2);
    expect(r.body.data.slot.history.length).toBeGreaterThan(0);
    await expire('product');                                                                // vence el manual -> vuelve el automático
    expect((await api().get('/api/v1/home')).body.data.featuredProduct).not.toBeNull();
    expect((await current('product'))[0].selection).toBe('automatic');
    const [[a]] = await db.query("SELECT COUNT(*) n FROM audit_logs WHERE action = 'featured.set_manual' AND entity_type = 'featured_product'");
    expect(a.n).toBeGreaterThan(0);
  });
  it('valida el objetivo: pendiente, inexistente o fecha pasada', async () => {
    const admin = await staffAuth('admin');
    expect((await api().put(`${A}/featured/product`).set(admin).send({ id: 10 })).body.error.code).toBe('INVALID_TARGET');   // pendiente
    expect((await api().put(`${A}/featured/video`).set(admin).send({ id: 999999 })).body.error.code).toBe('INVALID_TARGET');
    expect((await api().put(`${A}/featured/video`).set(admin).send({ id: 1, endsAt: '2020-01-01T00:00:00Z' })).body.error.code).toBe('INVALID_END');
    expect((await api().put(`${A}/featured/zapato`).set(admin).send({ id: 1 })).status).toBe(400);
    expect((await api().put(`${A}/featured/video`).set(admin).send({ id: 1, extra: 1 })).status).toBe(400);
  });
  it('modo manual: dura hasta reemplazarlo; si se oculta la Home lo omite y el panel avisa; no se puede refrescar', async () => {
    const admin = await staffAuth('admin'); const mod = await staffAuth('moderator');
    const id = await freshContent('video');
    const r = await api().put(`${A}/featured/video`).set(admin).send({ id });
    expect(r.body.data.slot.current).toMatchObject({ targetId: id, selection: 'manual', endsAt: null, status: 'valid' });
    expect((await api().get('/api/v1/home')).body.data.featuredVideo.id).toBe(id);
    expect((await api().post(`${A}/featured/video/refresh`).set(admin)).body.error.code).toBe('MANUAL_MODE');
    await api().post(`/api/v1/moderation/video/${id}/hide`).set(mod).send({});
    expect((await api().get('/api/v1/home')).body.data.featuredVideo).toBeNull();
    expect((await api().get(`${A}/featured`).set(admin)).body.data.featured.video.current.status).toBe('unavailable');
    await api().post(`/api/v1/moderation/video/${id}/restore`).set(mod).send({});
    expect((await api().get('/api/v1/home')).body.data.featuredVideo.id).toBe(id);
  });
  it('el modo automático también sirve para el video de la semana (criterio y período documentados)', async () => {
    const admin = await staffAuth('admin');
    await settings(admin, 'video', { mode: 'automatic', periodHours: 168, minReviews: 1 });
    const r = await api().post(`${A}/featured/video/refresh`).set(admin);
    expect(r.body.data.slot.current).toMatchObject({ selection: 'automatic', status: 'valid' });
    expect((new Date(r.body.data.slot.current.endsAt) - new Date(r.body.data.slot.current.startsAt)) / 3_600_000).toBeCloseTo(168, 0);
  });
});

describe('configuración y permisos', () => {
  it('valida la configuración y la audita', async () => {
    const admin = await staffAuth('admin');
    for (const bad of [{ periodHours: 0 }, { minReviews: -1 }, { mode: 'azar' }, { recencyDays: 1000 }, { foo: 1 }, {}]) {
      expect((await settings(admin, 'place', bad)).status).toBe(400);
    }
    const ok = await settings(admin, 'place', { mode: 'manual', periodHours: 48, minReviews: 7, recencyDays: 14 });
    expect(ok.body.data.slot.settings).toMatchObject({ mode: 'manual', periodHours: 48, minReviews: 7, recencyDays: 14 });
    const [[a]] = await db.query("SELECT COUNT(*) n FROM audit_logs WHERE action = 'featured.settings_updated'");
    expect(a.n).toBeGreaterThan(0);
  });
  it('solo el administrador: sin sesión 401; usuario y moderador 403', async () => {
    const { auth } = await verifiedUser(); const mod = await staffAuth('moderator');
    for (const who of [auth, mod]) {
      expect((await api().get(`${A}/featured`).set(who)).status).toBe(403);
      expect((await api().put(`${A}/featured/place`).set(who).send({ id: 1 })).status).toBe(403);
      expect((await settings(who, 'place', { minReviews: 1 })).status).toBe(403);
      expect((await api().post(`${A}/featured/place/refresh`).set(who)).status).toBe(403);
    }
    expect((await api().get(`${A}/featured`)).status).toBe(401);
  });
});
