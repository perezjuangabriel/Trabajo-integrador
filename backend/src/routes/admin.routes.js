import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate, requireRole } from '../middleware/authenticate.js';
import * as c from '../controllers/user.controller.js';
import * as v from '../validators/user.validators.js';
import * as a from '../controllers/admin.controller.js';
import * as av from '../validators/admin.validators.js';

export const createAdminRouter = () => {
  const r = Router();
  // Todo /admin exige sesión + rol admin; la comprobación es del servidor, no de la app.
  r.use(authenticate, requireRole('admin'));
  r.get('/users', validate(v.adminListUsersSchema), c.adminList);
  r.patch('/users/:id/role', validate(v.setRoleSchema), c.adminSetRole);
  r.post('/users/:id/suspend', validate(v.suspendSchema), c.adminSuspend);
  r.post('/users/:id/reactivate', validate(v.userIdSchema), c.adminReactivate);
  r.get('/featured', a.featuredAll);
  r.put('/featured/:slot', validate(av.setManualSchema), a.setManual);
  r.patch('/featured/:slot/settings', validate(av.featuredSettingsSchema), a.featuredSettings);
  r.post('/featured/:slot/refresh', validate(av.slotParam), a.refresh);
  r.get('/stats', a.getStats);
  r.get('/audit', validate(av.auditSchema), a.getAudit);
  r.get('/settings', c.adminSettings);
  r.patch('/settings', validate(v.updateSettingsSchema), c.adminUpdateSettings);
  return r;
};
