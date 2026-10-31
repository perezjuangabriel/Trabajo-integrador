-- =============================================================================
-- SPOTCHECK — Datos de prueba (TODOS FICTICIOS: lugares, marcas, videos y usuarios)
-- Contraseña de todas las cuentas demo: Demo1234!   (solo para desarrollo)
-- Cuentas: admin@spotcheck.test, mod@spotcheck.test, lucia@/tomas@/camila@/bruno@/valen@spotcheck.test
-- Los videos usan IDs de proveedor inventados: reemplazarlos desde el panel admin.
-- EN PRODUCCIÓN NO EJECUTAR ESTE ARCHIVO: crear el admin con backend/scripts/create-admin.js
-- =============================================================================
SET NAMES utf8mb4;

INSERT INTO users (id, email, password_hash, display_name, bio, role, status, email_verified_at) VALUES
 (1,'admin@spotcheck.test','$2b$12$kw.5gLxrMEChEHqrcqazge5mrXCj/dmv/ZhUht1e/yj2D0X6qzu/S','Admin SpotCheck','Cuenta de administración de demostración.','admin','active',NOW()),
 (2,'mod@spotcheck.test','$2b$12$kw.5gLxrMEChEHqrcqazge5mrXCj/dmv/ZhUht1e/yj2D0X6qzu/S','Mod Demo','Moderación de la comunidad.','moderator','active',NOW()),
 (3,'lucia@spotcheck.test','$2b$12$kw.5gLxrMEChEHqrcqazge5mrXCj/dmv/ZhUht1e/yj2D0X6qzu/S','Lucía','Street y plazas, siempre con ruedas blandas.','user','active',NOW()),
 (4,'tomas@spotcheck.test','$2b$12$kw.5gLxrMEChEHqrcqazge5mrXCj/dmv/ZhUht1e/yj2D0X6qzu/S','Tomás','Bowls y parks.','user','active',NOW()),
 (5,'camila@spotcheck.test','$2b$12$kw.5gLxrMEChEHqrcqazge5mrXCj/dmv/ZhUht1e/yj2D0X6qzu/S','Camila','Skate desde 2015.','user','active',NOW()),
 (6,'bruno@spotcheck.test','$2b$12$kw.5gLxrMEChEHqrcqazge5mrXCj/dmv/ZhUht1e/yj2D0X6qzu/S','Bruno',NULL,'user','active',NOW()),
 (7,'valen@spotcheck.test','$2b$12$kw.5gLxrMEChEHqrcqazge5mrXCj/dmv/ZhUht1e/yj2D0X6qzu/S','Valen',NULL,'user','suspended',NOW());
UPDATE users SET suspended_reason='Cuenta de demostración suspendida' WHERE id=7;

INSERT INTO cities (id, name, region, country) VALUES
 (1,'Mar del Plata','Buenos Aires','AR'),(2,'Ciudad Autónoma de Buenos Aires','Buenos Aires','AR'),
 (3,'Córdoba','Córdoba','AR'),(4,'Rosario','Santa Fe','AR'),(5,'Mendoza','Mendoza','AR');

INSERT INTO categories (id, type, name, slug) VALUES
 (1,'place','Street','street'),(2,'place','Skatepark','skatepark'),
 (3,'place','Plaza / Skate plaza','plaza'),(4,'place','Indoor','indoor'),
 (5,'product','Tablas','tablas'),(6,'product','Trucks / Ejes','trucks'),(7,'product','Ruedas','ruedas'),
 (8,'product','Rulemanes','rulemanes'),(9,'product','Zapatillas','zapatillas'),(10,'product','Grip','grip'),
 (11,'product','Accesorios y protecciones','accesorios'),(12,'product','Ropa de skate','ropa'),
 (13,'video','Clips','clips'),(14,'video','Full parts','full-parts'),
 (15,'video','Tutoriales','tutoriales'),(16,'video','Eventos','eventos');

INSERT INTO brands (id, name, slug) VALUES
 (1,'Concreto Skate Co','concreto-skate-co'),(2,'Hardflip Supply','hardflip-supply'),
 (3,'Bearing Lab','bearing-lab'),(4,'Gripworks','gripworks'),
 (5,'Pavement Gear','pavement-gear'),(6,'Urbano Wear','urbano-wear');

INSERT INTO surface_types (id, name) VALUES
 (1,'Hormigón liso'),(2,'Hormigón rugoso'),(3,'Asfalto'),(4,'Granito'),(5,'Madera'),(6,'Baldosa');
