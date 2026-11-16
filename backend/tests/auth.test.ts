import { describe, it, expect, afterAll } from 'vitest';
import { api, registerUser, login, asUser, lastCodeFor, outbox, PASSWORD, uniqueEmail, db } from './helpers.js';
import { createApp } from '../src/app.js';
import request from 'supertest';

afterAll(() => db.end());
const A = '/api/v1/auth';

describe('registro', () => {
  it('crea siempre rol user, sin contraseña en la respuesta, y envía código de verificación', async () => {
    const { res, body } = await registerUser();
    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({ role: 'user', status: 'active', emailVerified: false, email: body.email });
    expect(JSON.stringify(res.body)).not.toMatch(/password_?hash|passwordHash/i);
    expect(lastCodeFor(body.email)).toMatch(/^\d{6}$/);
  });
  it('IGNORA un intento de enviar role=admin (no hay escalada en el registro público)', async () => {
    const { res } = await registerUser({ role: 'admin' });
    expect(res.body.data.user.role).toBe('user');
  });
  it('rechaza correo duplicado (409), contraseña débil y correo inválido (400)', async () => {
    const { body } = await registerUser();
    expect((await api().post(`${A}/register`).send(body)).status).toBe(409);
    const weak = await api().post(`${A}/register`).send({ ...body, email: uniqueEmail(), password: 'abc' });
    expect(weak.status).toBe(400);
    expect(weak.body.error.code).toBe('VALIDATION_ERROR');
    expect((await api().post(`${A}/register`).send({ ...body, email: 'no-es-correo' })).status).toBe(400);
  });
  it('normaliza el correo (mayúsculas/espacios) para evitar cuentas duplicadas', async () => {
    const { body } = await registerUser();
    const dup = await api().post(`${A}/register`).send({ ...body, email: `  ${body.email.toUpperCase()} ` });
    expect(dup.status).toBe(409);
  });
});

describe('verificación de correo', () => {
  it('verifica con el código correcto y rechaza el incorrecto', async () => {
    const { body, accessToken } = await registerUser();
    expect((await api().post(`${A}/verify-email`).send({ email: body.email, code: '000000' })).status).toBe(400);
    const code = lastCodeFor(body.email);
    expect((await api().post(`${A}/verify-email`).send({ email: body.email, code })).status).toBe(204);
    const me = await api().get(`${A}/me`).set(asUser(accessToken));
    expect(me.body.data.user.emailVerified).toBe(true);
    // el código ya fue consumido
    expect((await api().post(`${A}/verify-email`).send({ email: body.email, code })).status).toBe(400);
  });
  it('tras 5 intentos fallidos el código se inutiliza aunque luego se envíe el correcto', async () => {
    const { body } = await registerUser();
    const code = lastCodeFor(body.email);
    const wrong = code === '111111' ? '222222' : '111111';
    for (let i = 0; i < 5; i++) await api().post(`${A}/verify-email`).send({ email: body.email, code: wrong });
    expect((await api().post(`${A}/verify-email`).send({ email: body.email, code })).status).toBe(400);
  });
  it('el reenvío tiene enfriamiento de 60 s', async () => {
    const { accessToken } = await registerUser();
    const r = await api().post(`${A}/resend-verification`).set(asUser(accessToken));
    expect(r.status).toBe(429);
    expect(r.body.error.code).toBe('RETRY_LATER');
  });
});

