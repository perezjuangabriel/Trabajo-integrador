import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate, optionalAuthenticate, requireVerifiedEmail } from '../middleware/authenticate.js';
import { uploadImage } from '../middleware/upload.js';
import * as c from '../controllers/reviews.controller.js';
import * as v from '../validators/reviews.validators.js';

/** Se monta en la raíz de la API porque define rutas anidadas (/places/:id/reviews) y propias (/reviews/:id). */
export function createReviewsRouter({ submitLimiter }) {
  const r = Router();
  for (const [path, kind] of [['places', 'place'], ['products', 'product'], ['videos', 'video']]) {
    const h = c.forEntity(kind);
    r.get(`/${path}/:id/reviews`, optionalAuthenticate, validate(v.listReviewsSchema), h.list);
    r.post(`/${path}/:id/reviews`, authenticate, requireVerifiedEmail, submitLimiter, validate(v.createReviewSchema), h.create);
  }
  for (const [path, table] of [['reviews', 'reviews'], ['video-reviews', 'video_reviews']]) {
    const h = c.byId(table);
    r.get(`/${path}/:id`, optionalAuthenticate, validate(v.reviewIdSchema), h.get);
    r.patch(`/${path}/:id`, authenticate, requireVerifiedEmail, validate(v.updateReviewSchema), h.update);
    r.delete(`/${path}/:id`, authenticate, validate(v.reviewIdSchema), h.remove);
  }
  // Fotos: solo reseñas de lugares y productos.
  r.post('/reviews/:id/images', authenticate, requireVerifiedEmail, submitLimiter, validate(v.reviewIdSchema), uploadImage, c.addImage);
  r.delete('/reviews/:id/images/:imageId', authenticate, requireVerifiedEmail, validate(v.reviewImageSchema), c.removeImage);
  return r;
}
