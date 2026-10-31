import { describe, it, expect, afterAll } from 'vitest';
import { api, verifiedUser, registerUser, asUser, staffAuth, freshContent, db } from './helpers.js';

afterAll(() => db.end());
const F = '/api/v1/favorites';

describe('favoritos', () => {
  it('exige sesión (no el correo verificado) y valida tipo e id', async () => {
    expect((await api().get(`${F}?kind=place`)).status).toBe(401);
    const { accessToken } = await registerUser();                       // correo sin verificar
    const auth = asUser(accessToken);
    const id = await freshContent('place');
    expect((await api().post(F).set(auth).send({ kind: 'place', id })).status).toBe(201);
    expect((await api().post(F).set(auth).send({ kind: 'reseña', id })).status).toBe(400);
    expect((await api().post(F).set(auth).send({ kind: 'place', id: 'x' })).status).toBe(400);
    expect((await api().delete(`${F}/place/abc`).set(auth)).status).toBe(400);
  });
  it('agregar es idempotente: el segundo intento devuelve 200 y NUNCA duplica en la base', async () => {
    const { auth, user } = await verifiedUser(); const id = await freshContent('product');
    expect((await api().post(F).set(auth).send({ kind: 'product', id })).status).toBe(201);
    expect((await api().post(F).set(auth).send({ kind: 'product', id })).status).toBe(200);
    const [[c]] = await db.query('SELECT COUNT(*) n FROM favorites WHERE user_id = ? AND product_id = ?', [user.id, id]);
    expect(c.n).toBe(1);
    const same = await Promise.all([1, 2, 3, 4].map(() => api().post(F).set(auth).send({ kind: 'product', id })));
    expect(same.every((r) => r.status === 200)).toBe(true);
    const [[c2]] = await db.query('SELECT COUNT(*) n FROM favorites WHERE user_id = ? AND product_id = ?', [user.id, id]);
    expect(c2.n).toBe(1);
  });
  it('quitar es idempotente y /favorites/ids devuelve los ids por tipo', async () => {
    const { auth } = await verifiedUser();
    const [p, pr, v] = [await freshContent('place'), await freshContent('product'), await freshContent('video')];
    for (const [kind, id] of [['place', p], ['product', pr], ['video', v]]) await api().post(F).set(auth).send({ kind, id });
    expect((await api().get(`${F}/ids`).set(auth)).body.data).toEqual({ place: [p], product: [pr], video: [v] });
    expect((await api().delete(`${F}/place/${p}`).set(auth)).status).toBe(204);
    expect((await api().delete(`${F}/place/${p}`).set(auth)).status).toBe(204);       // ya no estaba: no es error
    expect((await api().get(`${F}/ids`).set(auth)).body.data.place).toEqual([]);
  });
  it('lista tarjetas paginadas, la más reciente primero; cada usuario ve solo las suyas', async () => {
    const a = await verifiedUser(); const b = await verifiedUser();
    const ids = [await freshContent('place'), await freshContent('place'), await freshContent('place')];
    for (const id of ids) await api().post(F).set(a.auth).send({ kind: 'place', id });
    const r = await api().get(`${F}?kind=place&pageSize=2`).set(a.auth);
    expect(r.body.data).toMatchObject({ total: 3, totalPages: 2 });
    expect(r.body.data.items.map((i) => i.id)).toEqual([ids[2], ids[1]]);
    expect(r.body.data.items[0]).toMatchObject({ slug: expect.any(String), category: expect.any(Object), favoritedAt: expect.any(String) });
    expect((await api().get(`${F}?kind=place`).set(b.auth)).body.data.total).toBe(0);
    expect((await api().get(`${F}?kind=video`).set(a.auth)).body.data.total).toBe(0);
  });
  it('solo se pueden marcar contenidos públicos', async () => {
    const { auth } = await verifiedUser();
    expect((await api().post(F).set(auth).send({ kind: 'place', id: 10 })).status).toBe(404);       // pendiente
    expect((await api().post(F).set(auth).send({ kind: 'place', id: 11 })).status).toBe(404);       // oculto
    expect((await api().post(F).set(auth).send({ kind: 'video', id: 999999 })).status).toBe(404);
  });
  it('si el contenido se oculta desaparece de la lista, pero el favorito se conserva y vuelve al restaurarlo', async () => {
    const { auth, user } = await verifiedUser(); const id = await freshContent('place'); const mod = await staffAuth('moderator');
    await api().post(F).set(auth).send({ kind: 'place', id });
    await api().post(`/api/v1/moderation/place/${id}/hide`).set(mod).send({});
    expect((await api().get(`${F}?kind=place`).set(auth)).body.data.total).toBe(0);
    const [[c]] = await db.query('SELECT COUNT(*) n FROM favorites WHERE user_id = ? AND place_id = ?', [user.id, id]);
    expect(c.n).toBe(1);
    await api().post(`/api/v1/moderation/place/${id}/restore`).set(mod).send({});
    expect((await api().get(`${F}?kind=place`).set(auth)).body.data.items.map((i) => i.id)).toEqual([id]);
  });
});
