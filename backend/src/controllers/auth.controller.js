import * as auth from '../services/auth.service.js';
import * as users from '../repositories/users.repo.js';

const ctx = (req) => ({ userAgent: req.get('user-agent'), ip: req.ip });

export const register = async (req, res) => res.status(201).json({ data: await auth.register(req.valid.body, ctx(req)) });
export const login = async (req, res) => res.json({ data: await auth.login(req.valid.body, ctx(req)) });
export const refresh = async (req, res) => res.json({ data: await auth.refresh(req.valid.body, ctx(req)) });
export const logout = async (req, res) => { await auth.logout(req.valid.body); res.status(204).end(); };
export const logoutAll = async (req, res) => { await auth.logoutAll(req.user.id); res.status(204).end(); };
export const verifyEmail = async (req, res) => { await auth.verifyEmail(req.valid.body); res.status(204).end(); };
export const resendVerification = async (req, res) => {
  const { sent } = await auth.resendVerification(req.user.id);
  res.status(202).json({ data: { emailSent: sent } });
};
export const forgotPassword = async (req, res) => {
  await auth.forgotPassword(req.valid.body);
  // Respuesta idéntica exista o no el correo.
  res.status(202).json({ data: { message: 'Si el correo está registrado, te enviamos un código.' } });
};
export const resetPassword = async (req, res) => { await auth.resetPassword(req.valid.body); res.status(204).end(); };
export const changePassword = async (req, res) =>
  res.json({ data: await auth.changePassword(req.user.id, req.valid.body, ctx(req)) });
export const requestSensitive = async (req, res) => {
  const { sent } = await auth.requestSensitiveCode(req.user.id);
  res.status(202).json({ data: { emailSent: sent } });
};
export const confirmSensitive = async (req, res) =>
  res.json({ data: await auth.confirmSensitiveCode(req.user.id, req.valid.body) });
export const me = async (req, res) => res.json({ data: { user: users.toPublicUser(req.user) } });
