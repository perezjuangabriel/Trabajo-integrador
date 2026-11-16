import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import * as c from '../controllers/auth.controller.js';
import * as v from '../validators/auth.validators.js';

export const createAuthRouter = ({ authLimiter }) => {
  const r = Router();
  // Endpoints públicos con límite estricto por IP (además del bloqueo por cuenta en login).
  r.post('/register', authLimiter, validate(v.registerSchema), c.register);
  r.post('/login', authLimiter, validate(v.loginSchema), c.login);
  r.post('/refresh', authLimiter, validate(v.refreshSchema), c.refresh);
  r.post('/logout', validate(v.refreshSchema), c.logout);
  r.post('/verify-email', authLimiter, validate(v.verifyEmailSchema), c.verifyEmail);
  r.post('/forgot-password', authLimiter, validate(v.forgotSchema), c.forgotPassword);
  r.post('/reset-password', authLimiter, validate(v.resetSchema), c.resetPassword);

  // Con sesión
  r.get('/me', authenticate, c.me);
  r.post('/logout-all', authenticate, c.logoutAll);
  r.post('/resend-verification', authenticate, authLimiter, c.resendVerification);
  r.post('/change-password', authenticate, authLimiter, validate(v.changePasswordSchema), c.changePassword);
  r.post('/sensitive/request', authenticate, authLimiter, c.requestSensitive);
  r.post('/sensitive/confirm', authenticate, authLimiter, validate(v.confirmSensitiveSchema), c.confirmSensitive);
  return r;
};