INSERT INTO obstacle_types (id, name) VALUES
 (1,'Escalera'),(2,'Baranda'),(3,'Cajón / Ledge'),(4,'Manual pad'),(5,'Bowl'),(6,'Banco'),
 (7,'Quarter'),(8,'Rampa'),(9,'Gap'),(10,'Funbox'),(11,'Mini rampa'),(12,'Pirámide');
INSERT INTO amenities (id, name) VALUES
 (1,'Iluminación'),(2,'Baños'),(3,'Agua potable'),(4,'Estacionamiento'),
 (5,'Bancos'),(6,'Acceso gratuito'),(7,'Sombra'),(8,'Techado');

-- Lugares (ficticios). status: 10 = pendiente de moderación, 11 = oculto.
INSERT INTO places (id,name,slug,description,category_id,city_id,zone,address,latitude,longitude,surface_type_id,status,submitted_by,published_at) VALUES
 (1,'Skatepark Costanera','skatepark-costanera','Park abierto con bowl, quarters y flatground amplio. Mejor al atardecer.',2,1,'Costa','Av. Costanera s/n',-38.005000,-57.540000,1,'published',3,DATE_SUB(NOW(),INTERVAL 60 DAY)),
 (2,'Plaza Hormigón','plaza-hormigon','Plaza con ledges, banco largo y manual pads.',3,1,'Centro','Calle Ficticia 123',-38.002000,-57.555000,1,'published',4,DATE_SUB(NOW(),INTERVAL 45 DAY)),
 (3,'Escalones del Banco','escalones-del-banco','Spot street con escalera de 5 y baranda.',1,1,'Centro','Calle Inventada 456',-37.998000,-57.548000,4,'published',5,DATE_SUB(NOW(),INTERVAL 30 DAY)),
 (4,'Skatepark Parque Norte','skatepark-parque-norte','Park grande con funbox, spine y rampas.',2,2,'Núñez','Parque Norte (demo)',-34.545000,-58.460000,1,'published',3,DATE_SUB(NOW(),INTERVAL 80 DAY)),
 (5,'Plaza Seca','plaza-seca','Plaza urbana con módulos bajos, ideal para principiantes.',3,2,'Palermo','Plaza Seca (demo)',-34.580000,-58.420000,2,'published',6,DATE_SUB(NOW(),INTERVAL 20 DAY)),
 (6,'Gap del Puente','gap-del-puente','Gap largo bajo un puente peatonal. Superficie irregular.',1,3,'Nueva Córdoba','Puente (demo)',-31.420000,-64.185000,3,'published',5,DATE_SUB(NOW(),INTERVAL 15 DAY)),
 (7,'Nave 7 Indoor','nave-7-indoor','Nave techada con rampas de madera. Abre de tarde.',4,2,'Villa Crespo','Galpón 7 (demo)',-34.598000,-58.440000,5,'published',4,DATE_SUB(NOW(),INTERVAL 40 DAY)),
 (8,'Skatepark del Río','skatepark-del-rio','Park sobre la costa del río con bowl pequeño.',2,4,'Costanera','Costanera (demo)',-32.945000,-60.640000,1,'published',3,DATE_SUB(NOW(),INTERVAL 10 DAY)),
 (9,'Pirámide Cordillera','piramide-cordillera','Pirámide de granito con banco y rampa baja.',1,5,'Centro','Plaza (demo)',-32.890000,-68.840000,4,'published',6,DATE_SUB(NOW(),INTERVAL 5 DAY)),
 (10,'Rampa del Fondo','rampa-del-fondo','Propuesta de usuario pendiente de revisión.',1,1,'Puerto','A confirmar',NULL,NULL,3,'pending',6,NULL),
 (11,'Spot Cerrado','spot-cerrado','Oculto por moderación (demostración).',1,3,NULL,NULL,NULL,NULL,3,'hidden',5,DATE_SUB(NOW(),INTERVAL 90 DAY));

INSERT INTO place_categories (place_id, category_id) VALUES (2,1),(3,3),(4,3),(8,3);
INSERT INTO place_obstacles (place_id, obstacle_type_id) VALUES
 (1,5),(1,7),(1,11),(2,3),(2,6),(2,4),(3,1),(3,2),(4,10),(4,8),(4,7),(5,6),(5,4),(6,9),(7,8),(7,11),(8,5),(9,12),(9,6);
