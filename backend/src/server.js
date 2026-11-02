import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './config/db.js';
import { startJobs } from './jobs/index.js';

const app = createApp();
const server = app.listen(env.PORT, () => {
  console.log(`SPOTCHECK API escuchando en :${env.PORT} (${env.NODE_ENV})`);
  startJobs();
});

// Cierre ordenado (Render envía SIGTERM al redeployar).
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => server.close(async () => { await pool.end(); process.exit(0); }));
}
