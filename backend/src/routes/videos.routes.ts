import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate, optionalAuthenticate, requireRole, requireVerifiedEmail } from '../middleware/authenticate.js';
import * as c from '../controllers/videos.controller.js';
import * as v from '../validators/videos.validators.js';
import { idParam } from '../validators/common.js';

export const createVideosRouter = ({ submitLimiter }) => {
  const r = Router();
  r.get('/', optionalAuthenticate, validate(v.listVideosSchema), c.list);
  r.post('/', authenticate, requireVerifiedEmail, submitLimiter, validate(v.createVideoSchema), c.create);
  r.get('/:ref', optionalAuthenticate, validate(v.videoRefSchema), c.get);
  r.patch('/:id', authenticate, requireVerifiedEmail, validate(v.updateVideoSchema), c.update);
  r.delete('/:id', authenticate, validate({ params: idParam }), c.remove);
  r.post('/:id/restore', authenticate, requireRole('admin'), validate({ params: idParam }), c.restore);
  return r;
};
