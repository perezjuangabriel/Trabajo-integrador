import * as users from '../repositories/users.repo.js';
import { verifyAccessToken, verifySensitiveToken } from '../services/token.service.js';
import { forbidden, unauthorized } from '../utils/AppError.js';

async function loadUserFromRequest(req) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw unauthorized('TOKEN_MISSING', 'Falta el token de acceso');
  const payload = verifyAccessToken(token);
  // El estado y el rol se leen de la BD en CADA request: una suspensión o un cambio de rol
  // rigen de inmediato, sin esperar a que venza el access token.
  const user = await users.findById(Number(payload.sub));
  if (!user || user.status === 'deleted') throw unauthorized('TOKEN_INVALID', 'Token inválido');
  if (user.status === 'suspended') throw forbidden('ACCOUNT_SUSPENDED', 'Tu cuenta está suspendida');
  return user;
}

export async function authenticate(req, res, next) {
  req.user = await loadUserFromRequest(req);
  next();
}

/** Para endpoints públicos que muestran datos extra si hay sesión. Un token inválido igual falla. */
export async function optionalAuthenticate(req, res, next) {
  if (req.get('authorization')) req.user = await loadUserFromRequest(req);
  next();
}

/** Autorización por rol. Siempre va DESPUÉS de authenticate. El admin no hereda otros roles implícitamente: se lista. */
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) throw forbidden('FORBIDDEN', 'No tenés permisos para esta acción');
  next();
};

export function requireVerifiedEmail(req, res, next) {
  if (!req.user.emailVerifiedAt) throw forbidden('EMAIL_NOT_VERIFIED', 'Verificá tu correo para continuar');
  next();
}

/** Exige el token de verificación adicional (header X-Sensitive-Token) emitido para este mismo usuario. */
export function requireSensitiveVerification(req, res, next) {
  const token = req.get('x-sensitive-token');
  if (!token) throw unauthorized('SENSITIVE_TOKEN_INVALID', 'Verificación adicional requerida');
  const payload = verifySensitiveToken(token);
  if (Number(payload.sub) !== req.user.id) throw unauthorized('SENSITIVE_TOKEN_INVALID', 'Verificación adicional inválida');
  next();
}
