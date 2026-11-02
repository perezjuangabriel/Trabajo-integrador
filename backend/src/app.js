import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env.js';
import { createLimiters } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { createApiRouter } from './routes/index.js';

/** Fábrica de la app (separada de server.js para poder probarla con supertest). */
export function createApp({ limiterOptions, webDir = env.WEB_DIR } = {}) {
  const app = express();
  app.set('trust proxy', env.TRUST_PROXY); // IP real del cliente detrás del proxy de Render
  app.disable('x-powered-by');
  // CSP pensada para servir la web exportada de Expo (scripts propios; imágenes https de miniaturas de video).
  // COOP desactivado a propósito: con `same-origin` el navegador corta el vínculo con la ventana de login social (popup) y la web no puede completar el inicio de sesión.
  app.use(helmet({ crossOriginOpenerPolicy: false, contentSecurityPolicy: { directives: { 'default-src': ["'self'"], 'img-src': ["'self'", 'data:', 'blob:', 'https:'], 'style-src': ["'self'", "'unsafe-inline'"], 'script-src': ["'self'"], 'font-src': ["'self'", 'data:'], 'connect-src': ["'self'"], 'object-src': ["'none'"], 'frame-ancestors': ["'self'"] } } }));
  // La app móvil no usa CORS; solo se habilita para los orígenes configurados (p. ej. un panel web).
  app.use(cors({ origin: env.CORS_ORIGINS.length ? env.CORS_ORIGINS : false }));
  app.use(express.json({ limit: '100kb' }));

  // Imágenes subidas (disco local / carpeta local o volumen). Solo lectura, sin listado de directorios,
  // con nosniff para que el navegador no reinterprete el tipo de archivo.
  app.use('/uploads', express.static(path.resolve(env.UPLOADS_DIR), {
    index: false, dotfiles: 'deny', maxAge: '7d', immutable: true,
    setHeaders: (res) => { res.set('X-Content-Type-Options', 'nosniff'); res.set('Cross-Origin-Resource-Policy', 'cross-origin'); },
  }));

  const limiters = createLimiters(limiterOptions);
  app.use('/api/v1', limiters.general, createApiRouter(limiters));
  // Versión web (opcional): si existe la carpeta exportada, se sirve en la raíz con fallback a index.html.
  const webRoot = path.resolve(webDir);
  if (fs.existsSync(path.join(webRoot, 'index.html'))) {
    app.use(express.static(webRoot, { index: false, maxAge: '1h' }));
    app.get(/^\/(?!api\/|uploads\/).*/, (req, res) => res.sendFile(path.join(webRoot, 'index.html')));
  }
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}