import { describe, it, expect, afterAll } from 'vitest';
import { api, registerUser, asUser, staffAuth, uniq, db } from './helpers.js';

afterAll(() => db.end());

describe('catálogos de apoyo: lectura pública', () => {
  it('lista categorías por tipo (solo activas) con paginación', async () => {
    const r = await api().get('/api/v1/categories?type=place');
    expect(r.status).toBe(200);
    expect(r.body.data.items.map((c) => c.type)).toEqual(Array(4).fill('place'));
    expect(r.body.data).toMatchObject({ page: 1, total: 4, totalPages: 1 });
    expect((await api().get('/api/v1/categories?pageSize=2&page=2')).body.data.items).toHaveLength(2);
    expect((await api().get('/api/v1/categories?type=nada')).status).toBe(400);
  });
  it('expone marcas, ciudades y todas las opciones del formulario', async () => {
    expect((await api().get('/api/v1/brands')).body.data.total).toBeGreaterThanOrEqual(6);
    expect((await api().get('/api/v1/cities?q=Mar')).body.data.items[0].name).toBe('Mar del Plata');
    const o = (await api().get('/api/v1/catalog/options')).body.data;
    expect([o.surfaceTypes.length, o.obstacleTypes.length, o.amenities.length]).toEqual([6, 12, 8]);
  });
  it('la búsqueda trata % y _ como texto literal', async () => {
    expect((await api().get('/api/v1/cities?q=%25')).body.data.total).toBe(0);
  });
});

describe('ABMLC de categorías y marcas (solo admin)', () => {
  it('usuario y moderador reciben 403; sin sesión 401', async () => {
    const { accessToken } = await registerUser();
    const body = { type: 'place', name: uniq('Cat') };
    expect((await api().post('/api/v1/categories').send(body)).status).toBe(401);
    expect((await api().post('/api/v1/categories').set(asUser(accessToken)).send(body)).status).toBe(403);
    expect((await api().post('/api/v1/categories').set(await staffAuth('moderator')).send(body)).status).toBe(403);
    expect((await api().delete('/api/v1/brands/1').set(await staffAuth('moderator'))).status).toBe(403);
  });
  it('el admin da de alta, modifica, consulta y da de baja; genera slug y audita', async () => {
    const admin = await staffAuth('admin');
    const name = uniq('Rampas');
    const c = await api().post('/api/v1/categories').set(admin).send({ type: 'place', name });
    expect(c.status).toBe(201);
    expect(c.body.data.item).toMatchObject({ type: 'place', isActive: true, slug: expect.stringMatching(/^rampas-/) });
    const id = c.body.data.item.id;
    expect((await api().patch(`/api/v1/categories/${id}`).set(admin).send({ name: `${name} 2` })).body.data.item.name).toBe(`${name} 2`);
    expect((await api().get(`/api/v1/categories/${id}`)).status).toBe(200);
    expect((await api().patch(`/api/v1/categories/${id}`).set(admin).send({ type: 'video' })).status).toBe(400); // el tipo no se cambia
    expect((await api().delete(`/api/v1/categories/${id}`).set(admin)).body.data.result).toBe('deleted');
    expect((await api().get(`/api/v1/categories/${id}`)).status).toBe(404);
    const [[a]] = await db.query("SELECT COUNT(*) n FROM audit_logs WHERE entity_type='categories' AND entity_id=?", [id]);
    expect(a.n).toBe(3); // created, updated, deleted
  });
  it('una categoría en uso se DESACTIVA en lugar de borrarse y deja de ofrecerse', async () => {
    const admin = await staffAuth('admin');
    const r = await api().delete('/api/v1/categories/5').set(admin);          // "Tablas", usada por productos
    expect(r.body.data.result).toBe('deactivated');
    expect((await api().get('/api/v1/categories?type=product')).body.data.items.some((c) => c.id === 5)).toBe(false);
    expect((await api().get('/api/v1/categories?type=product&includeInactive=true').set(admin)).body.data.items.some((c) => c.id === 5)).toBe(true);
    await api().patch('/api/v1/categories/5').set(admin).send({ isActive: true }); // restaura para el resto de las pruebas
  });
  it('nombre duplicado 409; ciudad en uso no se puede borrar (409 IN_USE)', async () => {
    const admin = await staffAuth('admin');
    expect((await api().post('/api/v1/categories').set(admin).send({ type: 'place', name: 'Street' })).status).toBe(409);
    const r = await api().delete('/api/v1/cities/1').set(admin);
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('IN_USE');
  });
  it('valida entradas de marcas (URL inválida, campos desconocidos)', async () => {
    const admin = await staffAuth('admin');
    expect((await api().post('/api/v1/brands').set(admin).send({ name: uniq('Marca'), website: 'no-es-url' })).status).toBe(400);
    expect((await api().post('/api/v1/brands').set(admin).send({ name: uniq('Marca'), isActive: false })).status).toBe(400);
    const ok = await api().post('/api/v1/brands').set(admin).send({ name: uniq('Marca'), website: 'https://marca.example' });
    expect(ok.status).toBe(201);
  });
});
