import { describe, it, expect } from 'vitest';
import { pool } from '../src/config/db.js';
import { ensureDefaults } from '../src/repositories/settings.repo.js';

describe('configuración inicial de producción', () => {
  it('ensureDefaults crea las filas que faltan y no pisa las existentes', async () => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction(); // todo se deshace: no afecta a los demás tests
      await conn.query('DELETE FROM featured_content');
      await conn.query('DELETE FROM featured_settings');
      await conn.query('DELETE FROM app_settings');
      await ensureDefaults(conn);
      const [fs] = await conn.query('SELECT slot, mode FROM featured_settings ORDER BY CAST(slot AS CHAR)');
      expect(fs.map((r) => r.slot)).toEqual(['place', 'product', 'video']);
      expect(fs.every((r) => r.mode === 'automatic')).toBe(true);
      const [as] = await conn.query("SELECT setting_value FROM app_settings WHERE setting_key = 'require_moderation_places'");
      expect(as[0].setting_value).toBe('1');
      // idempotente: un valor cambiado por el admin se conserva
      await conn.query("UPDATE featured_settings SET mode = 'manual' WHERE slot = 'video'");
      await ensureDefaults(conn);
      const [v] = await conn.query("SELECT mode FROM featured_settings WHERE slot = 'video'");
      expect(v[0].mode).toBe('manual');
    } finally {
      await conn.rollback();
      conn.release();
    }
  });
  it('carga los catálogos básicos solo si la tabla está vacía', async () => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM place_amenities');
      await conn.query('DELETE FROM amenities');
      await ensureDefaults(conn);
      const [[a]] = await conn.query('SELECT COUNT(*) AS n FROM amenities');
      expect(a.n).toBe(8);
      await conn.query("DELETE FROM place_amenities");
      await conn.query("DELETE FROM amenities WHERE name = 'Baños'");
      await ensureDefaults(conn); // ya hay filas: lo que el admin borró no vuelve
      const [[b]] = await conn.query('SELECT COUNT(*) AS n FROM amenities');
      expect(b.n).toBe(7);
    } finally {
      await conn.rollback();
      conn.release();
    }
  });
});

describe('proveedores de video', () => {
  it('ensureVideoProviders amplía una base antigua y es idempotente', async () => {
    const { ensureVideoProviders } = await import('../src/repositories/settings.repo.js');
    const col = async () => (await pool.query("SELECT COLUMN_TYPE AS t FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'videos' AND COLUMN_NAME = 'provider'"))[0][0].t;
    await pool.query("DELETE FROM videos WHERE provider = 'instagram'");
    await pool.query("ALTER TABLE videos MODIFY provider ENUM('youtube','vimeo','other') NOT NULL DEFAULT 'other'");
    await ensureVideoProviders(); await ensureVideoProviders();
    expect(await col()).toContain("'instagram'");
  });
});
