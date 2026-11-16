import { z } from 'zod';
import { pagination } from './common.js';

export const posInt = z.number().int().positive();
export const ids = (max = 20) => z.array(posInt).max(max).transform((a) => [...new Set(a)]);
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usá el formato AAAA-MM-DD');
export const text = (max) => z.string().trim().max(max);
export const refine1 = (obj) => obj.refine((v) => Object.keys(v).length > 0, 'Enviá al menos un campo');

// Filtros de listado comunes a los tres tipos de contenido.
export const baseListQuery = pagination.extend({
  q: z.string().trim().min(1).max(100).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  minReviews: z.coerce.number().int().min(0).optional(),
  publishedAfter: isoDate.optional(),
  publishedBefore: isoDate.optional(),
  status: z.enum(['pending', 'published', 'rejected', 'hidden', 'all']).optional(), // solo lo respeta el staff
  includeDeleted: z.enum(['true', 'false']).transform((v) => v === 'true').optional(), // solo lo respeta el admin
});
export const refParam = z.object({ ref: z.string().min(1).max(200) });
export const imageParams = z.object({ id: z.coerce.number().int().positive(), imageId: z.coerce.number().int().positive() });
