// Descripción de los tres tipos de contenido del catálogo. Los nombres de tabla salen SOLO de aquí
// (nunca de la entrada del usuario), por eso es seguro interpolarlos en SQL.
export const KINDS = {
  place:   { table: 'places',   label: 'lugar',    categoryType: 'place',   settingKey: 'require_moderation_places',   imageTable: 'place_images',   imageFk: 'place_id' },
  product: { table: 'products', label: 'producto', categoryType: 'product', settingKey: 'require_moderation_products', imageTable: 'product_images', imageFk: 'product_id' },
  video:   { table: 'videos',   label: 'video',    categoryType: 'video',   settingKey: 'require_moderation_videos',   imageTable: null,             imageFk: null },
};
export const KIND_NAMES = Object.keys(KINDS);
export const STAFF_ROLES = ['moderator', 'admin'];
export const MAX_PENDING_PER_USER = 10;
export const MAX_IMAGES_PER_ENTITY = 8;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
