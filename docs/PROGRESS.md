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
- [x] **Etapa 1 — Cimientos** (COMPLETA y probada): estructura del repo, `database/schema.sql` (37 tablas), `seed.sql`, `backend/src/config/{env,db}.js`, `scripts/db-setup.js`, `tests/schema.test.js`, `docs/DATABASE.md`.
- [ ] Etapa 2 — Auth y roles  ← **SIGUIENTE**
- [ ] Etapa 3 — Catálogo (spots, productos, videos, categorías, marcas) con ABMLC, filtros y paginación
- [ ] Etapa 4 — Reseñas (promedios en transacción), favoritos, reportes, moderación, subida de imágenes
- [ ] Etapa 5 — Destacados (manual/automático, job cada 24 h), panel admin, auditoría, estadísticas
- [ ] Etapa 6 — App móvil (Expo 58, React Navigation, temas claro/oscuro/sistema, SecureStore)
- [ ] Etapa 7 — Documentación final, OAuth/EAS/Railway guías, manual de usuario

## Entorno de pruebas (la sandbox se reinicia; hay que recrearlo)
- Shell = `/bin/sh` (dash): NO usar expansión de llaves `{a,b}` en mkdir.
- MariaDB 10.11 vía `apt-get install mariadb-server`; levantar con `setsid nohup mysqld_safe &` en el MISMO comando que lo use (se cierra entre llamadas). Root TCP sin contraseña: `ALTER USER 'root'@'localhost' IDENTIFIED VIA mysql_native_password USING PASSWORD('')`.
- MySQL 8.0.46 en `:3307`: `.deb` extraídos en `/opt/mysql8` con `dpkg -x`, datadir `/tmp/m8data`, `--secure-file-priv=NULL`. Probar con `DB_PORT=3307 npm test`.
- `backend/.env` (no versionado) usa root sin contraseña y un `JWT_ACCESS_SECRET` de desarrollo.

## Diseño acordado para la Etapa 2 (a implementar)
- Access JWT 15 min; refresh token aleatorio, guardado como SHA-256 en `refresh_tokens`, **rota en cada uso**; si se reutiliza uno ya rotado se revoca toda la `family_id`.
- Códigos/tokens de un solo uso en `auth_tokens` (verificar correo, reset, `sensitive_action` con código de 6 dígitos y máx. de intentos). Envío con Resend.
- Bloqueo por intentos fallidos (`failed_login_count`, `locked_until`) + `express-rate-limit`.
- OAuth: la app obtiene el código con `expo-auth-session` (PKCE); el backend lo intercambia con el secreto y verifica la identidad. Vincular por `(provider, provider_user_id)`; vincular por correo solo si el proveedor lo marca verificado. **Sin credenciales no se puede probar: quedará "implementado, pendiente de configurar".**
- Registro público siempre rol `user`. Middleware `authenticate` + `requireRole(...)`. Cuenta `suspended`/`deleted` no puede iniciar sesión.
- Destacados automáticos: `score = (v/(v+m))·R + (m/(v+m))·C` (+ factor de actividad reciente), `m = featured_settings.min_reviews`, `C` = promedio global.

## Pendientes que dependen del cliente (no verificables desde la sandbox)
APK con EAS Build (cuenta Expo), prueba en Android real, credenciales OAuth (Google/GitHub/Discord), API key de Resend y dominio, despliegue en Railway (+ volumen para `uploads`), video de demostración.
