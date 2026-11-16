import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/authenticate.js';
import * as c from '../controllers/favorites.controller.js';
import * as v from '../validators/favorites.validators.js';

export const createFavoritesRouter = () => {
  const r = Router();
  r.use(authenticate);
  r.get('/', validate(v.listFavoritesSchema), c.list);
  r.get('/ids', c.ids);                                  // para pintar los corazones de un listado de una vez
  r.post('/', validate(v.addFavoriteSchema), c.add);
  r.delete('/:kind/:id', validate(v.removeFavoriteSchema), c.remove);
  return r;
};
