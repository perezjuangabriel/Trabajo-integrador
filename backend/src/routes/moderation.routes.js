import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate, requireRole } from '../middleware/authenticate.js';
import * as c from '../controllers/moderation.controller.js';
import * as v from '../validators/moderation.validators.js';

export const createModerationRouter = () => {
  const r = Router();
  r.use(authenticate, requireRole('moderator', 'admin'));   // el servidor valida el rol en cada endpoint
  r.get('/queue', validate(v.queueSchema), c.queue);
  r.get('/logs', validate(v.logsSchema), c.logs);
  r.post('/:kind/:id/:action', validate(v.actionSchema), c.act);
  return r;
};
