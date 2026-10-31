import { z } from 'zod';
import { idParam } from './common.js';

const name = z.string().trim().min(2).max(80);
const listQuery = z.object({
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(100),
  includeInactive: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});
const website = z.url().max(255).nullable().optional();

export const schemas = {
  categories: {
    list: { query: listQuery.extend({ type: z.enum(['place', 'product', 'video']).optional() }) },
    create: { body: z.object({ type: z.enum(['place', 'product', 'video']), name }).strict() },
    update: { params: idParam, body: z.object({ name: name.optional(), isActive: z.boolean().optional() }).strict().refine((v) => Object.keys(v).length, 'Enviá al menos un campo') },
  },
  brands: {
    list: { query: listQuery },
    create: { body: z.object({ name, website }).strict() },
    update: { params: idParam, body: z.object({ name: name.optional(), website, isActive: z.boolean().optional() }).strict().refine((v) => Object.keys(v).length, 'Enviá al menos un campo') },
  },
  cities: {
    list: { query: listQuery },
    create: { body: z.object({ name: z.string().trim().min(2).max(100), region: z.string().trim().max(100).nullable().optional(), country: z.string().length(2).toUpperCase().optional() }).strict() },
    update: { params: idParam, body: z.object({ name: z.string().trim().min(2).max(100).optional(), region: z.string().trim().max(100).nullable().optional(), country: z.string().length(2).toUpperCase().optional() }).strict().refine((v) => Object.keys(v).length, 'Enviá al menos un campo') },
  },
  simple: {
    list: { query: listQuery },
    create: { body: z.object({ name }).strict() },
    update: { params: idParam, body: z.object({ name }).strict() },
  },
};
export const idOnly = { params: idParam };
