import { pool } from '../config/db.js';

export async function getInt(key, fallback, db = pool) {
  const [rows] = await db.query('SELECT setting_value FROM app_settings WHERE setting_key = ?', [key]);
  const n = Number.parseInt(rows[0]?.setting_value, 10);
  return Number.isNaN(n) ? fallback : n;
}
