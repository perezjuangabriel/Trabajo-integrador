import cron from 'node-cron';
import { purgeDueAccounts } from '../services/accountDeletion.service.js';
import * as refreshRepo from '../repositories/refreshTokens.repo.js';
import { refreshAll } from '../services/featured.service.js';
import * as authTokens from '../repositories/authTokens.repo.js';

// Tareas periódicas. Cada una captura su error para no tumbar el proceso.
const safe = (name, fn) => async () => {
  try { const r = await fn(); console.log(`[job:${name}] ok`, r ?? ''); } catch (e) { console.error(`[job:${name}] falló:`, e); }
};

export function startJobs() {
  cron.schedule('5 * * * *', safe('featured', refreshAll));                         // destacados: renueva los vencidos (cada hora)
  cron.schedule('15 3 * * *', safe('purge-accounts', purgeDueAccounts));          // bajas de cuenta vencidas
  cron.schedule('30 3 * * *', safe('purge-tokens', async () => {                   // limpieza de tokens viejos
    await refreshRepo.deleteExpired(); await authTokens.deleteExpired();
  }));
}
