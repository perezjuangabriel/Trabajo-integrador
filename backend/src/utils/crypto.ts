import crypto from 'node:crypto';
import { env } from '../config/env.js';

export const randomToken = (bytes = 48) => crypto.randomBytes(bytes).toString('base64url');
export const sha256Hex = (v) => crypto.createHash('sha256').update(v).digest('hex');
// Código numérico de 6 dígitos con CSPRNG (conserva ceros a la izquierda).
export const numericCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
// HMAC con secreto del servidor: un código de 6 dígitos hasheado sin clave sería trivial de revertir.
export const hmacHex = (message) => crypto.createHmac('sha256', env.JWT_ACCESS_SECRET).update(message).digest('hex');
export const safeEqualHex = (a, b) => {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
};
// PKCE S256: base64url(sha256(verifier)) debe igualar al challenge.
export const pkceChallenge = (verifier) => crypto.createHash('sha256').update(verifier).digest('base64url');
