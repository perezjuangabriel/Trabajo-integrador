import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { env, databaseUrl } from '../src/config/env.js';
import { buildConnectionConfig } from '../src/config/db.js';

const dbDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../database');

/** Crea (si hace falta) la base y recrea tablas; opcionalmente carga los datos de prueba. DESTRUCTIVO. */
export async function setupDatabase({ seed = false } = {}) {
  // Con URL (Railway) la base ya existe. En local la creamos si hace falta.
  if (!databaseUrl) {
    const admin = await mysql.createConnection(buildConnectionConfig({ withDatabase: false }));
    await admin.query(`CREATE DATABASE IF NOT EXISTS \`${env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await admin.end();
  }
  const { uri, ...rest } = buildConnectionConfig();
  const conn = await mysql.createConnection(uri ? { uri, multipleStatements: true } : { ...rest, multipleStatements: true });
  try {
    await conn.query(await readFile(path.join(dbDir, 'schema.sql'), 'utf8'));
    if (seed) await conn.query(await readFile(path.join(dbDir, 'seed.sql'), 'utf8'));
  } finally {
    await conn.end();
  }
}
