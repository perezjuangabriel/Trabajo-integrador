# SPOTCHECK

App móvil de reseñas de skate: spots, skateparks, productos y videos. Monorepo:

| Carpeta | Contenido |
|---|---|
| `backend/` | API REST (Node 22 + Express 5 + MySQL) |
| `database/` | `schema.sql`, `seed.sql`, `00_create_database.sql` |
| `docs/` | `API.md`, `OAUTH.md`, `DATABASE.md`, `PROGRESS.md` (estado y contexto para continuar) |
| `mobile/` | App Expo SDK 58 (React Native + TypeScript) |

> **Estado:** Etapas 1–7 completas (backend 201 pruebas, app móvil con tipos y bundle verificados). La app **no se probó aún en un dispositivo** ni se generó el APK: ver `docs/EAS_APK.md` y la lista de pendientes en `docs/PROGRESS.md`.

## Abrir en VS Code
`code spotcheck` (o *Archivo → Abrir carpeta*). Requisitos: **Node.js 20 o superior** y MySQL/MariaDB (XAMPP sirve).
Desde la carpeta raíz (o con *Terminal → Ejecutar tarea…* que ya trae los pasos 1, 2 y 3; **F5** depura la API):
```bash
npm run setup          # instala dependencias del backend
cp backend/.env.example backend/.env     # y completar JWT_ACCESS_SECRET (mín. 32 caracteres)
npm run db:seed        # crea la base y los datos de prueba (DESTRUCTIVO para la base `spotcheck`)
npm run dev            # API en http://localhost:3000/api/v1/health
npm test               # 201 pruebas (usa su propia base `spotcheck_test`)
```

## Puesta en marcha local (XAMPP u otro MySQL/MariaDB)
1. Iniciar MySQL en XAMPP (el usuario `root` sin contraseña es el valor por defecto).
2. ```bash
   cd backend
   cp .env.example .env     # completar JWT_ACCESS_SECRET (mín. 32 caracteres) y lo que necesites
   npm install
   npm run db:seed          # crea la base `spotcheck`, tablas y datos de prueba (DESTRUCTIVO)
   npm run dev              # API en http://localhost:3000/api/v1/health
   ```
3. Cuentas demo (solo desarrollo, contraseña `Demo1234!`): `admin@spotcheck.test`, `mod@spotcheck.test`, `lucia@spotcheck.test`, `tomas@spotcheck.test`…
4. Administrador real (producción): `ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run create-admin`. No ejecutes `db:seed` en producción.

Sin Node: importar a mano en phpMyAdmin `database/00_create_database.sql`, luego `schema.sql` y `seed.sql`.

## Pruebas
```bash
cd backend && npm test      # recrea la base spotcheck_test y corre 201 pruebas
```
Nunca toca `spotcheck` ni `MYSQL_URL` (salvaguarda: la base de pruebas debe terminar en `_test`). Para MySQL en otro puerto: `DB_PORT=3307 npm test`.

## Probar la API a mano
Con `npm run dev` y la base sembrada: `GET http://localhost:3000/api/v1/places`, `/products`, `/videos`, `/categories`. Referencia completa en `docs/API.md`.
Imágenes: se guardan en `UPLOADS_DIR` (por defecto `backend/uploads`, ignorada por Git) y se sirven en `/uploads/...`.

## Correo y OAuth
Sin `RESEND_API_KEY` el servidor **no envía** correos y lo avisa en el log (en desarrollo imprime el contenido para poder copiar el código). OAuth: `docs/OAUTH.md`.

## App móvil
```bash
cd mobile && npm install
npx expo start          # Expo Go o emulador Android (API por defecto: http://10.0.2.2:3000/api/v1)
npm run typecheck && npm test
```
OAuth con Google/GitHub/Discord requiere un build propio (esquema `spotcheck://`), no Expo Go.

## Documentación
`docs/GUIA_INSTALACION.md` (entorno, variables, APK) · `docs/MANUAL_DE_USUARIO.md` (3 roles) · `docs/API.md` (endpoints) · `DATABASE.md` · `FEATURED_ALGORITHM.md` · `OAUTH.md` · `EAS_APK.md` · `DEPLOY_RENDER.md` · `PROGRESS.md`
