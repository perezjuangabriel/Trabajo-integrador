import { describe, it, expect, afterAll } from 'vitest';
import { api, verifiedUser, staffAuth, freshContent, placeBody, db } from './helpers.js';

afterAll(() => db.end());

describe('actividad del usuario', () => {
  it('combina reseñas, favoritos y propuestas, de la más reciente a la más antigua, con paginación', async () => {
    const { auth } = await verifiedUser();
    const pid = await freshContent('place'); const prod = await freshContent('product');
    await api().post(`/api/v1/places/${pid}/reviews`).set(auth).send({ rating: 4, comment: 'Mi reseña' });
    await api().post('/api/v1/favorites').set(auth).send({ kind: 'product', id: prod });
    await api().post('/api/v1/places').set(auth).send(placeBody());                        // propuesta pendiente
    const r = await api().get('/api/v1/users/me/activity?pageSize=2').set(auth);
    expect(r.body.data).toMatchObject({ total: 3, totalPages: 2 });
    expect(r.body.data.items).toHaveLength(2);
    const all = (await api().get('/api/v1/users/me/activity').set(auth)).body.data.items;
    expect(all.map((a) => a.type).sort()).toEqual(['favorite', 'review', 'submission']);
    const times = all.map((a) => new Date(a.at).getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(all.find((a) => a.type === 'review')).toMatchObject({ rating: 4, target: { kind: 'place', id: pid } });
    expect(all.find((a) => a.type === 'submission')).toMatchObject({ status: 'pending' });
  });
  it('no incluye favoritos de contenido que ya no es público y cada usuario ve solo lo suyo', async () => {
    const a = await verifiedUser(); const b = await verifiedUser();
    const id = await freshContent('place');
    await api().post('/api/v1/favorites').set(a.auth).send({ kind: 'place', id });
    await api().post(`/api/v1/moderation/place/${id}/hide`).set(await staffAuth('moderator')).send({});
    expect((await api().get('/api/v1/users/me/activity').set(a.auth)).body.data.total).toBe(0);
    expect((await api().get('/api/v1/users/me/activity').set(b.auth)).body.data.total).toBe(0);
    expect((await api().get('/api/v1/users/me/activity')).status).toBe(401);
  });
});
