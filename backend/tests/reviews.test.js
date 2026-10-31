import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { api, verifiedUser, registerUser, asUser, staffAuth, freshContent, expectAggregates, PNG, db } from './helpers.js';

afterAll(() => db.end());
const ROUTES = { place: 'places', product: 'products', video: 'videos' };
const post = (kind, id, auth, body = { rating: 4, comment: 'Muy buen lugar' }) => api().post(`/api/v1/${ROUTES[kind]}/${id}/reviews`).set(auth).send(body);
const list = (kind, id, q = '', auth = {}) => api().get(`/api/v1/${ROUTES[kind]}/${id}/reviews${q}`).set(auth);
const rid = (kind) => (kind === 'video' ? 'video-reviews' : 'reviews');

describe.each(['place', 'product', 'video'])('reseñas de %s: alta y promedios', (kind) => {
  it('exige sesión y correo verificado; valida puntuación (1-5 entero) y comentario', async () => {
    const id = await freshContent(kind);
    expect((await api().post(`/api/v1/${ROUTES[kind]}/${id}/reviews`).send({ rating: 4, comment: 'abc' })).status).toBe(401);
    expect((await post(kind, id, asUser((await registerUser()).accessToken))).body.error.code).toBe('EMAIL_NOT_VERIFIED');
    const { auth } = await verifiedUser();
    for (const bad of [{ rating: 0, comment: 'abcd' }, { rating: 6, comment: 'abcd' }, { rating: 3.5, comment: 'abcd' }, { rating: '4', comment: 'abcd' }, { rating: 4, comment: 'ab' }, { rating: 4, comment: '   ' }, { rating: 4, comment: 'abcd', status: 'visible' }]) {
      expect((await post(kind, id, auth, bad)).status).toBe(400);
    }
  });
  it('crea la reseña, recalcula el promedio y no permite una segunda del mismo usuario', async () => {
    const id = await freshContent(kind);
    const a = await verifiedUser(); const b = await verifiedUser();
    const r1 = await post(kind, id, a.auth, { rating: 5, comment: 'Excelente' });
    expect(r1.status).toBe(201);
    expect(r1.body.data.review).toMatchObject({ rating: 5, status: 'visible', isMine: true, target: { kind, id }, author: { id: a.user.id } });
    expect(await expectAggregates(kind, id)).toEqual({ avg: 5, count: 1 });
    await post(kind, id, b.auth, { rating: 2, comment: 'Regular' });
    expect(await expectAggregates(kind, id)).toEqual({ avg: 3.5, count: 2 });
    const dup = await post(kind, id, a.auth);
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('REVIEW_EXISTS');
  });
  it('no se puede reseñar contenido pendiente, oculto, dado de baja ni inexistente', async () => {
    const { auth } = await verifiedUser();
    const pending = { place: 10, product: 10, video: 6 }[kind];
    expect((await post(kind, pending, auth)).status).toBe(404);
    expect((await post(kind, 999999, auth)).status).toBe(404);
    const id = await freshContent(kind);
    const admin = await staffAuth('admin');
    await api().delete(`/api/v1/${ROUTES[kind]}/${id}`).set(admin);
    expect((await post(kind, id, auth)).status).toBe(404);
  });
  it('lista paginada con resumen, distribución, orden y filtro por puntuación; incluye "mi reseña"', async () => {
    const id = await freshContent(kind);
    const users = await Promise.all([1, 2, 3, 4, 5].map(() => verifiedUser()));
    for (const [i, u] of users.entries()) await post(kind, id, u.auth, { rating: i + 1, comment: `Comentario ${i + 1}` });
    const r = await list(kind, id, '?pageSize=2&sort=rating_desc', users[0].auth);
    expect(r.body.data.items.map((x) => x.rating)).toEqual([5, 4]);
    expect(r.body.data).toMatchObject({ total: 5, totalPages: 3, summary: { avgRating: 3, reviewCount: 5, distribution: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 } } });
    expect(r.body.data.myReview).toMatchObject({ rating: 1, isMine: true });
    expect((await list(kind, id, '?sort=oldest')).body.data.items[0].rating).toBe(1);
    expect((await list(kind, id, '?rating=3')).body.data.items.map((x) => x.rating)).toEqual([3]);
    expect((await list(kind, id)).body.data.myReview).toBeNull();
    expect((await list(kind, id, '?sort=raro')).status).toBe(400);
  });
});

