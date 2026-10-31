import * as svc from '../services/lookups.service.js';

// Fábrica: un controlador por grupo de catálogo de apoyo.
export const lookupController = (group) => ({
  list: async (req, res) => res.json({ data: await svc.list(group, req.valid.query, req.user) }),
  get: async (req, res) => res.json({ data: { item: await svc.get(group, req.valid.params.id) } }),
  create: async (req, res) => res.status(201).json({ data: { item: await svc.create(group, req.user, req.valid.body, req.ip) } }),
  update: async (req, res) => res.json({ data: { item: await svc.update(group, req.user, req.valid.params.id, req.valid.body, req.ip) } }),
  remove: async (req, res) => res.json({ data: await svc.remove(group, req.user, req.valid.params.id, req.ip) }),
});
