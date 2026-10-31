import { z } from 'zod';
import { pagination, idParam } from './common.js';
import { imageParams } from './catalog.common.js';

const rating = z.number().int().min(1, 'La puntuación va de 1 a 5').max(5, 'La puntuación va de 1 a 5');
const comment = z.string().trim().min(3, 'Escribí al menos 3 caracteres').max(2000);

export const createReviewSchema = { params: idParam, body: z.object({ rating, comment }).strict() };
export const updateReviewSchema = { params: idParam, body: z.object({ rating: rating.optional(), comment: comment.optional() }).strict().refine((v) => Object.keys(v).length > 0, 'Enviá al menos un campo') };
export const listReviewsSchema = {
  params: idParam,
  query: pagination.extend({
    sort: z.enum(['newest', 'oldest', 'rating_desc', 'rating_asc']).default('newest'),
    rating: z.coerce.number().int().min(1).max(5).optional(),
    status: z.enum(['visible', 'pending', 'hidden', 'all']).optional(), // solo lo respeta el staff
  }),
};
export const reviewIdSchema = { params: idParam };
export const reviewImageSchema = { params: imageParams };
export const myReviewsSchema = { query: pagination.extend({ kind: z.enum(['place', 'product', 'video']) }) };
export const pendingReviewsSchema = { query: pagination.extend({ type: z.enum(['review', 'video_review']).default('review') }) };
