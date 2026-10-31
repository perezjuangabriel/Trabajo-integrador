import { z } from 'zod';
import { email, newPassword, code6, displayName } from './common.js';

export const registerSchema = { body: z.object({ email, password: newPassword, displayName }) };
export const loginSchema = { body: z.object({ email, password: z.string().min(1).max(200) }) };
export const refreshSchema = { body: z.object({ refreshToken: z.string().min(20).max(200) }) };
export const verifyEmailSchema = { body: z.object({ email, code: code6 }) };
export const forgotSchema = { body: z.object({ email }) };
export const resetSchema = { body: z.object({ email, code: code6, newPassword }) };
export const changePasswordSchema = { body: z.object({ currentPassword: z.string().min(1).max(200), newPassword }) };
export const confirmSensitiveSchema = { body: z.object({ code: code6 }) };
