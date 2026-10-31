import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate, requireRole } from '../middleware/authenticate.js';
import * as c from '../controllers/user.controller.js';
import * as v from '../validators/user.validators.js';

export const createAdminRouter = () => {
  const r = Router();
  // Todo /admin exige sesión + rol admin; la comprobación es del servidor, no de la app.
  r.use(authenticate, requireRole('admin'));
  r.get('/users', validate(v.adminListUsersSchema), c.adminList);
  r.patch('/users/:id/role', validate(v.setRoleSchema), c.adminSetRole);
  r.post('/users/:id/suspend', validate(v.suspendSchema), c.adminSuspend);
  r.post('/users/:id/reactivate', validate(v.userIdSchema), c.adminReactivate);
  return r;
};
