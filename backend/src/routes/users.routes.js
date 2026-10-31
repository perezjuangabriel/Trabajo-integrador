import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate, requireSensitiveVerification } from '../middleware/authenticate.js';
import * as c from '../controllers/user.controller.js';
import * as v from '../validators/user.validators.js';

export const createUsersRouter = () => {
  const r = Router();
  r.use(authenticate);
  r.get('/me', c.getMe);
  r.patch('/me', validate(v.updateProfileSchema), c.updateMe);
  r.get('/me/linked-accounts', c.linkedAccounts);
  // Baja de cuenta: contraseña (si tiene) + verificación adicional por correo.
  r.post('/me/deletion-request', requireSensitiveVerification, validate(v.deletionSchema), c.requestDeletion);
  r.post('/me/deletion-cancel', c.cancelDeletion);
  return r;
};
