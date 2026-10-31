import { env } from '../src/config/env.js';
import { setupDatabase } from '../scripts/setup-lib.js';

// Recrea la base de pruebas desde cero (esquema + datos demo) antes de cada corrida.
export default async function setup() {
  if (!env.DB_NAME.endsWith('_test')) throw new Error(`Salvaguarda: la base de pruebas debe terminar en _test (es "${env.DB_NAME}")`);
  await setupDatabase({ seed: true });
}
