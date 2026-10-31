import { describe, it, expect, afterAll } from 'vitest';
import { api, verifiedUser, registerUser, asUser, staffAuth, placeBody, uniq, db } from './helpers.js';

afterAll(() => db.end());
const P = '/api/v1/places';
const ids = (res) => res.body.data.items.map((i) => i.id).sort((a, b) => a - b);
const sqlIds = async (sql, params = []) => (await db.query(sql, params))[0].map((r) => r.id).sort((a, b) => a - b);

describe('listado público de lugares', () => {
  it('solo muestra publicados (no pendientes, ocultos ni dados de baja)', async () => {
    const r = await api().get(`${P}?pageSize=100`);
    expect(r.status).toBe(200);
    expect(ids(r)).toEqual(await sqlIds("SELECT id FROM places WHERE status='published' AND deleted_at IS NULL"));
    expect(r.body.data.items.every((i) => i.status === 'published')).toBe(true);
  });
  it('pagina y devuelve metadatos', async () => {
    const r = await api().get(`${P}?pageSize=3&page=2`);
    expect(r.body.data).toMatchObject({ page: 2, pageSize: 3 });
    expect(r.body.data.items.length).toBeLessThanOrEqual(3);
    expect(r.body.data.totalPages).toBe(Math.ceil(r.body.data.total / 3));
    expect((await api().get(`${P}?pageSize=500`)).status).toBe(400);
  });
  it('filtra por categoría (principal O secundaria), ciudad y zona', async () => {
    const cat = await api().get(`${P}?categoryId=1&pageSize=100`);
    expect(ids(cat)).toEqual(await sqlIds("SELECT p.id FROM places p WHERE p.status='published' AND p.deleted_at IS NULL AND (p.category_id=1 OR EXISTS(SELECT 1 FROM place_categories pc WHERE pc.place_id=p.id AND pc.category_id=1))"));
    expect(ids(cat)).toContain(2); // el lugar 2 es "Plaza" y además "Street" (categoría secundaria)
    expect(ids(await api().get(`${P}?cityId=1&pageSize=100`))).toEqual(await sqlIds("SELECT id FROM places WHERE status='published' AND deleted_at IS NULL AND city_id=1"));
    expect(ids(await api().get(`${P}?zone=nunez`))).toEqual([4]); // sin distinguir tildes: Núñez
  });
  it('filtra por puntuación mínima, cantidad de reseñas y fecha de publicación', async () => {
    const rating = await api().get(`${P}?minRating=4.5&pageSize=100`);
    expect(rating.body.data.items.length).toBeGreaterThan(0);
    expect(rating.body.data.items.every((i) => i.avgRating >= 4.5)).toBe(true);
    const reviews = await api().get(`${P}?minReviews=4&pageSize=100`);
    expect(reviews.body.data.items.every((i) => i.reviewCount >= 4)).toBe(true);
    const date = new Date(Date.now() - 25 * 86400000).toISOString().slice(0, 10);
    expect(ids(await api().get(`${P}?publishedAfter=${date}&pageSize=100`))).toEqual(await sqlIds("SELECT id FROM places WHERE status='published' AND deleted_at IS NULL AND published_at >= ?", [date]));
    expect((await api().get(`${P}?publishedAfter=ayer`)).status).toBe(400);
  });
  it('ordena por puntuación, reseñas y nombre', async () => {
    const byRating = (await api().get(`${P}?sort=rating&pageSize=100`)).body.data.items.map((i) => i.avgRating);
    expect(byRating).toEqual([...byRating].sort((a, b) => b - a));
    const byName = (await api().get(`${P}?sort=name&pageSize=100`)).body.data.items.map((i) => i.name);
    expect(byName).toEqual([...byName].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })));
    expect((await api().get(`${P}?sort=drop_table`)).status).toBe(400);
  });
  it('búsqueda por texto; % es literal y una inyección SQL no devuelve nada ni rompe', async () => {
    expect(ids(await api().get(`${P}?q=bowl`))).toContain(1);
    expect((await api().get(`${P}?q=%25`)).body.data.total).toBe(0);
    const inj = await api().get(`${P}?q=${encodeURIComponent("x' OR '1'='1")}`);
    expect(inj.status).toBe(200);
    expect(inj.body.data.total).toBe(0);
  });
});

