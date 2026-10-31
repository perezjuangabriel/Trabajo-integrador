import { env } from '../config/env.js';
// Las imágenes se guardan con ruta relativa (/uploads/...) y se publican absolutas:
// si cambia el dominio del servidor no hay que tocar la base de datos.
export const absoluteUrl = (u) => (u && u.startsWith('/') ? `${env.PUBLIC_BASE_URL}${u}` : u);