INSERT INTO place_amenities (place_id, amenity_id) VALUES
 (1,1),(1,6),(1,4),(2,5),(2,6),(4,1),(4,2),(4,3),(4,4),(7,2),(7,8),(8,7),(8,6);
INSERT INTO place_hours (place_id, weekday, opens_at, closes_at) VALUES
 (7,1,'15:00:00','22:00:00'),(7,2,'15:00:00','22:00:00'),(7,3,'15:00:00','22:00:00'),
 (7,4,'15:00:00','22:00:00'),(7,5,'15:00:00','23:00:00'),(7,6,'12:00:00','23:00:00');

-- Productos (ficticios). 10 = pendiente.
INSERT INTO products (id,name,slug,description,brand_id,category_id,price_amount,price_currency,status,submitted_by,published_at) VALUES
 (1,'Tabla Maple 8.25 Street','tabla-maple-825-street','Tabla de 7 capas de maple, concavo medio.',1,5,85000.00,'ARS','published',3,DATE_SUB(NOW(),INTERVAL 50 DAY)),
 (2,'Tabla Maple 8.0 Pro','tabla-maple-80-pro','Tabla liviana para técnica.',1,5,92000.00,'ARS','published',4,DATE_SUB(NOW(),INTERVAL 48 DAY)),
 (3,'Trucks Alto 5.25','trucks-alto-525','Ejes de aluminio con bujes medios.',2,6,70000.00,'ARS','published',5,DATE_SUB(NOW(),INTERVAL 40 DAY)),
 (4,'Ruedas 52mm 99A','ruedas-52mm-99a','Ruedas de poliuretano para street y plaza.',5,7,38000.00,'ARS','published',3,DATE_SUB(NOW(),INTERVAL 35 DAY)),
 (5,'Rulemanes Precision ABEC 7','rulemanes-precision-abec-7','Set de 8 rulemanes.',3,8,22000.00,'ARS','published',4,DATE_SUB(NOW(),INTERVAL 30 DAY)),
 (6,'Zapatillas Vulc Low','zapatillas-vulc-low','Suela vulcanizada con refuerzo en puntera.',5,9,120000.00,'ARS','published',5,DATE_SUB(NOW(),INTERVAL 25 DAY)),
 (7,'Lija Grip Black','lija-grip-black','Lija negra de grano estándar.',4,10,9000.00,'ARS','published',6,DATE_SUB(NOW(),INTERVAL 20 DAY)),
 (8,'Rodilleras Pro','rodilleras-pro','Rodilleras con casquillo rígido.',5,11,45000.00,'ARS','published',3,DATE_SUB(NOW(),INTERVAL 12 DAY)),
 (9,'Remera Heavy Logo','remera-heavy-logo','Remera de algodón pesado.',6,12,NULL,NULL,'published',6,DATE_SUB(NOW(),INTERVAL 8 DAY)),
 (10,'Casco Classic','casco-classic','Propuesta pendiente de revisión.',5,11,NULL,NULL,'pending',4,NULL);
INSERT INTO product_specs (product_id, spec_key, spec_value) VALUES
 (1,'Ancho','8.25 in'),(1,'Capas','7'),(2,'Ancho','8.0 in'),(3,'Altura','Alto'),(3,'Ancho de eje','5.25 in'),
 (4,'Diámetro','52 mm'),(4,'Dureza','99A'),(5,'Cantidad','8 unidades'),(6,'Suela','Vulcanizada');

-- Videos (ficticios). 6 = pendiente.
INSERT INTO videos (id,title,description,url,provider,external_id,thumbnail_url,category_id,status,submitted_by,published_at) VALUES
 (1,'Sesión de plaza (demo)','Clip de demostración. Reemplazar por un video real.','https://www.youtube.com/watch?v=demo0000001','youtube','demo0000001',NULL,13,'published',3,DATE_SUB(NOW(),INTERVAL 6 DAY)),
 (2,'Full part street (demo)','Parte completa de demostración.','https://www.youtube.com/watch?v=demo0000002','youtube','demo0000002',NULL,14,'published',4,DATE_SUB(NOW(),INTERVAL 14 DAY)),
 (3,'Cómo hacer un kickflip (demo)','Tutorial paso a paso de demostración.','https://vimeo.com/900000003','vimeo','900000003',NULL,15,'published',5,DATE_SUB(NOW(),INTERVAL 20 DAY)),
 (4,'Competencia local (demo)','Resumen de evento de demostración.','https://example.com/videos/evento-demo','other',NULL,NULL,16,'published',6,DATE_SUB(NOW(),INTERVAL 30 DAY)),
 (5,'Bowl session (demo)','Clip de bowl de demostración.','https://www.youtube.com/watch?v=demo0000005','youtube','demo0000005',NULL,13,'published',3,DATE_SUB(NOW(),INTERVAL 2 DAY)),
 (6,'Propuesta de video (demo)','Pendiente de revisión.','https://www.youtube.com/watch?v=demo0000006','youtube','demo0000006',NULL,13,'pending',6,NULL);

