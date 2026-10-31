import { z } from 'zod';
import { posInt, text, refine1, baseListQuery, refParam } from './catalog.common.js';
import { idParam } from './common.js';

const fields = { title: z.string().trim().min(3).max(160), description: text(3000).nullable().optional(), url: z.string().trim().min(8).max(500), categoryId: posInt };
export const createVideoSchema = { body: z.object(fields).strict() };
export const updateVideoSchema = { params: idParam, body: refine1(z.object(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.optional()]))).strict()) };
export const listVideosSchema = { query: baseListQuery.extend({ sort: z.enum(['newest', 'rating', 'reviews', 'title']).default('newest') }) };
export const videoRefSchema = { params: refParam };
