import { z } from 'zod';
import { KIND_NAMES } from '../config/catalog.js';
import { pagination } from './common.js';
import { ACTIONS } from '../services/moderation.service.js';

const kind = z.enum(KIND_NAMES);
export const REVIEW_TYPES = ['review', 'video_review'];
const anyKind = z.enum([...KIND_NAMES, ...REVIEW_TYPES]); // contenido o reseñas
export const actionSchema = {
  params: z.object({ kind: anyKind, id: z.coerce.number().int().positive(), action: z.enum(ACTIONS) }),
  body: z.object({ note: z.string().trim().min(3).max(500).optional() }).strict(),
};
export const queueSchema = { query: pagination.extend({ kind, status: z.enum(['pending', 'rejected', 'hidden', 'published', 'all']).optional() }) };
export const logsSchema = {
  query: pagination.extend({
    moderatorId: z.coerce.number().int().positive().optional(),
    action: z.enum(['approve', 'reject', 'hide', 'restore', 'edit', 'resolve_report', 'dismiss_report']).optional(),
    targetType: z.enum(['place', 'product', 'video', 'review', 'video_review', 'report']).optional(),
  }),
};
export const submissionsSchema = {
  query: pagination.extend({ kind, status: z.enum(['pending', 'published', 'rejected', 'hidden', 'all']).optional() }),
};
