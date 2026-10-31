import * as svc from '../services/moderation.service.js';
import * as places from '../services/places.service.js';
import * as products from '../services/products.service.js';
import * as videos from '../services/videos.service.js';
import { AppError } from '../utils/AppError.js';

export const queue = async (req, res) => res.json({ data: await svc.queue(req.user, req.valid.query.kind, req.valid.query) });
export const logs = async (req, res) => res.json({ data: await svc.logs(req.user, req.valid.query) });
export const act = async (req, res) => {
  const { kind, id, action } = req.valid.params;
  const note = req.valid.body.note;
  if (action === 'reject' && !note) throw new AppError(400, 'NOTE_REQUIRED', 'Indicá el motivo del rechazo');
  res.json({ data: await svc.moderate(req.user, kind, id, action, note) });
};
// "Mis propuestas": todo lo que el usuario envió, con su estado y el motivo si fue rechazado.
export const mySubmissions = async (req, res) => {
  const s = { place: places, product: products, video: videos }[req.valid.query.kind];
  res.json({ data: await s.listOwn(req.user, req.valid.query) });
};
