import multer from 'multer';
import { MAX_IMAGE_BYTES } from '../config/catalog.js';
import { AppError } from '../utils/AppError.js';

// Archivo en memoria (máx. 5 MB, 1 archivo); el tipo real se valida por firma en image.service.
const parser = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 5 } }).single('image');

export const uploadImage = (req, res, next) =>
  parser(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return next(new AppError(413, 'FILE_TOO_LARGE', `La imagen supera ${MAX_IMAGE_BYTES / 1024 / 1024} MB`));
    if (err instanceof multer.MulterError) return next(new AppError(400, 'INVALID_UPLOAD', 'Subida inválida: enviá un solo archivo en el campo "image"'));
    return next(err);
  });
