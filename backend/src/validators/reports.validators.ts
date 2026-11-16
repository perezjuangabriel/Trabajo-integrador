import { z } from 'zod';
import { pagination, idParam } from './common.js';
import { TARGET_TYPES } from '../repositories/reports.repo.js';

const targetType = z.enum(TARGET_TYPES);
export const createReportSchema = {
  body: z.object({
    targetType, targetId: z.number().int().positive(),
    reason: z.enum(['spam', 'offensive', 'inaccurate', 'duplicate', 'illegal', 'other']),
    details: z.string().trim().max(1000).optional(),
  }).strict(),
};
export const myReportsSchema = { query: pagination.extend({ status: z.enum(['open', 'resolved', 'dismissed']).optional() }) };
export const staffReportsSchema = { query: pagination.extend({ status: z.enum(['open', 'resolved', 'dismissed']).default('open'), targetType: targetType.optional() }) };
export const reportIdSchema = { params: idParam };
export const resolveSchema = { params: idParam, body: z.object({ note: z.string().trim().min(3).max(500).optional(), hideTarget: z.boolean().default(false) }).strict() };
export const dismissSchema = { params: idParam, body: z.object({ note: z.string().trim().min(3).max(500).optional() }).strict() };
