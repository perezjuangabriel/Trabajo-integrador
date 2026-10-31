# PROGRESS / CONTEXTO PARA CONTINUAR (SPOTCHECK)

> Si la conversación se corta, pegá este archivo completo en una conversación nueva junto con la consigna original.

## Decisiones del cliente
- Hosting: **Railway** (backend + MySQL). Correo: **Resend**. Imágenes: **disco local del servidor** (volumen Railway, `UPLOADS_DIR`).
- Al eliminar cuenta: **se eliminan las reseñas**.
- Panel admin dentro de la misma app móvil (rol admin), una sola base de código y un APK.

## Versiones verificadas (npm, 29/10/2026)
Expo SDK 58 (`expo@58.0.21`) → React 19.3.0, React Native 0.88.1, expo-secure-store ~58.0.2, expo-auth-session ~58.0.16, expo-web-browser ~58.0.7, expo-crypto ~58.0.7, expo-linking ~58.0.15, expo-constants ~58.0.14, expo-image ~58.0.18, expo-image-picker ~58.0.10, expo-status-bar ~58.0.4, expo-video ~58.0.13, expo-system-ui ~58.0.7, react-native-screens ~4.30.0, react-native-safe-area-context ~5.10.1, react-native-gesture-handler ~3.3.0, react-native-reanimated 4.7.1, async-storage 2.2.0, react-native-webview 14.0.1. (Salen de `expo/bundledNativeModules.json`; al crear `/mobile` usar `npx expo install` para fijarlas.)
Backend (ESM, Node 22): express ^5.3, mysql2 ^3.24, zod ^4.6, bcryptjs ^3, jsonwebtoken ^9, helmet ^8, express-rate-limit ^8, multer ^2, resend ^6, node-cron ^4, dotenv ^18; dev: vitest ^5, supertest ^7.

## Estado
- [x] **Etapa 1 — Cimientos** (COMPLETA y probada): estructura del repo, `database/schema.sql` (30 tablas), `seed.sql`, `backend/src/config/{env,db}.js`, `scripts/db-setup.js`, `tests/schema.test.js`, `docs/DATABASE.md`.
- [x] **Etapa 2 — Auth y roles** (COMPLETA, 75/75 pruebas en MySQL 8 y MariaDB): registro, login, refresh con rotación y detección de reuso, bloqueo por intentos, verificación de correo, recuperación y cambio de contraseña, verificación adicional (código -> token 5 min), OAuth Google/GitHub/Discord (implementado; **sin probar contra proveedores reales**), perfil, baja de cuenta con purga, gestión de usuarios/roles/suspensión del admin con auditoría, `npm run create-admin`. Docs: `API.md`, `OAUTH.md`.
- [x] **Etapa 3 — Catálogo** (COMPLETA, 137/137 pruebas en MySQL 8 y MariaDB): lugares, productos y videos con ABMLC, búsqueda, filtros, orden y paginación; catálogos de apoyo (categorías, marcas, ciudades, superficies, obstáculos, servicios); flujo de moderación (cola, aprobar/rechazar/ocultar/restaurar, historial); "mis propuestas"; subida de imágenes a disco con validación por firma; configuración de moderación editable por el admin. (spots, productos, videos, categorías, marcas) con ABMLC, filtros y paginación
- [ ] Etapa 4 — Reseñas  ← **SIGUIENTE** (promedios en transacción), favoritos, reportes, moderación, subida de imágenes
- [ ] Etapa 5 — Destacados (manual/automático, job cada 24 h), panel admin, auditoría, estadísticas
- [ ] Etapa 6 — App móvil (Expo 58, React Navigation, temas claro/oscuro/sistema, SecureStore)
- [ ] Etapa 7 — Documentación final, OAuth/EAS/Railway guías, manual de usuario

## Entorno de pruebas (la sandbox se reinicia; hay que recrearlo)
- Shell = `/bin/sh` (dash): NO usar expansión de llaves `{a,b}` en mkdir.
- MariaDB 10.11 vía `apt-get install mariadb-server`; levantar con `setsid nohup mysqld_safe &` en el MISMO comando que lo use (se cierra entre llamadas). Root TCP sin contraseña: `ALTER USER 'root'@'localhost' IDENTIFIED VIA mysql_native_password USING PASSWORD('')`.
- MySQL 8.0.46 en `:3307`: `.deb` extraídos en `/opt/mysql8` con `dpkg -x`, datadir `/tmp/m8data`, `--secure-file-priv=NULL`. Probar con `DB_PORT=3307 npm test`.
- `backend/.env` (no versionado) usa root sin contraseña y un `JWT_ACCESS_SECRET` de desarrollo.

## Diseño de la Etapa 2 (IMPLEMENTADO; se conserva como referencia)
- Access JWT 15 min; refresh token aleatorio, guardado como SHA-256 en `refresh_tokens`, **rota en cada uso**; si se reutiliza uno ya rotado se revoca toda la `family_id`.
- Códigos/tokens de un solo uso en `auth_tokens` (verificar correo, reset, `sensitive_action` con código de 6 dígitos y máx. de intentos). Envío con Resend.
- Bloqueo por intentos fallidos (`failed_login_count`, `locked_until`) + `express-rate-limit`.
- OAuth: la app obtiene el código con `expo-auth-session` (PKCE); el backend lo intercambia con el secreto y verifica la identidad. Vincular por `(provider, provider_user_id)`; vincular por correo solo si el proveedor lo marca verificado. **Sin credenciales no se puede probar: quedará "implementado, pendiente de configurar".**
- Registro público siempre rol `user`. Middleware `authenticate` + `requireRole(...)`. Cuenta `suspended`/`deleted` no puede iniciar sesión.
- Destacados automáticos: `score = (v/(v+m))·R + (m/(v+m))·C` (+ factor de actividad reciente), `m = featured_settings.min_reviews`, `C` = promedio global.

