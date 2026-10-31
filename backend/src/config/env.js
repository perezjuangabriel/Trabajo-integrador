import 'dotenv/config';
import { z } from 'zod';

// Variables de entorno validadas al arrancar: si falta algo crítico, falla rápido.
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),

  // MySQL: URL completa (Railway la entrega como MYSQL_URL) o variables sueltas (XAMPP).
  DATABASE_URL: z.string().optional(),
  MYSQL_URL: z.string().optional(),
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().default(3306),
  DB_USER: z.string().default('root'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().default('spotcheck'),

  // Se exigen en la etapa de autenticación; por ahora son opcionales.
  JWT_ACCESS_SECRET: z.string().min(32).optional(),
  JWT_ACCESS_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),

  RESEND_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default('SPOTCHECK <onboarding@resend.dev>'),

  UPLOADS_DIR: z.string().default('./uploads'),
  PUBLIC_BASE_URL: z.string().default('http://localhost:3000'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Configuración de entorno inválida:', z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
export const databaseUrl = env.DATABASE_URL || env.MYSQL_URL || null;
