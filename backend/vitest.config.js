import { defineConfig } from 'vitest/config';

// Las pruebas usan SIEMPRE una base aparte (spotcheck_test) y jamás la URL de producción.
delete process.env.DATABASE_URL;
delete process.env.MYSQL_URL;
process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.DB_NAME_TEST || 'spotcheck_test';
process.env.JWT_ACCESS_SECRET = 'test-secret-test-secret-test-secret-0123456789';
process.env.BCRYPT_COST = '4';
process.env.PUBLIC_BASE_URL = 'http://api.test';
process.env.OAUTH_APP_REDIRECTS = 'spotcheck://auth,exp://127.0.0.1:8081/--/auth';
process.env.UPLOADS_DIR = '/tmp/spotcheck-test-uploads';
for (const k of ['RESEND_API_KEY', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET']) delete process.env[k];

export default defineConfig({
  test: { environment: 'node', globalSetup: ['./tests/globalSetup.js'], fileParallelism: false, testTimeout: 20000 },
});