describe('edición y baja', () => {
  it('el autor edita (promedio se actualiza); otro usuario recibe 403', async () => {
    const id = await freshContent('place');
    const a = await verifiedUser(); const b = await verifiedUser();
    const rev = (await post('place', id, a.auth, { rating: 2, comment: 'Meh' })).body.data.review;
    expect((await api().patch(`/api/v1/reviews/${rev.id}`).set(b.auth).send({ rating: 5 })).status).toBe(403);
    const up = await api().patch(`/api/v1/reviews/${rev.id}`).set(a.auth).send({ rating: 5, comment: 'Mejoró mucho' });
    expect(up.body.data.review).toMatchObject({ rating: 5, comment: 'Mejoró mucho' });
    expect(await expectAggregates('place', id)).toEqual({ avg: 5, count: 1 });
    expect((await api().patch(`/api/v1/reviews/${rev.id}`).set(a.auth).send({})).status).toBe(400);
    expect((await api().patch(`/api/v1/reviews/${rev.id}`).set(a.auth).send({ rating: 9 })).status).toBe(400);
    expect((await api().patch(`/api/v1/reviews/${rev.id}`).set(a.auth).send({ status: 'hidden' })).status).toBe(400); // no puede cambiar su propio estado
  });
  it('el autor elimina (promedio vuelve a 0 y puede reseñar de nuevo); el moderador no puede eliminar, el admin sí', async () => {
    const id = await freshContent('product');
    const a = await verifiedUser(); const b = await verifiedUser();
    const r1 = (await post('product', id, a.auth)).body.data.review;
    const r2 = (await post('product', id, b.auth)).body.data.review;
    expect((await api().delete(`/api/v1/reviews/${r1.id}`).set(b.auth)).status).toBe(403);
    expect((await api().delete(`/api/v1/reviews/${r1.id}`).set(await staffAuth('moderator'))).status).toBe(403);
    expect((await api().delete(`/api/v1/reviews/${r1.id}`).set(a.auth)).status).toBe(204);
    expect(await expectAggregates('product', id)).toMatchObject({ count: 1 });
    expect((await api().get(`/api/v1/reviews/${r1.id}`)).status).toBe(404);
    expect((await post('product', id, a.auth, { rating: 1, comment: 'Segunda oportunidad' })).status).toBe(201);
    expect((await api().delete(`/api/v1/reviews/${r2.id}`).set(await staffAuth('admin'))).status).toBe(204);
    const [[audit]] = await db.query("SELECT COUNT(*) n FROM audit_logs WHERE action = 'review.deleted' AND entity_id = ?", [r2.id]);
    expect(audit.n).toBe(1);
    await expectAggregates('product', id);
  });
  it('reseñas de video: mismo flujo con su propia tabla', async () => {
    const id = await freshContent('video');
    const a = await verifiedUser();
    const r = (await post('video', id, a.auth, { rating: 3, comment: 'Está bien' })).body.data.review;
    expect(r.type).toBe('video_review');
    expect((await api().patch(`/api/v1/video-reviews/${r.id}`).set(a.auth).send({ rating: 4 })).body.data.review.rating).toBe(4);
    expect((await api().delete(`/api/v1/video-reviews/${r.id}`).set(a.auth)).status).toBe(204);
    expect(await expectAggregates('video', id)).toEqual({ avg: 0, count: 0 });
    expect((await api().post(`/api/v1/video-reviews/${r.id}/images`).set(a.auth).attach('image', PNG, 'a.png')).status).toBe(404); // los videos no admiten fotos
    expect(rid('video')).toBe('video-reviews');
  });
});

