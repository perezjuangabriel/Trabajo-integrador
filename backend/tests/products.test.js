import { describe, it, expect, afterAll } from 'vitest';
import { api, verifiedUser, staffAuth, uniq, db } from './helpers.js';

afterAll(() => db.end());
const P = '/api/v1/products';
const ids = (r) => r.body.data.items.map((i) => i.id).sort((a, b) => a - b);
const body = (o = {}) => ({ name: uniq('Producto'), description: 'Prueba', brandId: 1, categoryId: 5, price: { amount: 1000, currency: 'ARS' }, specs: [{ key: 'Ancho', value: '8 in' }], ...o });

describe('listado de productos', () => {
  it('solo publicados; filtros por categoría, marca y precio coinciden con la base', async () => {
    const all = await api().get(`${P}?pageSize=100`);
    expect(all.body.data.items.every((i) => i.status === 'published')).toBe(true);
    expect(ids(all)).not.toContain(10);                                     // el 10 está pendiente
    const [cat] = await db.query("SELECT id FROM products WHERE status='published' AND deleted_at IS NULL AND category_id=5");
    expect(ids(await api().get(`${P}?categoryId=5&pageSize=100`))).toEqual(cat.map((r) => r.id).sort((a, b) => a - b));
    expect(ids(await api().get(`${P}?brandId=5&pageSize=100`)).every((id) => [4, 6, 8].includes(id))).toBe(true);
    const price = await api().get(`${P}?minPrice=30000&maxPrice=90000&pageSize=100`);
    expect(price.body.data.items.every((i) => i.price && i.price.amount >= 30000 && i.price.amount <= 90000)).toBe(true);
    expect(price.body.data.items.length).toBeGreaterThan(0);
    expect((await api().get(`${P}?minPrice=100&maxPrice=1`)).status).toBe(400);
  });
  it('ordena por precio dejando los productos sin precio al final', async () => {
    const asc = (await api().get(`${P}?sort=price_asc&pageSize=100`)).body.data.items;
    const withPrice = asc.filter((i) => i.price).map((i) => i.price.amount);
    expect(withPrice).toEqual([...withPrice].sort((a, b) => a - b));
    expect(asc.at(-1).price).toBeNull();                                    // "Remera Heavy Logo" no tiene precio
    const desc = (await api().get(`${P}?sort=price_desc&pageSize=100`)).body.data.items.filter((i) => i.price).map((i) => i.price.amount);
    expect(desc).toEqual([...desc].sort((a, b) => b - a));
  });
  it('filtra por puntuación/reseñas y busca por nombre o marca', async () => {
    const r = await api().get(`${P}?minRating=4.5&minReviews=2&pageSize=100`);
    expect(r.body.data.items.every((i) => i.avgRating >= 4.5 && i.reviewCount >= 2)).toBe(true);
    expect(ids(await api().get(`${P}?q=Bearing`))).toEqual([5]);           // por marca
  });
  it('detalle por id y slug con especificaciones; pendiente = 404 para el público', async () => {
    const d = (await api().get(`${P}/tabla-maple-825-street`)).body.data.product;
    expect(d).toMatchObject({ id: 1, brand: { name: 'Concreto Skate Co' }, price: { amount: 85000, currency: 'ARS' } });
    expect(d.specs).toContainEqual({ key: 'Ancho', value: '8.25 in' });
    expect((await api().get(`${P}/10`)).status).toBe(404);
  });
});

describe('alta, edición y baja de productos', () => {
  it('un usuario verificado propone (pendiente) y el moderador lo publica', async () => {
    const { auth } = await verifiedUser();
    const r = await api().post(P).set(auth).send(body());
    expect(r.status).toBe(201);
    const p = r.body.data.product;
    expect(p).toMatchObject({ status: 'pending', specs: [{ key: 'Ancho', value: '8 in' }] });
    expect((await api().get(`${P}/${p.id}`)).status).toBe(404);
    expect((await api().post(`/api/v1/moderation/product/${p.id}/approve`).set(await staffAuth('moderator')).send({})).body.data.status).toBe('published');
    expect((await api().get(`${P}/${p.id}`)).status).toBe(200);
  });
  it('precio opcional; moneda obligatoria con monto; valores inválidos rechazados', async () => {
    const { auth } = await verifiedUser();
    expect((await api().post(P).set(auth).send(body({ price: undefined }))).body.data.product.price).toBeNull();
    expect((await api().post(P).set(auth).send(body({ price: { amount: 5 } }))).status).toBe(400);
    expect((await api().post(P).set(auth).send(body({ price: { amount: -1, currency: 'ARS' } }))).status).toBe(400);
    expect((await api().post(P).set(auth).send(body({ specs: [{ key: 'a', value: '1' }, { key: 'A', value: '2' }] }))).status).toBe(400);
  });
  it('valida categoría de tipo producto y marca activa', async () => {
    const { auth } = await verifiedUser();
    expect((await api().post(P).set(auth).send(body({ categoryId: 1 }))).body.error.code).toBe('INVALID_CATEGORY');
    expect((await api().post(P).set(auth).send(body({ brandId: 9999 }))).body.error.code).toBe('INVALID_BRAND');
    const admin = await staffAuth('admin');
    const brand = (await api().post('/api/v1/brands').set(admin).send({ name: uniq('Inactiva') })).body.data.item;
    await api().patch(`/api/v1/brands/${brand.id}`).set(admin).send({ isActive: false });
    expect((await api().post(P).set(auth).send(body({ brandId: brand.id }))).body.error.code).toBe('INVALID_BRAND');
  });
  it('rechaza duplicados marca+nombre', async () => {
    const { auth } = await verifiedUser();
    const b = body();
    expect((await api().post(P).set(auth).send(b)).status).toBe(201);
    expect((await api().post(P).set(auth).send(b)).body.error.code).toBe('DUPLICATE_PRODUCT');
  });
  it('edición: reemplaza especificaciones y limpia el precio con null', async () => {
    const { auth } = await verifiedUser();
    const p = (await api().post(P).set(auth).send(body())).body.data.product;
    const e = (await api().patch(`${P}/${p.id}`).set(auth).send({ specs: [{ key: 'Capas', value: '7' }], price: null })).body.data.product;
    expect(e.specs).toEqual([{ key: 'Capas', value: '7' }]);
    expect(e.price).toBeNull();
    expect((await api().patch(`${P}/${p.id}`).set(auth).send({ rating: 5 })).status).toBe(400);
  });
  it('baja lógica por admin y restauración', async () => {
    const admin = await staffAuth('admin');
    const p = (await api().post(P).set(admin).send(body())).body.data.product;
    expect((await api().delete(`${P}/${p.id}`).set(admin)).status).toBe(204);
    expect((await api().get(`${P}/${p.id}`)).status).toBe(404);
    expect((await api().get(`${P}?q=${encodeURIComponent(p.name)}&includeDeleted=true`).set(admin)).body.data.total).toBe(1);
    expect((await api().post(`${P}/${p.id}/restore`).set(admin)).status).toBe(204);
    expect((await api().get(`${P}/${p.id}`)).status).toBe(200);
  });
});
