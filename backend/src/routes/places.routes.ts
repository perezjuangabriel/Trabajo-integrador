import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate, optionalAuthenticate, requireRole, requireVerifiedEmail } from '../middleware/authenticate.js';
import { uploadImage } from '../middleware/upload.js';
import * as c from '../controllers/places.controller.js';
import { imageController } from '../controllers/images.controller.js';
import * as v from '../validators/places.validators.js';
import { imageParams } from '../validators/catalog.common.js';
import { idParam } from '../validators/common.js';

export const createPlacesRouter = ({ submitLimiter }) => {
  const r = Router();
  const img = imageController('place');
  r.get('/', optionalAuthenticate, validate(v.listPlacesSchema), c.list);
  r.post('/', authenticate, requireVerifiedEmail, submitLimiter, validate(v.createPlaceSchema), c.create);
  r.get('/:ref', optionalAuthenticate, validate(v.placeRefSchema), c.get);
  r.patch('/:id', authenticate, requireVerifiedEmail, validate(v.updatePlaceSchema), c.update);
  r.delete('/:id', authenticate, validate({ params: idParam }), c.remove);
  r.post('/:id/restore', authenticate, requireRole('admin'), validate({ params: idParam }), c.restore);
  r.post('/:id/images', authenticate, requireVerifiedEmail, submitLimiter, validate({ params: idParam }), uploadImage, img.add);
  r.delete('/:id/images/:imageId', authenticate, requireVerifiedEmail, validate({ params: imageParams }), img.remove);
  return r;
};