describe('moderación de reseñas y premoderación', () => {
  it('ocultar saca la reseña del promedio y del listado público; restaurar la devuelve', async () => {
    const id = await freshContent('place');
    const a = await verifiedUser(); const b = await verifiedUser();
    const r1 = (await post('place', id, a.auth, { rating: 1, comment: 'Reseña abusiva' })).body.data.review;
    await post('place', id, b.auth, { rating: 5, comment: 'Genial' });
    expect(await expectAggregates('place', id)).toEqual({ avg: 3, count: 2 });
    const mod = await staffAuth('moderator');
    expect((await api().post(`/api/v1/moderation/review/${r1.id}/hide`).set(mod).send({ note: 'Insultos' })).body.data.status).toBe('hidden');
    expect(await expectAggregates('place', id)).toEqual({ avg: 5, count: 1 });
    expect((await list('place', id)).body.data.items).toHaveLength(1);
    expect((await api().get(`/api/v1/reviews/${r1.id}`)).status).toBe(404);                         // público: no existe
    expect((await api().get(`/api/v1/reviews/${r1.id}`).set(a.auth)).body.data.review.status).toBe('hidden'); // el autor sí la ve
    expect((await list('place', id, '?status=hidden', mod)).body.data.items).toHaveLength(1);
    expect((await list('place', id, '?status=hidden', b.auth)).body.data.items.every((x) => x.status === 'visible')).toBe(true); // un usuario común nunca obtiene ocultas
    // el autor puede corregir el texto pero NO reactivarla
    expect((await api().patch(`/api/v1/reviews/${r1.id}`).set(a.auth).send({ comment: 'Pido disculpas' })).body.data.review.status).toBe('hidden');
    expect(await expectAggregates('place', id)).toEqual({ avg: 5, count: 1 });
    expect((await api().post(`/api/v1/moderation/review/${r1.id}/restore`).set(mod).send({})).body.data.status).toBe('visible');
    expect(await expectAggregates('place', id)).toEqual({ avg: 3, count: 2 });
    expect((await api().post(`/api/v1/moderation/review/${r1.id}/restore`).set(mod).send({})).body.error.code).toBe('INVALID_TRANSITION');
    expect((await api().post(`/api/v1/moderation/review/${r1.id}/reject`).set(mod).send({ note: 'no aplica' })).body.error.code).toBe('INVALID_ACTION');
    expect((await api().post(`/api/v1/moderation/review/${r1.id}/hide`).set(a.auth).send({})).status).toBe(403);
  });
  it('con premoderación las reseñas nuevas quedan pendientes, no cuentan y se aprueban desde la cola', async () => {
    const admin = await staffAuth('admin'); const mod = await staffAuth('moderator');
    const id = await freshContent('place');
    const a = await verifiedUser();
    await api().patch('/api/v1/admin/settings').set(admin).send({ premoderate_reviews: true });
    try {
      const r = (await post('place', id, a.auth, { rating: 5, comment: 'Pendiente de revisión' })).body.data.review;
      expect(r.status).toBe('pending');
      expect(await expectAggregates('place', id)).toEqual({ avg: 0, count: 0 });
      expect((await list('place', id)).body.data.items).toHaveLength(0);
      expect((await list('place', id, '', a.auth)).body.data.myReview.status).toBe('pending');
      const queue = (await api().get('/api/v1/moderation/reviews?pageSize=100').set(mod)).body.data.items;
      expect(queue.find((q) => q.id === r.id)).toMatchObject({ target: { kind: 'place', id }, author: { id: a.user.id } });
      await api().post(`/api/v1/moderation/review/${r.id}/approve`).set(mod).send({});
      expect(await expectAggregates('place', id)).toEqual({ avg: 5, count: 1 });
      // editar con premoderación vuelve a revisión y sale del promedio
      expect((await api().patch(`/api/v1/reviews/${r.id}`).set(a.auth).send({ comment: 'Texto cambiado' })).body.data.review.status).toBe('pending');
      expect(await expectAggregates('place', id)).toEqual({ avg: 0, count: 0 });
    } finally { await api().patch('/api/v1/admin/settings').set(admin).send({ premoderate_reviews: false }); }
    // el staff no pasa por premoderación
    const id2 = await freshContent('place');
    await api().patch('/api/v1/admin/settings').set(admin).send({ premoderate_reviews: true });
    try { expect((await post('place', id2, mod)).body.data.review.status).toBe('visible'); }
    finally { await api().patch('/api/v1/admin/settings').set(admin).send({ premoderate_reviews: false }); }
  });
  it('si el contenido deja de ser público, sus reseñas dejan de listarse', async () => {
    const id = await freshContent('place'); const a = await verifiedUser();
    const rev = (await post('place', id, a.auth)).body.data.review;
    await api().post(`/api/v1/moderation/place/${id}/hide`).set(await staffAuth('moderator')).send({});
    expect((await list('place', id)).status).toBe(404);
    expect((await api().get(`/api/v1/reviews/${rev.id}`)).status).toBe(404);
  });
});