-- Reseñas de lugares/productos. Incluye 1 pendiente y 1 oculta para comprobar que NO cuentan.
INSERT INTO reviews (user_id, place_id, product_id, rating, comment, status, created_at) VALUES
 (3,1,NULL,5,'Excelente park, el bowl está muy bien hecho.','visible',DATE_SUB(NOW(),INTERVAL 10 DAY)),
 (4,1,NULL,4,'Muy bueno pero se llena los fines de semana.','visible',DATE_SUB(NOW(),INTERVAL 8 DAY)),
 (5,1,NULL,5,'De lo mejor de la ciudad.','visible',DATE_SUB(NOW(),INTERVAL 3 DAY)),
 (6,1,NULL,1,'Comentario oculto por moderación (demo).','hidden',DATE_SUB(NOW(),INTERVAL 2 DAY)),
 (3,2,NULL,4,'Lindos ledges y suelo liso.','visible',DATE_SUB(NOW(),INTERVAL 12 DAY)),
 (5,2,NULL,3,'Está bien, le falta mantenimiento.','visible',DATE_SUB(NOW(),INTERVAL 6 DAY)),
 (4,3,NULL,5,'La escalera es ideal para trucos grandes.','visible',DATE_SUB(NOW(),INTERVAL 4 DAY)),
 (3,4,NULL,5,'Park enorme y bien cuidado.','visible',DATE_SUB(NOW(),INTERVAL 15 DAY)),
 (4,4,NULL,4,'Muy completo.','visible',DATE_SUB(NOW(),INTERVAL 9 DAY)),
 (5,4,NULL,5,'Imperdible si venís a Buenos Aires.','visible',DATE_SUB(NOW(),INTERVAL 1 DAY)),
 (6,4,NULL,4,'Buen flow en las rampas.','visible',DATE_SUB(NOW(),INTERVAL 1 DAY)),
 (6,5,NULL,4,'Perfecto para empezar.','visible',DATE_SUB(NOW(),INTERVAL 5 DAY)),
 (3,7,NULL,4,'Genial para días de lluvia.','visible',DATE_SUB(NOW(),INTERVAL 7 DAY)),
 (4,7,NULL,5,'Las rampas de madera son un lujo.','visible',DATE_SUB(NOW(),INTERVAL 2 DAY)),
 (5,8,NULL,3,'Lindo lugar, bowl chico.','visible',DATE_SUB(NOW(),INTERVAL 3 DAY)),
 (4,9,NULL,4,'La pirámide es divertida.','visible',DATE_SUB(NOW(),INTERVAL 1 DAY)),
 (6,6,NULL,2,'Reseña pendiente de revisión (demo).','pending',DATE_SUB(NOW(),INTERVAL 1 DAY)),
 (3,NULL,1,5,'Dura mucho y pop excelente.','visible',DATE_SUB(NOW(),INTERVAL 11 DAY)),
 (4,NULL,1,4,'Buena relación precio-calidad.','visible',DATE_SUB(NOW(),INTERVAL 7 DAY)),
 (5,NULL,1,5,'Mi tabla de siempre.','visible',DATE_SUB(NOW(),INTERVAL 2 DAY)),
 (3,NULL,2,4,'Liviana y responde bien.','visible',DATE_SUB(NOW(),INTERVAL 9 DAY)),
 (6,NULL,3,5,'Giran muy bien.','visible',DATE_SUB(NOW(),INTERVAL 6 DAY)),
 (5,NULL,3,4,'Resistentes.','visible',DATE_SUB(NOW(),INTERVAL 3 DAY)),
 (3,NULL,4,3,'Se aplanan rápido en asfalto.','visible',DATE_SUB(NOW(),INTERVAL 4 DAY)),
 (4,NULL,5,4,'Rápidos y silenciosos.','visible',DATE_SUB(NOW(),INTERVAL 5 DAY)),
 (5,NULL,6,5,'Muy cómodas y duran.','visible',DATE_SUB(NOW(),INTERVAL 2 DAY)),
 (3,NULL,6,4,'Buen agarre.','visible',DATE_SUB(NOW(),INTERVAL 1 DAY)),
 (6,NULL,7,4,'Pega bien.','visible',DATE_SUB(NOW(),INTERVAL 3 DAY)),
 (4,NULL,8,5,'Protegen sin molestar.','visible',DATE_SUB(NOW(),INTERVAL 1 DAY));

