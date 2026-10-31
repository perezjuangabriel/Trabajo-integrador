import { z } from 'zod';

export const email = z.string().trim().toLowerCase().max(254).pipe(z.email('Correo inválido'));

// bcrypt solo usa los primeros 72 bytes: se limita para no truncar en silencio.
export const newPassword = z
  .string()
  .min(8, 'Mínimo 8 caracteres')
  .refine((v) => Buffer.byteLength(v) <= 72, 'Máximo 72 bytes')
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Debe incluir letras y números');

export const code6 = z.string().regex(/^\d{6}$/, 'El código tiene 6 dígitos');
export const displayName = z.string().trim().min(2, 'Mínimo 2 caracteres').max(60);
export const idParam = z.object({ id: z.coerce.number().int().positive() });
export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
