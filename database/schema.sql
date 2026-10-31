-- =============================================================================
-- SPOTCHECK — Esquema relacional
-- Compatible con MySQL 8.0+ y MariaDB 10.4+ (XAMPP). Motor InnoDB, utf8mb4.
-- Todas las fechas se guardan en UTC. Este script NO crea la base de datos:
-- se ejecuta contra la base ya seleccionada (ver database/00_create_database.sql
-- para el uso manual con XAMPP/phpMyAdmin, o `npm run db:setup` en /backend).
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS audit_logs, moderation_logs, featured_content, featured_settings,
  app_settings, reports, favorites, review_images, video_reviews, reviews,
  product_specs, product_images, products, videos, place_images, place_hours,
  place_amenities, place_obstacles, place_categories, places, amenities,
  obstacle_types, surface_types, brands, categories, cities, auth_tokens,
  refresh_tokens, auth_accounts, users;

SET FOREIGN_KEY_CHECKS = 1;

-- -----------------------------------------------------------------------------
-- 1. Identidad y sesión
-- -----------------------------------------------------------------------------

CREATE TABLE users (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email                 VARCHAR(255)    NOT NULL,
  password_hash         VARCHAR(255)    NULL COMMENT 'NULL si la cuenta solo usa OAuth',
  display_name          VARCHAR(60)     NOT NULL,
  avatar_url            VARCHAR(500)    NULL,
  bio                   VARCHAR(500)    NULL,
  role                  ENUM('user','moderator','admin') NOT NULL DEFAULT 'user',
  status                ENUM('active','suspended','pending_deletion','deleted') NOT NULL DEFAULT 'active',
  suspended_reason      VARCHAR(255)    NULL,
  theme_preference      ENUM('system','light','dark') NOT NULL DEFAULT 'system',
  email_verified_at     DATETIME        NULL,
  failed_login_count    TINYINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until          DATETIME        NULL,
  last_login_at         DATETIME        NULL,
  deletion_requested_at DATETIME        NULL,
  deletion_scheduled_for DATETIME       NULL,
  deleted_at            DATETIME        NULL,
  created_at            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role_status (role, status),
  KEY idx_users_deletion (status, deletion_scheduled_for)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Una fila por proveedor vinculado. (provider, provider_user_id) identifica a la
-- persona en el proveedor; nunca se vincula solo por correo no verificado.
CREATE TABLE auth_accounts (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id          BIGINT UNSIGNED NOT NULL,
  provider         ENUM('google','github','discord') NOT NULL,
  provider_user_id VARCHAR(100)    NOT NULL,
  provider_email   VARCHAR(255)    NULL,
  created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_auth_provider_identity (provider, provider_user_id),
  UNIQUE KEY uq_auth_user_provider (user_id, provider),
  CONSTRAINT fk_auth_accounts_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Solo se guarda el hash SHA-256 del refresh token. family_id permite revocar
-- toda la cadena si se detecta reutilización de un token ya rotado.
CREATE TABLE refresh_tokens (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  token_hash  CHAR(64)        NOT NULL,
  family_id   CHAR(36)        NOT NULL,
  expires_at  DATETIME        NOT NULL,
  revoked_at  DATETIME        NULL,
  user_agent  VARCHAR(255)    NULL,
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_refresh_token_hash (token_hash),
  KEY idx_refresh_user (user_id, revoked_at),
  KEY idx_refresh_family (family_id),
  KEY idx_refresh_expires (expires_at),
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tokens/códigos de un solo uso: verificar correo, recuperar contraseña,
-- confirmar operaciones sensibles (código de 6 dígitos con límite de intentos) y
-- canjear el resultado de un login OAuth (con PKCE).
CREATE TABLE auth_tokens (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  purpose    ENUM('verify_email','reset_password','sensitive_action','oauth_exchange') NOT NULL,
  token_hash CHAR(64)        NOT NULL COMMENT 'HMAC-SHA256 del código/token, nunca el valor en claro',
  payload    VARCHAR(255)    NULL COMMENT 'oauth_exchange: code_challenge PKCE',
  attempts   TINYINT UNSIGNED NOT NULL DEFAULT 0,
  expires_at DATETIME        NOT NULL,
  used_at    DATETIME        NULL,
  created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_auth_tokens_lookup (user_id, purpose, used_at),
  KEY idx_auth_tokens_hash (token_hash),
  CONSTRAINT fk_auth_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. Catálogos de apoyo
-- -----------------------------------------------------------------------------

-- Categorías de los tres tipos de contenido; `type` evita mezclar dominios.
CREATE TABLE categories (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  type       ENUM('place','product','video') NOT NULL,
  name       VARCHAR(80)  NOT NULL,
  slug       VARCHAR(100) NOT NULL,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_type_slug (type, slug),
  UNIQUE KEY uq_categories_type_name (type, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE brands (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(80)  NOT NULL,
  slug       VARCHAR(100) NOT NULL,
  website    VARCHAR(255) NULL,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_brands_slug (slug),
  UNIQUE KEY uq_brands_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE cities (
  id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name    VARCHAR(100) NOT NULL,
  region  VARCHAR(100) NULL,
  country CHAR(2)      NOT NULL DEFAULT 'AR',
  PRIMARY KEY (id),
  UNIQUE KEY uq_cities_identity (name, region, country)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE surface_types (
  id   SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(60) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_surface_types_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE obstacle_types (
  id   SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(60) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_obstacle_types_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE amenities (
  id   SMALLINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(60) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_amenities_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. Spots y lugares
--    status: pending (propuesto) -> published | rejected ; hidden (moderación)
--    deleted_at: baja lógica. avg_rating / review_count: caché recalculable.
-- -----------------------------------------------------------------------------

CREATE TABLE places (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name             VARCHAR(120)    NOT NULL,
  slug             VARCHAR(160)    NOT NULL,
  description      TEXT            NULL,
  category_id      INT UNSIGNED    NOT NULL COMMENT 'Categoría principal',
  city_id          INT UNSIGNED    NOT NULL,
  zone             VARCHAR(100)    NULL COMMENT 'Barrio o zona dentro de la ciudad',
  address          VARCHAR(255)    NULL,
  latitude         DECIMAL(9,6)    NULL,
  longitude        DECIMAL(9,6)    NULL,
  surface_type_id  SMALLINT UNSIGNED NULL,
  status           ENUM('pending','published','rejected','hidden') NOT NULL DEFAULT 'pending',
  rejection_reason VARCHAR(255)    NULL,
  submitted_by     BIGINT UNSIGNED NULL,
  avg_rating       DECIMAL(3,2)    NOT NULL DEFAULT 0.00,
  review_count     INT UNSIGNED    NOT NULL DEFAULT 0,
  published_at     DATETIME        NULL,
  deleted_at       DATETIME        NULL,
  created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_places_slug (slug),
  KEY idx_places_listing (status, deleted_at, category_id, avg_rating),
  KEY idx_places_city (status, city_id),
  KEY idx_places_published (status, published_at),
  KEY idx_places_submitter (submitted_by),
  FULLTEXT KEY ft_places_search (name, description),
  CONSTRAINT chk_places_lat CHECK (latitude  IS NULL OR latitude  BETWEEN -90  AND 90),
  CONSTRAINT chk_places_lng CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  CONSTRAINT fk_places_category FOREIGN KEY (category_id) REFERENCES categories (id),
  CONSTRAINT fk_places_city     FOREIGN KEY (city_id)     REFERENCES cities (id),
  CONSTRAINT fk_places_surface  FOREIGN KEY (surface_type_id) REFERENCES surface_types (id),
  CONSTRAINT fk_places_submitter FOREIGN KEY (submitted_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Clasificaciones secundarias (etiquetas): un lugar puede ser Street y Plaza.
-- La app valida que la categoría sea de tipo 'place'.
CREATE TABLE place_categories (
  place_id    BIGINT UNSIGNED NOT NULL,
  category_id INT UNSIGNED    NOT NULL,
  PRIMARY KEY (place_id, category_id),
  KEY idx_place_categories_cat (category_id),
  CONSTRAINT fk_pc_place    FOREIGN KEY (place_id)    REFERENCES places (id)     ON DELETE CASCADE,
  CONSTRAINT fk_pc_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE place_obstacles (
  place_id         BIGINT UNSIGNED   NOT NULL,
  obstacle_type_id SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (place_id, obstacle_type_id),
  CONSTRAINT fk_po_place    FOREIGN KEY (place_id)         REFERENCES places (id)         ON DELETE CASCADE,
  CONSTRAINT fk_po_obstacle FOREIGN KEY (obstacle_type_id) REFERENCES obstacle_types (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE place_amenities (
  place_id    BIGINT UNSIGNED   NOT NULL,
  amenity_id  SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (place_id, amenity_id),
  CONSTRAINT fk_pa_place   FOREIGN KEY (place_id)   REFERENCES places (id)    ON DELETE CASCADE,
  CONSTRAINT fk_pa_amenity FOREIGN KEY (amenity_id) REFERENCES amenities (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Horario por día de la semana (0 = domingo ... 6 = sábado). Sin fila = se desconoce.
CREATE TABLE place_hours (
  place_id BIGINT UNSIGNED NOT NULL,
  weekday  TINYINT UNSIGNED NOT NULL,
  opens_at TIME NOT NULL,
  closes_at TIME NOT NULL,
  PRIMARY KEY (place_id, weekday),
  CONSTRAINT chk_place_hours_weekday CHECK (weekday BETWEEN 0 AND 6),
  CONSTRAINT fk_ph_place FOREIGN KEY (place_id) REFERENCES places (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Metadatos de imágenes; el archivo vive en el disco del servidor (volumen).
CREATE TABLE place_images (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  place_id     BIGINT UNSIGNED NOT NULL,
  url          VARCHAR(500)    NOT NULL,
  storage_path VARCHAR(500)    NULL COMMENT 'Ruta relativa en disco; NULL si la imagen es externa',
  mime_type    VARCHAR(50)     NULL,
  size_bytes   INT UNSIGNED    NULL,
  position     SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  uploaded_by  BIGINT UNSIGNED NULL,
  created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_place_images_place (place_id, position),
  CONSTRAINT fk_pi_place    FOREIGN KEY (place_id)    REFERENCES places (id) ON DELETE CASCADE,
  CONSTRAINT fk_pi_uploader FOREIGN KEY (uploaded_by) REFERENCES users (id)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. Productos (catálogo para descubrir y reseñar; sin carrito ni pagos)
-- -----------------------------------------------------------------------------

CREATE TABLE products (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name           VARCHAR(140)    NOT NULL,
  slug           VARCHAR(180)    NOT NULL,
  description    TEXT            NULL,
  brand_id       INT UNSIGNED    NOT NULL,
  category_id    INT UNSIGNED    NOT NULL,
  price_amount   DECIMAL(10,2)   NULL COMMENT 'Precio orientativo opcional',
  price_currency CHAR(3)         NULL,
  status         ENUM('pending','published','rejected','hidden') NOT NULL DEFAULT 'pending',
  rejection_reason VARCHAR(255)  NULL,
  submitted_by   BIGINT UNSIGNED NULL,
  avg_rating     DECIMAL(3,2)    NOT NULL DEFAULT 0.00,
  review_count   INT UNSIGNED    NOT NULL DEFAULT 0,
  published_at   DATETIME        NULL,
  deleted_at     DATETIME        NULL,
  created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_slug (slug),
  KEY idx_products_listing (status, deleted_at, category_id, avg_rating),
  KEY idx_products_brand (status, brand_id),
  KEY idx_products_price (status, price_amount),
  KEY idx_products_published (status, published_at),
  KEY idx_products_submitter (submitted_by),
  FULLTEXT KEY ft_products_search (name, description),
  CONSTRAINT chk_products_price CHECK (price_amount IS NULL OR price_amount >= 0),
  CONSTRAINT chk_products_price_pair CHECK ((price_amount IS NULL) = (price_currency IS NULL)),
  CONSTRAINT fk_products_brand     FOREIGN KEY (brand_id)     REFERENCES brands (id),
  CONSTRAINT fk_products_category  FOREIGN KEY (category_id)  REFERENCES categories (id),
  CONSTRAINT fk_products_submitter FOREIGN KEY (submitted_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Especificaciones clave/valor (ej.: "Ancho" = "8.25 in"). PK compuesta.
CREATE TABLE product_specs (
  product_id BIGINT UNSIGNED NOT NULL,
  spec_key   VARCHAR(60)     NOT NULL,
  spec_value VARCHAR(160)    NOT NULL,
  PRIMARY KEY (product_id, spec_key),
  CONSTRAINT fk_ps_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE product_images (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id   BIGINT UNSIGNED NOT NULL,
  url          VARCHAR(500)    NOT NULL,
  storage_path VARCHAR(500)    NULL,
  mime_type    VARCHAR(50)     NULL,
  size_bytes   INT UNSIGNED    NULL,
  position     SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  uploaded_by  BIGINT UNSIGNED NULL,
  created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_product_images_product (product_id, position),
  CONSTRAINT fk_pri_product  FOREIGN KEY (product_id)  REFERENCES products (id) ON DELETE CASCADE,
  CONSTRAINT fk_pri_uploader FOREIGN KEY (uploaded_by) REFERENCES users (id)    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. Videos (enlaces a plataformas externas; sin streaming propio)
-- -----------------------------------------------------------------------------

CREATE TABLE videos (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title          VARCHAR(160)    NOT NULL,
  description    TEXT            NULL,
  url            VARCHAR(500)    NOT NULL COMMENT 'Enlace original',
  provider       ENUM('youtube','vimeo','other') NOT NULL DEFAULT 'other',
  external_id    VARCHAR(64)     NULL COMMENT 'ID en el proveedor; permite embeber',
  thumbnail_url  VARCHAR(500)    NULL,
  category_id    INT UNSIGNED    NOT NULL,
  status         ENUM('pending','published','rejected','hidden') NOT NULL DEFAULT 'pending',
  rejection_reason VARCHAR(255)  NULL,
  submitted_by   BIGINT UNSIGNED NULL,
  avg_rating     DECIMAL(3,2)    NOT NULL DEFAULT 0.00,
  review_count   INT UNSIGNED    NOT NULL DEFAULT 0,
  published_at   DATETIME        NULL,
  deleted_at     DATETIME        NULL,
  created_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_videos_url (url),
  KEY idx_videos_listing (status, deleted_at, category_id, avg_rating),
  KEY idx_videos_published (status, published_at),
  KEY idx_videos_submitter (submitted_by),
  FULLTEXT KEY ft_videos_search (title, description),
  CONSTRAINT fk_videos_category  FOREIGN KEY (category_id)  REFERENCES categories (id),
  CONSTRAINT fk_videos_submitter FOREIGN KEY (submitted_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 6. Reseñas
--    Las reseñas de lugares/productos comparten tabla (se exige exactamente un
--    destino) y las de videos tienen tabla propia, según la consigna.
--    Una reseña por usuario y entidad: UNIQUE. La baja de la reseña propia es
--    física (permite reseñar de nuevo); ocultar por moderación es status='hidden'.
--    Solo status='visible' entra en los promedios públicos.
-- -----------------------------------------------------------------------------

CREATE TABLE reviews (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  place_id   BIGINT UNSIGNED NULL,
  product_id BIGINT UNSIGNED NULL,
  rating     TINYINT UNSIGNED NOT NULL,
  comment    VARCHAR(2000)   NOT NULL,
  status     ENUM('visible','pending','hidden') NOT NULL DEFAULT 'visible',
  created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_reviews_user_place   (user_id, place_id),
  UNIQUE KEY uq_reviews_user_product (user_id, product_id),
  KEY idx_reviews_place   (place_id, status, created_at),
  KEY idx_reviews_product (product_id, status, created_at),
  KEY idx_reviews_user    (user_id, created_at),
  CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT chk_reviews_one_target CHECK ((place_id IS NOT NULL) + (product_id IS NOT NULL) = 1),
  CONSTRAINT fk_reviews_user    FOREIGN KEY (user_id)    REFERENCES users (id)    ON DELETE CASCADE,
  CONSTRAINT fk_reviews_place   FOREIGN KEY (place_id)   REFERENCES places (id)   ON DELETE CASCADE,
  CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE video_reviews (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  video_id   BIGINT UNSIGNED NOT NULL,
  rating     TINYINT UNSIGNED NOT NULL,
  comment    VARCHAR(2000)   NOT NULL,
  status     ENUM('visible','pending','hidden') NOT NULL DEFAULT 'visible',
  created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_video_reviews_user_video (user_id, video_id),
  KEY idx_video_reviews_video (video_id, status, created_at),
  CONSTRAINT chk_video_reviews_rating CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT fk_vr_user  FOREIGN KEY (user_id)  REFERENCES users (id)  ON DELETE CASCADE,
  CONSTRAINT fk_vr_video FOREIGN KEY (video_id) REFERENCES videos (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fotos opcionales de reseñas de lugares y productos (no de videos).
CREATE TABLE review_images (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  review_id    BIGINT UNSIGNED NOT NULL,
  url          VARCHAR(500)    NOT NULL,
  storage_path VARCHAR(500)    NULL,
  mime_type    VARCHAR(50)     NULL,
  size_bytes   INT UNSIGNED    NULL,
  position     SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_review_images_review (review_id, position),
  CONSTRAINT fk_ri_review FOREIGN KEY (review_id) REFERENCES reviews (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 7. Favoritos: exactamente un destino por fila; UNIQUE evita duplicados.
-- -----------------------------------------------------------------------------

CREATE TABLE favorites (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  place_id   BIGINT UNSIGNED NULL,
  product_id BIGINT UNSIGNED NULL,
  video_id   BIGINT UNSIGNED NULL,
  created_at DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_fav_user_place   (user_id, place_id),
  UNIQUE KEY uq_fav_user_product (user_id, product_id),
  UNIQUE KEY uq_fav_user_video   (user_id, video_id),
  KEY idx_fav_user (user_id, created_at),
  CONSTRAINT chk_fav_one_target CHECK ((place_id IS NOT NULL) + (product_id IS NOT NULL) + (video_id IS NOT NULL) = 1),
  CONSTRAINT fk_fav_user    FOREIGN KEY (user_id)    REFERENCES users (id)    ON DELETE CASCADE,
  CONSTRAINT fk_fav_place   FOREIGN KEY (place_id)   REFERENCES places (id)   ON DELETE CASCADE,
  CONSTRAINT fk_fav_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
  CONSTRAINT fk_fav_video   FOREIGN KEY (video_id)   REFERENCES videos (id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 8. Reportes y moderación
-- -----------------------------------------------------------------------------

CREATE TABLE reports (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reporter_id      BIGINT UNSIGNED NULL,
  place_id         BIGINT UNSIGNED NULL,
  product_id       BIGINT UNSIGNED NULL,
  video_id         BIGINT UNSIGNED NULL,
  review_id        BIGINT UNSIGNED NULL,
  video_review_id  BIGINT UNSIGNED NULL,
  reason           ENUM('spam','offensive','inaccurate','duplicate','illegal','other') NOT NULL,
  details          VARCHAR(1000)   NULL,
  status           ENUM('open','resolved','dismissed') NOT NULL DEFAULT 'open',
  handled_by       BIGINT UNSIGNED NULL,
  resolution_note  VARCHAR(500)    NULL,
  handled_at       DATETIME        NULL,
  created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_reports_status (status, created_at),
  KEY idx_reports_reporter (reporter_id),
  CONSTRAINT chk_reports_one_target CHECK (
    (place_id IS NOT NULL) + (product_id IS NOT NULL) + (video_id IS NOT NULL)
    + (review_id IS NOT NULL) + (video_review_id IS NOT NULL) = 1),
  CONSTRAINT fk_rep_reporter FOREIGN KEY (reporter_id)     REFERENCES users (id)         ON DELETE SET NULL,
  CONSTRAINT fk_rep_handler  FOREIGN KEY (handled_by)      REFERENCES users (id)         ON DELETE SET NULL,
  CONSTRAINT fk_rep_place    FOREIGN KEY (place_id)        REFERENCES places (id)        ON DELETE CASCADE,
  CONSTRAINT fk_rep_product  FOREIGN KEY (product_id)      REFERENCES products (id)      ON DELETE CASCADE,
  CONSTRAINT fk_rep_video    FOREIGN KEY (video_id)        REFERENCES videos (id)        ON DELETE CASCADE,
  CONSTRAINT fk_rep_review   FOREIGN KEY (review_id)       REFERENCES reviews (id)       ON DELETE CASCADE,
  CONSTRAINT fk_rep_vreview  FOREIGN KEY (video_review_id) REFERENCES video_reviews (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Historial de decisiones de moderación. target_type/target_id SIN FK a
-- propósito: es un registro histórico que debe sobrevivir al borrado del objetivo.
CREATE TABLE moderation_logs (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  moderator_id BIGINT UNSIGNED NULL,
  action       ENUM('approve','reject','hide','restore','edit','resolve_report','dismiss_report') NOT NULL,
  target_type  ENUM('place','product','video','review','video_review','report') NOT NULL,
  target_id    BIGINT UNSIGNED NOT NULL,
  note         VARCHAR(500)    NULL,
  created_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_modlogs_moderator (moderator_id, created_at),
  KEY idx_modlogs_target (target_type, target_id),
  CONSTRAINT fk_modlogs_moderator FOREIGN KEY (moderator_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Auditoría de acciones administrativas sensibles (roles, suspensiones, destacados...).
CREATE TABLE audit_logs (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_id    BIGINT UNSIGNED NULL,
  action      VARCHAR(60)     NOT NULL,
  entity_type VARCHAR(40)     NOT NULL,
  entity_id   BIGINT UNSIGNED NULL,
  details     JSON            NULL,
  ip_address  VARCHAR(45)     NULL,
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_actor (actor_id, created_at),
  KEY idx_audit_entity (entity_type, entity_id),
  KEY idx_audit_created (created_at),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 9. Destacados de Home y configuración
-- -----------------------------------------------------------------------------

-- Configuración por ranura (video / producto / spot). Editable sin tocar código.
CREATE TABLE featured_settings (
  slot                  ENUM('video','product','place') NOT NULL,
  mode                  ENUM('manual','automatic') NOT NULL DEFAULT 'automatic',
  period_hours          SMALLINT UNSIGNED NOT NULL DEFAULT 24 COMMENT 'Vigencia de cada selección automática',
  min_reviews           SMALLINT UNSIGNED NOT NULL DEFAULT 3 COMMENT 'm del promedio ponderado',
  recency_days          SMALLINT UNSIGNED NOT NULL DEFAULT 30 COMMENT 'Ventana de actividad reciente',
  preferred_category_id INT UNSIGNED NULL,
  updated_by            BIGINT UNSIGNED NULL,
  updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (slot),
  CONSTRAINT fk_fs_category FOREIGN KEY (preferred_category_id) REFERENCES categories (id) ON DELETE SET NULL,
  CONSTRAINT fk_fs_updated  FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Historial persistido de selecciones. El destacado vigente de una ranura es la
-- fila con is_current=1 cuyo rango [starts_at, ends_at) incluye el momento actual.
CREATE TABLE featured_content (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slot        ENUM('video','product','place') NOT NULL,
  place_id    BIGINT UNSIGNED NULL,
  product_id  BIGINT UNSIGNED NULL,
  video_id    BIGINT UNSIGNED NULL,
  selection   ENUM('manual','automatic') NOT NULL,
  score       DECIMAL(6,4)    NULL COMMENT 'Puntuación ponderada si fue automática',
  starts_at   DATETIME        NOT NULL,
  ends_at     DATETIME        NULL COMMENT 'NULL = hasta que se reemplace',
  is_current  TINYINT(1)      NOT NULL DEFAULT 1,
  selected_by BIGINT UNSIGNED NULL,
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_featured_current (slot, is_current, starts_at),
  CONSTRAINT chk_featured_slot_match CHECK (
    (slot = 'place'   AND place_id   IS NOT NULL AND product_id IS NULL AND video_id IS NULL) OR
    (slot = 'product' AND product_id IS NOT NULL AND place_id   IS NULL AND video_id IS NULL) OR
    (slot = 'video'   AND video_id   IS NOT NULL AND place_id   IS NULL AND product_id IS NULL)),
  CONSTRAINT fk_fc_place   FOREIGN KEY (place_id)   REFERENCES places (id)   ON DELETE CASCADE,
  CONSTRAINT fk_fc_product FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
  CONSTRAINT fk_fc_video   FOREIGN KEY (video_id)   REFERENCES videos (id)   ON DELETE CASCADE,
  CONSTRAINT fk_fc_selector FOREIGN KEY (selected_by) REFERENCES users (id)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Configuración general clave/valor (ej.: exigir moderación de propuestas).
CREATE TABLE app_settings (
  setting_key   VARCHAR(60)  NOT NULL,
  setting_value VARCHAR(255) NOT NULL,
  updated_by    BIGINT UNSIGNED NULL,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key),
  CONSTRAINT fk_settings_updated FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
