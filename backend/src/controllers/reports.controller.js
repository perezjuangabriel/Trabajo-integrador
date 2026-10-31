import * as svc from '../services/reports.service.js';

export const create = async (req, res) => res.status(201).json({ data: { report: await svc.create(req.user, req.valid.body) } });
export const mine = async (req, res) => res.json({ data: await svc.listMine(req.user, req.valid.query) });
// Moderación
export const list = async (req, res) => res.json({ data: await svc.list(req.valid.query) });
export const get = async (req, res) => res.json({ data: { report: await svc.get(req.valid.params.id) } });
export const resolve = async (req, res) => res.json({ data: { report: await svc.resolve(req.user, req.valid.params.id, req.valid.body) } });
export const dismiss = async (req, res) => res.json({ data: { report: await svc.dismiss(req.user, req.valid.params.id, req.valid.body) } });
