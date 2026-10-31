import * as svc from '../services/reviews.service.js';

// Fábrica por tipo de entidad (place | product | video).
export const forEntity = (kind) => ({
  list: async (req, res) => res.json({ data: await svc.list(req.user, kind, req.valid.params.id, req.valid.query) }),
  create: async (req, res) => res.status(201).json({ data: { review: await svc.create(req.user, kind, req.valid.params.id, req.valid.body) } }),
});
// Operaciones por id de reseña. `table` = 'reviews' (lugares/productos) | 'video_reviews'.
export const byId = (table) => ({
  get: async (req, res) => res.json({ data: { review: await svc.get(req.user, table, req.valid.params.id) } }),
  update: async (req, res) => res.json({ data: { review: await svc.update(req.user, table, req.valid.params.id, req.valid.body) } }),
  remove: async (req, res) => { await svc.remove(req.user, table, req.valid.params.id, req.ip); res.status(204).end(); },
});
export const addImage = async (req, res) => res.status(201).json({ data: { image: await svc.addImage(req.user, req.valid.params.id, req.file) } });
export const removeImage = async (req, res) => { await svc.removeImage(req.user, req.valid.params.id, req.valid.params.imageId); res.status(204).end(); };
export const mine = async (req, res) => res.json({ data: await svc.listMine(req.user, req.valid.query) });
export const pending = async (req, res) => res.json({ data: await svc.pendingQueue(req.valid.query) });
