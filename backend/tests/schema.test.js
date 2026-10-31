// Pruebas de integridad del esquema contra MySQL/MariaDB real.
// Requisito: haber ejecutado `npm run db:seed`. Cada prueba corre en una
// transacción que se revierte, por lo que no altera los datos.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '../src/config/db.js';

let conn;
beforeAll(async () => { conn = await pool.getConnection(); });
afterAll(async () => { conn.release(); await pool.end(); });

// Ejecuta fn dentro de una transacción y siempre hace rollback.
async function inRollback(fn) {
  await conn.beginTransaction();
  try { return await fn(); } finally { await conn.rollback(); }
}
const failsWith = async (promise, code) => {
  await expect(promise).rejects.toMatchObject({ code });
};

describe('conexión y datos de prueba', () => {
  it('se conecta y encuentra los 3 roles sembrados', async () => {
    const [rows] = await conn.query('SELECT role, COUNT(*) n FROM users GROUP BY role ORDER BY CAST(role AS CHAR)');
    expect(rows.map((r) => r.role)).toEqual(['admin', 'moderator', 'user']);
  });
});

describe('reseñas', () => {
  it('rechaza una segunda reseña del mismo usuario sobre el mismo lugar', () =>
    inRollback(() => failsWith(
      conn.query("INSERT INTO reviews (user_id, place_id, rating, comment) VALUES (3, 1, 4, 'otra')"),
      'ER_DUP_ENTRY')));

  it('rechaza puntuación fuera de 1..5', () =>
    inRollback(async () => {
      await expect(conn.query("INSERT INTO reviews (user_id, place_id, rating, comment) VALUES (6, 2, 6, 'x')")).rejects.toThrow();
      await expect(conn.query("INSERT INTO reviews (user_id, place_id, rating, comment) VALUES (6, 2, 0, 'x')")).rejects.toThrow();
    }));

  it('exige exactamente un destino (lugar o producto)', () =>
    inRollback(async () => {
      await expect(conn.query("INSERT INTO reviews (user_id, place_id, product_id, rating, comment) VALUES (6, 2, 2, 4, 'x')")).rejects.toThrow();
      await expect(conn.query("INSERT INTO reviews (user_id, rating, comment) VALUES (6, 4, 'x')")).rejects.toThrow();
    }));

  it('el promedio guardado coincide con el recálculo usando solo reseñas visibles', async () => {
    const [rows] = await conn.query(`
      SELECT p.id, p.avg_rating, p.review_count,
             COALESCE(ROUND(AVG(r.rating),2),0) AS calc_avg, COUNT(r.id) AS calc_n
      FROM places p LEFT JOIN reviews r ON r.place_id = p.id AND r.status = 'visible'
      GROUP BY p.id`);
    for (const r of rows) {
      expect(r.review_count).toBe(r.calc_n);
      expect(Number(r.avg_rating)).toBeCloseTo(Number(r.calc_avg), 2);
    }
  });

  it('las reseñas oculta y pendiente sembradas no entran en los promedios', async () => {
    const [[p1]] = await conn.query('SELECT avg_rating, review_count FROM places WHERE id = 1');
    expect(p1.review_count).toBe(3);               // 4 reseñas, 1 oculta
    expect(Number(p1.avg_rating)).toBeCloseTo(4.67, 2);
    const [[p6]] = await conn.query('SELECT review_count FROM places WHERE id = 6');
    expect(p6.review_count).toBe(0);               // la única reseña está pendiente
  });
});

describe('favoritos', () => {
  it('rechaza favoritos duplicados', () =>
    inRollback(() => failsWith(
      conn.query('INSERT INTO favorites (user_id, place_id) VALUES (3, 1)'), 'ER_DUP_ENTRY')));
  it('exige exactamente un destino', () =>
    inRollback(() => expect(conn.query('INSERT INTO favorites (user_id, place_id, product_id) VALUES (6, 2, 2)')).rejects.toThrow()));
});

describe('cuentas y sesión', () => {
  it('rechaza correo duplicado', () =>
    inRollback(() => failsWith(
      conn.query("INSERT INTO users (email, display_name) VALUES ('admin@spotcheck.test', 'Dup')"), 'ER_DUP_ENTRY')));
  it('rechaza vincular la misma identidad de proveedor a dos usuarios', () =>
    inRollback(async () => {
      await conn.query("INSERT INTO auth_accounts (user_id, provider, provider_user_id) VALUES (3, 'google', 'g-123')");
      await failsWith(conn.query("INSERT INTO auth_accounts (user_id, provider, provider_user_id) VALUES (4, 'google', 'g-123')"), 'ER_DUP_ENTRY');
    }));
  it('el rol por defecto de un registro nuevo es user', () =>
    inRollback(async () => {
      const [res] = await conn.query("INSERT INTO users (email, display_name) VALUES ('nuevo@spotcheck.test', 'Nuevo')");
      const [[u]] = await conn.query('SELECT role, status FROM users WHERE id = ?', [res.insertId]);
      expect(u).toEqual({ role: 'user', status: 'active' });
    }));
  it('al borrar un usuario se eliminan sus reseñas, favoritos y tokens (decisión: eliminar reseñas)', () =>
    inRollback(async () => {
      await conn.query('DELETE FROM users WHERE id = 3');
      const [[r]] = await conn.query('SELECT COUNT(*) n FROM reviews WHERE user_id = 3');
      const [[f]] = await conn.query('SELECT COUNT(*) n FROM favorites WHERE user_id = 3');
      expect(r.n + f.n).toBe(0);
      // Los lugares que propuso siguen existiendo (submitted_by -> NULL).
      const [[p]] = await conn.query('SELECT submitted_by FROM places WHERE id = 1');
      expect(p.submitted_by).toBeNull();
    }));
});

describe('destacados y contenido', () => {
  it('la ranura debe coincidir con el tipo de contenido', () =>
    inRollback(() => expect(conn.query(
      "INSERT INTO featured_content (slot, product_id, selection, starts_at) VALUES ('place', 1, 'manual', NOW())")).rejects.toThrow()));
  it('un producto exige moneda si tiene precio', () =>
    inRollback(() => expect(conn.query(
      "INSERT INTO products (name, slug, brand_id, category_id, price_amount) VALUES ('x','x',1,5,100)")).rejects.toThrow()));
  it('no permite eliminar una categoría en uso', () =>
    inRollback(() => failsWith(conn.query('DELETE FROM categories WHERE id = 2'), 'ER_ROW_IS_REFERENCED_2')));
  it('la búsqueda de texto completo encuentra lugares', async () => {
    const [rows] = await conn.query("SELECT id FROM places WHERE MATCH(name, description) AGAINST (? IN NATURAL LANGUAGE MODE)", ['bowl']);
    expect(rows.length).toBeGreaterThan(0);
  });
});
