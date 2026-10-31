import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';

export const zodDetails = (err) =>
  err.issues.map((i) => ({ field: i.path.join('.') || '(body)', message: i.message }));

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Ruta no encontrada: ${req.method} ${req.path}` } });
}

// Manejo centralizado: todas las respuestas de error tienen la forma { error: { code, message, details? } }.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: zodDetails(err) } });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'El cuerpo no es JSON válido' } });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Cuerpo demasiado grande' } });
  }
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: { code: 'CONFLICT', message: 'El registro ya existe' } });
  }
  if (env.NODE_ENV !== 'test') console.error('[error]', err);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: env.NODE_ENV === 'production' ? 'Error interno' : err.message },
  });
}
