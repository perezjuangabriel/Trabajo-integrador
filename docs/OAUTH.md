# Configuración de Google, GitHub y Discord (OAuth)

> **Estado:** el flujo está **implementado y probado con un proveedor simulado** (75 pruebas automáticas, incluidas las peticiones que se arman hacia cada proveedor). **NO se probó contra los servidores reales** porque requiere tus credenciales. Hasta cargarlas, `GET /auth/oauth/:provider/start` responde `503 PROVIDER_NOT_CONFIGURED`.
> Los nombres de menús de las consolas de cada proveedor cambian seguido: si algo no coincide, buscá el equivalente.

## Cómo funciona (los secretos nunca salen del servidor)
```
App ──abre navegador──▶ GET /auth/oauth/google/start?code_challenge=<PKCE>
                         │ 302
                         ▼
                      Proveedor (login y consentimiento)
                         │ redirige a  {PUBLIC_BASE_URL}/api/v1/auth/oauth/google/callback?code=…&state=…
                         ▼
                      Backend: verifica `state` firmado → canjea `code` CON el secreto → obtiene perfil verificado
                         │ crea/vincula cuenta → guarda código de 1 uso (2 min) atado al PKCE
                         │ 302 spotcheck://auth?code=<un-solo-uso>
                         ▼
App ──POST /auth/oauth/exchange {code, codeVerifier}──▶ sesión (access + refresh)
```
Seguridad: `state` firmado (10 min); destino de retorno en lista blanca (`OAUTH_APP_REDIRECTS`); PKCE evita que otra app con el mismo esquema robe el código; el correo solo vincula una cuenta existente si el proveedor lo marca **verificado**; si la cuenta local tenía el correo sin verificar, se anula su contraseña antes de vincular (anti pre-hijacking).

## URLs de redirección (callback) a registrar
| Entorno | Callback |
|---|---|
| Producción (Railway) | `https://TU-APP.up.railway.app/api/v1/auth/oauth/<proveedor>/callback` |
| Desarrollo con el teléfono | Igual, pero con la URL **pública** de un túnel (ngrok / cloudflared). Un `192.168.x.x` NO sirve: Google lo rechaza y el teléfono necesita alcanzar el callback |
| Solo PC (sin teléfono) | `http://localhost:3000/api/v1/auth/oauth/<proveedor>/callback` |

`<proveedor>` = `google`, `github` o `discord`. Debe coincidir **exactamente** con `PUBLIC_BASE_URL` del servidor.

## Variables (solo en el servidor / Railway → Variables)
```
PUBLIC_BASE_URL=https://TU-APP.up.railway.app
OAUTH_APP_REDIRECTS=spotcheck://auth        # esquema de la app (se define en app.json en la Etapa 6)
GOOGLE_CLIENT_ID=…   GOOGLE_CLIENT_SECRET=…
GITHUB_CLIENT_ID=…   GITHUB_CLIENT_SECRET=…
DISCORD_CLIENT_ID=…  DISCORD_CLIENT_SECRET=…
```
En desarrollo con Expo Go, agregar también la URL `exp://…` que muestra la app, separada por coma.

## Google (obligatorio)
1. Google Cloud Console → crear/seleccionar proyecto.
2. *APIs y servicios → Pantalla de consentimiento de OAuth*: tipo Externo, nombre de la app, correo de soporte. Scopes: `openid`, `email`, `profile`. Mientras esté en "Prueba", agregar tus cuentas como usuarios de prueba.
3. *Credenciales → Crear credenciales → ID de cliente de OAuth* → tipo **Aplicación web**.
4. *URI de redireccionamiento autorizados*: el callback de la tabla (`…/oauth/google/callback`).
5. Copiar ID y secreto a `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

## GitHub
1. Settings → Developer settings → OAuth Apps → *New OAuth App*.
2. *Authorization callback URL*: `…/oauth/github/callback` (GitHub admite **una** URL por app: creá una app para desarrollo y otra para producción).
3. *Generate a new client secret* → copiar a las variables. Se piden los scopes `read:user user:email`; el backend usa el correo **primario y verificado** de `/user/emails`.

## Discord
1. Discord Developer Portal → *New Application*.
2. *OAuth2 → Redirects → Add Redirect*: `…/oauth/discord/callback`.
3. *OAuth2 → Client information*: copiar *Client ID* y *Reset Secret* → variables. Scopes usados: `identify email`. Solo se acepta si `verified` es `true`.

## Cómo probar cuando tengas las credenciales
1. Cargarlas en `backend/.env` y levantar el túnel apuntando a `PORT`; poner la URL del túnel en `PUBLIC_BASE_URL` y registrarla en el proveedor.
2. Abrir en un navegador `…/api/v1/auth/oauth/google/start?code_challenge=<43 caracteres base64url>`: debe llevar a la pantalla de Google y volver a `spotcheck://auth?code=…`.
3. Canjear con `POST /auth/oauth/exchange` usando el `verifier` correspondiente (la app lo hace sola desde la Etapa 6).

| Proveedor | Implementado | Probado con simulador | Probado contra el servidor real |
|---|---|---|---|
| Google | ✔ | ✔ | ⏳ pendiente de credenciales |
| GitHub | ✔ | ✔ | ⏳ pendiente de credenciales |
| Discord | ✔ | ✔ | ⏳ pendiente de credenciales |