describe('login y sesión', () => {
  it('login correcto devuelve tokens; credenciales malas dan el MISMO error exista o no el correo', async () => {
    const { body } = await registerUser();
    const ok = await login(body.email);
    expect(ok.status).toBe(200);
    expect(ok.body.data.accessToken).toBeTruthy();
    expect(ok.body.data.refreshToken).toBeTruthy();
    const badPass = await login(body.email, 'Incorrecta1');
    const noUser = await login('noexiste@spotcheck.test', 'Incorrecta1');
    expect(badPass.status).toBe(401);
    expect(badPass.body.error).toEqual(noUser.body.error); // no filtra qué correos existen
  });
  it('bloquea la cuenta tras 5 contraseñas incorrectas, incluso con la correcta', async () => {
    const { body } = await registerUser();
    for (let i = 0; i < 5; i++) await login(body.email, 'Incorrecta1');
    const locked = await login(body.email, PASSWORD);
    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe('ACCOUNT_LOCKED');
  });
  it('endpoints protegidos: sin token 401, token basura 401, token válido 200', async () => {
    const { accessToken } = await registerUser();
    expect((await api().get(`${A}/me`)).body.error.code).toBe('TOKEN_MISSING');
    expect((await api().get(`${A}/me`).set(asUser('basura'))).body.error.code).toBe('TOKEN_INVALID');
    expect((await api().get(`${A}/me`).set(asUser(accessToken))).status).toBe(200);
  });
  it('un access token vencido responde TOKEN_EXPIRED', async () => {
    const jwt = (await import('jsonwebtoken')).default;
    const { user } = await registerUser();
    const expired = jwt.sign({ role: 'user' }, process.env.JWT_ACCESS_SECRET, { subject: String(user.id), expiresIn: -10, issuer: 'spotcheck-api' });
    expect((await api().get(`${A}/me`).set(asUser(expired))).body.error.code).toBe('TOKEN_EXPIRED');
  });
});

describe('refresh tokens', () => {
  it('rota el refresh token: el nuevo funciona y el viejo ya no', async () => {
    const { refreshToken } = await registerUser();
    const r1 = await api().post(`${A}/refresh`).send({ refreshToken });
    expect(r1.status).toBe(200);
    expect(r1.body.data.refreshToken).not.toBe(refreshToken);
    expect((await api().post(`${A}/refresh`).send({ refreshToken: r1.body.data.refreshToken })).status).toBe(200);
  });
  it('detecta reutilización de un token ya rotado y revoca TODA la cadena', async () => {
    const { refreshToken } = await registerUser();
    const r1 = await api().post(`${A}/refresh`).send({ refreshToken });
    const reuse = await api().post(`${A}/refresh`).send({ refreshToken });
    expect(reuse.status).toBe(401);
    expect(reuse.body.error.code).toBe('REFRESH_REUSED');
    // el token legítimo más nuevo también quedó revocado
    expect((await api().post(`${A}/refresh`).send({ refreshToken: r1.body.data.refreshToken })).status).toBe(401);
  });
  it('logout revoca el refresh token', async () => {
    const { refreshToken } = await registerUser();
    expect((await api().post(`${A}/logout`).send({ refreshToken })).status).toBe(204);
    expect((await api().post(`${A}/refresh`).send({ refreshToken })).status).toBe(401);
  });
  it('logout-all revoca todas las sesiones del usuario', async () => {
    const { body, accessToken, refreshToken } = await registerUser();
    const second = (await login(body.email)).body.data.refreshToken;
    expect((await api().post(`${A}/logout-all`).set(asUser(accessToken))).status).toBe(204);
    for (const t of [refreshToken, second]) expect((await api().post(`${A}/refresh`).send({ refreshToken: t })).status).toBe(401);
  });
  it('un refresh token vencido es rechazado', async () => {
    const { refreshToken } = await registerUser();
    await db.query('UPDATE refresh_tokens SET expires_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY) WHERE 1=1 AND revoked_at IS NULL AND user_id = (SELECT id FROM (SELECT MAX(id) id FROM users) x)');
    expect((await api().post(`${A}/refresh`).send({ refreshToken })).body.error.code).toBe('REFRESH_EXPIRED');
  });
  it('solo se guarda el hash del refresh token, nunca el valor en claro', async () => {
    const { refreshToken } = await registerUser();
    const [rows] = await db.query('SELECT COUNT(*) n FROM refresh_tokens WHERE token_hash = ?', [refreshToken]);
    expect(rows[0].n).toBe(0);
  });
});

