import type { NextFunction, Request, Response } from 'express';
import { bump } from '../services/changes.service.js';

// Toda escritura exitosa sobre contenido, reseñas, reportes o moderación avisa a las pantallas abiertas.
// Las reseñas también cambian los promedios de las tarjetas, por eso cuentan en ambos temas.
const CONTENT = /^\/(places|products|videos|moderation|reports|reviews|video-reviews|admin)(\/|$)/;
const REVIEWS = /(^|\/)(reviews|video-reviews)(\/|$)|^\/moderation\/(review|video_review)\//;

export function trackChanges(req: Request, res: Response, next: NextFunction) {
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    const path = req.path; // relativo al montaje (/api/v1): se lee ahora porque Express lo restaura al terminar la cadena
    res.on('finish', () => {
      if (res.statusCode >= 400) return;
      if (REVIEWS.test(path)) bump('reviews');
      if (CONTENT.test(path)) bump('content');
    });
  }
  next();
}
