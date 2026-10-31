import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { withTransaction } from '../config/db.js';
import * as refreshRepo from '../repositories/refreshTokens.repo.js';
import { randomToken, sha256Hex } from '../utils/crypto.js';
import { unauthorized } from '../utils/AppError.js';
import { randomUUID } from 'node:crypto';

const ISSUER = 'spotcheck-api';

export const signAccessToken = (user) =>
  jwt.sign({ role: user.role }, env.JWT_ACCESS_SECRET, { subject: String(user.id), expiresIn: env.JWT_ACCESS_TTL, issuer: ISSUER });

export function verifyAccessToken(token) {
  try {
    const p = jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: ISSUER });
    if (p.typ) throw new Error('not an access token'); // evita usar un token "sensitive" como acceso
    return p;
  } catch (e) {
    throw unauthorized(e.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID', 'Token inválido o vencido');
  }
}

// Token efímero que prueba una verificación reciente (código por correo) para operaciones sensibles.
export const signSensitiveToken = (userId) =>
  jwt.sign({ typ: 'sensitive' }, env.JWT_ACCESS_SECRET, { subject: String(userId), expiresIn: `${env.SENSITIVE_TTL_MIN}m`, issuer: ISSUER });
export function verifySensitiveToken(token) {
  try {
    const p = jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: ISSUER });
    if (p.typ !== 'sensitive') throw new Error('wrong type');
    return p;
  } catch {
    throw unauthorized('SENSITIVE_TOKEN_INVALID', 'Verificación adicional requerida o vencida');
  }
}

async function issueRefresh(userId, familyId, userAgent, db) {
  const raw = randomToken();
  await refreshRepo.insert(
    { userId, tokenHash: sha256Hex(raw), familyId, expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000), userAgent },
    db,
  );
  return raw;
}

/** Crea una sesión nueva (nueva "familia" de refresh tokens). */
export async function issueSession(user, { userAgent } = {}, db) {
  const refreshToken = await issueRefresh(user.id, randomUUID(), userAgent, db);
  return { accessToken: signAccessToken(user), refreshToken };
}

/**
 * Rota un refresh token: el viejo queda revocado y se emite uno nuevo de la misma familia.
 * Si llega un token ya revocado (reuso) se asume robo y se revoca TODA la familia.
 */
export async function rotateRefreshToken(rawToken, { userAgent, loadUser }) {
  const hash = sha256Hex(rawToken);
  const row = await refreshRepo.findByHash(hash);
  if (!row) throw unauthorized('REFRESH_INVALID', 'Sesión inválida');
  if (row.revoked_at) {
    await refreshRepo.revokeFamily(row.family_id);
    throw unauthorized('REFRESH_REUSED', 'Sesión inválida');
  }
  if (new Date(row.expires_at) <= new Date()) throw unauthorized('REFRESH_EXPIRED', 'La sesión venció');

  const user = await loadUser(row.user_id);
  if (!user || !['active', 'pending_deletion'].includes(user.status)) {
    await refreshRepo.revokeAllForUser(row.user_id);
    throw unauthorized('REFRESH_INVALID', 'Sesión inválida');
  }

  return withTransaction(async (conn) => {
    // Si otra petición concurrente ya rotó este token, esta pierde y se trata como reuso.
    if (!(await refreshRepo.revokeIfActive(row.id, conn))) throw unauthorized('REFRESH_REUSED', 'Sesión inválida');
    const refreshToken = await issueRefresh(user.id, row.family_id, userAgent, conn);
    return { user, accessToken: signAccessToken(user), refreshToken };
  });
}

export async function revokeRefreshToken(rawToken) {
  const row = await refreshRepo.findByHash(sha256Hex(rawToken));
  if (row) await refreshRepo.revokeFamily(row.family_id); // cerrar sesión invalida toda la cadena
}
