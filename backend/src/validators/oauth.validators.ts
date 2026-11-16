import { z } from 'zod';
import { PROVIDER_NAMES } from '../services/oauthProviders.js';

const provider = z.enum(PROVIDER_NAMES);
export const startSchema = {
  params: z.object({ provider }),
  query: z.object({
    code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'code_challenge debe ser SHA-256 en base64url'),
    app_redirect: z.string().max(200).optional(),
  }),
};
export const linkStartSchema = { params: z.object({ provider }), body: z.object({ appRedirect: z.string().max(200).optional() }) };
export const callbackSchema = {
  params: z.object({ provider }),
  query: z.object({ code: z.string().max(2000).optional(), state: z.string().max(4000), error: z.string().max(200).optional() }),
};
export const exchangeSchema = {
  body: z.object({
    code: z.string().min(20).max(200),
    codeVerifier: z.string().regex(/^[A-Za-z0-9\-._~]{43,128}$/, 'codeVerifier inválido'),
  }),
};
export const unlinkSchema = { params: z.object({ provider }) };
