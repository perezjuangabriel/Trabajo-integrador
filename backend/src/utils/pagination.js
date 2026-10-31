export const pageOf = (items, total, page, pageSize) => ({
  items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)),
});
export const offsetOf = (page, pageSize) => (page - 1) * pageSize;
// Escapa % _ \ para que el texto buscado se trate como literal en un LIKE.
export const escapeLike = (s) => s.replace(/[\\%_]/g, '\\$&');
// Armador de WHERE con parámetros (nunca concatena valores).
export function whereBuilder() {
  const clauses = [];
  const params = [];
  return {
    add(sql, ...p) { clauses.push(sql); params.push(...p); return this; },
    get sql() { return clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''; },
    params,
  };
}
