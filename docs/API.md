# API REST SPOTCHECK — v1

Base: `{PUBLIC_BASE_URL}/api/v1` · JSON · fechas ISO-8601 en UTC.
> Documentado hasta la **Etapa 3** (autenticación, perfil, roles y catálogo). Se amplía en cada etapa.

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

---
# Catálogo (Etapa 3)

Listados paginados: `{ items, page, pageSize, total, totalPages }` (`page` ≥ 1, `pageSize` 1–100; 1–200 en catálogos de apoyo). Un parámetro inválido → `400 VALIDATION_ERROR`.
Lectura pública con sesión opcional (`Authorization` si la hay: el autor y el staff ven más). Todo `POST/PATCH/DELETE` exige sesión; las altas, ediciones y subidas exigen **correo verificado** (`403 EMAIL_NOT_VERIFIED`). Las altas y subidas tienen un límite por usuario (40 / 15 min).

## Estados y visibilidad
`pending` → `published` | `rejected` · `published` ↔ `hidden` · `deleted_at` = baja lógica.
| Quién | Ve | Edita | Da de baja |
|---|---|---|---|
| Público | solo `published` | — | — |
| Autor (usuario) | lo suyo en cualquier estado | mientras esté `pending` o `rejected` (si corrige uno rechazado vuelve a `pending`) | su propuesta `pending`/`rejected` |
| Moderador | todo menos las bajas | todo (cada edición queda en el historial de moderación) | — |
| Admin | todo, incluidas las bajas (`includeDeleted=true`) | todo | cualquiera; puede restaurar |

Lo que un usuario no puede ver responde `404` (no se revela que existe). Los usuarios no pueden fijar `status`, puntuaciones ni autor: los campos desconocidos se rechazan (`400`).
La moderación de altas de usuarios comunes es configurable (`require_moderation_places|products|videos`); moderadores y admin publican directo. Máx. 10 propuestas pendientes por usuario y tipo (`409 TOO_MANY_PENDING`).

## Lugares `/places`
| Ruta | Auth | Descripción |
|---|---|---|
| `GET /places` | — | Filtros: `q` (nombre/zona/descripción, sin distinguir tildes), `categoryId` (principal **o** secundaria), `cityId`, `zone`, `minRating`, `minReviews`, `publishedAfter`/`publishedBefore` (`AAAA-MM-DD`), `sort` = `newest`(def.)·`rating`·`reviews`·`name`. Staff: `status` = `pending`·`published`·`rejected`·`hidden`·`all`. Admin: `includeDeleted=true` |
| `GET /places/:ref` | — | `:ref` = id o slug. Incluye categorías secundarias, obstáculos, servicios, horarios, imágenes, `permissions` |
| `POST /places` | verificado | `{name, categoryId, categoryIds?, cityId \| newCity{name,region?,country?}, zone?, address?, latitude?+longitude?, surfaceTypeId?, obstacleIds?, amenityIds?, hours?[{weekday 0-6, opensAt, closesAt}], description?}` → 201. `409 DUPLICATE_PLACE` (mismo nombre y ciudad) |
| `PATCH /places/:id` | autor/staff | Mismos campos, todos opcionales; las listas enviadas **reemplazan** a las anteriores |
| `DELETE /places/:id` | autor/admin | 204. Baja lógica. `409 NOT_DELETABLE` si el autor intenta borrar lo ya publicado |
| `POST /places/:id/restore` | admin | 204 |
| `POST /places/:id/images` | autor/staff | `multipart/form-data`, campo `image` (JPEG, PNG o WebP, máx. 5 MB, máx. 8 por lugar) → 201 `{image:{id,url,position}}`. `400 INVALID_IMAGE`, `413 FILE_TOO_LARGE` |
| `DELETE /places/:id/images/:imageId` | autor/staff | 204 (borra también el archivo) |

## Productos `/products`
Igual que lugares, con: filtros `categoryId`, `brandId`, `minPrice`, `maxPrice` (excluye los que no tienen precio), `minRating`, `minReviews`; `sort` = `newest`·`rating`·`reviews`·`name`·`price_asc`·`price_desc` (sin precio al final). Cuerpo: `{name, brandId, categoryId, description?, price?: {amount, currency}|null, specs?: [{key,value}]}`. `409 DUPLICATE_PRODUCT` (misma marca y nombre). Imágenes: igual que lugares. No hay carrito ni pagos: el precio es orientativo.

## Videos `/videos`
`GET /videos` (filtros `q`, `categoryId`, `minRating`, `minReviews`, fechas; `sort` = `newest`·`rating`·`reviews`·`title`), `GET /videos/:id`, `POST`, `PATCH`, `DELETE`, `POST /:id/restore`. Cuerpo: `{title, url, categoryId, description?}`.
- Solo `http(s)` sin credenciales. YouTube (watch, youtu.be, shorts, embed) y Vimeo se normalizan a un enlace canónico: el mismo video con otro formato de URL da `409 VIDEO_ALREADY_EXISTS`.
- Respuesta: `url` (original), `provider` (`youtube`·`vimeo`·`other`), `embedUrl` (**solo** si el proveedor permite embeber; si es `null`, la app abre `url`), `thumbnailUrl` (YouTube se completa solo).

## Catálogos de apoyo
`categories` (`?type=place|product|video`), `brands`, `cities`, `surface-types`, `obstacle-types`, `amenities`: `GET /x` (paginado, `?q=`), `GET /x/:id`, y para el **admin** `POST /x`, `PATCH /x/:id`, `DELETE /x/:id`. `GET /catalog/options` devuelve superficies, obstáculos y servicios juntos.
Baja: si nadie lo usa se elimina (`{result:"deleted"}`); si es categoría o marca en uso se **desactiva** (`{result:"deactivated"}`, deja de ofrecerse pero conserva el historial); ciudad, superficie, obstáculo o servicio en uso → `409 IN_USE`. Cada cambio queda en `audit_logs`.

## Moderación `/moderation` (moderador o admin)
| Ruta | Descripción |
|---|---|
| `GET /moderation/queue?kind=place\|product\|video&status=pending` | Cola de revisión (más antiguos primero) |
| `POST /moderation/:kind/:id/approve` | `pending`/`rejected` → `published` (fija `published_at`) |
| `POST /moderation/:kind/:id/reject` | `{note}` obligatorio (3–500 caracteres) → `rejected`; el autor ve el motivo |
| `POST /moderation/:kind/:id/hide` | `published` → `hidden` (`{note?}`) |
| `POST /moderation/:kind/:id/restore` | `hidden` → `published` |
| `GET /moderation/logs` | Historial. El moderador ve solo el suyo; el admin ve todo (`moderatorId`, `action`, `targetType`) |
Transición no permitida → `409 INVALID_TRANSITION`. La resolución es atómica (dos moderadores no pisan la misma revisión).

## Otros
- `GET /users/me/submissions?kind=place|product|video&status=` — mis propuestas con estado y motivo de rechazo.
- `GET /admin/settings`, `PATCH /admin/settings` (admin) — `require_moderation_places|products|videos`, `premoderate_reviews`, `account_deletion_grace_days`.
- `GET /uploads/...` — imágenes (solo lectura, `X-Content-Type-Options: nosniff`). Las respuestas devuelven URLs absolutas.

## Excepciones ABMLC documentadas
- **Baja de lugares/productos/videos: solo lógica.** Se conservan reseñas, favoritos, reportes y trazabilidad; no hay borrado definitivo por API.
- Un usuario no puede dar de baja lo ya publicado; un moderador oculta, no elimina.
- Las categorías y marcas en uso se desactivan, no se borran.
