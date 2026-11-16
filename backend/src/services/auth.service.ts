import * as users from '../repositories/users.repo.js';
import * as refreshRepo from '../repositories/refreshTokens.repo.js';
import * as tokens from './token.service.js';
import * as codes from './oneTimeCode.service.js';
import * as mail from './mail.service.js';
import { hashPassword, verifyPassword, burnPasswordCheck } from '../utils/password.js';
import { AppError, badRequest, conflict, forbidden, unauthorized } from '../utils/AppError.js';

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const normalizeEmail = (e) => e.trim().toLowerCase();
const invalidCredentials = () => unauthorized('INVALID_CREDENTIALS', 'Correo o contraseña incorrectos');

const sessionResponse = (user, session) => ({ user: users.toPublicUser(user), ...session });

/** Registro público: SIEMPRE crea rol `user`. La sesión se abre sin exigir verificación (ver docs/API.md). */
export async function register({ email, password, displayName }, ctx) {
  email = normalizeEmail(email);
  if (await users.findByEmail(email)) throw conflict('EMAIL_TAKEN', 'Ya existe una cuenta con ese correo');
  const user = await users.create({ email, passwordHash: await hashPassword(password), displayName });
  const code = await codes.issueCode(user.id, 'verify_email');
  const { sent } = code ? await mail.sendVerificationEmail(email, code) : { sent: false };
  const session = await tokens.issueSession(user, ctx);
  return { ...sessionResponse(user, session), verificationEmailSent: sent };
}

export async function verifyEmail({ email, code }) {
  const user = await users.findByEmail(normalizeEmail(email));
  if (!user) throw badRequest('INVALID_CODE', 'Código inválido o vencido');
  await codes.verifyCode(user.id, 'verify_email', code);
  await users.markEmailVerified(user.id);
}

export async function resendVerification(userId) {
  const user = await users.findById(userId);
  if (user.emailVerifiedAt) throw conflict('ALREADY_VERIFIED', 'El correo ya está verificado');
  const code = await codes.issueCode(user.id, 'verify_email');
  if (!code) throw codes.cooldownError();
  return mail.sendVerificationEmail(user.email, code);
}

export async function login({ email, password }, ctx) {
  const user = await users.findByEmail(normalizeEmail(email));
  if (!user || !user.passwordHash) {
    await burnPasswordCheck(password); // mismo costo que un login real
    throw invalidCredentials();
  }
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    throw new AppError(429, 'ACCOUNT_LOCKED', 'Demasiados intentos fallidos. Probá de nuevo en unos minutos.');
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    await users.registerFailedLogin(user.id, MAX_FAILED_LOGINS, LOCK_MINUTES);
    throw invalidCredentials();
  }
  if (user.status === 'suspended') throw forbidden('ACCOUNT_SUSPENDED', 'Tu cuenta está suspendida');
  if (user.status === 'deleted') throw invalidCredentials();
  await users.registerSuccessfulLogin(user.id);
  return sessionResponse(user, await tokens.issueSession(user, ctx));
}

export async function refresh({ refreshToken }, ctx) {
  const { user, accessToken, refreshToken: next } = await tokens.rotateRefreshToken(refreshToken, {
    userAgent: ctx.userAgent, loadUser: users.findById,
  });
  return { user: users.toPublicUser(user), accessToken, refreshToken: next };
}

export const logout = ({ refreshToken }) => tokens.revokeRefreshToken(refreshToken);
export const logoutAll = (userId) => refreshRepo.revokeAllForUser(userId);

/** Responde siempre igual exista o no la cuenta (no revela qué correos están registrados). */
export async function forgotPassword({ email }) {
  const user = await users.findByEmail(normalizeEmail(email));
  if (!user || user.status !== 'active') return;
  const code = await codes.issueCode(user.id, 'reset_password');
  if (code) await mail.sendPasswordResetEmail(user.email, code);
}

export async function resetPassword({ email, code, newPassword }) {
  const user = await users.findByEmail(normalizeEmail(email));
  if (!user || user.status !== 'active') throw badRequest('INVALID_CODE', 'Código inválido o vencido');
  await codes.verifyCode(user.id, 'reset_password', code);
  await users.setPassword(user.id, await hashPassword(newPassword));
  await users.markEmailVerified(user.id); // recibir el código prueba que controla el correo
  await refreshRepo.revokeAllForUser(user.id); // cierra todas las sesiones abiertas
}

export async function changePassword(userId, { currentPassword, newPassword }, ctx) {
  const user = await users.findById(userId);
  if (!user.passwordHash) throw conflict('NO_PASSWORD', 'Tu cuenta no tiene contraseña. Usá "Olvidé mi contraseña" para crear una.');
  if (!(await verifyPassword(currentPassword, user.passwordHash))) throw forbidden('WRONG_PASSWORD', 'La contraseña actual es incorrecta');
  await users.setPassword(user.id, await hashPassword(newPassword));
  await refreshRepo.revokeAllForUser(user.id);
  return sessionResponse(user, await tokens.issueSession(user, ctx)); // este dispositivo sigue con sesión
}

// --- Verificación adicional para operaciones sensibles (código por correo -> token de 5 min) ---
export async function requestSensitiveCode(userId) {
  const user = await users.findById(userId);
  if (!user.emailVerifiedAt) throw forbidden('EMAIL_NOT_VERIFIED', 'Verificá tu correo primero');
  const code = await codes.issueCode(user.id, 'sensitive_action');
  if (!code) throw codes.cooldownError();
  return mail.sendSensitiveActionEmail(user.email, code);
}
export async function confirmSensitiveCode(userId, { code }) {
  await codes.verifyCode(userId, 'sensitive_action', code);
  return { sensitiveToken: tokens.signSensitiveToken(userId) };
}
