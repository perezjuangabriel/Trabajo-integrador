// Uso: npm run db:setup           -> crea tablas
//      npm run db:seed            -> crea tablas + datos de prueba
// DESTRUCTIVO: borra y recrea todas las tablas de SPOTCHECK.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { env, databaseUrl } from '../src/config/env.js';
import { buildConnectionConfig } from '../src/config/db.js';

const dbDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../database');
const withSeed = process.argv.includes('--seed');

if (env.NODE_ENV === 'production' && withSeed) {
  console.error('Se rechaza cargar datos de prueba con NODE_ENV=production.');
  process.exit(1);
}

async function main() {
  // Con URL (Railway) la base ya existe. En local la creamos si hace falta.
  if (!databaseUrl) {
    const admin = await mysql.createConnection(buildConnectionConfig({ withDatabase: false }));
    await admin.query(
      `CREATE DATABASE IF NOT EXISTS \`${env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await admin.end();
  }

  const { uri, ...rest } = buildConnectionConfig();
  const conn = await mysql.createConnection(
    uri ? { uri, multipleStatements: true } : { ...rest, multipleStatements: true },
  );

  await conn.query(await readFile(path.join(dbDir, 'schema.sql'), 'utf8'));
  console.log('✔ Esquema creado');
  if (withSeed) {
    await conn.query(await readFile(path.join(dbDir, 'seed.sql'), 'utf8'));
    console.log('✔ Datos de prueba cargados');
  }
  await conn.end();
}

main().catch((err) => {
  console.error('✖ Error:', err.message);
  process.exit(1);
});
