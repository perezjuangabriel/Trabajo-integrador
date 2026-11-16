import * as svc from '../services/favorites.service.js';

export const add = async (req, res) => {
  const r = await svc.add(req.user, req.valid.body.kind, req.valid.body.id);
  res.status(r.created ? 201 : 200).json({ data: { favorited: true } });
};
export const remove = async (req, res) => { await svc.remove(req.user, req.valid.params.kind, req.valid.params.id); res.status(204).end(); };
export const ids = async (req, res) => res.json({ data: await svc.ids(req.user) });
export const list = async (req, res) => res.json({ data: await svc.list(req.user, req.valid.query) });
