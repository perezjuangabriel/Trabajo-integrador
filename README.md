# SPOTCHECK

App móvil de reseñas de skate: spots, skateparks, productos y videos. Monorepo:

| Carpeta | Contenido |
|---|---|
| `backend/` | API REST (Node 22 + Express 5 + MySQL) |
| `database/` | `schema.sql`, `seed.sql`, `00_create_database.sql` |
| `docs/` | `API.md`, `OAUTH.md`, `DATABASE.md`, `PROGRESS.md` (estado y contexto para continuar) |
| `mobile/` | App Expo SDK 58 (Etapa 6, aún no creada) |

> **Estado:** Etapas 1 (base de datos) y 2 (autenticación y roles) completas. Ver `docs/PROGRESS.md`.

## Abrir en VS Code
`code spotcheck` (o *Archivo → Abrir carpeta*). Instalar dependencias: `cd backend && npm install`.

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
cd backend && npm test      # recrea la base spotcheck_test y corre 75 pruebas
```
Nunca toca `spotcheck` ni `MYSQL_URL` (salvaguarda: la base de pruebas debe terminar en `_test`). Para MySQL en otro puerto: `DB_PORT=3307 npm test`.

## Correo y OAuth
Sin `RESEND_API_KEY` el servidor **no envía** correos y lo avisa en el log (en desarrollo imprime el contenido para poder copiar el código). OAuth: `docs/OAUTH.md`.
