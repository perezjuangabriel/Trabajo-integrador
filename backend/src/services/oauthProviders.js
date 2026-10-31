import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

// Adaptadores de proveedor. Cada uno sabe: si está configurado, a dónde mandar al usuario
// y cómo canjear el `code` por un perfil verificado (llamada servidor a servidor con el secreto).
// Perfil normalizado: { providerUserId, email, emailVerified, displayName, avatarUrl }.

export const callbackUrl = (provider) => `${env.PUBLIC_BASE_URL}/api/v1/auth/oauth/${provider}/callback`;

const providerError = (msg, cause) => {
  if (cause) console.error(`[oauth] ${msg}`, cause);
  return new AppError(502, 'PROVIDER_ERROR', 'No se pudo completar el inicio de sesión con el proveedor');
};

async function request(url, options, what) {
  let res;
  try {
    res = await fetch(url, { ...options, signal: AbortSignal.timeout(10_000) });
  } catch (e) {
    throw providerError(`${what}: fallo de red`, e.message);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) throw providerError(`${what}: HTTP ${res.status}`, body.error_description || body.error || '');
  return body;
}
const form = (params) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
  body: new URLSearchParams(params).toString(),
});
const bearer = (token) => ({ headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'User-Agent': 'spotcheck-api' } });

const google = {
  isConfigured: () => Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  authorizeUrl(state) {
    const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    u.search = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID, redirect_uri: callbackUrl('google'), response_type: 'code',
      scope: 'openid email profile', state, prompt: 'select_account',
    }).toString();
    return u.toString();
  },
  async fetchProfile(code) {
    const t = await request('https://oauth2.googleapis.com/token', form({
      code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: callbackUrl('google'), grant_type: 'authorization_code',
    }), 'google token');
    const p = await request('https://openidconnect.googleapis.com/v1/userinfo', bearer(t.access_token), 'google userinfo');
    return { providerUserId: p.sub, email: p.email, emailVerified: p.email_verified === true, displayName: p.name, avatarUrl: p.picture };
  },
};

const github = {
  isConfigured: () => Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
  authorizeUrl(state) {
    const u = new URL('https://github.com/login/oauth/authorize');
    u.search = new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID, redirect_uri: callbackUrl('github'), scope: 'read:user user:email', state,
    }).toString();
    return u.toString();
  },
  async fetchProfile(code) {
    const t = await request('https://github.com/login/oauth/access_token', form({
      code, client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, redirect_uri: callbackUrl('github'),
    }), 'github token');
    const user = await request('https://api.github.com/user', bearer(t.access_token), 'github user');
    // El correo público del perfil no está verificado: se usa el correo PRIMARIO Y verificado de /user/emails.
    const emails = await request('https://api.github.com/user/emails', bearer(t.access_token), 'github emails');
    const primary = Array.isArray(emails) ? emails.find((e) => e.primary && e.verified) : null;
    return {
      providerUserId: String(user.id), email: primary?.email ?? null, emailVerified: Boolean(primary),
      displayName: user.name || user.login, avatarUrl: user.avatar_url,
    };
  },
};

const discord = {
  isConfigured: () => Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET),
  authorizeUrl(state) {
    const u = new URL('https://discord.com/oauth2/authorize');
    u.search = new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID, redirect_uri: callbackUrl('discord'), response_type: 'code',
      scope: 'identify email', state, prompt: 'consent',
    }).toString();
    return u.toString();
  },
  async fetchProfile(code) {
    const t = await request('https://discord.com/api/oauth2/token', form({
      code, client_id: env.DISCORD_CLIENT_ID, client_secret: env.DISCORD_CLIENT_SECRET,
      redirect_uri: callbackUrl('discord'), grant_type: 'authorization_code',
    }), 'discord token');
    const p = await request('https://discord.com/api/users/@me', bearer(t.access_token), 'discord user');
    return {
      providerUserId: p.id, email: p.email, emailVerified: p.verified === true,
      displayName: p.global_name || p.username,
      avatarUrl: p.avatar ? `https://cdn.discordapp.com/avatars/${p.id}/${p.avatar}.png` : null,
    };
  },
};

const defaults = { google, github, discord };
export const PROVIDER_NAMES = Object.keys(defaults);

// Las pruebas reemplazan el adaptador por uno falso (no hay credenciales reales en el repo).
const overrides = {};
export const setAdapterOverride = (name, adapter) => { if (adapter) overrides[name] = adapter; else delete overrides[name]; };
export const getAdapter = (name) => overrides[name] ?? defaults[name];
