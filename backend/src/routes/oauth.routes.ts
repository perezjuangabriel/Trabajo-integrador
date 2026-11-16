import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate, requireSensitiveVerification } from '../middleware/authenticate.js';
import * as c from '../controllers/oauth.controller.js';
import * as v from '../validators/oauth.validators.js';

export const createOAuthRouter = ({ authLimiter }) => {
  const r = Router();
  r.post('/exchange', authLimiter, validate(v.exchangeSchema), c.exchange);
  r.get('/:provider/start', authLimiter, validate(v.startSchema), c.start);
  r.get('/:provider/callback', validate(v.callbackSchema), c.callback);
  r.post('/:provider/link', authenticate, authLimiter, validate(v.linkStartSchema), c.linkStart);
  r.delete('/:provider', authenticate, requireSensitiveVerification, validate(v.unlinkSchema), c.unlink);
  return r;
};
