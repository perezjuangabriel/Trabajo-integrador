import { z } from 'zod';
import { displayName, idParam, pagination } from './common.js';

export const updateProfileSchema = {
  body: z.object({
    displayName: displayName.optional(),
    bio: z.string().trim().max(500).nullable().optional(),
    themePreference: z.enum(['system', 'light', 'dark']).optional(),
  }).strict().refine((v) => Object.keys(v).length > 0, 'Enviá al menos un campo'),
};
export const deletionSchema = { body: z.object({ password: z.string().max(200).optional() }) };

export const adminListUsersSchema = {
  query: pagination.extend({
    q: z.string().trim().max(100).optional(),
    role: z.enum(['user', 'moderator', 'admin']).optional(),
    status: z.enum(['active', 'suspended', 'pending_deletion', 'deleted']).optional(),
  }),
};
// Solo se asigna/retira el rol de moderador: el rol admin no se otorga por API.
export const setRoleSchema = { params: idParam, body: z.object({ role: z.enum(['user', 'moderator']) }) };
export const suspendSchema = { params: idParam, body: z.object({ reason: z.string().trim().min(3).max(255) }) };
export const userIdSchema = { params: idParam };
