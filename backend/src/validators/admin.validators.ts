import { z } from 'zod';
import { pagination } from './common.js';

const slot = z.enum(['video', 'product', 'place']);
export const slotParam = { params: z.object({ slot }) };
export const setManualSchema = { params: z.object({ slot }), body: z.object({ id: z.number().int().positive(), endsAt: z.iso.datetime().optional() }).strict() };
export const featuredSettingsSchema = {
  params: z.object({ slot }),
  body: z.object({
    mode: z.enum(['manual', 'automatic']),
    periodHours: z.number().int().min(1).max(24 * 90),
    minReviews: z.number().int().min(0).max(1000),
    recencyDays: z.number().int().min(1).max(365),
    preferredCategoryId: z.number().int().positive().nullable(),
  }).partial().strict().refine((v) => Object.keys(v).length > 0, 'Enviá al menos un campo'),
};
export const auditSchema = {
  query: pagination.extend({ actorId: z.coerce.number().int().positive().optional(), action: z.string().trim().max(60).optional(), entityType: z.string().trim().max(40).optional() }),
};
