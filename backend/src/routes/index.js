import { Router } from 'express';
import { pool } from '../config/db.js';
import { createAuthRouter } from './auth.routes.js';
import { createOAuthRouter } from './oauth.routes.js';
import { createUsersRouter } from './users.routes.js';
import { createAdminRouter } from './admin.routes.js';

export function createApiRouter(limiters) {
  const api = Router();
  api.get('/health', async (req, res) => {
    await pool.query('SELECT 1'); // si la BD no responde, el error handler devuelve 500
    res.json({ data: { status: 'ok' } });
  });
  api.use('/auth/oauth', createOAuthRouter({ authLimiter: limiters.auth }));
  api.use('/auth', createAuthRouter({ authLimiter: limiters.auth }));
  api.use('/users', createUsersRouter());
  api.use('/admin', createAdminRouter());
  return api;
}