describe('integridad bajo concurrencia', () => {
  it('12 reseñas simultáneas de usuarios distintos dejan el promedio exacto', async () => {
    const id = await freshContent('place');
    const users = await Promise.all(Array.from({ length: 12 }, () => verifiedUser()));
    const res = await Promise.all(users.map((u, i) => post('place', id, u.auth, { rating: (i % 5) + 1, comment: `Concurrente ${i}` })));
    expect(res.map((r) => r.status)).toEqual(Array(12).fill(201));
    const agg = await expectAggregates('place', id);
    expect(agg.count).toBe(12);
  });
  it('dos envíos simultáneos del MISMO usuario crean una sola reseña', async () => {
    const id = await freshContent('product'); const a = await verifiedUser();
    const res = await Promise.all([post('product', id, a.auth), post('product', id, a.auth), post('product', id, a.auth)]);
    expect(res.map((r) => r.status).sort()).toEqual([201, 409, 409]);
    expect(await expectAggregates('product', id)).toMatchObject({ count: 1 });
  });
  it('crear, editar y moderar a la vez no corrompe ni interbloquea', async () => {
    const id = await freshContent('place');
    const a = await verifiedUser(); const b = await verifiedUser(); const c = await verifiedUser();
    const mod = await staffAuth('moderator');
    const ra = (await post('place', id, a.auth, { rating: 1, comment: 'primera' })).body.data.review;
    const results = await Promise.all([
      api().patch(`/api/v1/reviews/${ra.id}`).set(a.auth).send({ rating: 5 }),
      post('place', id, b.auth, { rating: 3, comment: 'segunda' }),
      post('place', id, c.auth, { rating: 4, comment: 'tercera' }),
      api().post(`/api/v1/moderation/review/${ra.id}/hide`).set(mod).send({}),
    ]);
    expect(results.every((r) => r.status < 500)).toBe(true);
    await expectAggregates('place', id);
  });
});

describe('fotos de la reseña', () => {
  it('el autor sube fotos (se listan y se sirven), con límite de 4; al borrar la reseña se borran los archivos', async () => {
    const id = await freshContent('place'); const a = await verifiedUser(); const b = await verifiedUser();
    const rev = (await post('place', id, a.auth)).body.data.review;
    const url = `/api/v1/reviews/${rev.id}/images`;
    const up = await api().post(url).set(a.auth).attach('image', PNG, { filename: 'f.png', contentType: 'image/png' });
    expect(up.status).toBe(201);
    const file = path.resolve(process.env.UPLOADS_DIR, new URL(up.body.data.image.url).pathname.replace('/uploads/', ''));
    await expect(fs.access(file)).resolves.toBeUndefined();
    expect((await api().get(new URL(up.body.data.image.url).pathname)).headers['content-type']).toBe('image/png');
    expect((await list('place', id)).body.data.items[0].images).toHaveLength(1);
    expect((await api().post(url).set(b.auth).attach('image', PNG, 'f.png')).status).toBe(403);   // otra persona no puede
    expect((await api().post(url).set(a.auth).attach('image', Buffer.from('no es imagen'), { filename: 'f.png', contentType: 'image/png' })).body.error.code).toBe('INVALID_IMAGE');
    for (let i = 0; i < 3; i++) expect((await api().post(url).set(a.auth).attach('image', PNG, 'f.png')).status).toBe(201);
    expect((await api().post(url).set(a.auth).attach('image', PNG, 'f.png')).body.error.code).toBe('TOO_MANY_IMAGES');
    expect((await api().delete(`${url}/${up.body.data.image.id}`).set(a.auth)).status).toBe(204);
    await expect(fs.access(file)).rejects.toThrow();
    const [[before]] = await db.query('SELECT COUNT(*) n FROM review_images WHERE review_id = ?', [rev.id]);
    expect(before.n).toBe(3);
    await api().delete(`/api/v1/reviews/${rev.id}`).set(a.auth);
    const [[after]] = await db.query('SELECT COUNT(*) n FROM review_images WHERE review_id = ?', [rev.id]);
    expect(after.n).toBe(0);
  });
});

describe('mis reseñas', () => {
  it('lista las reseñas propias por tipo con el nombre del contenido', async () => {
    const id = await freshContent('place'); const a = await verifiedUser();
    await post('place', id, a.auth, { rating: 4, comment: 'Mía' });
    const r = await api().get('/api/v1/users/me/reviews?kind=place').set(a.auth);
    expect(r.body.data.total).toBe(1);
    expect(r.body.data.items[0]).toMatchObject({ rating: 4, isMine: true, target: { kind: 'place', id } });
    expect(r.body.data.items[0].target.name).toBeTruthy();
    expect((await api().get('/api/v1/users/me/reviews?kind=video').set(a.auth)).body.data.total).toBe(0);
    expect((await api().get('/api/v1/users/me/reviews').set(a.auth)).status).toBe(400);
  });
});
