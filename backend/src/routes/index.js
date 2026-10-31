import { Router } from 'express';
import { pool } from '../config/db.js';
import { createAuthRouter } from './auth.routes.js';
import { createOAuthRouter } from './oauth.routes.js';
import { createUsersRouter } from './users.routes.js';
import { createAdminRouter } from './admin.routes.js';
import { createLookupRoutes } from './lookups.routes.js';
import { createPlacesRouter } from './places.routes.js';
import { createProductsRouter } from './products.routes.js';
import { createVideosRouter } from './videos.routes.js';
import { createModerationRouter } from './moderation.routes.js';
import { createReviewsRouter } from './reviews.routes.js';
import { createFavoritesRouter } from './favorites.routes.js';
import { createReportsRouter } from './reports.routes.js';

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
  createLookupRoutes(api);
  api.use('/places', createPlacesRouter({ submitLimiter: limiters.submit }));
  api.use('/products', createProductsRouter({ submitLimiter: limiters.submit }));
  api.use('/videos', createVideosRouter({ submitLimiter: limiters.submit }));
  api.use('/moderation', createModerationRouter());
  api.use(createReviewsRouter({ submitLimiter: limiters.submit }));
  api.use('/favorites', createFavoritesRouter());
  api.use('/reports', createReportsRouter({ submitLimiter: limiters.submit }));
  return api;
}
