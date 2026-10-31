import * as images from '../services/image.service.js';

export const imageController = (kind) => ({
  add: async (req, res) => res.status(201).json({ data: { image: await images.addImage(kind, req.user, req.valid.params.id, req.file) } }),
  remove: async (req, res) => { await images.removeImage(kind, req.user, req.valid.params.id, req.valid.params.imageId); res.status(204).end(); },
});
