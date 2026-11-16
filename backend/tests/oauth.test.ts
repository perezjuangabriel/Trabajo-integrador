import { describe, it, expect, afterAll, beforeEach, afterEach } from 'vitest';
import { api, registerUser, login, asUser, tokenFor, seeded, getSensitiveToken, uniqueEmail, db } from './helpers.js';
import { setAdapterOverride } from '../src/services/oauthProviders.js';
import { pkceChallenge, randomToken } from '../src/utils/crypto.js';

afterAll(() => db.end());
const O = '/api/v1/auth/oauth';
const APP = 'spotcheck://auth';

// Proveedor simulado: el "code" selecciona qué perfil devuelve. No hay credenciales reales en el repo.
const profiles = {};
const fake = {
  isConfigured: () => true,
  authorizeUrl: (state) => `https://idp.test/authorize?state=${state}`,
  fetchProfile: async (code) => { if (!profiles[code]) throw new Error('code desconocido'); return profiles[code]; },
};
beforeEach(() => setAdapterOverride('google', fake));
afterEach(() => setAdapterOverride('google', null));

const newPkce = () => { const verifier = randomToken(32); return { verifier, challenge: pkceChallenge(verifier) }; };
async function startFlow(challenge) {
  const res = await api().get(`${O}/google/start`).query({ code_challenge: challenge });
  return new URL(res.headers.location).searchParams.get('state');
}
// Ejecuta start -> callback y devuelve la URL de retorno a la app parseada.
async function runLogin(profile, pkce = newPkce()) {
  const code = `c-${randomToken(8)}`;
  profiles[code] = profile;
  const state = await startFlow(pkce.challenge);
  const cb = await api().get(`${O}/google/callback`).query({ code, state });
  return { pkce, back: new URL(cb.headers.location), status: cb.status };
}
const profile = (o = {}) => ({ providerUserId: `g-${randomToken(6)}`, email: uniqueEmail('g'), emailVerified: true, displayName: 'Skater Google', avatarUrl: null, ...o });

describe('inicio del flujo', () => {
  it('sin credenciales del proveedor responde 503 PROVIDER_NOT_CONFIGURED (no simula éxito)', async () => {
    setAdapterOverride('google', null);
    const r = await api().get(`${O}/google/start`).query({ code_challenge: newPkce().challenge });
    expect(r.status).toBe(503);
    expect(r.body.error.code).toBe('PROVIDER_NOT_CONFIGURED');
  });
  it('redirige al proveedor con un state firmado; valida challenge y destino', async () => {
    const r = await api().get(`${O}/google/start`).query({ code_challenge: newPkce().challenge });
    expect(r.status).toBe(302);
    expect(r.headers.location).toMatch(/^https:\/\/idp\.test\/authorize\?state=/);
    expect((await api().get(`${O}/google/start`).query({ code_challenge: 'corto' })).status).toBe(400);
    expect((await api().get(`${O}/google/start`).query({ code_challenge: newPkce().challenge, app_redirect: 'https://evil.test/steal' })).body.error.code).toBe('INVALID_APP_REDIRECT');
    expect((await api().get(`${O}/myspace/start`).query({ code_challenge: newPkce().challenge })).status).toBe(400);
  });
});

describe('login por OAuth de extremo a extremo', () => {
  it('crea una cuenta nueva (rol user, correo verificado, sin contraseña) y canjea el código con PKCE', async () => {
    const p = profile();
    const { pkce, back } = await runLogin(p);
    expect(back.href.startsWith('spotcheck://auth?')).toBe(true);
    const code = back.searchParams.get('code');
    expect(code).toBeTruthy();
    const ex = await api().post(`${O}/exchange`).send({ code, codeVerifier: pkce.verifier });
    expect(ex.status).toBe(200);
    expect(ex.body.data.user).toMatchObject({ role: 'user', emailVerified: true, hasPassword: false, email: p.email });
    expect((await api().get('/api/v1/auth/me').set(asUser(ex.body.data.accessToken))).status).toBe(200);
    expect((await api().post('/api/v1/auth/refresh').send({ refreshToken: ex.body.data.refreshToken })).status).toBe(200);
  });
  it('el código de canje es de un solo uso y un verifier incorrecto lo invalida', async () => {
    const a = await runLogin(profile());
    const code = a.back.searchParams.get('code');
    expect((await api().post(`${O}/exchange`).send({ code, codeVerifier: a.pkce.verifier })).status).toBe(200);
    expect((await api().post(`${O}/exchange`).send({ code, codeVerifier: a.pkce.verifier })).status).toBe(400); // reuso

    const b = await runLogin(profile());
    const codeB = b.back.searchParams.get('code');
    const attacker = newPkce().verifier;
    expect((await api().post(`${O}/exchange`).send({ code: codeB, codeVerifier: attacker })).status).toBe(400);
    expect((await api().post(`${O}/exchange`).send({ code: codeB, codeVerifier: b.pkce.verifier })).status).toBe(400); // quedó quemado
  });
  it('un state manipulado o de otro proveedor se rechaza', async () => {
    expect((await api().get(`${O}/google/callback`).query({ code: 'x', state: 'falso' })).body.error.code).toBe('INVALID_STATE');
    const { default: jwt } = await import('jsonwebtoken');
    const forged = jwt.sign({ typ: 'oauth_state', p: 'google', cc: 'x', ar: APP }, 'otro-secreto-otro-secreto-otro-secreto-1');
    expect((await api().get(`${O}/google/callback`).query({ code: 'x', state: forged })).status).toBe(400);
  });
  it('si el usuario cancela en el proveedor, vuelve a la app con error=ACCESS_DENIED', async () => {
    const state = await startFlow(newPkce().challenge);
    const cb = await api().get(`${O}/google/callback`).query({ state, error: 'access_denied' });
    expect(new URL(cb.headers.location).searchParams.get('error')).toBe('ACCESS_DENIED');
  });
  it('rechaza perfiles sin correo verificado y no crea cuenta', async () => {
    const p = profile({ emailVerified: false });
    const { back } = await runLogin(p);
    expect(back.searchParams.get('error')).toBe('EMAIL_NOT_VERIFIED_BY_PROVIDER');
    const [[n]] = await db.query('SELECT COUNT(*) n FROM users WHERE email = ?', [p.email]);
    expect(n.n).toBe(0);
  });
});

