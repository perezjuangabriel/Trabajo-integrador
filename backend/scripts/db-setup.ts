// Uso: npm run db:setup           -> crea tablas
//      npm run db:seed            -> crea tablas + datos de prueba
// DESTRUCTIVO: borra y recrea todas las tablas de SPOTCHECK.
import { env } from '../src/config/env.js';
import { setupDatabase } from './setup-lib.js';

const withSeed = process.argv.includes('--seed');
if (env.NODE_ENV === 'production' && withSeed) {
  console.error('Se rechaza cargar datos de prueba con NODE_ENV=production.');
  process.exit(1);
}
try {
  await setupDatabase({ seed: withSeed });
  console.log(`✔ Esquema creado${withSeed ? ' + datos de prueba' : ''}`);
} catch (err) {
  console.error('✖ Error:', err.message);
  process.exit(1);
}
