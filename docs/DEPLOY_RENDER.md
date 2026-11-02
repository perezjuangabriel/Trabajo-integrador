# Despliegue en Render (gratis) con MySQL gratuito

Un solo servicio de Render ejecuta el **backend y la web**: la página principal de tu proyecto es `https://TU-APP.onrender.com` y la API está en `https://TU-APP.onrender.com/api/v1`. La app móvil (APK) usa esa misma API.

> Los planes gratuitos cambian: verificá límites y condiciones actuales en render.com y aiven.io antes de depender de ellos.

## Limitaciones del plan gratuito (importan para este proyecto)
| Limitación | Efecto |
|---|---|
| El servicio se **duerme** tras un rato sin tráfico | La primera visita tarda en despertar (decenas de segundos). Las tareas programadas (borrado de cuentas vencidas, destacados) solo corren mientras está despierto; los destacados también se refrescan al pedir `/home` |
| **Disco efímero** | Las **fotos subidas se pierden** al reiniciar o redesplegar. Sirve para demo; para conservarlas hace falta un disco persistente (plan de pago) o almacenamiento externo (no implementado) |
| Render no ofrece MySQL gratis (solo PostgreSQL) | La base va en otro proveedor (abajo) |
| Poca memoria (512 MB) | Por eso la web se compila **en tu PC** y se sube ya generada en `backend/public` (compilarla en Render se queda sin memoria) |

## 1. Base MySQL gratuita (Aiven)
1. Creá una cuenta en aiven.io → **Create service → MySQL → plan Free**, región cercana.
2. Cuando esté *Running*, copiá la **Service URI** (empieza con `mysql://…` y suele terminar en `?ssl-mode=REQUIRED`). **Borrá** el `?ssl-mode=REQUIRED` del final: la conexión SSL se activa con `DB_SSL=true`.
3. En *IP allowlist* del servicio permití conexiones desde cualquier IP (`0.0.0.0/0`) si no lo está, porque Render usa IPs variables.
4. Opcional: descargá el certificado **CA** y pegalo en la variable `DB_SSL_CA` (verifica la identidad del servidor). Sin ella la conexión va cifrada pero no verificada.

## 2. Crear las tablas y tu administrador (una sola vez, desde tu PC)
Hacelo **una vez**: `db:setup` borra y recrea las tablas. PowerShell, dentro de `backend`:
```powershell
npm install
$env:MYSQL_URL="mysql://usuario:clave@host:puerto/defaultdb"   # la URI de Aiven sin ?ssl-mode
$env:DB_SSL="true"
$env:JWT_ACCESS_SECRET="cualquier-cadena-de-al-menos-32-caracteres-para-este-comando"
$env:NODE_ENV="production"
npm run db:setup
$env:ADMIN_EMAIL="tu@correo.com"; $env:ADMIN_PASSWORD="UnaClaveSegura123"
npm run create-admin
```
No uses `db:seed` en producción (se rechaza a propósito). La base queda **vacía**: cargá spots y productos desde la app como admin.

## 3. Crear el servicio en Render
1. Subí el repo a GitHub (ya incluye `render.yaml` y la web compilada en `backend/public`).
2. render.com → **New → Blueprint** → elegí el repo. Render lee `render.yaml`. (Alternativa manual: *New → Web Service*, *Root Directory* `backend`, *Build* `npm ci`, *Start* `npm start`, plan Free.)
3. Completá las variables marcadas como manuales (*Environment*):

| Variable | Valor |
|---|---|
| `MYSQL_URL` | La URI de Aiven (sin `?ssl-mode`) |
| `DB_SSL` | `true` (ya viene en el blueprint) |
| `PUBLIC_BASE_URL` | `https://TU-APP.onrender.com` (sin barra final; se conoce al crear el servicio, completala y redesplegá) |
| `JWT_ACCESS_SECRET` | Lo genera Render solo |
| `RESEND_API_KEY`, `MAIL_FROM` | Ver `OAUTH.md` y la sección de correo de la guía |
| `GOOGLE_*`, `GITHUB_*`, `DISCORD_*` | `CLIENT_ID` / `CLIENT_SECRET` de cada proveedor |
| `OAUTH_APP_REDIRECTS` | `spotcheck://auth` (ya viene) |

4. Desplegá y abrí `https://TU-APP.onrender.com/api/v1/health` → `{"data":{"status":"ok"}}`. Luego `https://TU-APP.onrender.com/` muestra la web.

## 4. Callbacks de OAuth
Con la URL real: `https://TU-APP.onrender.com/api/v1/auth/oauth/<google|github|discord>/callback`. Más detalle en `OAUTH.md`.

## 5. APK
En `mobile/eas.json` poné `https://TU-APP.onrender.com/api/v1` y seguí `EAS_APK.md`.

## Actualizar la web después de cambiar la app
```bash
npm run build:web      # regenera backend/public
git add -A && git commit -m "actualizar web" && git push    # Render redespliega solo
```
