import mysql from 'mysql2/promise';
import { env, databaseUrl } from './env.js';

// Opciones comunes: fechas en UTC y DECIMAL como número (no string).
const common = {
  waitForConnections: true,
  connectionLimit: 10,
  timezone: 'Z',
  charset: 'utf8mb4',
  decimalNumbers: true,
};

export function buildConnectionConfig({ withDatabase = true } = {}) {
  if (databaseUrl) return { uri: databaseUrl, ...common };
  return {
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    ...(withDatabase ? { database: env.DB_NAME } : {}),
    ...common,
  };
}

// Pool compartido. Todas las consultas del proyecto deben usar parámetros (?).
export const pool = mysql.createPool(buildConnectionConfig());

// Cada conexión trabaja en UTC: NOW()/CURRENT_TIMESTAMP deben coincidir con las fechas
// que mysql2 convierte (timezone 'Z'). Sin esto, un servidor MySQL con hora local
// (p. ej. XAMPP en Argentina, UTC-3) rompería los vencimientos de tokens.
pool.pool.on('connection', (conn) => conn.query("SET time_zone = '+00:00'"));

/** Ejecuta varias operaciones en una transacción; rollback ante cualquier error. */
export async function withTransaction(work) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
