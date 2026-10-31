# Despliegue del backend en Railway

1. Crear proyecto en Railway → **New → GitHub repo** (o `railway up`) con **Root Directory = `backend`**. Start command: `npm start`.
2. Añadir el plugin **MySQL**. Railway entrega `MYSQL_URL`; el backend lo usa si está definida.
3. **Volumen** (imágenes en disco): Service → Volumes → montar en `/data/uploads` y definir `UPLOADS_DIR=/data/uploads`. Sin volumen las imágenes se pierden en cada despliegue.
4. Variables de entorno (Service → Variables):

| Variable | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_ACCESS_SECRET` | cadena aleatoria ≥ 32 caracteres (`openssl rand -hex 48`) |
| `TRUST_PROXY` | `1` |
| `PUBLIC_BASE_URL` | `https://TU-APP.up.railway.app` (sin barra final) |
| `UPLOADS_DIR` | `/data/uploads` |
| `RESEND_API_KEY`, `MAIL_FROM` | clave de Resend y remitente de un dominio verificado |
| `OAUTH_APP_REDIRECTS` | `spotcheck://auth` |
| `GOOGLE_*`, `GITHUB_*`, `DISCORD_*` | `CLIENT_ID` / `CLIENT_SECRET` (ver `OAUTH.md`; callbacks `https://TU-APP.up.railway.app/api/v1/auth/oauth/<proveedor>/callback`) |
| `CORS_ORIGINS` | vacío si solo hay app móvil |

5. **Crear tablas** (una vez, sin datos demo): desde tu equipo con la URL pública del MySQL de Railway:
   `cd backend && MYSQL_URL="mysql://..." npm run db:setup` — **no** uses `db:seed` en producción (borra y carga datos de prueba).
6. **Crear el administrador**: `MYSQL_URL="mysql://..." ADMIN_EMAIL=tu@correo ADMIN_PASSWORD='...' npm run create-admin`.
7. Verificar `https://TU-APP.up.railway.app/api/v1/health`.

Los secretos viven solo en Railway; nada de esto va en el repo ni en el APK. Las tareas programadas (limpieza de cuentas y tokens, destacados) corren dentro del mismo proceso: mantén **una sola réplica**.