describe('detalle y visibilidad', () => {
  it('devuelve el detalle completo por id y por slug', async () => {
    const byId = (await api().get(`${P}/7`)).body.data.place;
    expect(byId).toMatchObject({ id: 7, slug: 'nave-7-indoor', category: { id: 4 }, city: { name: 'Ciudad Autónoma de Buenos Aires' } });
    expect(byId.hours).toContainEqual({ weekday: 1, opensAt: '15:00', closesAt: '22:00' });
    expect(byId.obstacles.length).toBeGreaterThan(0);
    expect((await api().get(`${P}/nave-7-indoor`)).body.data.place.id).toBe(7);
    expect(byId.permissions).toEqual({ canEdit: false, canDelete: false });
  });
  it('pendientes y ocultos son 404 para el público, visibles para su autor y el staff', async () => {
    expect((await api().get(`${P}/10`)).status).toBe(404);   // pendiente (propuesta de Bruno)
    expect((await api().get(`${P}/11`)).status).toBe(404);   // oculto
    expect((await api().get(`${P}/999999`)).status).toBe(404);
    const other = await registerUser();
    expect((await api().get(`${P}/10`).set(asUser(other.accessToken))).status).toBe(404);
    expect((await api().get(`${P}/10`).set(await staffAuth('moderator'))).status).toBe(200);
    const bruno = await api().post('/api/v1/auth/login').send({ email: 'bruno@spotcheck.test', password: 'Demo1234!' });
    expect((await api().get(`${P}/10`).set(asUser(bruno.body.data.accessToken))).status).toBe(200);
  });
});

