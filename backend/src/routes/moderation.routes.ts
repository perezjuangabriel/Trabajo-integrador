import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate, requireRole } from '../middleware/authenticate.js';
import * as c from '../controllers/moderation.controller.js';
import * as v from '../validators/moderation.validators.js';
import * as rc from '../controllers/reports.controller.js';
import * as rv from '../validators/reports.validators.js';
import { pendingReviewsSchema } from '../validators/reviews.validators.js';

export const createModerationRouter = () => {
  const r = Router();
  r.use(authenticate, requireRole('moderator', 'admin'));   // el servidor valida el rol en cada endpoint
  r.get('/queue', validate(v.queueSchema), c.queue);
  r.get('/logs', validate(v.logsSchema), c.logs);
  // Reportes y cola de reseñas: van ANTES de la ruta genérica para que /reports/5/resolve no se interprete como /:kind/:id/:action.
  r.get('/reports', validate(rv.staffReportsSchema), rc.list);
  r.get('/reports/:id', validate(rv.reportIdSchema), rc.get);
  r.post('/reports/:id/resolve', validate(rv.resolveSchema), rc.resolve);
  r.post('/reports/:id/dismiss', validate(rv.dismissSchema), rc.dismiss);
  r.get('/reviews', validate(pendingReviewsSchema), c.pendingReviews);
  r.post('/:kind/:id/:action', validate(v.actionSchema), c.act);
  return r;
};