describe('vinculación segura y cuentas duplicadas', () => {
  it('con el mismo correo verificado vincula a la cuenta existente (sin duplicar) y vuelve a entrar con la misma identidad', async () => {
    const { user, body, accessToken } = await registerUser();
    await api().post('/api/v1/auth/verify-email').send({ email: body.email, code: (await import('./helpers.js')).lastCodeFor(body.email) });
    const p = profile({ email: body.email });
    const first = await runLogin(p);
    const ex = await api().post(`${O}/exchange`).send({ code: first.back.searchParams.get('code'), codeVerifier: first.pkce.verifier });
    expect(ex.body.data.user.id).toBe(user.id);
    expect(ex.body.data.user.hasPassword).toBe(true);           // su contraseña legítima sigue
    const second = await runLogin(p);
    const ex2 = await api().post(`${O}/exchange`).send({ code: second.back.searchParams.get('code'), codeVerifier: second.pkce.verifier });
    expect(ex2.body.data.user.id).toBe(user.id);
    const [[c]] = await db.query('SELECT COUNT(*) n FROM users WHERE email = ?', [body.email]);
    const [[l]] = await db.query('SELECT COUNT(*) n FROM auth_accounts WHERE user_id = ?', [user.id]);
    expect([c.n, l.n]).toEqual([1, 1]);
    expect((await api().get('/api/v1/users/me/linked-accounts').set(asUser(accessToken))).body.data.accounts[0].provider).toBe('google');
  });
  it('ANTI PRE-HIJACKING: si la cuenta local no tenía el correo verificado, se anula su contraseña y sus sesiones', async () => {
    const { body, refreshToken } = await registerUser();            // un atacante registró el correo de la víctima
    const victim = profile({ email: body.email });                   // la víctima entra con Google (correo verificado)
    const { pkce, back } = await runLogin(victim);
    expect(back.searchParams.get('code')).toBeTruthy();
    expect((await login(body.email)).status).toBe(401);              // la contraseña del atacante ya no sirve
    expect((await api().post('/api/v1/auth/refresh').send({ refreshToken })).status).toBe(401); // ni su sesión
    const ex = await api().post(`${O}/exchange`).send({ code: back.searchParams.get('code'), codeVerifier: pkce.verifier });
    expect(ex.body.data.user.emailVerified).toBe(true);
  });
  it('una cuenta suspendida no puede entrar por OAuth', async () => {
    const { user, body } = await registerUser();
    const p = profile({ email: body.email });
    const first = await runLogin(p);                                  // vincula
    expect(first.back.searchParams.get('code')).toBeTruthy();
    await db.query("UPDATE users SET status='suspended' WHERE id=?", [user.id]);
    expect((await runLogin(p)).back.searchParams.get('error')).toBe('ACCOUNT_SUSPENDED');
  });
});

describe('vincular y desvincular con sesión iniciada', () => {
  it('vincula un proveedor a mi cuenta y rechaza una identidad que ya pertenece a otro usuario', async () => {
    const a = await registerUser();
    const b = await registerUser();
    const shared = profile();
    const code = `link-${randomToken(6)}`;
    profiles[code] = shared;

    const linkUrl = await api().post(`${O}/google/link`).set(asUser(a.accessToken)).send({});
    expect(linkUrl.status).toBe(200);
    const state = new URL(linkUrl.body.data.url).searchParams.get('state');
    const cb = await api().get(`${O}/google/callback`).query({ code, state });
    expect(new URL(cb.headers.location).searchParams.get('linked')).toBe('google');
    expect((await api().get('/api/v1/users/me/linked-accounts').set(asUser(a.accessToken))).body.data.accounts).toHaveLength(1);

    const stateB = new URL((await api().post(`${O}/google/link`).set(asUser(b.accessToken)).send({})).body.data.url).searchParams.get('state');
    const cbB = await api().get(`${O}/google/callback`).query({ code, state: stateB });
    expect(new URL(cbB.headers.location).searchParams.get('error')).toBe('IDENTITY_ALREADY_LINKED');
  });
  it('vincular exige sesión; desvincular exige verificación adicional y no deja la cuenta sin acceso', async () => {
    expect((await api().post(`${O}/google/link`).send({})).status).toBe(401);
    // cuenta solo-OAuth
    const p = profile();
    const { pkce, back } = await runLogin(p);
    const ex = await api().post(`${O}/exchange`).send({ code: back.searchParams.get('code'), codeVerifier: pkce.verifier });
    const token = ex.body.data.accessToken;
    expect((await api().delete(`${O}/google`).set(asUser(token))).status).toBe(401);       // falta verificación adicional
    const sensitive = await getSensitiveToken(p.email, token);
    const del = await api().delete(`${O}/google`).set({ ...asUser(token), 'X-Sensitive-Token': sensitive });
    expect(del.status).toBe(409);
    expect(del.body.error.code).toBe('LAST_LOGIN_METHOD');
  });
});
