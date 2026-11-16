import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './config/db.js';
import { startJobs } from './jobs/index.js';
import { ensureDefaults } from './repositories/settings.repo.js';

// Si la base aún no tiene la configuración inicial (producción recién creada), se completa sin pisar lo existente.
await ensureDefaults().catch((e) => console.error('[defaults] no se pudo completar la configuración inicial:', e.message));

const app = createApp();
const server = app.listen(env.PORT, () => {
  console.log(`SPOTCHECK API escuchando en :${env.PORT} (${env.NODE_ENV})`);
  startJobs();
});

// Cierre ordenado (Render envía SIGTERM al redeployar).
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => server.close(async () => { await pool.end(); process.exit(0); }));
}
