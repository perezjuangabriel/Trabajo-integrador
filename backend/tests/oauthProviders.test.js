import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { env } from '../src/config/env.js';
import { getAdapter } from '../src/services/oauthProviders.js';

// Verifica CÓMO se construyen las peticiones a cada proveedor y el mapeo del perfil, con fetch simulado.
// NO prueba contra los servidores reales de Google/GitHub/Discord (requiere credenciales).
beforeAll(() => Object.assign(env, {
  GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'gsecret', GITHUB_CLIENT_ID: 'hid', GITHUB_CLIENT_SECRET: 'hsecret',
  DISCORD_CLIENT_ID: 'did', DISCORD_CLIENT_SECRET: 'dsecret',
}));
afterEach(() => vi.unstubAllGlobals());

const jsonRes = (body, ok = true) => ({ ok, status: ok ? 200 : 400, json: async () => body });
const stubFetch = (routes) => {
  const calls = [];
  vi.stubGlobal('fetch', async (url, opts) => { calls.push({ url: String(url), opts }); return jsonRes(routes[String(url)] ?? {}); });
  return calls;
};

describe('URL de autorización', () => {
  it.each([['google', 'accounts.google.com', 'openid email profile'], ['github', 'github.com', 'read:user user:email'], ['discord', 'discord.com', 'identify email']])(
    '%s apunta a su servidor, usa el redirect del backend y pide el scope correcto', (name, host, scope) => {
      const u = new URL(getAdapter(name).authorizeUrl('STATE'));
      expect(u.host).toBe(host);
      expect(u.searchParams.get('state')).toBe('STATE');
      expect(u.searchParams.get('scope')).toBe(scope);
      expect(u.searchParams.get('redirect_uri')).toBe(`http://api.test/api/v1/auth/oauth/${name}/callback`);
      expect(u.searchParams.get('client_id')).toBeTruthy();
      expect(u.toString()).not.toMatch(/secret/i);             // el secreto nunca viaja en la URL del navegador
    });
});

describe('canje del código y perfil', () => {
  it('Google: envía el secreto al token endpoint y mapea email_verified', async () => {
    const calls = stubFetch({
      'https://oauth2.googleapis.com/token': { access_token: 'AT' },
      'https://openidconnect.googleapis.com/v1/userinfo': { sub: '123', email: 'a@b.com', email_verified: true, name: 'Ana', picture: 'http://p' },
    });
    const p = await getAdapter('google').fetchProfile('CODE');
    const body = new URLSearchParams(calls[0].opts.body);
    expect(Object.fromEntries(body)).toMatchObject({ code: 'CODE', client_secret: 'gsecret', grant_type: 'authorization_code' });
    expect(calls[1].opts.headers.Authorization).toBe('Bearer AT');
    expect(p).toEqual({ providerUserId: '123', email: 'a@b.com', emailVerified: true, displayName: 'Ana', avatarUrl: 'http://p' });
  });
  it('GitHub: usa el correo PRIMARIO y VERIFICADO de /user/emails, no el del perfil', async () => {
    stubFetch({
      'https://github.com/login/oauth/access_token': { access_token: 'AT' },
      'https://api.github.com/user': { id: 77, login: 'skater', name: null, avatar_url: 'http://a', email: 'publico-sin-verificar@x.com' },
      'https://api.github.com/user/emails': [
        { email: 'otro@x.com', primary: false, verified: true },
        { email: 'primario@x.com', primary: true, verified: true },
      ],
    });
    const p = await getAdapter('github').fetchProfile('CODE');
    expect(p).toMatchObject({ providerUserId: '77', email: 'primario@x.com', emailVerified: true, displayName: 'skater' });
  });
  it('GitHub: sin correo primario verificado -> emailVerified=false (no se confía en el correo)', async () => {
    stubFetch({
      'https://github.com/login/oauth/access_token': { access_token: 'AT' },
      'https://api.github.com/user': { id: 5, login: 'x' },
      'https://api.github.com/user/emails': [{ email: 'sin@verificar.com', primary: true, verified: false }],
    });
    expect(await getAdapter('github').fetchProfile('C')).toMatchObject({ email: null, emailVerified: false });
  });
  it('Discord: mapea verified y arma la URL del avatar', async () => {
    stubFetch({
      'https://discord.com/api/oauth2/token': { access_token: 'AT' },
      'https://discord.com/api/users/@me': { id: '9', username: 'rider', global_name: 'Rider', email: 'r@d.com', verified: true, avatar: 'abc' },
    });
    expect(await getAdapter('discord').fetchProfile('C')).toEqual({
      providerUserId: '9', email: 'r@d.com', emailVerified: true, displayName: 'Rider', avatarUrl: 'https://cdn.discordapp.com/avatars/9/abc.png',
    });
  });
  it('un error del proveedor se convierte en PROVIDER_ERROR 502 sin filtrar detalles', async () => {
    vi.stubGlobal('fetch', async () => jsonRes({ error: 'invalid_grant', error_description: 'secreto interno' }, false));
    await expect(getAdapter('google').fetchProfile('MAL')).rejects.toMatchObject({ status: 502, code: 'PROVIDER_ERROR' });
  });
});
