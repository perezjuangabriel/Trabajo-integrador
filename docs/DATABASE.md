# Base de datos SPOTCHECK

Motor: MySQL 8 / MariaDB 10.4+ (InnoDB, utf8mb4, fechas en UTC).
Archivos: `database/schema.sql` (estructura), `database/seed.sql` (datos ficticios), `database/00_create_database.sql` (uso manual con XAMPP).

## Tablas (30)
Identidad: `users`, `auth_accounts`, `refresh_tokens`, `auth_tokens`.
Catálogos: `categories`, `brands`, `cities`, `surface_types`, `obstacle_types`, `amenities`.
Lugares: `places`, `place_categories`, `place_obstacles`, `place_amenities`, `place_hours`, `place_images`.
Productos: `products`, `product_specs`, `product_images`. Videos: `videos`.
Reseñas: `reviews`, `video_reviews`, `review_images`. Social: `favorites`.
Moderación: `reports`, `moderation_logs`, `audit_logs`.
Destacados/config: `featured_settings`, `featured_content`, `app_settings`.

## Normalización
**1FN (valores atómicos, sin grupos repetitivos).** Obstáculos, servicios, categorías secundarias y horarios de un lugar NO son columnas de texto con listas: son tablas hijas (`place_obstacles`, `place_amenities`, `place_categories`, `place_hours`). Las especificaciones de un producto van en `product_specs` (una fila por especificación) y las imágenes en tablas `*_images` (una fila por imagen).

**2FN (dependencia completa de la clave compuesta).** En las tablas con PK compuesta (`place_obstacles`, `place_amenities`, `place_categories`, `place_hours`, `product_specs`) todo atributo no clave depende de la clave completa: `opens_at/closes_at` dependen de (`place_id`, `weekday`), `spec_value` de (`product_id`, `spec_key`). Las tablas puente no guardan atributos del lugar ni del catálogo.

**3FN (sin dependencias transitivas).** La ciudad, la superficie, la marca y la categoría no se repiten como texto: `places.city_id → cities`, `places.surface_type_id → surface_types`, `products.brand_id → brands`, `*.category_id → categories`. Así `region` y `country` dependen de la ciudad y no del lugar. Las cuentas externas viven en `auth_accounts`, no en `users`.

## Excepciones deliberadas
- `avg_rating` y `review_count` en `places/products/videos` son **caché derivada** (desnormalización controlada) para listar y ordenar sin agregar en cada consulta. Se recalculan en la misma transacción que modifica una reseña, solo con `status='visible'`. El seed y las pruebas verifican que coinciden con el recálculo.
- `moderation_logs.target_type/target_id` no tiene clave foránea a propósito: es historial que debe sobrevivir al borrado del objetivo.
- `reviews`, `favorites`, `reports` y `featured_content` usan varias FK anulables con `CHECK` de "exactamente un destino" en vez de una columna polimórfica sin integridad referencial.
- Límite conocido: que `place_categories.category_id` sea de tipo `place` lo valida la aplicación (MySQL no permite CHECK entre tablas).

## Decisiones de bajas
- Lugares/productos/videos: baja lógica (`deleted_at`) + `status`. Usuarios: `status` y anonimización.
- Reseña propia: baja **física** (permite reseñar de nuevo); ocultar por moderación = `status='hidden'`.
- Eliminación de cuenta (decisión del cliente): se **eliminan sus reseñas**, favoritos y tokens (`ON DELETE CASCADE`); lo que propuso queda con `submitted_by = NULL`. Período de gracia configurable (`account_deletion_grace_days`).
- Imágenes: en la BD solo URL y metadatos; los archivos van al disco del servidor (volumen en Railway).

## Verificación
`npm test` en `/backend` recrea una base aparte (`spotcheck_test`, con salvaguarda: el nombre debe terminar en `_test` y se ignora `MYSQL_URL`) y ejecuta 137 pruebas distribuidas en 12 archivos (esquema, autenticación, roles, OAuth, baja de cuenta, adaptadores de proveedor, catálogos de apoyo, lugares, productos, videos, moderación e imágenes).
Resultado (Etapa 3): **137/137 en MySQL 8.0.46 y en MariaDB 10.11.14**, y también con el servidor en huso UTC-3 (la app fuerza UTC por conexión). Probado con MariaDB/MySQL reales, no con la versión exacta de tu XAMPP.

## Cambios por etapa
- Etapa 2: `auth_tokens.purpose` suma `oauth_exchange` y la columna `payload` (challenge PKCE del canje OAuth).
