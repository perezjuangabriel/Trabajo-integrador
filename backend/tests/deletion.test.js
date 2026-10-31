import { describe, it, expect, afterAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { api, registerUser, login, asUser, tokenFor, seeded, getSensitiveToken, PASSWORD, db } from './helpers.js';
import { purgeDueAccounts } from '../src/services/accountDeletion.service.js';

afterAll(() => db.end());
const DEL = '/api/v1/users/me/deletion-request';

async function userWithActivity() {
  const reg = await registerUser();
  const sensitive = await getSensitiveToken(reg.body.email, reg.accessToken);
  const uid = reg.user.id;
  // actividad: reseñas de lugar y de video con foto, favoritos y un reporte
  const [r] = await db.query("INSERT INTO reviews (user_id, place_id, rating, comment) VALUES (?, 2, 1, 'Reseña a eliminar')", [uid]);
  await db.query("INSERT INTO video_reviews (user_id, video_id, rating, comment) VALUES (?, 1, 1, 'Reseña de video a eliminar')", [uid]);
  await db.query('INSERT INTO favorites (user_id, place_id) VALUES (?, 1)', [uid]);
  await db.query("INSERT INTO reports (reporter_id, place_id, reason) VALUES (?, 1, 'spam')", [uid]);
  const dir = path.resolve(process.env.UPLOADS_DIR, 'reviews');
  await fs.mkdir(dir, { recursive: true });
  const rel = `reviews/foto-${uid}.jpg`;
  await fs.writeFile(path.resolve(process.env.UPLOADS_DIR, rel), 'x');
  await db.query("INSERT INTO review_images (review_id, url, storage_path) VALUES (?, ?, ?)", [r.insertId, `/uploads/${rel}`, rel]);
  await db.query("UPDATE places SET review_count = review_count + 1 WHERE id = 2"); // simula el recálculo previo
  return { ...reg, sensitive, rel };
}
const placeAgg = async (id) => (await db.query('SELECT avg_rating, review_count FROM places WHERE id = ?', [id]))[0][0];

describe('solicitud de baja', () => {
  it('exige verificación adicional y contraseña correcta; pasa a pending_deletion y puede cancelarse', async () => {
    const { body, accessToken, sensitive } = await registerUser().then(async (r) => ({ ...r, sensitive: await getSensitiveToken(r.body.email, r.accessToken) }));
    const h = (s) => ({ ...asUser(accessToken), ...(s ? { 'X-Sensitive-Token': s } : {}) });
    expect((await api().post(DEL).set(h()).send({ password: PASSWORD })).status).toBe(401);          // sin token sensible
    expect((await api().post(DEL).set(h(sensitive)).send({ password: 'Equivocada1' })).status).toBe(403);
    const ok = await api().post(DEL).set(h(sensitive)).send({ password: PASSWORD });
    expect(ok.status).toBe(202);
    expect(new Date(ok.body.data.deletionScheduledFor).getTime()).toBeGreaterThan(Date.now() + 13 * 86400000); // 14 días de gracia
    expect((await api().get('/api/v1/auth/me').set(asUser(accessToken))).body.data.user.status).toBe('pending_deletion');
    expect((await login(body.email)).status).toBe(200);                                              // puede entrar a cancelar
    expect((await api().post('/api/v1/users/me/deletion-cancel').set(asUser(accessToken))).status).toBe(204);
    expect((await api().get('/api/v1/auth/me').set(asUser(accessToken))).body.data.user.status).toBe('active');
  });
  it('un administrador no puede eliminar su cuenta desde la app', async () => {
    const token = await tokenFor(seeded.admin);
    const email = seeded.admin;
    // el admin sembrado ya tiene correo verificado: pedimos el código directamente
    await api().post('/api/v1/auth/sensitive/request').set(asUser(token));
    const { outbox } = await import('./helpers.js');
    const code = outbox.filter((m) => m.to === email && /confirmación/i.test(m.subject)).at(-1).text.match(/\b(\d{6})\b/)[1];
    const s = (await api().post('/api/v1/auth/sensitive/confirm').set(asUser(token)).send({ code })).body.data.sensitiveToken;
    const r = await api().post(DEL).set({ ...asUser(token), 'X-Sensitive-Token': s }).send({ password: PASSWORD });
    expect(r.body.error.code).toBe('ADMIN_CANNOT_DELETE');
  });
});

describe('baja definitiva (purga)', () => {
  it('elimina reseñas/favoritos/tokens/fotos, recalcula promedios, anonimiza la cuenta y conserva los reportes', async () => {
    const u = await userWithActivity();
    const before = await placeAgg(2);
    await api().post(DEL).set({ ...asUser(u.accessToken), 'X-Sensitive-Token': u.sensitive }).send({ password: PASSWORD });
    // vencida la gracia, el job la procesa
    await db.query("UPDATE users SET deletion_scheduled_for = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 MINUTE) WHERE id = ?", [u.user.id]);
    expect(await purgeDueAccounts()).toBeGreaterThanOrEqual(1);

    const count = async (sql) => (await db.query(sql, [u.user.id]))[0][0].n;
    expect(await count('SELECT COUNT(*) n FROM reviews WHERE user_id = ?')).toBe(0);
    expect(await count('SELECT COUNT(*) n FROM video_reviews WHERE user_id = ?')).toBe(0);
    expect(await count('SELECT COUNT(*) n FROM favorites WHERE user_id = ?')).toBe(0);
    expect(await count('SELECT COUNT(*) n FROM refresh_tokens WHERE user_id = ?')).toBe(0);
    expect(await count('SELECT COUNT(*) n FROM review_images ri JOIN reviews r ON r.id = ri.review_id WHERE r.user_id = ?')).toBe(0);
    await expect(fs.access(path.resolve(process.env.UPLOADS_DIR, u.rel))).rejects.toThrow();        // la foto se borró del disco

    // los promedios vuelven a calcularse sin esa reseña
    const [[calc]] = await db.query("SELECT COUNT(*) n, COALESCE(ROUND(AVG(rating),2),0) a FROM reviews WHERE place_id = 2 AND status='visible'");
    const after = await placeAgg(2);
    expect(after.review_count).toBe(calc.n);
    expect(Number(after.avg_rating)).toBeCloseTo(Number(calc.a), 2);
    expect(after.review_count).toBeLessThan(before.review_count);

    const [[row]] = await db.query('SELECT email, display_name, status, password_hash, deleted_at FROM users WHERE id = ?', [u.user.id]);
    expect(row).toMatchObject({ display_name: 'Usuario eliminado', status: 'deleted', password_hash: null });
    expect(row.email).toBe(`deleted-${u.user.id}@deleted.invalid`);
    expect(row.deleted_at).not.toBeNull();
    const [[rep]] = await db.query("SELECT COUNT(*) n FROM reports WHERE reporter_id IS NULL AND place_id = 1 AND reason = 'spam'");
    expect(rep.n).toBeGreaterThanOrEqual(1);                                                          // el reporte se conserva, anónimo

    // la cuenta ya no entra ni con sus tokens viejos, y el correo original queda libre
    expect((await login(u.body.email)).status).toBe(401);
    expect((await api().get('/api/v1/auth/me').set(asUser(u.accessToken))).status).toBe(401);
    expect((await api().post('/api/v1/auth/register').send({ email: u.body.email, password: PASSWORD, displayName: 'Vuelve' })).status).toBe(201);
    const [[log]] = await db.query("SELECT COUNT(*) n FROM audit_logs WHERE action='account_purged' AND entity_id = ?", [u.user.id]);
    expect(log.n).toBe(1);
  });
  it('NO purga cuentas cuya gracia todavía no venció', async () => {
    const { user, accessToken, body } = await registerUser();
    const s = await getSensitiveToken(body.email, accessToken);
    await api().post(DEL).set({ ...asUser(accessToken), 'X-Sensitive-Token': s }).send({ password: PASSWORD });
    await purgeDueAccounts();
    const [[u]] = await db.query('SELECT status FROM users WHERE id = ?', [user.id]);
    expect(u.status).toBe('pending_deletion');
  });
});
