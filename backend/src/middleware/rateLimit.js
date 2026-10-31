import rateLimit from 'express-rate-limit';

const handler = (req, res) =>
  res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Demasiados intentos. Probá de nuevo más tarde.' } });

// Límite general de la API y límite estricto para endpoints de autenticación.
export const createLimiters = ({ generalMax = 300, authMax = 20, windowMs = 15 * 60 * 1000 } = {}) => ({
  general: rateLimit({ windowMs, limit: generalMax, standardHeaders: 'draft-7', legacyHeaders: false, handler }),
  auth: rateLimit({ windowMs, limit: authMax, standardHeaders: 'draft-7', legacyHeaders: false, handler }),
});
