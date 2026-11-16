import { pool } from '../config/db.js';
import { escapeLike, whereBuilder } from '../utils/pagination.js';

const SORTS = {
  oldest: 'p.created_at ASC, p.id ASC',
  newest: 'COALESCE(p.published_at, p.created_at) DESC, p.id DESC',
  rating: 'p.avg_rating DESC, p.review_count DESC, p.id DESC',
  reviews: 'p.review_count DESC, p.avg_rating DESC, p.id DESC',
  name: 'p.name ASC, p.id ASC',
  price_asc: 'p.price_amount IS NULL, p.price_amount ASC, p.id ASC',   // sin precio al final
  price_desc: 'p.price_amount IS NULL, p.price_amount DESC, p.id ASC',
};

export async function search(f, db = pool) {
  const w = whereBuilder();
  if (f.statuses) w.add(`p.status IN (${f.statuses.map(() => '?').join(',')})`, ...f.statuses);
  if (!f.includeDeleted) w.add('p.deleted_at IS NULL');
  if (f.submittedBy) w.add('p.submitted_by = ?', f.submittedBy);
  if (f.ids) w.add('p.id IN (?)', f.ids);
  if (f.q) { const like = `%${escapeLike(f.q)}%`; w.add('(p.name LIKE ? OR p.description LIKE ? OR b.name LIKE ?)', like, like, like); }
  if (f.categoryId) w.add('p.category_id = ?', f.categoryId);
  if (f.brandId) w.add('p.brand_id = ?', f.brandId);
  if (f.minPrice !== undefined) w.add('p.price_amount >= ?', f.minPrice);   // los productos sin precio quedan fuera al filtrar por precio
  if (f.maxPrice !== undefined) w.add('p.price_amount <= ?', f.maxPrice);
  if (f.minRating !== undefined) w.add('p.avg_rating >= ?', f.minRating);
  if (f.minReviews !== undefined) w.add('p.review_count >= ?', f.minReviews);
  if (f.publishedAfter) w.add('p.published_at >= ?', f.publishedAfter);
  if (f.publishedBefore) w.add('p.published_at < DATE_ADD(?, INTERVAL 1 DAY)', f.publishedBefore);
  const from = 'FROM products p JOIN brands b ON b.id = p.brand_id JOIN categories c ON c.id = p.category_id';
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total ${from} ${w.sql}`, w.params);
  const [rows] = await db.query(
    `SELECT p.id, p.name, p.slug, p.status, p.rejection_reason, p.submitted_by, p.price_amount, p.price_currency, p.avg_rating, p.review_count, p.published_at, p.created_at,
            b.id AS brand_id, b.name AS brand_name, c.id AS category_id, c.name AS category_name,
            (SELECT i.url FROM product_images i WHERE i.product_id = p.id ORDER BY i.position, i.id LIMIT 1) AS cover_url
       ${from} ${w.sql} ORDER BY ${SORTS[f.sort] ?? SORTS.newest} LIMIT ? OFFSET ?`,
    [...w.params, f.limit, f.offset]);
  return { total, rows };
}

export async function findDetail(ref, db = pool) {
  const [rows] = await db.query(
    `SELECT p.*, b.name AS brand_name, c.name AS category_name, u.display_name AS submitter_name
       FROM products p JOIN brands b ON b.id = p.brand_id JOIN categories c ON c.id = p.category_id LEFT JOIN users u ON u.id = p.submitted_by
      WHERE ${/^\d+$/.test(ref) ? 'p.id' : 'p.slug'} = ?`, [ref]);
  const row = rows[0];
  if (!row) return null;
  const [[specs], [images]] = await Promise.all([
    db.query('SELECT spec_key, spec_value FROM product_specs WHERE product_id = ? ORDER BY spec_key', [row.id]),
    db.query('SELECT id, url, position FROM product_images WHERE product_id = ? ORDER BY position, id', [row.id]),
  ]);
  return { row, specs, images };
}

export async function duplicateExists(brandId, name, exceptId = null, db = pool) {
  const [rows] = await db.query('SELECT 1 FROM products WHERE brand_id = ? AND name = ? AND deleted_at IS NULL AND id <> ? LIMIT 1', [brandId, name, exceptId ?? 0]);
  return rows.length > 0;
}
export async function insert(d, db = pool) {
  const [res] = await db.query(
    `INSERT INTO products (name, slug, description, brand_id, category_id, price_amount, price_currency, status, submitted_by, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [d.name, d.slug, d.description ?? null, d.brandId, d.categoryId, d.price?.amount ?? null, d.price?.currency ?? null, d.status, d.submittedBy, d.status === 'published' ? new Date() : null]);
  return res.insertId;
}
export async function updateFields(id, d, db = pool) {
  const sets = []; const values = [];
  const add = (col, v) => { sets.push(`${col} = ?`); values.push(v); };
  if (d.name !== undefined) add('name', d.name);
  if (d.description !== undefined) add('description', d.description);
  if (d.brandId !== undefined) add('brand_id', d.brandId);
  if (d.categoryId !== undefined) add('category_id', d.categoryId);
  if (d.price !== undefined) { add('price_amount', d.price?.amount ?? null); add('price_currency', d.price?.currency ?? null); }
  if (sets.length) await db.query(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`, [...values, id]);
}
export async function replaceSpecs(id, specs, db = pool) {
  if (specs === undefined) return;
  await db.query('DELETE FROM product_specs WHERE product_id = ?', [id]);
  if (specs.length) await db.query('INSERT INTO product_specs (product_id, spec_key, spec_value) VALUES ?', [specs.map((s) => [id, s.key, s.value])]);
}
