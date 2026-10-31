import express from 'express';
import path from 'node:path';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env.js';
import { createLimiters } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { createApiRouter } from './routes/index.js';

/** Fábrica de la app (separada de server.js para poder probarla con supertest). */
export function createApp({ limiterOptions } = {}) {
  const app = express();
  app.set('trust proxy', env.TRUST_PROXY); // IP real del cliente detrás del proxy de Railway
  app.disable('x-powered-by');
  app.use(helmet());
  // La app móvil no usa CORS; solo se habilita para los orígenes configurados (p. ej. un panel web).
  app.use(cors({ origin: env.CORS_ORIGINS.length ? env.CORS_ORIGINS : false }));
  app.use(express.json({ limit: '100kb' }));

  // Imágenes subidas (disco local / volumen de Railway). Solo lectura, sin listado de directorios,
  // con nosniff para que el navegador no reinterprete el tipo de archivo.
  app.use('/uploads', express.static(path.resolve(env.UPLOADS_DIR), {
    index: false, dotfiles: 'deny', maxAge: '7d', immutable: true,
    setHeaders: (res) => { res.set('X-Content-Type-Options', 'nosniff'); res.set('Cross-Origin-Resource-Policy', 'cross-origin'); },
  }));

  const limiters = createLimiters(limiterOptions);
  app.use('/api/v1', limiters.general, createApiRouter(limiters));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
