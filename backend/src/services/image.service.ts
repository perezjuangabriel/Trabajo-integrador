import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { KINDS, MAX_IMAGES_PER_ENTITY } from '../config/catalog.js';
import * as common from '../repositories/catalogCommon.repo.js';
import { assertEditable } from './catalogCommon.service.js';
import { deleteStoredFiles } from '../utils/storage.js';
import { badRequest, conflict, notFound } from '../utils/AppError.js';
import { absoluteUrl } from '../utils/urls.js';
import { parseImageUrl } from '../utils/imageUrl.js';

/** Detecta el tipo REAL por la firma del archivo (no se confía en la extensión ni en el Content-Type del cliente). */
export function detectImageType(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', ext: 'png' };
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  return null;
}

/** Guarda el archivo con nombre aleatorio (nunca el del cliente). Devuelve los metadatos para la BD. */
export async function storeImage(buffer, subdir) {
  const type = detectImageType(buffer);
  if (!type) throw badRequest('INVALID_IMAGE', 'El archivo debe ser una imagen JPEG, PNG o WebP');
  const rel = `${subdir}/${randomUUID()}.${type.ext}`;
  const full = path.resolve(env.UPLOADS_DIR, rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, buffer, { flag: 'wx' });
  return { storagePath: rel, url: `/uploads/${rel}`, mimeType: type.mime, size: buffer.length };
}

const assertHasImages = (kind) => { if (!KINDS[kind].imageTable) throw badRequest('NO_IMAGES', `Los ${KINDS[kind].label}s no admiten imágenes propias`); };

export async function addImage(kind, user, id, file, url) {
  assertHasImages(kind);
  if (!file && url === undefined) throw badRequest('FILE_REQUIRED', 'Enviá un archivo (campo "image") o una URL (campo "url")');
  const external = file ? null : parseImageUrl(url); // se valida antes de tocar la base
  const row = await common.findRow(kind, id);
  assertEditable(user, row);
  if ((await common.countImages(kind, id)) >= MAX_IMAGES_PER_ENTITY) throw conflict('TOO_MANY_IMAGES', `Máximo ${MAX_IMAGES_PER_ENTITY} imágenes`);
  // Con URL externa no se guarda nada en disco: el enlace queda en la base y sobrevive a reinicios del servidor.
  const stored = external ? { url: external, storagePath: null, mimeType: null, size: null } : await storeImage(file.buffer, kind === 'place' ? 'places' : 'products');
  try {
    const img = await common.insertImage(kind, id, { ...stored, position: await common.countImages(kind, id), uploadedBy: user.id });
    return { id: img.id, url: absoluteUrl(img.url), position: img.position };
  } catch (e) {
    await deleteStoredFiles([stored.storagePath]); // no dejar archivos huérfanos si falla la BD (con URL externa es null: no hace nada)
    throw e;
  }
}

export async function removeImage(kind, user, id, imageId) {
  assertHasImages(kind);
  const row = await common.findRow(kind, id);
  assertEditable(user, row);
  const img = await common.findImage(kind, id, imageId);
  if (!img) throw notFound('Imagen no encontrada');
  await common.deleteImage(kind, imageId);
  await deleteStoredFiles([img.storage_path]);
}