## Pendientes que dependen del cliente (no verificables desde la sandbox)
APK con EAS Build (cuenta Expo), prueba en Android real, credenciales OAuth (Google/GitHub/Discord), API key de Resend y dominio, despliegue en Railway (+ volumen para `uploads`), video de demostración.

## Estructura del backend (Etapa 2)
`src/`: `app.js` (fábrica, para supertest) · `server.js` · `config/{env,db}.js` · `middleware/{authenticate,validate,errorHandler,rateLimit}.js` (`authenticate`, `optionalAuthenticate`, `requireRole(...)`, `requireVerifiedEmail`, `requireSensitiveVerification`) · `routes/` · `controllers/` · `services/` (auth, oauth, oauthProviders, token, oneTimeCode, mail, accountDeletion, adminUser) · `repositories/` (todo el SQL; incluye `ratings.repo.js` con `recompute(kind,id,conn)` que la Etapa 4 debe reutilizar al crear/editar/borrar/ocultar reseñas) · `validators/` (zod) · `jobs/` (cron: purga de cuentas 03:15 UTC y de tokens 03:30 UTC) · `utils/`. `scripts/`: `db-setup`, `setup-lib`, `create-admin`. `tests/`: schema, auth, roles, oauth, oauthProviders, deletion.

## Convenciones a respetar en las próximas etapas
- Respuestas `{data}` / `{error:{code,message,details}}`; errores de negocio con `AppError`; validación con `validate({body,query,params})` y datos en `req.valid`.
- Express 5: los handlers `async` propagan errores solos (no hace falta try/catch ni `asyncHandler`).
- Consultas SIEMPRE con `?` (mysql2 `query` con parámetros); rutas por módulo: routes -> controller -> service -> repository.
- Rol y estado se leen de la BD en cada request (suspensión y cambio de rol son inmediatos).
- Publicar contenido debe exigir `requireVerifiedEmail`. Los moderadores usan `requireRole('moderator','admin')`.
- Al borrar/ocultar reseñas: recalcular con `ratings.recompute` en la MISMA transacción. Borrar archivos de fotos con `utils/storage.deleteStoredFiles` DESPUÉS del commit.
- Tests: usan `tests/helpers.js` (app con límites altos, `outbox` de correos, `registerUser`, `getSensitiveToken`). No dependen de datos mutables de la semilla salvo usuarios 1–6 y lugares 1–9.

## Cómo correr todo (sandbox)
`/home/claude/startdb.sh` levanta MariaDB (:3306) y MySQL 8 (:3307) (se apagan entre turnos; recrear el script con los pasos de "Entorno de pruebas" si se perdió). `npm test` (MariaDB) y `DB_PORT=3307 npm test` (MySQL 8).

## Lecciones de la Etapa 2 (bugs reales encontrados)
- MySQL evalúa las asignaciones de un `UPDATE` de izquierda a derecha: `locked_until` debe ir antes de `failed_login_count`.
- Sin forzar `SET time_zone='+00:00'` por conexión, un servidor en UTC-3 rompe los vencimientos (verificado con contraprueba).
- `new URL('spotcheck://x').origin` es `'null'`: comparar con `href`.

## Pendientes de cliente acumulados
OAuth real (Google/GitHub/Discord) y su prueba; `RESEND_API_KEY` + dominio verificado (sin dominio, Resend solo entrega a tu propio correo); resto igual que arriba.

## Estructura agregada en la Etapa 3
`config/catalog.js` (KINDS: tablas, claves de configuración, límites) · `repositories/{places,products,videos,lookups,catalogCommon,settings}.repo.js` · `services/{places,products,videos,lookups,moderation,settings,catalogCommon,image}.service.js` · `validators/{catalog.common,places,products,videos,lookups,moderation}.validators.js` · `middleware/upload.js` (multer en memoria) · `utils/{slug,videoUrl,pagination,urls}.js`.
- Reglas de visibilidad/edición/baja centralizadas en `catalogCommon.service.js` (`canView`, `canEdit`, `canDelete`, `assertVisible`, `assertEditable`). Lo no visible responde 404 (también en DELETE).
- Búsqueda de texto con `LIKE` escapado (no FULLTEXT): sin mínimo de longitud de palabra y sin lista de palabras vacías. Los índices FULLTEXT del esquema quedan disponibles para mejorar la relevancia más adelante.
- Imágenes: se guardan con ruta relativa `/uploads/...` y la API las devuelve absolutas con `PUBLIC_BASE_URL`. Se valida la firma (JPEG/PNG/WebP), no se decodifica la imagen (no hay redimensionado ni verificación de que sea una imagen completa válida).
- Para la Etapa 4: reutilizar `ratings.repo.recompute`, `catalogCommon.repo` (estado/baja), `image.service.storeImage` (fotos de reseñas, subcarpeta `reviews/`) y `requireVerifiedEmail`; los videos usan `video_reviews` (sin fotos).
- Para la Etapa 5: al ocultar/dar de baja un contenido destacado hay que reemplazar el destacado (`featured_content`); hoy no hay vínculo automático.

## Lecciones de la Etapa 3
- Hallazgo real: `DELETE` sobre una propuesta ajena respondía 403 (revelaba que existía); ahora 404, como al verla.
- Prueba de mutación: romper la validación de firma de imagen y la visibilidad de pendientes hace fallar las pruebas (confirma que no son vacías).
- `LIKE '%costa%'` coincide con "Costanera": en pruebas usar valores que no sean subcadena de otros.
