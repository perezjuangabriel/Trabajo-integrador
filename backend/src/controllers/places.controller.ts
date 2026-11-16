import * as svc from '../services/places.service.js';

export const list = async (req, res) => res.json({ data: await svc.list(req.user, req.valid.query) });
export const get = async (req, res) => res.json({ data: { place: await svc.get(req.user, req.valid.params.ref) } });
export const create = async (req, res) => res.status(201).json({ data: { place: await svc.create(req.user, req.valid.body) } });
export const update = async (req, res) => res.json({ data: { place: await svc.update(req.user, req.valid.params.id, req.valid.body) } });
export const remove = async (req, res) => { await svc.remove(req.user, req.valid.params.id, req.ip); res.status(204).end(); };
export const restore = async (req, res) => { await svc.restore(req.user, req.valid.params.id, req.ip); res.status(204).end(); };
export const listOwn = async (req, res) => res.json({ data: await svc.listOwn(req.user, req.valid.query) });
