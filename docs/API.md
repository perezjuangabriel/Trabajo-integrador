# API REST SPOTCHECK — v1

Base: `{PUBLIC_BASE_URL}/api/v1` · JSON · fechas ISO-8601 en UTC.
> Documentado hasta la **Etapa 2** (autenticación, perfil, roles). Se amplía en cada etapa.

## Convenciones
- Éxito: `{ "data": ... }` (o `204` sin cuerpo). Error: `{ "error": { "code", "message", "details?" } }`.
- Autenticación: `Authorization: Bearer <accessToken>` (JWT, 15 min). Renovar con `/auth/refresh`.
- Verificación adicional (operaciones sensibles): header `X-Sensitive-Token` (5 min).
- Límites: 300 req/15 min por IP en toda la API y 20 req/15 min en endpoints de autenticación → `429 RATE_LIMITED`.
- Roles: `user`, `moderator`, `admin`. Se validan en el servidor en cada request, leyendo rol y estado desde la BD.

### Códigos de error frecuentes
| HTTP | code | Cuándo |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Cuerpo/consulta inválidos (`details: [{field, message}]`) |
| 400 | `INVALID_CODE` | Código de 6 dígitos incorrecto, vencido, usado o con 5 intentos agotados |
| 401 | `TOKEN_MISSING` / `TOKEN_INVALID` / `TOKEN_EXPIRED` | Falta, es inválido o venció el access token (si vence: refrescar) |
| 401 | `INVALID_CREDENTIALS` | Correo o contraseña incorrectos (mismo mensaje exista o no el correo) |
| 401 | `REFRESH_INVALID` / `REFRESH_EXPIRED` / `REFRESH_REUSED` | Refresh token inválido, vencido o reutilizado (toda la sesión se revoca) |
| 401 | `SENSITIVE_TOKEN_INVALID` | Falta o venció la verificación adicional |
| 403 | `FORBIDDEN` | El rol no permite la operación |
| 403 | `ACCOUNT_SUSPENDED` · `EMAIL_NOT_VERIFIED` · `WRONG_PASSWORD` | |
| 404 | `NOT_FOUND` | |
| 409 | `EMAIL_TAKEN` · `CONFLICT` · `NO_CHANGE` · … | |
| 429 | `ACCOUNT_LOCKED` · `RETRY_LATER` · `RATE_LIMITED` | 5 contraseñas erróneas → bloqueo 15 min; reenvío de código cada 60 s |
| 503 | `PROVIDER_NOT_CONFIGURED` | OAuth sin credenciales en el servidor |

## Autenticación `/auth`
Respuesta de sesión: `{ user, accessToken, refreshToken }`. `user` nunca incluye hashes.

| Método y ruta | Auth | Cuerpo → Respuesta |
|---|---|---|
| `POST /auth/register` | — | `{email, password, displayName}` → **201** sesión + `verificationEmailSent`. Siempre rol `user`. `409 EMAIL_TAKEN` |
| `POST /auth/login` | — | `{email, password}` → sesión. `401`, `403 ACCOUNT_SUSPENDED`, `429 ACCOUNT_LOCKED` |
| `POST /auth/refresh` | — | `{refreshToken}` → sesión nueva (el token anterior queda revocado: **rotación**) |
| `POST /auth/logout` | — | `{refreshToken}` → 204. Revoca toda la cadena de ese dispositivo |
| `POST /auth/logout-all` | usuario | → 204. Revoca todas las sesiones |
| `POST /auth/verify-email` | — | `{email, code}` → 204 |
| `POST /auth/resend-verification` | usuario | → 202 `{emailSent}`. `409 ALREADY_VERIFIED`, `429 RETRY_LATER` |
| `POST /auth/forgot-password` | — | `{email}` → 202 (respuesta idéntica exista o no la cuenta) |
| `POST /auth/reset-password` | — | `{email, code, newPassword}` → 204. Cierra todas las sesiones |
| `POST /auth/change-password` | usuario | `{currentPassword, newPassword}` → sesión nueva (las demás se cierran) |
| `POST /auth/sensitive/request` | usuario verificado | → 202. Envía código al correo |
| `POST /auth/sensitive/confirm` | usuario | `{code}` → `{sensitiveToken}` (5 min) |
| `GET /auth/me` | usuario | → `{user}` |

