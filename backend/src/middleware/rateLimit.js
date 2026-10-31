import rateLimit from 'express-rate-limit';

const handler = (req, res) =>
  res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Demasiados intentos. Probá de nuevo más tarde.' } });

// Límite general de la API y límite estricto para endpoints de autenticación.
export const createLimiters = ({ generalMax = 300, authMax = 20, submitMax = 40, windowMs = 15 * 60 * 1000 } = {}) => ({
  general: rateLimit({ windowMs, limit: generalMax, standardHeaders: 'draft-7', legacyHeaders: false, handler }),
  // Altas y subidas de archivos: se limita por USUARIO (no por IP) para frenar el spam de propuestas.
  submit: rateLimit({ windowMs, limit: submitMax, standardHeaders: 'draft-7', legacyHeaders: false, handler,
    keyGenerator: (req) => (req.user ? `u${req.user.id}` : req.ip), validate: { keyGeneratorIpFallback: false } }),
  auth: rateLimit({ windowMs, limit: authMax, standardHeaders: 'draft-7', legacyHeaders: false, handler }),
});
