import { describe, it, expect, afterAll } from 'vitest';
import { api, verifiedUser, registerUser, asUser, staffAuth, freshContent, expectAggregates, db } from './helpers.js';

afterAll(() => db.end());
const R = '/api/v1/reports';
const M = '/api/v1/moderation';
const report = (auth, o) => api().post(R).set(auth).send({ reason: 'spam', ...o });
async function reviewOn(kind, id, rating = 1) {
  const author = await verifiedUser();
  const route = { place: 'places', product: 'products', video: 'videos' }[kind];
  const r = await api().post(`/api/v1/${route}/${id}/reviews`).set(author.auth).send({ rating, comment: 'Contenido reportable' });
  return { author, review: r.body.data.review };
}

describe('crear reportes', () => {
  it('exige sesión y correo verificado; valida motivo y objetivo', async () => {
    const id = await freshContent('place');
    expect((await api().post(R).send({ targetType: 'place', targetId: id, reason: 'spam' })).status).toBe(401);
    expect((await report(asUser((await registerUser()).accessToken), { targetType: 'place', targetId: id })).body.error.code).toBe('EMAIL_NOT_VERIFIED');
    const { auth } = await verifiedUser();
    expect((await report(auth, { targetType: 'place', targetId: id, reason: 'molesto' })).status).toBe(400);
    expect((await report(auth, { targetType: 'usuario', targetId: id })).status).toBe(400);
    expect((await report(auth, { targetType: 'place', targetId: id, details: 'x'.repeat(1001) })).status).toBe(400);
    expect((await report(auth, { targetType: 'place', targetId: 999999 })).status).toBe(404);
    expect((await report(auth, { targetType: 'place', targetId: 10 })).status).toBe(404);          // pendiente: no es público
  });
  it('un usuario reporta lugar, producto, video y reseñas; queda abierto', async () => {
    const { auth } = await verifiedUser();
    for (const kind of ['place', 'product', 'video']) {
      const id = await freshContent(kind);
      const r = await report(auth, { targetType: kind, targetId: id, reason: 'inaccurate', details: 'Datos erróneos' });
      expect(r.status).toBe(201);
      expect(r.body.data.report).toMatchObject({ status: 'open', reason: 'inaccurate', target: { type: kind, id }, handledBy: null });
    }
    const pl = await freshContent('place');
    const { review } = await reviewOn('place', pl);
    expect((await report(auth, { targetType: 'review', targetId: review.id })).body.data.report.target).toMatchObject({ type: 'review', id: review.id });
    const vi = await freshContent('video');
    const vr = await reviewOn('video', vi);
    expect((await report(auth, { targetType: 'video_review', targetId: vr.review.id })).status).toBe(201);
  });
  it('no permite reportar lo propio ni reportar dos veces lo mismo; /reports/mine lista los míos', async () => {
    const author = await verifiedUser(); const other = await verifiedUser();
    const pl = (await api().post('/api/v1/places').set(author.auth).send({ name: `P ${Date.now()}`, categoryId: 2, cityId: 1 })).body.data.place;
    await api().post(`${M}/place/${pl.id}/approve`).set(await staffAuth('moderator')).send({});
    expect((await report(author.auth, { targetType: 'place', targetId: pl.id })).body.error.code).toBe('SELF_REPORT');
    expect((await report(other.auth, { targetType: 'place', targetId: pl.id })).status).toBe(201);
    expect((await report(other.auth, { targetType: 'place', targetId: pl.id })).body.error.code).toBe('ALREADY_REPORTED');
    const { review } = await reviewOn('place', await freshContent('place'));
    expect((await report((await verifiedUser()).auth, { targetType: 'review', targetId: review.id })).status).toBe(201);
    const mine = await api().get(`${R}/mine`).set(other.auth);
    expect(mine.body.data.total).toBe(1);
    expect((await api().get(`${R}/mine`).set(author.auth)).body.data.total).toBe(0);
  });
  it('una reseña propia no se puede reportar; una reseña oculta tampoco', async () => {
    const id = await freshContent('place');
    const { author, review } = await reviewOn('place', id);
    expect((await report(author.auth, { targetType: 'review', targetId: review.id })).body.error.code).toBe('SELF_REPORT');
    await api().post(`${M}/review/${review.id}/hide`).set(await staffAuth('moderator')).send({});
    expect((await report((await verifiedUser()).auth, { targetType: 'review', targetId: review.id })).status).toBe(404);
  });
});

