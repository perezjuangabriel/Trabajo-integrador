import { z } from 'zod';
import { pagination } from './common.js';

const kind = z.enum(['place', 'product', 'video']);
export const addFavoriteSchema = { body: z.object({ kind, id: z.number().int().positive() }).strict() };
export const removeFavoriteSchema = { params: z.object({ kind, id: z.coerce.number().int().positive() }) };
export const listFavoritesSchema = { query: pagination.extend({ kind }) };
