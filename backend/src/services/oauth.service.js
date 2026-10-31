import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { withTransaction } from '../config/db.js';
import * as users from '../repositories/users.repo.js';
import * as accounts from '../repositories/authAccounts.repo.js';
import * as authTokens from '../repositories/authTokens.repo.js';
import * as refreshRepo from '../repositories/refreshTokens.repo.js';
import * as tokens from './token.service.js';
import { getAdapter } from './oauthProviders.js';
import { AppError, badRequest, conflict, forbidden } from '../utils/AppError.js';
import { hmacHex, pkceChallenge, randomToken } from '../utils/crypto.js';

const STATE_TTL = '10m';
const EXCHANGE_TTL_MS = 2 * 60_000;
const exchangeHash = (code) => hmacHex(`oauth_exchange:${code}`);

export function assertConfigured(provider) {
  if (!getAdapter(provider).isConfigured()) {
    throw new AppError(503, 'PROVIDER_NOT_CONFIGURED', `El inicio de sesión con ${provider} no está configurado en el servidor`);
  }
}

export const allowedAppRedirect = (uri) => env.OAUTH_APP_REDIRECTS.includes(uri);

/** `state` firmado: lleva proveedor, PKCE de la app, destino de retorno y (opcional) usuario a vincular. */
export function signState(payload) {
  return jwt.sign({ typ: 'oauth_state', ...payload }, env.JWT_ACCESS_SECRET, { expiresIn: STATE_TTL, issuer: 'spotcheck-api' });
}
export function verifyState(state, provider) {
  try {
    const p = jwt.verify(state, env.JWT_ACCESS_SECRET, { issuer: 'spotcheck-api' });
    if (p.typ !== 'oauth_state' || p.p !== provider) throw new Error('state mismatch');
    return p;
  } catch {
    throw badRequest('INVALID_STATE', 'La solicitud de inicio de sesión es inválida o venció');
  }
}

export const buildAuthorizeUrl = (provider, statePayload) => getAdapter(provider).authorizeUrl(signState({ p: provider, ...statePayload }));

const fallbackName = (profile) => {
  const base = (profile.displayName || profile.email.split('@')[0] || 'skater').trim().slice(0, 60);
  return base.length >= 2 ? base : `${base}_`;
};

/**
 * Resuelve la identidad ya verificada por el proveedor a una cuenta interna.
 *  - Identidad conocida -> esa cuenta.
 *  - Correo verificado por el proveedor que coincide con una cuenta -> se vincula (sin duplicar).
 *  - Si no -> se crea una cuenta nueva con rol `user`.
 * Nunca se vincula por un correo que el proveedor no marque como verificado.
 */
export async function resolveLogin(provider, profile) {
  if (!profile?.providerUserId) throw new AppError(502, 'PROVIDER_ERROR', 'El proveedor no devolvió un identificador de usuario');

  const known = await accounts.findByIdentity(provider, String(profile.providerUserId));
  if (known) {
    const user = await users.findById(known.user_id);
    if (user.status === 'suspended') throw forbidden('ACCOUNT_SUSPENDED', 'Tu cuenta está suspendida');
    return user;
  }

  if (!profile.email || !profile.emailVerified) {
    throw badRequest('EMAIL_NOT_VERIFIED_BY_PROVIDER', 'El proveedor no entregó un correo verificado. Verificalo en tu cuenta de ese servicio e intentá de nuevo.');
  }
  const email = profile.email.trim().toLowerCase();

  return withTransaction(async (conn) => {
    let user = await users.findByEmail(email, conn);
    if (user) {
      if (user.status === 'suspended') throw forbidden('ACCOUNT_SUSPENDED', 'Tu cuenta está suspendida');
      if (user.status === 'deleted') throw conflict('EMAIL_UNAVAILABLE', 'Ese correo no está disponible');
      if (!user.emailVerifiedAt) {
        // Anti "pre-hijacking": alguien pudo registrar este correo con una contraseña que conoce
        // sin haberlo verificado. Se invalida esa contraseña y las sesiones antes de vincular.
        await users.clearPassword(user.id, conn);
        await refreshRepo.revokeAllForUser(user.id, conn);
        await users.markEmailVerified(user.id, conn);
        user = await users.findById(user.id, conn);
      }
    } else {
      user = await users.create({ email, displayName: fallbackName({ ...profile, email }), avatarUrl: profile.avatarUrl ?? null, emailVerified: true }, conn);
    }
    await accounts.link({ userId: user.id, provider, providerUserId: String(profile.providerUserId), providerEmail: email }, conn);
    return user;
  });
}

/** Vincular un proveedor a la cuenta con sesión iniciada. */
export async function linkToUser(userId, provider, profile) {
  if (!profile?.providerUserId) throw new AppError(502, 'PROVIDER_ERROR', 'El proveedor no devolvió un identificador de usuario');
  const known = await accounts.findByIdentity(provider, String(profile.providerUserId));
  if (known) {
    if (known.user_id === userId) return; // ya vinculado: idempotente
    throw conflict('IDENTITY_ALREADY_LINKED', 'Esa cuenta del proveedor ya está vinculada a otro usuario');
  }
  const mine = (await accounts.listForUser(userId)).some((a) => a.provider === provider);
  if (mine) throw conflict('PROVIDER_ALREADY_LINKED', 'Ya tenés otra cuenta de ese proveedor vinculada');
  await accounts.link({ userId, provider, providerUserId: String(profile.providerUserId), providerEmail: profile.emailVerified ? profile.email : null });
}

export async function unlink(user, provider) {
  const total = await accounts.countForUser(user.id);
  if (!user.passwordHash && total <= 1) throw conflict('LAST_LOGIN_METHOD', 'Es tu único método de acceso: creá una contraseña antes de desvincularlo');
  if (!(await accounts.unlink(user.id, provider))) throw new AppError(404, 'NOT_FOUND', 'Ese proveedor no está vinculado');
}

/** Tras el callback: guarda un código de un solo uso (2 min) atado al challenge PKCE de la app. */
export async function createExchangeCode(userId, codeChallenge) {
  const code = randomToken(32);
  await authTokens.insert({
    userId, purpose: 'oauth_exchange', tokenHash: exchangeHash(code), payload: codeChallenge,
    expiresAt: new Date(Date.now() + EXCHANGE_TTL_MS),
  });
  return code;
}

/** La app canjea el código presentando el verifier PKCE. El código se consume SIEMPRE (acierte o no). */
export async function exchange({ code, codeVerifier }, ctx) {
  const invalid = () => badRequest('INVALID_CODE', 'Código inválido o vencido');
  const row = await authTokens.findOpenByHash('oauth_exchange', exchangeHash(code));
  if (!row || !(await authTokens.consume(row.id))) throw invalid();
  if (pkceChallenge(codeVerifier) !== row.payload) throw invalid();
  const user = await users.findById(row.user_id);
  if (!user || user.status === 'suspended' || user.status === 'deleted') throw forbidden('ACCOUNT_SUSPENDED', 'Tu cuenta no está disponible');
  await users.registerSuccessfulLogin(user.id);
  return { user: users.toPublicUser(user), ...(await tokens.issueSession(user, ctx)) };
}
