import request from 'supertest';
import { createApp } from '../src/app.js';
import { pool } from '../src/config/db.js';
import { setMailTransport } from '../src/services/mail.service.js';

export const app = createApp({ limiterOptions: { authMax: 100000, generalMax: 100000 } });
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
