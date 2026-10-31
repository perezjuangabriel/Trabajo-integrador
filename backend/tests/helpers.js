import request from 'supertest';
import { expect } from 'vitest';
import { createApp } from '../src/app.js';
import { pool } from '../src/config/db.js';
import { setMailTransport } from '../src/services/mail.service.js';

export const app = createApp({ limiterOptions: { authMax: 100000, generalMax: 100000, submitMax: 100000 } });
export const api = () => request(app);
export const PASSWORD = 'Demo1234!'; // contraseña de las cuentas sembradas

// Captura los correos "enviados" para leer los códigos en las pruebas.
export const outbox = [];
setMailTransport(async (msg) => { outbox.push(msg); return { sent: true }; });
export const lastCodeFor = (to) => {
  const msg = [...outbox].reverse().find((m) => m.to === to);
  return msg?.text.match(/\b(\d{6})\b/)?.[1];
};

let counter = 0;
export const uniqueEmail = (p = 'u') => `${p}${Date.now()}${counter++}@spotcheck.test`;

export async function registerUser(overrides = {}) {
  const body = { email: uniqueEmail(), password: PASSWORD, displayName: 'Tester', ...overrides };
  const res = await api().post('/api/v1/auth/register').send(body);
  return { res, body, ...res.body.data };
}
export const login = (email, password = PASSWORD) => api().post('/api/v1/auth/login').send({ email, password });
export const asUser = (token) => ({ Authorization: `Bearer ${token}` });
export const db = pool;

export const tokenFor = async (email) => (await login(email)).body.data.accessToken;
export const seeded = { admin: 'admin@spotcheck.test', moderator: 'mod@spotcheck.test', user: 'lucia@spotcheck.test' };

/** Verifica el correo y completa la verificación adicional; devuelve el token sensible. */
export async function getSensitiveToken(email, accessToken) {
  await api().post('/api/v1/auth/verify-email').send({ email, code: lastCodeFor(email) });
  await api().post('/api/v1/auth/sensitive/request').set(asUser(accessToken));
  const code = outbox.filter((m) => m.to === email && /confirmación/i.test(m.subject)).at(-1).text.match(/\b(\d{6})\b/)[1];
  const r = await api().post('/api/v1/auth/sensitive/confirm').set(asUser(accessToken)).send({ code });
  return r.body.data.sensitiveToken;
}

// Usuario nuevo con correo YA verificado (puede proponer contenido).
export async function verifiedUser(overrides = {}) {
  const reg = await registerUser(overrides);
  await api().post('/api/v1/auth/verify-email').send({ email: reg.body.email, code: lastCodeFor(reg.body.email) });
  return { ...reg, auth: asUser(reg.accessToken) };
}
export const staffAuth = async (who) => asUser(await tokenFor(seeded[who]));
let n = 0;
export const uniq = (p = 'X') => `${p} ${Date.now().toString(36)}${n++}`;
export const placeBody = (o = {}) => ({
  name: uniq('Spot'), description: 'Descripción de prueba', categoryId: 2, categoryIds: [1], cityId: 1, zone: 'Centro',
  latitude: -38.0, longitude: -57.5, surfaceTypeId: 1, obstacleIds: [1, 2], amenityIds: [1],
  hours: [{ weekday: 1, opensAt: '10:00', closesAt: '20:00' }], ...o,
});
export const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);

// Contenido nuevo y publicado (lo crea el staff) para que cada prueba parta de promedios en cero.
export async function freshContent(kind) {
  const mod = await staffAuth('moderator');
  const bodies = {
    place: ['/api/v1/places', placeBody(), 'place'],
    product: ['/api/v1/products', { name: uniq('Prod'), brandId: 1, categoryId: 5 }, 'product'],
    video: ['/api/v1/videos', { title: uniq('Video'), url: `https://example.com/v/${Date.now()}${n++}`, categoryId: 13 }, 'video'],
  };
  const [route, body] = bodies[kind];
  const r = await api().post(route).set(mod).send(body);
  return r.body.data[kind].id;
}
const AGG = { place: ['places', 'reviews', 'place_id'], product: ['products', 'reviews', 'product_id'], video: ['videos', 'video_reviews', 'video_id'] };
/** La caché avg_rating/review_count debe igualar al recálculo con SOLO reseñas visibles. */
export async function expectAggregates(kind, id) {
  const [entity, table, fk] = AGG[kind];
  const [[e]] = await db.query(`SELECT avg_rating, review_count FROM ${entity} WHERE id = ?`, [id]);
  const [[c]] = await db.query(`SELECT COUNT(*) n, COALESCE(ROUND(AVG(rating),2),0) a FROM ${table} WHERE ${fk} = ? AND status = 'visible'`, [id]);
  expect(e.review_count).toBe(c.n);
  expect(Number(e.avg_rating)).toBeCloseTo(Number(c.a), 2);
  return { avg: Number(e.avg_rating), count: e.review_count };
}