INSERT INTO video_reviews (user_id, video_id, rating, comment, status, created_at) VALUES
 (4,1,5,'Muy buen clip.','visible',DATE_SUB(NOW(),INTERVAL 4 DAY)),
 (5,1,4,'Buena edición.','visible',DATE_SUB(NOW(),INTERVAL 3 DAY)),
 (6,1,5,'Me encantó.','visible',DATE_SUB(NOW(),INTERVAL 1 DAY)),
 (3,2,4,'Gran parte completa.','visible',DATE_SUB(NOW(),INTERVAL 8 DAY)),
 (5,2,5,'Increíble nivel.','visible',DATE_SUB(NOW(),INTERVAL 6 DAY)),
 (4,3,5,'Muy claro, aprendí rápido.','visible',DATE_SUB(NOW(),INTERVAL 10 DAY)),
 (3,5,4,'Lindo bowl.','visible',DATE_SUB(NOW(),INTERVAL 1 DAY));

INSERT INTO favorites (user_id, place_id, product_id, video_id) VALUES
 (3,1,NULL,NULL),(3,NULL,1,NULL),(3,NULL,NULL,1),(4,4,NULL,NULL),(4,NULL,2,NULL),(5,NULL,NULL,2),(6,5,NULL,NULL);

INSERT INTO reports (reporter_id, review_id, reason, details, status) VALUES
 (3, 4, 'offensive', 'Comentario fuera de lugar (demostración).', 'open');
INSERT INTO reports (reporter_id, place_id, reason, details, status, handled_by, resolution_note, handled_at) VALUES
 (4, 11, 'inaccurate', 'El spot ya no existe.', 'resolved', 2, 'Se ocultó el lugar.', NOW());

INSERT INTO moderation_logs (moderator_id, action, target_type, target_id, note) VALUES
 (2,'hide','review',4,'Comentario ofensivo'),(2,'hide','place',11,'Spot inexistente'),(2,'resolve_report','report',2,'Se ocultó el lugar');

INSERT INTO app_settings (setting_key, setting_value) VALUES
 ('require_moderation_places','1'),('require_moderation_products','1'),
 ('require_moderation_videos','1'),('premoderate_reviews','0'),('account_deletion_grace_days','14');

INSERT INTO featured_settings (slot, mode, period_hours, min_reviews, recency_days) VALUES
 ('video','manual',168,2,30),('product','automatic',24,3,30),('place','automatic',24,3,30);

-- Destacados iniciales (el job automático los reemplazará según la configuración).
INSERT INTO featured_content (slot, video_id, selection, starts_at, is_current, selected_by) VALUES ('video',1,'manual',NOW(),1,1);
INSERT INTO featured_content (slot, product_id, selection, starts_at, ends_at, is_current) VALUES ('product',1,'automatic',NOW(),DATE_ADD(NOW(),INTERVAL 24 HOUR),1);
INSERT INTO featured_content (slot, place_id, selection, starts_at, ends_at, is_current) VALUES ('place',4,'automatic',NOW(),DATE_ADD(NOW(),INTERVAL 24 HOUR),1);

-- Recalcular las columnas de caché SOLO con reseñas visibles.
UPDATE places p SET
  review_count = (SELECT COUNT(*) FROM reviews r WHERE r.place_id = p.id AND r.status = 'visible'),
  avg_rating   = COALESCE((SELECT ROUND(AVG(r.rating),2) FROM reviews r WHERE r.place_id = p.id AND r.status = 'visible'),0);
UPDATE products p SET
  review_count = (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id AND r.status = 'visible'),
  avg_rating   = COALESCE((SELECT ROUND(AVG(r.rating),2) FROM reviews r WHERE r.product_id = p.id AND r.status = 'visible'),0);
UPDATE videos v SET
  review_count = (SELECT COUNT(*) FROM video_reviews r WHERE r.video_id = v.id AND r.status = 'visible'),
  avg_rating   = COALESCE((SELECT ROUND(AVG(r.rating),2) FROM video_reviews r WHERE r.video_id = v.id AND r.status = 'visible'),0);
