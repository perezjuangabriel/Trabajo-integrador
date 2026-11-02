import 'dotenv/config';
import { z } from 'zod';

const csv = (v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

// Variables de entorno validadas al arrancar: si falta algo crítico, falla rápido.
const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(3000),
    TRUST_PROXY: z.coerce.number().default(1), // Render está detrás de 1 proxy

    // MySQL: URL completa (Render/Aiven la entregan como URL) o variables sueltas (XAMPP).
    DATABASE_URL: z.string().optional(),
    MYSQL_URL: z.string().optional(),
    DB_HOST: z.string().default('127.0.0.1'),
    DB_PORT: z.coerce.number().default(3306),
    DB_USER: z.string().default('root'),
    DB_PASSWORD: z.string().default(''),
    DB_NAME: z.string().default('spotcheck'),
    DB_SSL: z.enum(['true', 'false']).default('false'), // true para bases en la nube (Aiven, etc.)
    DB_SSL_CA: z.string().optional(), // certificado CA en PEM; si falta, la conexión se cifra pero no se verifica el servidor
    WEB_DIR: z.string().default('./public'), // carpeta de la versión web exportada (si existe, se sirve en /)

    // Secreto para firmar JWT y para el HMAC de los códigos de un solo uso.
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET debe tener al menos 32 caracteres'),
    JWT_ACCESS_TTL: z.string().default('15m'),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),
    CODE_TTL_MIN: z.coerce.number().default(15),
    SENSITIVE_TTL_MIN: z.coerce.number().default(5),
    BCRYPT_COST: z.coerce.number().min(4).max(15).default(12),

    RESEND_API_KEY: z.string().optional(),
    BREVO_API_KEY: z.string().optional(),
    MAIL_FROM: z.string().default('SPOTCHECK <onboarding@resend.dev>'),

    UPLOADS_DIR: z.string().default('./uploads'),
    PUBLIC_BASE_URL: z.string().default('http://localhost:3000'),
    CORS_ORIGINS: z.string().optional().transform(csv),

    // OAuth: el secreto vive SOLO aquí. Sin credenciales, el proveedor responde 503.
    OAUTH_APP_REDIRECTS: z.string().default('spotcheck://auth').transform(csv),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
    DISCORD_CLIENT_ID: z.string().optional(),
    DISCORD_CLIENT_SECRET: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.NODE_ENV === 'production' && !v.RESEND_API_KEY && !v.BREVO_API_KEY) {
      ctx.addIssue({ code: 'custom', path: ['RESEND_API_KEY'], message: 'Obligatoria en producción' });
    }
  });

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Configuración de entorno inválida:\n' + z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
export const databaseUrl = env.DATABASE_URL || env.MYSQL_URL || null;
