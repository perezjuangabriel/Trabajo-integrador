import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { api, verifiedUser, registerUser, asUser, staffAuth, placeBody, PNG, db } from './helpers.js';

afterAll(() => db.end());
const upload = (route, auth, buf = PNG, opts = { filename: 'foto.png', contentType: 'image/png' }, field = 'image') =>
  api().post(route).set(auth).attach(field, buf, opts);
const diskPath = (url) => path.resolve(process.env.UPLOADS_DIR, new URL(url).pathname.replace('/uploads/', ''));

async function ownPlace() {
  const u = await verifiedUser();
  const place = (await api().post('/api/v1/places').set(u.auth).send(placeBody())).body.data.place;
  return { ...u, place, route: `/api/v1/places/${place.id}/images` };
}

describe('subida de imágenes', () => {
  it('guarda el archivo en disco, registra metadatos y lo sirve con tipo correcto y nosniff', async () => {
    const { auth, route, place } = await ownPlace();
    const r = await upload(route, auth);
    expect(r.status).toBe(201);
    const img = r.body.data.image;
    expect(img.url).toMatch(/^http:\/\/api\.test\/uploads\/places\/[0-9a-f-]{36}\.png$/);
    await expect(fs.access(diskPath(img.url))).resolves.toBeUndefined();
    const [[row]] = await db.query('SELECT mime_type, size_bytes, storage_path FROM place_images WHERE id = ?', [img.id]);
    expect(row).toMatchObject({ mime_type: 'image/png', size_bytes: PNG.length });
    const served = await api().get(new URL(img.url).pathname);
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toBe('image/png');
    expect(served.headers['x-content-type-options']).toBe('nosniff');
    // el detalle publica la imagen y la usa como portada
    expect((await api().get(`/api/v1/places/${place.id}`).set(auth)).body.data.place.images[0].url).toBe(img.url);
  });
  it('rechaza archivos que no son imagen aunque digan serlo (valida la firma real)', async () => {
    const { auth, route } = await ownPlace();
    const fake = Buffer.from('<script>alert(1)</script>');
    const r = await upload(route, auth, fake, { filename: 'x.png', contentType: 'image/png' });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('INVALID_IMAGE');
    expect((await upload(route, auth, Buffer.from('GIF89a....'), { filename: 'x.gif', contentType: 'image/gif' })).status).toBe(400);
  });
  it('rechaza archivos de más de 5 MB (413) y campos o cantidades inesperadas (400)', async () => {
    const { auth, route } = await ownPlace();
    const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);
    expect((await upload(route, auth, big)).status).toBe(413);
    expect((await upload(route, auth, PNG, { filename: 'a.png', contentType: 'image/png' }, 'archivo')).status).toBe(400);
    expect((await api().post(route).set(auth).send({})).body.error.code).toBe('FILE_REQUIRED');
  });
  it('limita a 8 imágenes por lugar', async () => {
    const { auth, route } = await ownPlace();
    for (let i = 0; i < 8; i++) expect((await upload(route, auth)).status).toBe(201);
    expect((await upload(route, auth)).body.error.code).toBe('TOO_MANY_IMAGES');
  });
  it('permisos: sin sesión 401; correo sin verificar 403; ajeno 404; el staff sí puede', async () => {
    const { route, auth } = await ownPlace();
    expect((await api().post(route).attach('image', PNG, 'a.png')).status).toBe(401);
    expect((await upload(route, asUser((await registerUser()).accessToken))).body.error.code).toBe('EMAIL_NOT_VERIFIED');
    expect((await upload(route, (await verifiedUser()).auth)).status).toBe(404);
    expect((await upload(route, await staffAuth('moderator'))).status).toBe(201);
    expect(auth).toBeTruthy();
  });
  it('al borrar la imagen se elimina de la base y del disco; el autor ya no puede tocar lo publicado', async () => {
    const { auth, route, place } = await ownPlace();
    const img = (await upload(route, auth)).body.data.image;
    const file = diskPath(img.url);
    expect((await api().delete(`${route}/${img.id}`).set(auth)).status).toBe(204);
    await expect(fs.access(file)).rejects.toThrow();
    expect((await api().delete(`${route}/${img.id}`).set(auth)).status).toBe(404);
    await api().post(`/api/v1/moderation/place/${place.id}/approve`).set(await staffAuth('moderator')).send({});
    expect((await upload(route, auth)).status).toBe(403);
  });
  it('los productos también admiten imágenes', async () => {
    const { auth } = await verifiedUser();
    const p = (await api().post('/api/v1/products').set(auth).send({ name: `P ${Date.now()}`, brandId: 1, categoryId: 5 })).body.data.product;
    const r = await upload(`/api/v1/products/${p.id}/images`, auth);
    expect(r.status).toBe(201);
    expect((await api().get(`/api/v1/products/${p.id}`).set(auth)).body.data.product.images).toHaveLength(1);
  });
  it('no se pueden leer archivos fuera de /uploads (path traversal)', async () => {
    for (const p of ['/uploads/../../package.json', '/uploads/%2e%2e/%2e%2e/package.json', '/uploads/.env']) {
      const r = await api().get(p);
      expect([301, 400, 403, 404]).toContain(r.status);
      expect(r.text ?? '').not.toContain('spotcheck-backend');
    }
  });

  it('acepta una URL https externa (sin tocar el disco) y rechaza URLs inseguras', async () => {
    const { auth, route, place } = await ownPlace();
    const ok = await api().post(route).set(auth).send({ url: 'https://images.example.com/foto.jpg' });
    expect(ok.status).toBe(201);
    expect(ok.body.data.image.url).toBe('https://images.example.com/foto.jpg');
    const [[row]] = await db.query('SELECT storage_path FROM place_images WHERE id = ?', [ok.body.data.image.id]);
    expect(row.storage_path).toBeNull();
    expect((await api().get(`/api/v1/places/${place.id}`).set(auth)).body.data.place.images[0].url).toBe('https://images.example.com/foto.jpg');
    for (const bad of ['http://images.example.com/a.jpg', 'https://localhost/a.jpg', 'https://127.0.0.1/a.jpg', 'https://u:p@images.example.com/a.jpg', 'javascript:alert(1)', 'no-es-url', '']) {
      const r = await api().post(route).set(auth).send({ url: bad });
      expect(r.status, bad).toBe(400);
    }
    expect((await api().post(route).set(auth).send({})).status).toBe(400);
    const del = await api().delete(`${route}/${ok.body.data.image.id}`).set(auth);
    expect(del.status).toBeLessThan(300);
  });

  it('también en productos', async () => {
    const u = await verifiedUser();
    const p = (await api().post('/api/v1/products').set(u.auth).send({ name: `P ${Date.now()}`, brandId: 1, categoryId: 5 })).body.data.product;
    const r = await api().post(`/api/v1/products/${p.id}/images`).set(u.auth).send({ url: 'https://cdn.example.com/p.png' });
    expect(r.status).toBe(201);
  });
});