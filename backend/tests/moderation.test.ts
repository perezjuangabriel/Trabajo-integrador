import { describe, it, expect, afterAll } from 'vitest';
import { api, verifiedUser, registerUser, asUser, staffAuth, placeBody, db } from './helpers.js';

afterAll(() => db.end());
const M = '/api/v1/moderation';
const propose = async (auth) => (await api().post('/api/v1/places').set(auth).send(placeBody())).body.data.place;

describe('permisos de moderación (validados en el servidor)', () => {
  it('sin sesión 401, usuario 403, moderador y admin 200', async () => {
    const { accessToken } = await registerUser();
    expect((await api().get(`${M}/queue?kind=place`)).status).toBe(401);
    expect((await api().get(`${M}/queue?kind=place`).set(asUser(accessToken))).status).toBe(403);
    expect((await api().post(`${M}/place/1/hide`).set(asUser(accessToken)).send({})).status).toBe(403);
    expect((await api().get(`${M}/queue?kind=place`).set(await staffAuth('moderator'))).status).toBe(200);
    expect((await api().get(`${M}/queue?kind=place`).set(await staffAuth('admin'))).status).toBe(200);
  });
  it('valida tipo y acción', async () => {
    const mod = await staffAuth('moderator');
    expect((await api().get(`${M}/queue?kind=review`).set(mod)).status).toBe(400);
    expect((await api().post(`${M}/place/1/borrar`).set(mod).send({})).status).toBe(400);
    expect((await api().post(`${M}/place/999999/approve`).set(mod).send({})).status).toBe(404);
  });
});

describe('flujo de revisión de propuestas', () => {
  it('la cola lista pendientes (más antiguos primero) y aprobar publica con fecha y registra el historial', async () => {
    const { auth } = await verifiedUser();
    const a = await propose(auth); const b = await propose(auth);
    const mod = await staffAuth('moderator');
    const q = (await api().get(`${M}/queue?kind=place&pageSize=100`).set(mod)).body.data;
    expect(q.items.every((i) => i.status === 'pending')).toBe(true);
    const order = q.items.map((i) => i.id);
    expect(order.indexOf(a.id)).toBeLessThan(order.indexOf(b.id));
    const ok = await api().post(`${M}/place/${a.id}/approve`).set(mod).send({});
    expect(ok.body.data).toEqual({ id: a.id, kind: 'place', status: 'published' });
    const pub = (await api().get(`/api/v1/places/${a.id}`)).body.data.place;
    expect(pub.status).toBe('published');
    expect(pub.publishedAt).toBeTruthy();
    const [[log]] = await db.query("SELECT moderator_id, action FROM moderation_logs WHERE target_type='place' AND target_id=?", [a.id]);
    expect(log).toEqual({ moderator_id: 2, action: 'approve' });
  });
  it('rechazar exige motivo; el autor lo ve, el público no', async () => {
    const { auth } = await verifiedUser();
    const p = await propose(auth);
    const mod = await staffAuth('moderator');
    expect((await api().post(`${M}/place/${p.id}/reject`).set(mod).send({})).body.error.code).toBe('NOTE_REQUIRED');
    expect((await api().post(`${M}/place/${p.id}/reject`).set(mod).send({ note: 'Duplicado de otro spot' })).body.data.status).toBe('rejected');
    const mine = (await api().get('/api/v1/users/me/submissions?kind=place&status=rejected').set(auth)).body.data.items[0];
    expect(mine).toMatchObject({ id: p.id, status: 'rejected', rejectionReason: 'Duplicado de otro spot' });
    expect((await api().get(`/api/v1/places/${p.id}`)).status).toBe(404);
  });
  it('ocultar saca del listado público y restaurar lo devuelve; las transiciones inválidas dan 409', async () => {
    const mod = await staffAuth('moderator');
    const p = (await api().post('/api/v1/places').set(mod).send(placeBody())).body.data.place;
    expect((await api().post(`${M}/place/${p.id}/restore`).set(mod).send({})).body.error.code).toBe('INVALID_TRANSITION'); // no está oculto
    expect((await api().post(`${M}/place/${p.id}/approve`).set(mod).send({})).status).toBe(409);                           // ya publicado
    await api().post(`${M}/place/${p.id}/hide`).set(mod).send({ note: 'Contenido inapropiado' });
    expect((await api().get(`/api/v1/places?q=${encodeURIComponent(p.name)}`)).body.data.total).toBe(0);
    expect((await api().get(`/api/v1/places/${p.id}`)).status).toBe(404);
    expect((await api().get(`/api/v1/places?status=hidden&pageSize=100`).set(mod)).body.data.items.map((i) => i.id)).toContain(p.id);
    await api().post(`${M}/place/${p.id}/restore`).set(mod).send({});
    expect((await api().get(`/api/v1/places/${p.id}`)).status).toBe(200);
  });
  it('un usuario común no obtiene datos de moderación aunque pase ?status=pending', async () => {
    const { auth } = await verifiedUser();
    const r = await api().get('/api/v1/places?status=pending&pageSize=100').set(auth);
    expect(r.body.data.items.every((i) => i.status === 'published')).toBe(true);
  });
  it('funciona igual para productos y videos', async () => {
    const { auth } = await verifiedUser();
    const mod = await staffAuth('moderator');
    const pr = (await api().post('/api/v1/products').set(auth).send({ name: `Prod ${Date.now()}`, brandId: 1, categoryId: 5 })).body.data.product;
    const vi = (await api().post('/api/v1/videos').set(auth).send({ title: 'Video prueba', url: `https://example.com/v/${Date.now()}`, categoryId: 13 })).body.data.video;
    expect((await api().post(`${M}/product/${pr.id}/approve`).set(mod).send({})).body.data.status).toBe('published');
    expect((await api().post(`${M}/video/${vi.id}/reject`).set(mod).send({ note: 'No es de skate' })).body.data.status).toBe('rejected');
    expect((await api().get(`${M}/queue?kind=video&status=rejected&pageSize=100`).set(mod)).body.data.items.map((i) => i.id)).toContain(vi.id);
  });
});

describe('historial de moderación', () => {
  it('el moderador ve solo el suyo; el administrador ve todo y puede filtrar', async () => {
    const mod = await staffAuth('moderator'); const admin = await staffAuth('admin');
    const { auth } = await verifiedUser();
    const p = await propose(auth);
    await api().post(`${M}/place/${p.id}/approve`).set(admin).send({});     // acción del admin (moderador id 1)
    await api().post(`${M}/place/${(await propose(auth)).id}/approve`).set(mod).send({});
    const own = (await api().get(`${M}/logs?pageSize=100`).set(mod)).body.data.items;
    expect(own.length).toBeGreaterThan(0);
    expect(own.every((l) => l.moderator.id === 2)).toBe(true);
    const all = (await api().get(`${M}/logs?pageSize=100`).set(admin)).body.data.items;
    expect(new Set(all.map((l) => l.moderator?.id)).size).toBeGreaterThan(1);
    expect((await api().get(`${M}/logs?moderatorId=2&pageSize=100`).set(admin)).body.data.items.every((l) => l.moderator.id === 2)).toBe(true);
    expect((await api().get(`${M}/logs?moderatorId=1&pageSize=100`).set(mod)).body.data.items.every((l) => l.moderator.id === 2)).toBe(true); // el filtro no le abre datos ajenos
  });
});
