// "Plaza Hormigón #2" -> "plaza-hormigon-2" (sin tildes, minúsculas, solo [a-z0-9-]).
export const slugify = (text) =>
  text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'item';