describe('alta de lugares', () => {
  it('exige sesión y correo verificado', async () => {
    expect((await api().post(P).send(placeBody())).status).toBe(401);
    const { accessToken } = await registerUser(); // correo SIN verificar
    expect((await api().post(P).set(asUser(accessToken)).send(placeBody())).body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });
  it('un usuario crea una propuesta PENDIENTE con todos sus datos relacionados', async () => {
    const { auth, user } = await verifiedUser();
    const r = await api().post(P).set(auth).send(placeBody());
    expect(r.status).toBe(201);
    const p = r.body.data.place;
    expect(p).toMatchObject({ status: 'pending', publishedAt: null, submittedBy: { id: user.id }, surfaceType: { id: 1 }, permissions: { canEdit: true, canDelete: true } });
    expect(p.obstacles.map((o) => o.id).sort()).toEqual([1, 2]);
    expect(p.extraCategories.map((c) => c.id)).toEqual([1]);
    expect(p.hours).toEqual([{ weekday: 1, opensAt: '10:00', closesAt: '20:00' }]);
    expect((await api().get(`${P}/${p.id}`)).status).toBe(404);   // todavía no es público
  });
  it('moderadores y administradores publican directo', async () => {
    const r = await api().post(P).set(await staffAuth('moderator')).send(placeBody());
    expect(r.body.data.place.status).toBe('published');
    expect(r.body.data.place.publishedAt).toBeTruthy();
    expect((await api().get(`${P}/${r.body.data.place.id}`)).status).toBe(200);
  });
  it('si el admin desactiva la moderación, las propuestas se publican solas (y se restaura)', async () => {
    const admin = await staffAuth('admin');
    const { auth } = await verifiedUser();
    await api().patch('/api/v1/admin/settings').set(admin).send({ require_moderation_places: false });
    try {
      expect((await api().post(P).set(auth).send(placeBody())).body.data.place.status).toBe('published');
    } finally {
      await api().patch('/api/v1/admin/settings').set(admin).send({ require_moderation_places: true });
    }
    expect((await api().post(P).set(auth).send(placeBody())).body.data.place.status).toBe('pending');
  });
  it('un usuario NO puede forzar estado, puntuación ni autor (campos extra rechazados)', async () => {
    const { auth } = await verifiedUser();
    for (const extra of [{ status: 'published' }, { avgRating: 5 }, { submittedBy: 1 }]) {
      expect((await api().post(P).set(auth).send(placeBody(extra))).status).toBe(400);
    }
  });
  it('valida referencias y formato', async () => {
    const { auth } = await verifiedUser();
    const post = (o) => api().post(P).set(auth).send(placeBody(o));
    expect((await post({ categoryId: 5 })).body.error.code).toBe('INVALID_CATEGORY');           // categoría de productos
    expect((await post({ categoryIds: [6] })).body.error.code).toBe('INVALID_CATEGORY');
    expect((await post({ cityId: 9999 })).body.error.code).toBe('INVALID_REFERENCE');
    expect((await post({ latitude: 95 })).status).toBe(400);
    expect((await post({ longitude: undefined })).status).toBe(400);                            // latitud sin longitud
    expect((await post({ name: 'ab' })).status).toBe(400);
    expect((await post({ cityId: undefined })).status).toBe(400);                               // falta ciudad
    expect((await post({ newCity: { name: 'X Ciudad' } })).status).toBe(400);                   // cityId y newCity a la vez
    expect((await post({ hours: [{ weekday: 1, opensAt: '20:00', closesAt: '10:00' }] })).status).toBe(400);
    expect((await post({ hours: [{ weekday: 1, opensAt: '10:00', closesAt: '11:00' }, { weekday: 1, opensAt: '12:00', closesAt: '13:00' }] })).status).toBe(400);
  });
  it('permite una ciudad nueva y la reutiliza; rechaza duplicados nombre+ciudad', async () => {
    const { auth } = await verifiedUser();
    const city = { name: uniq('Ciudad'), region: 'Región' };
    const a = await api().post(P).set(auth).send(placeBody({ cityId: undefined, newCity: city }));
    expect(a.status).toBe(201);
    const dup = await api().post(P).set(auth).send(placeBody({ name: a.body.data.place.name, cityId: undefined, newCity: city }));
    expect(dup.body.error.code).toBe('DUPLICATE_PLACE');
    const [[c]] = await db.query('SELECT COUNT(*) n FROM cities WHERE name = ?', [city.name]);
    expect(c.n).toBe(1);
  });
  it('limita las propuestas pendientes por usuario (anti-spam)', async () => {
    const { auth } = await verifiedUser();
    for (let i = 0; i < 10; i++) expect((await api().post(P).set(auth).send(placeBody())).status).toBe(201);
    const r = await api().post(P).set(auth).send(placeBody());
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('TOO_MANY_PENDING');
  });
});

describe('modificación y baja', () => {
  it('el autor edita mientras está pendiente; al publicarse ya no puede, el staff sí (y queda en el historial)', async () => {
    const { auth } = await verifiedUser();
    const p = (await api().post(P).set(auth).send(placeBody())).body.data.place;
    const edit = await api().patch(`${P}/${p.id}`).set(auth).send({ description: 'Nueva descripción', obstacleIds: [3], hours: [] });
    expect(edit.body.data.place).toMatchObject({ description: 'Nueva descripción', hours: [] });
    expect(edit.body.data.place.obstacles.map((o) => o.id)).toEqual([3]);
    const mod = await staffAuth('moderator');
    await api().post(`/api/v1/moderation/place/${p.id}/approve`).set(mod).send({});
    expect((await api().patch(`${P}/${p.id}`).set(auth).send({ zone: 'Otra' })).status).toBe(403);
    expect((await api().patch(`${P}/${p.id}`).set(mod).send({ zone: 'Corregida' })).body.data.place.zone).toBe('Corregida');
    const [[l]] = await db.query("SELECT COUNT(*) n FROM moderation_logs WHERE action='edit' AND target_type='place' AND target_id=?", [p.id]);
    expect(l.n).toBe(1);
  });
  it('otro usuario no puede editar ni borrar (ni siquiera ver) una propuesta ajena', async () => {
    const a = await verifiedUser(); const b = await verifiedUser();
    const p = (await api().post(P).set(a.auth).send(placeBody())).body.data.place;
    expect((await api().patch(`${P}/${p.id}`).set(b.auth).send({ zone: 'x' })).status).toBe(404);
    expect((await api().delete(`${P}/${p.id}`).set(b.auth)).status).toBe(404);
  });
  it('una propuesta rechazada que el autor corrige vuelve a la cola de revisión', async () => {
    const { auth } = await verifiedUser();
    const p = (await api().post(P).set(auth).send(placeBody())).body.data.place;
    await api().post(`/api/v1/moderation/place/${p.id}/reject`).set(await staffAuth('moderator')).send({ note: 'Falta la ubicación exacta' });
    expect((await api().get(`${P}/${p.id}`).set(auth)).body.data.place).toMatchObject({ status: 'rejected', rejectionReason: 'Falta la ubicación exacta' });
    const fixed = await api().patch(`${P}/${p.id}`).set(auth).send({ address: 'Calle 123' });
    expect(fixed.body.data.place).toMatchObject({ status: 'pending' });
    expect(fixed.body.data.place.rejectionReason).toBeUndefined();
  });
  it('baja: el autor borra su propuesta pendiente; un publicado solo lo da de baja el admin; el moderador no', async () => {
    const { auth } = await verifiedUser();
    const pend = (await api().post(P).set(auth).send(placeBody())).body.data.place;
    expect((await api().delete(`${P}/${pend.id}`).set(auth)).status).toBe(204);
    expect((await api().get(`${P}/${pend.id}`).set(auth)).status).toBe(404);

    const pub = (await api().post(P).set(await staffAuth('moderator')).send(placeBody({ categoryIds: undefined }))).body.data.place;
    const mod = await staffAuth('moderator');
    expect((await api().delete(`${P}/${pub.id}`).set(mod)).body.error.code).toBe('NOT_DELETABLE'); // su autor (moderador) no puede borrar lo ya publicado
    expect((await api().delete(`${P}/1`).set(mod)).body.error.code).toBe('FORBIDDEN');             // un moderador tampoco borra lo ajeno
    expect((await api().get(`${P}/1`)).status).toBe(200);                                          // y no pasó nada
    expect((await api().delete(`${P}/${pub.id}`).set(auth)).status).toBe(403);                     // usuario común: ve el lugar publicado pero no puede borrarlo
    const admin = await staffAuth('admin');
    expect((await api().delete(`${P}/${pub.id}`).set(admin)).status).toBe(204);
    expect((await api().get(`${P}/${pub.id}`)).status).toBe(404);                // baja lógica: deja de ser público
    const [[row]] = await db.query('SELECT deleted_at FROM places WHERE id = ?', [pub.id]);
    expect(row.deleted_at).not.toBeNull();                                       // la fila se conserva (trazabilidad)
    expect((await api().get(`${P}/${pub.id}`).set(admin)).body.data.place.deletedAt).toBeTruthy();
    expect((await api().post(`${P}/${pub.id}/restore`).set(await staffAuth('moderator'))).status).toBe(403);
    expect((await api().post(`${P}/${pub.id}/restore`).set(admin)).status).toBe(204);
    expect((await api().get(`${P}/${pub.id}`)).status).toBe(200);
  });
  it('el autor ve sus propuestas en /users/me/submissions con su estado', async () => {
    const { auth } = await verifiedUser();
    await api().post(P).set(auth).send(placeBody());
    const r = await api().get('/api/v1/users/me/submissions?kind=place').set(auth);
    expect(r.body.data.total).toBe(1);
    expect(r.body.data.items[0].status).toBe('pending');
    expect((await api().get('/api/v1/users/me/submissions').set(auth)).status).toBe(400);   // kind obligatorio
  });
});
