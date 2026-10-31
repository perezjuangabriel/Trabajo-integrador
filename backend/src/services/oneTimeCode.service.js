import { env } from '../config/env.js';
import * as authTokens from '../repositories/authTokens.repo.js';
import { numericCode, hmacHex, safeEqualHex } from '../utils/crypto.js';
import { AppError, badRequest } from '../utils/AppError.js';

const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 60_000;

const digest = (purpose, userId, code) => hmacHex(`${purpose}:${userId}:${code}`);

/** Genera un código de 6 dígitos (solo vale el último). Devuelve null si está en enfriamiento. */
export async function issueCode(userId, purpose) {
  const last = await authTokens.findLatestCreatedAt(userId, purpose);
  if (last && Date.now() - new Date(last).getTime() < COOLDOWN_MS) return null;
  const code = numericCode();
  await authTokens.invalidateOpen(userId, purpose);
  await authTokens.insert({
    userId, purpose, tokenHash: digest(purpose, userId, code),
    expiresAt: new Date(Date.now() + env.CODE_TTL_MIN * 60_000),
  });
  return code;
}

export const cooldownError = () =>
  new AppError(429, 'RETRY_LATER', 'Esperá un minuto antes de pedir otro código');

/** Verifica y consume el código. Cada intento (acierte o no) cuenta; tras 5 fallos el código se inutiliza. */
export async function verifyCode(userId, purpose, code) {
  const invalid = () => badRequest('INVALID_CODE', 'Código inválido o vencido');
  const row = await authTokens.findLatestOpen(userId, purpose);
  if (!row) throw invalid();
  if (!(await authTokens.bumpAttempt(row.id, MAX_ATTEMPTS))) throw invalid();
  if (!safeEqualHex(row.token_hash, digest(purpose, userId, code))) throw invalid();
  if (!(await authTokens.consume(row.id))) throw invalid(); // otro request lo consumió primero
}
