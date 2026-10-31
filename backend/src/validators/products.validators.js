import { z } from 'zod';
import { posInt, text, refine1, baseListQuery, refParam } from './catalog.common.js';
import { idParam } from './common.js';

const price = z.object({ amount: z.number().min(0).max(99_999_999.99), currency: z.string().trim().length(3).toUpperCase() }).strict().nullable();
const specs = z.array(z.object({ key: z.string().trim().min(1).max(60), value: z.string().trim().min(1).max(160) }).strict()).max(20)
  .refine((a) => new Set(a.map((s) => s.key.toLowerCase())).size === a.length, 'No repitas especificaciones');
const fields = { name: z.string().trim().min(3).max(140), description: text(5000).nullable().optional(), brandId: posInt, categoryId: posInt, price: price.optional(), specs: specs.optional() };

export const createProductSchema = { body: z.object(fields).strict() };
export const updateProductSchema = { params: idParam, body: refine1(z.object(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.optional()]))).strict()) };
export const listProductsSchema = {
  query: baseListQuery.extend({
    brandId: z.coerce.number().int().positive().optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    sort: z.enum(['newest', 'rating', 'reviews', 'name', 'price_asc', 'price_desc']).default('newest'),
  }).refine((q) => q.minPrice === undefined || q.maxPrice === undefined || q.minPrice <= q.maxPrice, { message: 'minPrice no puede superar maxPrice', path: ['minPrice'] }),
};
export const productRefSchema = { params: refParam };
