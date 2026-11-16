import { describe, it, expect, afterAll } from 'vitest';
import { api, db, freshContent, staffAuth, verifiedUser, uniq } from './helpers.js';

afterAll(() => db.end());
const versions = async () => (await api().get('/api/v1/changes')).body.data;

describe('aviso de cambios (actualización automática de la app)', () => {
  it('es público, no se cachea y devuelve una versión por tema', async () => {
    const r = await api().get('/api/v1/changes');
    expect(r.status).toBe(200);
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.body.data).toEqual({ content: expect.any(String), reviews: expect.any(String) });
  });

  it('un alta o una moderación cambian "content"; las lecturas y los errores no', async () => {
    const mod = await staffAuth('moderator');
    const a = await versions();
    await api().get('/api/v1/places'); await api().get('/api/v1/home');
    expect(await versions()).toEqual(a);

    expect((await api().post('/api/v1/videos').set(mod).send({ title: 'x' })).status).toBe(400); // falla: no cuenta
    expect(await versions()).toEqual(a);

    const id = await freshContent('video');
    const b = await versions();
    expect(b.content).not.toBe(a.content);
    expect(b.reviews).toBe(a.reviews);

    expect((await api().post(`/api/v1/moderation/video/${id}/hide`).set(mod).send({})).status).toBe(200);
    expect((await versions()).content).not.toBe(b.content);
  });

  it('una reseña cambia "reviews" (y "content", porque cambia el promedio de las tarjetas)', async () => {
    const id = await freshContent('place');
    const u = await verifiedUser();
    const a = await versions();
    const r = await api().post(`/api/v1/places/${id}/reviews`).set(u.auth).send({ rating: 4, comment: uniq('Muy bueno') });
    expect(r.status).toBe(201);
    const b = await versions();
    expect(b.reviews).not.toBe(a.reviews);
    expect(b.content).not.toBe(a.content);

    const del = await api().delete(`/api/v1/reviews/${r.body.data.review.id}`).set(u.auth);
    expect(del.status).toBe(204);
    expect((await versions()).reviews).not.toBe(b.reviews);
  });
});