describe('gestión de reportes (moderador/administrador)', () => {
  it('un usuario común no accede a la cola ni resuelve (403); sin sesión 401', async () => {
    const { auth } = await verifiedUser();
    expect((await api().get(`${M}/reports`)).status).toBe(401);
    expect((await api().get(`${M}/reports`).set(auth)).status).toBe(403);
    expect((await api().post(`${M}/reports/1/resolve`).set(auth).send({})).status).toBe(403);
    expect((await api().post(`${M}/reports/1/dismiss`).set(auth).send({})).status).toBe(403);
  });
  it('la cola muestra abiertos (más antiguos primero) con el objetivo y quien reportó; el detalle funciona', async () => {
    const mod = await staffAuth('moderator');
    const id = await freshContent('place');
    const a = await verifiedUser();
    const rep = (await report(a.auth, { targetType: 'place', targetId: id, details: 'Está duplicado' })).body.data.report;
    const q = (await api().get(`${M}/reports?pageSize=100`).set(mod)).body.data;
    expect(q.items.every((r) => r.status === 'open')).toBe(true);
    expect(q.items.find((r) => r.id === rep.id)).toMatchObject({ target: { type: 'place', id, status: 'published' }, reporter: { id: a.user.id } });
    expect((await api().get(`${M}/reports/${rep.id}`).set(mod)).body.data.report.details).toBe('Está duplicado');
    expect((await api().get(`${M}/reports?targetType=review&pageSize=100`).set(mod)).body.data.items.every((r) => r.target.type === 'review')).toBe(true);
    expect((await api().get(`${M}/reports/999999`).set(mod)).status).toBe(404);
  });
  it('descartar cierra el reporte sin tocar el contenido y queda en el historial', async () => {
    const mod = await staffAuth('moderator');
    const id = await freshContent('product');
    const rep = (await report((await verifiedUser()).auth, { targetType: 'product', targetId: id })).body.data.report;
    const r = await api().post(`${M}/reports/${rep.id}/dismiss`).set(mod).send({ note: 'No infringe las normas' });
    expect(r.body.data.report).toMatchObject({ status: 'dismissed', resolutionNote: 'No infringe las normas', handledBy: { id: 2 } });
    expect((await api().get(`/api/v1/products/${id}`)).status).toBe(200);
    expect((await api().post(`${M}/reports/${rep.id}/dismiss`).set(mod).send({})).body.error.code).toBe('ALREADY_HANDLED');
    expect((await api().post(`${M}/reports/${rep.id}/resolve`).set(mod).send({})).body.error.code).toBe('ALREADY_HANDLED');
    const [[l]] = await db.query("SELECT COUNT(*) n FROM moderation_logs WHERE action='dismiss_report' AND target_id = ?", [rep.id]);
    expect(l.n).toBe(1);
  });
  it('resolver con hideTarget oculta el contenido y cierra los demás reportes sobre él', async () => {
    const mod = await staffAuth('moderator');
    const id = await freshContent('video');
    const r1 = (await report((await verifiedUser()).auth, { targetType: 'video', targetId: id, reason: 'illegal' })).body.data.report;
    const r2 = (await report((await verifiedUser()).auth, { targetType: 'video', targetId: id, reason: 'spam' })).body.data.report;
    const res = await api().post(`${M}/reports/${r1.id}/resolve`).set(mod).send({ note: 'Contenido ilegal', hideTarget: true });
    expect(res.body.data.report.status).toBe('resolved');
    expect((await api().get(`/api/v1/videos/${id}`)).status).toBe(404);                              // ya no es público
    expect((await api().get(`${M}/reports/${r2.id}`).set(mod)).body.data.report.status).toBe('resolved'); // el otro reporte se cerró
    const [logs] = await db.query("SELECT action FROM moderation_logs WHERE (target_type='video' AND target_id = ?) OR (target_type='report' AND target_id = ?)", [id, r1.id]);
    expect(logs.map((x) => x.action).sort()).toEqual(['hide', 'resolve_report']);
  });
  it('resolver con hideTarget sobre una reseña la oculta y recalcula el promedio', async () => {
    const mod = await staffAuth('moderator');
    const id = await freshContent('place');
    const bad = await reviewOn('place', id, 1); await reviewOn('place', id, 5);
    expect(await expectAggregates('place', id)).toEqual({ avg: 3, count: 2 });
    const rep = (await report((await verifiedUser()).auth, { targetType: 'review', targetId: bad.review.id, reason: 'offensive' })).body.data.report;
    await api().post(`${M}/reports/${rep.id}/resolve`).set(mod).send({ hideTarget: true });
    expect(await expectAggregates('place', id)).toEqual({ avg: 5, count: 1 });
    expect((await api().get(`/api/v1/reviews/${bad.review.id}`)).status).toBe(404);
  });
  it('resolver SIN hideTarget deja el contenido publicado; el administrador también puede gestionar', async () => {
    const id = await freshContent('place');
    const rep = (await report((await verifiedUser()).auth, { targetType: 'place', targetId: id })).body.data.report;
    const res = await api().post(`${M}/reports/${rep.id}/resolve`).set(await staffAuth('admin')).send({ note: 'Se corrigió el dato' });
    expect(res.body.data.report).toMatchObject({ status: 'resolved', handledBy: { id: 1 } });
    expect((await api().get(`/api/v1/places/${id}`)).status).toBe(200);
  });
  it('los reportes sobreviven si el contenido se elimina? Se eliminan junto con la reseña (cascada) sin dejar huérfanos', async () => {
    const id = await freshContent('place');
    const { author, review } = await reviewOn('place', id);
    const rep = (await report((await verifiedUser()).auth, { targetType: 'review', targetId: review.id })).body.data.report;
    await api().delete(`/api/v1/reviews/${review.id}`).set(author.auth);
    const [[c]] = await db.query('SELECT COUNT(*) n FROM reports WHERE id = ?', [rep.id]);
    expect(c.n).toBe(0);
  });
});
