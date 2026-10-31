import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate, optionalAuthenticate, requireRole } from '../middleware/authenticate.js';
import { lookupController } from '../controllers/lookups.controller.js';
import * as repo from '../repositories/lookups.repo.js';
import { schemas, idOnly } from '../validators/lookups.validators.js';

// GET público; alta, modificación y baja solo para el admin.
function lookupRouter(group, schemaKey) {
  const c = lookupController(group);
  const s = schemas[schemaKey];
  const r = Router();
  r.get('/', optionalAuthenticate, validate(s.list), c.list);
  r.get('/:id', validate(idOnly), c.get);
  r.post('/', authenticate, requireRole('admin'), validate(s.create), c.create);
  r.patch('/:id', authenticate, requireRole('admin'), validate(s.update), c.update);
  r.delete('/:id', authenticate, requireRole('admin'), validate(idOnly), c.remove);
  return r;
}

export function createLookupRoutes(api) {
  api.use('/categories', lookupRouter('categories', 'categories'));
  api.use('/brands', lookupRouter('brands', 'brands'));
  api.use('/cities', lookupRouter('cities', 'cities'));
  api.use('/surface-types', lookupRouter('surface-types', 'simple'));
  api.use('/obstacle-types', lookupRouter('obstacle-types', 'simple'));
  api.use('/amenities', lookupRouter('amenities', 'simple'));
  // Todas las opciones del formulario de lugares en una sola llamada.
  api.get('/catalog/options', async (req, res) => res.json({ data: await repo.allOptions() }));
}
