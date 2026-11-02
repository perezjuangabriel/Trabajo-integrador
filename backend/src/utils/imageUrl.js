import { badRequest } from './AppError.js';

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * Valida una URL de imagen externa. Solo se guarda el enlace: el servidor NUNCA la descarga (así no hay SSRF),
 * por eso no se puede comprobar que apunte a una imagen. Exige https, sin credenciales, con dominio público.
 */
export function parseImageUrl(raw) {
  if (typeof raw !== 'string' || !raw.trim()) throw badRequest('INVALID_IMAGE_URL', 'Falta la URL de la imagen');
  const text = raw.trim();
  if (text.length > 500) throw badRequest('INVALID_IMAGE_URL', 'La URL es demasiado larga (máx. 500 caracteres)');
  let u;
  try { u = new URL(text); } catch { throw badRequest('INVALID_IMAGE_URL', 'La URL de la imagen no es válida'); }
  const host = u.hostname.toLowerCase();
  if (u.protocol !== 'https:') throw badRequest('INVALID_IMAGE_URL', 'La URL debe empezar con https://');
  if (u.username || u.password) throw badRequest('INVALID_IMAGE_URL', 'La URL no puede incluir usuario ni contraseña');
  if (!host.includes('.') || host.startsWith('[') || IPV4.test(host) || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
    throw badRequest('INVALID_IMAGE_URL', 'La URL debe apuntar a un sitio público');
  }
  return u.href;
}