describe('recuperación y cambio de contraseña', () => {
  it('forgot-password responde igual exista o no el correo', async () => {
    const { body } = await registerUser();
    const a = await api().post(`${A}/forgot-password`).send({ email: body.email });
    const b = await api().post(`${A}/forgot-password`).send({ email: 'fantasma@spotcheck.test' });
    expect(a.status).toBe(202);
    expect(a.body).toEqual(b.body);
  });
  it('flujo completo: código por correo -> nueva contraseña -> sesiones viejas cerradas', async () => {
    const { body, refreshToken } = await registerUser();
    await api().post(`${A}/forgot-password`).send({ email: body.email });
    const code = outbox.filter((m) => m.to === body.email && /Recuperar/i.test(m.subject)).at(-1).text.match(/\b(\d{6})\b/)[1];
    const NEW = 'NuevaClave99';
    expect((await api().post(`${A}/reset-password`).send({ email: body.email, code: '123456' === code ? '654321' : '123456', newPassword: NEW })).status).toBe(400);
    expect((await api().post(`${A}/reset-password`).send({ email: body.email, code, newPassword: NEW })).status).toBe(204);
    expect((await login(body.email)).status).toBe(401);          // la contraseña vieja ya no sirve
    expect((await login(body.email, NEW)).status).toBe(200);
    expect((await api().post(`${A}/refresh`).send({ refreshToken })).status).toBe(401); // sesión anterior revocada
  });
  it('change-password exige la actual, revoca las otras sesiones y mantiene la actual', async () => {
    const { body, accessToken } = await registerUser();
    const other = (await login(body.email)).body.data.refreshToken;
    const bad = await api().post(`${A}/change-password`).set(asUser(accessToken)).send({ currentPassword: 'Equivocada1', newPassword: 'OtraClave123' });
    expect(bad.status).toBe(403);
    const ok = await api().post(`${A}/change-password`).set(asUser(accessToken)).send({ currentPassword: PASSWORD, newPassword: 'OtraClave123' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.refreshToken).toBeTruthy();
    expect((await api().post(`${A}/refresh`).send({ refreshToken: other })).status).toBe(401);
  });
});

describe('verificación adicional (operaciones sensibles)', () => {
  it('exige correo verificado, emite token de 5 min con el código y rechaza códigos erróneos', async () => {
    const { body, accessToken } = await registerUser();
    expect((await api().post(`${A}/sensitive/request`).set(asUser(accessToken))).body.error.code).toBe('EMAIL_NOT_VERIFIED');
    await api().post(`${A}/verify-email`).send({ email: body.email, code: lastCodeFor(body.email) });
    expect((await api().post(`${A}/sensitive/request`).set(asUser(accessToken))).status).toBe(202);
    const code = outbox.filter((m) => m.to === body.email && /confirmación/i.test(m.subject)).at(-1).text.match(/\b(\d{6})\b/)[1];
    expect((await api().post(`${A}/sensitive/confirm`).set(asUser(accessToken)).send({ code: code === '000000' ? '999999' : '000000' })).status).toBe(400);
    const ok = await api().post(`${A}/sensitive/confirm`).set(asUser(accessToken)).send({ code });
    expect(ok.status).toBe(200);
    expect(ok.body.data.sensitiveToken).toBeTruthy();
  });
  it('un token sensitive NO sirve como access token (ni al revés)', async () => {
    const { body, accessToken, user } = await registerUser();
    const { signSensitiveToken } = await import('../src/services/token.service.js');
    expect((await api().get(`${A}/me`).set(asUser(signSensitiveToken(user.id)))).status).toBe(401);
    const del = await api().post('/api/v1/users/me/deletion-request').set({ ...asUser(accessToken), 'X-Sensitive-Token': accessToken }).send({ password: PASSWORD });
    expect(del.status).toBe(401);
  });
});

describe('protección contra abuso', () => {
  it('el limitador por IP responde 429 al exceder el máximo', async () => {
    const strict = request(createApp({ limiterOptions: { authMax: 3, generalMax: 1000 } }));
    const codes = [];
    for (let i = 0; i < 5; i++) codes.push((await strict.post(`${A}/login`).send({ email: 'x@spotcheck.test', password: 'Algo1234' })).status);
    expect(codes).toEqual([401, 401, 401, 429, 429]);
  });
  it('JSON malformado -> 400 INVALID_JSON y ruta inexistente -> 404 con formato uniforme', async () => {
    const bad = await api().post(`${A}/login`).set('Content-Type', 'application/json').send('{no es json');
    expect(bad.body.error.code).toBe('INVALID_JSON');
    expect((await api().get('/api/v1/nada')).body.error.code).toBe('NOT_FOUND');
  });
  it('resiste un intento de inyección SQL en el login', async () => {
    const r = await login("' OR '1'='1' -- ", "' OR '1'='1");
    expect(r.status).toBe(400); // rechazado por validación de correo
    const r2 = await api().post(`${A}/verify-email`).send({ email: `${uniqueEmail()}`, code: "1' OR '1" });
    expect(r2.status).toBe(400);
  });
});
