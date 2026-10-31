import { describe, it, expect, afterAll } from 'vitest';
import { api, verifiedUser, staffAuth, freshContent, db } from './helpers.js';

afterAll(() => db.end());

describe('GET /home', () => {
  it('es público y trae destacados, reseñas recientes y populares con el formato esperado', async () => {
    const r = await api().get('/api/v1/home');
    expect(r.status).toBe(200);
    const h = r.body.data;
    expect(h).toHaveProperty('generatedAt');
    for (const k of ['featuredVideo', 'featuredProduct', 'featuredPlace']) expect(h[k]).toMatchObject({ id: expect.any(Number), status: 'published' });
    expect(h.featuredVideo).toHaveProperty('provider');
    expect(h.popularPlaces.length).toBeLessThanOrEqual(6);
    const counts = h.popularPlaces.map((p) => p.reviewCount);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    expect(h.recentReviews.length).toBeGreaterThan(0);
    expect(h.recentReviews.length).toBeLessThanOrEqual(10);
    const dates = h.recentReviews.map((x) => new Date(x.createdAt).getTime());
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });
  it('las reseñas recientes excluyen ocultas y de contenido no público', async () => {
    const id = await freshContent('place'); const { auth } = await verifiedUser();
    const rev = (await api().post(`/api/v1/places/${id}/reviews`).set(auth).send({ rating: 5, comment: 'Reseña recientísima única' })).body.data.review;
    const has = async () => (await api().get('/api/v1/home')).body.data.recentReviews.some((x) => x.comment === 'Reseña recientísima única');
    expect(await has()).toBe(true);
    const mod = await staffAuth('moderator');
    await api().post(`/api/v1/moderation/review/${rev.id}/hide`).set(mod).send({});
    expect(await has()).toBe(false);
    await api().post(`/api/v1/moderation/review/${rev.id}/restore`).set(mod).send({});
    await api().post(`/api/v1/moderation/place/${id}/hide`).set(mod).send({});
    expect(await has()).toBe(false);
  });
});

describe('estadísticas y auditoría (solo admin)', () => {
  it('stats coincide con la base y se niega a usuarios y moderadores', async () => {
    const admin = await staffAuth('admin');
    expect((await api().get('/api/v1/admin/stats')).status).toBe(401);
    expect((await api().get('/api/v1/admin/stats').set((await verifiedUser()).auth)).status).toBe(403);
    expect((await api().get('/api/v1/admin/stats').set(await staffAuth('moderator'))).status).toBe(403);
    const s = (await api().get('/api/v1/admin/stats').set(admin)).body.data;
    const [[u]] = await db.query("SELECT COUNT(*) n FROM users WHERE status <> 'deleted'");
    const [[rv]] = await db.query("SELECT (SELECT COUNT(*) FROM reviews WHERE status='visible') + (SELECT COUNT(*) FROM video_reviews WHERE status='visible') AS n");
    const [[rp]] = await db.query("SELECT COUNT(*) n FROM reports WHERE status='open'");
    const [[pl]] = await db.query("SELECT COUNT(*) n FROM places WHERE status='published' AND deleted_at IS NULL");
    expect(s.users.total).toBe(u.n);
    expect(s.users.byRole).toMatchObject({ admin: expect.any(Number), moderator: expect.any(Number), user: expect.any(Number) });
    expect(s.reviews.visible).toBe(Number(rv.n));
    expect(s.reports.open).toBe(rp.n);
    expect(s.content.places.published).toBe(pl.n);
    expect(s.pendingModeration.places).toBe(s.content.places.pending ?? 0);
    expect(s.reviewsPerDay.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.day) && d.count > 0)).toBe(true);
    expect(s.topRated.places.every((p) => p.reviewCount >= 3)).toBe(true);
    expect(JSON.stringify(s)).not.toMatch(/password|\$2[aby]\$/i);
  });
  it('audit lista acciones con actor, filtra y pagina; los demás roles no acceden', async () => {
    const admin = await staffAuth('admin');
    await api().patch('/api/v1/admin/settings').set(admin).send({ account_deletion_grace_days: 14 });
    const all = (await api().get('/api/v1/admin/audit?pageSize=5').set(admin)).body.data;
    expect(all.items.length).toBeGreaterThan(0);
    expect(all.items[0]).toMatchObject({ action: expect.any(String), actor: expect.any(Object), createdAt: expect.any(String) });
    expect(all.items.map((i) => i.id)).toEqual([...all.items.map((i) => i.id)].sort((a, b) => b - a));
    const settings = (await api().get('/api/v1/admin/audit?action=settings&pageSize=100').set(admin)).body.data.items;
    expect(settings.length).toBeGreaterThan(0);
    expect(settings.every((i) => i.action.startsWith('settings'))).toBe(true);
    expect((await api().get('/api/v1/admin/audit?actorId=1&entityType=settings').set(admin)).body.data.items.every((i) => i.actor.id === 1)).toBe(true);
    expect((await api().get('/api/v1/admin/audit').set(await staffAuth('moderator'))).status).toBe(403);
  });
});
