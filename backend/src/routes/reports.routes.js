import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate, requireVerifiedEmail } from '../middleware/authenticate.js';
import * as c from '../controllers/reports.controller.js';
import * as v from '../validators/reports.validators.js';

export const createReportsRouter = ({ submitLimiter }) => {
  const r = Router();
  r.use(authenticate);
  r.post('/', requireVerifiedEmail, submitLimiter, validate(v.createReportSchema), c.create);
  r.get('/mine', validate(v.myReportsSchema), c.mine);
  return r;
};