Política de contraseña: 8–72 bytes, con letras y números. Códigos: 6 dígitos, vigencia 15 min, máx. 5 intentos, solo vale el último emitido.

**Decisión:** un usuario sin correo verificado **puede iniciar sesión**, pero no ejecutar operaciones que exijan `EMAIL_NOT_VERIFIED` (verificación adicional y, en etapas siguientes, publicar contenido). Motivo: Resend solo envía a destinatarios arbitrarios con un dominio propio verificado; exigir verificación para entrar dejaría fuera a los usuarios hasta configurarlo.

## OAuth `/auth/oauth` — ver `docs/OAUTH.md`
| Método y ruta | Auth | Descripción |
|---|---|---|
| `GET /auth/oauth/:provider/start?code_challenge=&app_redirect=` | — | 302 al proveedor (`google`·`github`·`discord`). `503` si no está configurado |
| `GET /auth/oauth/:provider/callback` | — | Lo invoca el proveedor. Redirige a la app con `?code=`, `?linked=` o `?error=` |
| `POST /auth/oauth/exchange` | — | `{code, codeVerifier}` → sesión (código de 1 uso, 2 min, PKCE) |
| `POST /auth/oauth/:provider/link` | usuario | `{appRedirect?}` → `{url}` para vincular otro proveedor |
| `DELETE /auth/oauth/:provider` | usuario + `X-Sensitive-Token` | Desvincula. `409 LAST_LOGIN_METHOD` si quedaría sin acceso |

## Perfil `/users`
| Método y ruta | Auth | Descripción |
|---|---|---|
| `GET /users/me` | usuario | Perfil propio |
| `PATCH /users/me` | usuario | `{displayName?, bio?, themePreference?: system\|light\|dark}`. Campos desconocidos (p. ej. `role`) → 400 |
| `GET /users/me/linked-accounts` | usuario | Proveedores vinculados |
| `POST /users/me/deletion-request` | usuario + `X-Sensitive-Token` | `{password?}` → 202 `{deletionScheduledFor, graceDays}`. Administradores: `409 ADMIN_CANNOT_DELETE` |
| `POST /users/me/deletion-cancel` | usuario | → 204 (dentro del período de gracia, 14 días por defecto) |

**Baja de cuenta:** pasado el período de gracia, un job diario (03:15 UTC) **elimina** reseñas (de lugares, productos y videos) con sus fotos del disco, favoritos, sesiones y vínculos OAuth; recalcula los promedios afectados y **anonimiza** la fila (`Usuario eliminado`, correo `deleted-<id>@deleted.invalid`). Los reportes que hizo se conservan sin autor y su correo original queda libre.

## Administración `/admin` (solo `admin`)
| Método y ruta | Descripción |
|---|---|
| `GET /admin/users?q=&role=&status=&page=&pageSize=` | Listado paginado (máx. 100 por página) |
| `PATCH /admin/users/:id/role` | `{role: "user"\|"moderator"}`. El rol `admin` **no** se otorga por API (`npm run create-admin`). No sobre uno mismo ni sobre otro admin |
| `POST /admin/users/:id/suspend` | `{reason}`. Cierra sus sesiones al instante |
| `POST /admin/users/:id/reactivate` | |

Cada acción queda en `audit_logs` (quién, qué, a quién, IP).

## Permisos (matriz de la Etapa 2)
| Recurso | Anónimo | Usuario | Moderador | Admin |
|---|---|---|---|---|
| Registro, login, recuperación, OAuth | ✔ | ✔ | ✔ | ✔ |
| Perfil propio, sesiones, baja propia | — | ✔ | ✔ | ✔ (sin baja) |
| `/admin/*` | 401 | 403 | 403 | ✔ |
