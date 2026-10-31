import * as users from '../repositories/users.repo.js';
import * as accounts from '../repositories/authAccounts.repo.js';
import * as deletion from '../services/accountDeletion.service.js';
import * as admin from '../services/adminUser.service.js';

// --- Perfil propio ---
export const getMe = async (req, res) => res.json({ data: { user: users.toPublicUser(req.user) } });
export const updateMe = async (req, res) =>
  res.json({ data: { user: users.toPublicUser(await users.updateProfile(req.user.id, req.valid.body)) } });
export const linkedAccounts = async (req, res) => res.json({ data: { accounts: await accounts.listForUser(req.user.id) } });
export const requestDeletion = async (req, res) => res.status(202).json({ data: await deletion.requestDeletion(req.user, req.valid.body) });
export const cancelDeletion = async (req, res) => { await deletion.cancelDeletion(req.user); res.status(204).end(); };

// --- Administración de usuarios (solo admin) ---
export const adminList = async (req, res) => res.json({ data: await admin.list(req.valid.query) });
export const adminSetRole = async (req, res) =>
  res.json({ data: { user: await admin.setRole(req.user, req.valid.params.id, req.valid.body.role, req.ip) } });
export const adminSuspend = async (req, res) =>
  res.json({ data: { user: await admin.suspend(req.user, req.valid.params.id, req.valid.body.reason, req.ip) } });
export const adminReactivate = async (req, res) =>
  res.json({ data: { user: await admin.reactivate(req.user, req.valid.params.id, req.ip) } });
