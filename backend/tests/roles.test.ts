import { describe, it, expect, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { api, registerUser, login, asUser, tokenFor, seeded, db } from './helpers.js';
import { authenticate, requireRole } from '../src/middleware/authenticate.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

afterAll(() => db.end());
const ADMIN = '/api/v1/admin/users';

describe('acceso a /admin por rol (validado en el backend)', () => {
  it('sin token -> 401; usuario -> 403; moderador -> 403; admin -> 200', async () => {
    expect((await api().get(ADMIN)).status).toBe(401);
    expect((await api().get(ADMIN).set(asUser(await tokenFor(seeded.user)))).status).toBe(403);
    expect((await api().get(ADMIN).set(asUser(await tokenFor(seeded.moderator)))).status).toBe(403);
    const ok = await api().get(ADMIN).set(asUser(await tokenFor(seeded.admin)));
    expect(ok.status).toBe(200);
    expect(ok.body.data.items.length).toBeGreaterThan(0);
    expect(JSON.stringify(ok.body)).not.toMatch(/password_?hash|\$2[aby]\$/i);
  });
  it('el moderador no puede asignar roles ni suspender (403 en cada operación)', async () => {
    const mod = asUser(await tokenFor(seeded.moderator));
    const { user } = await registerUser();
    expect((await api().patch(`${ADMIN}/${user.id}/role`).set(mod).send({ role: 'moderator' })).status).toBe(403);
    expect((await api().post(`${ADMIN}/${user.id}/suspend`).set(mod).send({ reason: 'prueba' })).status).toBe(403);
    expect((await api().post(`${ADMIN}/${user.id}/reactivate`).set(mod)).status).toBe(403);
  });
  it('requireRole permite a moderador y admin pero no a usuario (middleware reutilizable)', async () => {
    const app = express();
    app.get('/mod', authenticate, requireRole('moderator', 'admin'), (req, res) => res.json({ ok: true }));
    app.use(errorHandler);
    const t = request(app);
    expect((await t.get('/mod').set(asUser(await tokenFor(seeded.user)))).status).toBe(403);
    expect((await t.get('/mod').set(asUser(await tokenFor(seeded.moderator)))).status).toBe(200);
    expect((await t.get('/mod').set(asUser(await tokenFor(seeded.admin)))).status).toBe(200);
  });
});

describe('gestión de roles', () => {
  it('el admin asigna y retira moderador; el cambio rige de inmediato y queda auditado', async () => {
    const admin = asUser(await tokenFor(seeded.admin));
    const { user, accessToken } = await registerUser();
    const up = await api().patch(`${ADMIN}/${user.id}/role`).set(admin).send({ role: 'moderator' });
    expect(up.body.data.user.role).toBe('moderator');
    // el mismo access token (emitido cuando era "user") ya ve el rol nuevo: se lee de la BD
    expect((await api().get('/api/v1/auth/me').set(asUser(accessToken))).body.data.user.role).toBe('moderator');
    expect((await api().patch(`${ADMIN}/${user.id}/role`).set(admin).send({ role: 'user' })).body.data.user.role).toBe('user');
    const [rows] = await db.query("SELECT action, details FROM audit_logs WHERE entity_type='user' AND entity_id=? ORDER BY id", [user.id]);
    expect(rows.map((r) => r.action)).toEqual(['user.role_changed', 'user.role_changed']);
  });
  it('NO se puede otorgar el rol admin por la API, ni tocarse a uno mismo, ni a otro admin', async () => {
    const admin = asUser(await tokenFor(seeded.admin));
    const { user } = await registerUser();
    expect((await api().patch(`${ADMIN}/${user.id}/role`).set(admin).send({ role: 'admin' })).status).toBe(400);
    expect((await api().patch(`${ADMIN}/1/role`).set(admin).send({ role: 'user' })).body.error.code).toBe('SELF_ACTION');
    await db.query("INSERT INTO users (email, display_name, role, email_verified_at) VALUES ('otro-admin@spotcheck.test','Otro','admin',NOW())");
    const [[other]] = await db.query("SELECT id FROM users WHERE email='otro-admin@spotcheck.test'");
    expect((await api().patch(`${ADMIN}/${other.id}/role`).set(admin).send({ role: 'user' })).body.error.code).toBe('TARGET_IS_ADMIN');
    expect((await api().post(`${ADMIN}/${other.id}/suspend`).set(admin).send({ reason: 'x y z' })).body.error.code).toBe('TARGET_IS_ADMIN');
  });
  it('un usuario no puede auto-asignarse un rol por el perfil (campos extra rechazados)', async () => {
    const { accessToken } = await registerUser();
    const r = await api().patch('/api/v1/users/me').set(asUser(accessToken)).send({ role: 'admin' });
    expect(r.status).toBe(400);
    expect((await api().get('/api/v1/auth/me').set(asUser(accessToken))).body.data.user.role).toBe('user');
  });
});

describe('suspensión', () => {
  it('suspender cierra sesiones y bloquea login y tokens existentes; reactivar lo restaura', async () => {
    const admin = asUser(await tokenFor(seeded.admin));
    const { user, body, accessToken, refreshToken } = await registerUser();
    expect((await api().post(`${ADMIN}/${user.id}/suspend`).set(admin).send({ reason: 'Spam reiterado' })).status).toBe(200);
    expect((await api().get('/api/v1/auth/me').set(asUser(accessToken))).body.error.code).toBe('ACCOUNT_SUSPENDED');
    expect((await login(body.email)).body.error.code).toBe('ACCOUNT_SUSPENDED');
    expect((await api().post('/api/v1/auth/refresh').send({ refreshToken })).status).toBe(401);
    expect((await api().post(`${ADMIN}/${user.id}/reactivate`).set(admin)).status).toBe(200);
    expect((await login(body.email)).status).toBe(200);
  });
  it('exige un motivo para suspender y evita repetir la acción', async () => {
    const admin = asUser(await tokenFor(seeded.admin));
    const { user } = await registerUser();
    expect((await api().post(`${ADMIN}/${user.id}/suspend`).set(admin).send({})).status).toBe(400);
    await api().post(`${ADMIN}/${user.id}/suspend`).set(admin).send({ reason: 'Motivo válido' });
    expect((await api().post(`${ADMIN}/${user.id}/suspend`).set(admin).send({ reason: 'Motivo válido' })).status).toBe(409);
  });
});

describe('listado de usuarios', () => {
  it('pagina, filtra por rol y busca por texto', async () => {
    const admin = asUser(await tokenFor(seeded.admin));
    const p1 = await api().get(`${ADMIN}?pageSize=2&page=1`).set(admin);
    expect(p1.body.data.items).toHaveLength(2);
    expect(p1.body.data.total).toBeGreaterThan(2);
    const mods = await api().get(`${ADMIN}?role=moderator`).set(admin);
    expect(mods.body.data.items.every((u) => u.role === 'moderator')).toBe(true);
    const q = await api().get(`${ADMIN}?q=${encodeURIComponent("' OR 1=1 --")}`).set(admin);
    expect(q.status).toBe(200);
    expect(q.body.data.total).toBe(0);               // el texto se trata como dato, no como SQL
    expect((await api().get(`${ADMIN}?pageSize=1000`).set(admin)).status).toBe(400);
  });
});

describe('perfil propio', () => {
  it('edita nombre, bio y tema, y valida los valores', async () => {
    const { accessToken } = await registerUser();
    const ok = await api().patch('/api/v1/users/me').set(asUser(accessToken)).send({ displayName: 'Nuevo Nombre', bio: 'Skate', themePreference: 'dark' });
    expect(ok.body.data.user).toMatchObject({ displayName: 'Nuevo Nombre', bio: 'Skate', themePreference: 'dark' });
    expect((await api().patch('/api/v1/users/me').set(asUser(accessToken)).send({ themePreference: 'neon' })).status).toBe(400);
    expect((await api().patch('/api/v1/users/me').set(asUser(accessToken)).send({})).status).toBe(400);
  });
});
