# SPOTCHECK: guía de archivos

Qué es cada archivo del proyecto y qué hace. Sirve para estudiar el código antes de la defensa.

## 1. Cómo se conecta todo

- **App (`mobile/`)**: una sola base de código React Native + Expo. Se usa como app Android (APK) y como web (se exporta a `backend/public`).
- **Backend (`backend/`)**: API REST en Node + Express 5, escrita en TypeScript. También sirve la web ya exportada.
- **Base de datos (`database/`)**: MySQL (Aiven en producción, XAMPP/MariaDB en local).
- **Hosting**: Render ejecuta `npm ci` y `npm start` dentro de `backend/` (`render.yaml`).

**Camino de una petición en el backend** (por ejemplo, crear un spot):

1. `routes/*.routes.ts`: define la URL y el método, y qué rol hace falta.
2. `middleware/`: autentica (`authenticate`), controla el rol (`requireRole`) y valida el cuerpo con Zod (`validate`).
3. `controllers/*.controller.ts`: recibe la petición validada y llama al servicio. No tiene reglas de negocio.
4. `services/*.service.ts`: reglas de negocio (quién puede qué, estados de moderación, límites).
5. `repositories/*.repo.ts`: único lugar con SQL. Siempre consultas parametrizadas.
6. `errorHandler`: cualquier error sale con la forma `{ error: { code, message, details? } }`.

---

## 2. Raíz del repositorio

| Archivo | Qué hace |
|---|---|
| `package.json` | Atajos desde la raíz: `npm run dev`, `start`, `test`, `db:seed`, `create-admin`, `build:web`. Todos delegan en `backend/` o `mobile/`. |
| `render.yaml` | Blueprint de Render: servicio web gratis, `rootDir: backend`, `npm ci` para construir, `npm start` para arrancar, chequeo de salud en `/api/v1/health` y la lista de variables de entorno (las secretas se cargan a mano en el panel). |
| `README.md` | Presentación del proyecto y cómo empezar. |
| `.gitignore` | Evita subir `node_modules`, `.env`, `uploads/`, builds y logs. |
| `.vscode/` | Configuración del editor: extensiones recomendadas, tareas y lanzadores de depuración. |

## 3. `database/`

| Archivo | Qué hace |
|---|---|
| `00_create_database.sql` | Crea la base `spotcheck` (utf8mb4). |
| `schema.sql` | Las 30 tablas: usuarios y sesiones (`users`, `auth_accounts`, `refresh_tokens`, `auth_tokens`), catálogos (`categories`, `brands`, `cities`, `surface_types`, `obstacle_types`, `amenities`), contenido (`places` y sus tablas hijas, `products`, `product_specs`, `videos`), reseñas (`reviews`, `video_reviews`, `review_images`), `favorites`, moderación (`reports`, `moderation_logs`, `audit_logs`) y configuración (`featured_settings`, `featured_content`, `app_settings`). El campo `videos.provider` admite `youtube`, `vimeo`, `instagram` y `other`. |
| `seed.sql` | Datos de prueba ficticios (usuarios demo, lugares, marcas, videos). La contraseña de las cuentas demo es `Demo1234!`. Solo para desarrollo: no se carga en producción. |

---

## 4. `backend/`: configuración y arranque

| Archivo | Qué hace |
|---|---|
| `package.json` | Dependencias y scripts: `start` (`tsx src/server.ts`), `dev` (con recarga), `test` (Vitest), `typecheck` (`tsc`), `db:setup`, `db:seed`, `create-admin`. |
| `tsconfig.json` | Configuración de TypeScript. No emite archivos: solo comprueba tipos. El código se ejecuta directo con `tsx`. |
| `vitest.config.ts` | Configuración de las pruebas: ejecuta una vez el `globalSetup` y corre los archivos en `tests/`. |
| `.env.example` | Plantilla de variables de entorno. El `.env` real nunca se sube a git. |
| `src/server.ts` | Punto de entrada: completa la configuración inicial si falta (`ensureDefaults`), arranca las tareas periódicas y empieza a escuchar. |
| `src/server.js` | Compatibilidad: si un panel todavía ejecuta `node src/server.js`, arranca la versión TypeScript. |
| `src/app.ts` | Fábrica de la app Express: seguridad (Helmet y política CSP), CORS, límites de velocidad, rutas `/api/v1`, archivos subidos y la web exportada con su ruta de respaldo a `index.html`. Está separada del servidor para poder probarla con supertest. |
| `src/jobs/index.ts` | Tareas programadas con `node-cron`: renueva destacados vencidos (cada hora), elimina cuentas con baja vencida y limpia tokens viejos (de madrugada). |

### `src/config/`

| Archivo | Qué hace |
|---|---|
| `env.ts` | Lee y valida las variables de entorno al arrancar. Si falta algo crítico, falla enseguida. |
| `db.ts` | Pool de conexiones MySQL (fechas en UTC) y `withTransaction`, que ejecuta un bloque dentro de una transacción con commit/rollback automático. |
| `catalog.ts` | Describe los tres tipos de contenido (lugar, producto, video): tablas, límites de imágenes y propuestas pendientes. Los nombres de tabla salen solo de acá. |

### `src/middleware/`

| Archivo | Qué hace |
|---|---|
| `authenticate.ts` | Lee el token de sesión y carga al usuario desde la base en cada petición (una suspensión o cambio de rol rige al instante). Incluye `requireRole`, `requireVerifiedEmail` y `requireSensitiveVerification`. |
| `validate.ts` | Valida `body`, `query` y `params` con Zod y deja los datos limpios en `req.valid`. |
| `errorHandler.ts` | Manejo central de errores y respuestas 404. |
| `rateLimit.ts` | Límite general de la API y límite más estricto para autenticación. |
| `upload.ts` | Multer en memoria: una imagen, máximo 5 MB. El tipo real se comprueba por la firma del archivo. |
| `changes.ts` | Cuenta cada escritura exitosa sobre contenido, reseñas, reportes y moderación, para la actualización automática de la app. |

### `src/routes/`

Cada archivo define las URL de un área y qué middleware aplica.

| Archivo | Área |
|---|---|
| `index.ts` | Arma el router de la API y monta los demás. Incluye `/health`. |
| `auth.routes.ts` | Registro, login, renovar sesión, logout, verificar correo y reenviar código. |
| `oauth.routes.ts` | Inicio de sesión y vinculación con Google, GitHub y Discord. |
| `users.routes.ts` | Perfil propio, cuentas vinculadas, actividad, baja de cuenta y gestión de usuarios por el admin. |
| `places.routes.ts`, `products.routes.ts`, `videos.routes.ts` | Listado, detalle, alta, edición, baja y restauración de cada tipo de contenido, más sus imágenes. |
| `reviews.routes.ts` | Reseñas de lugares, productos y videos (rutas anidadas como `/places/:id/reviews`) y sus fotos. |
| `favorites.routes.ts` | Agregar, quitar y listar favoritos. |
| `reports.routes.ts` | Reportes de contenido hechos por usuarios. |
| `moderation.routes.ts` | Cola de moderación, historial, reseñas pendientes y "Mis propuestas". |
| `lookups.routes.ts` | Catálogos de apoyo (categorías, marcas, ciudades, etc.): lectura pública, alta/edición/baja solo del admin. |
| `admin.routes.ts` | Estadísticas, auditoría, destacados y configuración. Todo exige rol admin. |

### `src/controllers/`

Adaptan la petición HTTP al servicio y devuelven la respuesta. Casi sin lógica.

| Archivo | Qué hace |
|---|---|
| `auth.controller.ts` | Registro, login, renovación, logout y verificación de correo. |
| `oauth.controller.ts` | Flujo OAuth con lista blanca de destinos de redirección, para que el código no se envíe a un sitio ajeno. |
| `user.controller.ts` | Perfil propio, cuentas vinculadas, baja de cuenta y, para el admin, listado de usuarios y cambio de rol. |
| `places.controller.ts`, `products.controller.ts`, `videos.controller.ts` | CRUD de cada tipo de contenido. |
| `reviews.controller.ts` | Reseñas, creadas por una fábrica según el tipo (lugar, producto o video). |
| `images.controller.ts` | Fábrica de controladores para subir y borrar imágenes (archivo o URL). |
| `favorites.controller.ts`, `reports.controller.ts`, `moderation.controller.ts` | Favoritos, reportes y moderación. |
| `lookups.controller.ts` | Fábrica: un controlador por cada grupo de catálogo de apoyo. |
| `admin.controller.ts` | Destacados, estadísticas, auditoría y página de inicio. |

### `src/services/`: reglas de negocio

| Archivo | Qué hace |
|---|---|
| `auth.service.ts` | Registro (siempre crea rol `user`), login con bloqueo por intentos, renovación y cierre de sesión. |
| `token.service.ts` | Firma y verifica los tokens: de acceso (JWT), de refresco con rotación y el de verificación sensible (5 minutos). |
| `oneTimeCode.service.ts` | Códigos de 6 dígitos por correo: solo vale el último, con enfriamiento y límite de intentos. |
| `mail.service.ts` | Envío de correos. Usa Brevo si hay `BREVO_API_KEY`, o Resend. En pruebas se reemplaza por un transporte falso. |
| `oauth.service.ts`, `oauthProviders.ts` | Inicio de sesión social: `state` firmado, PKCE y un adaptador por proveedor (Google, GitHub, Discord). |
| `catalogCommon.service.ts` | Quién puede ver, editar o borrar un registro y en qué estado nace (publicado o pendiente de moderación). |
| `places.service.ts`, `products.service.ts`, `videos.service.ts` | Reglas de cada tipo de contenido. El de videos analiza el enlace (YouTube, Vimeo, Instagram u otro) y arma el reproductor. |
| `image.service.ts` | Guarda imágenes: detecta el formato real por la firma del archivo o acepta una URL https (que nunca se descarga). |
| `reviews.service.ts`, `reviewModeration.service.ts` | Reseñas y su moderación: estados visible, pendiente y oculta; solo las visibles cuentan en el promedio. |
| `moderation.service.ts` | Máquina de estados de la moderación: qué transiciones se permiten (aprobar, rechazar, etc.). |
| `reports.service.ts` | Reportes: los crea el usuario y los resuelve o descarta el staff. |
| `favorites.service.ts` | Favoritos: solo se puede marcar lo que el usuario puede ver. |
| `featured.service.ts` | Destacados de Home por puntaje ponderado con bonus por novedad, en modo automático o manual. |
| `home.service.ts` | Arma la portada: destacados y últimas reseñas. |
| `changes.service.ts` | Versiones por tema (`content` y `reviews`) en memoria. Las lee la ruta pública `GET /api/v1/changes`, que la app consulta cada 10 segundos. |
| `lookups.service.ts` | Catálogos de apoyo: la baja es física si nadie lo usa y, si está en uso, se desactiva o se rechaza. |
| `accountDeletion.service.ts` | Baja de cuenta con período de gracia (cancelable) y purga definitiva. |
| `activity.service.ts` | Actividad del usuario: reseñas, favoritos y propuestas. |
| `adminStats.service.ts`, `adminUser.service.ts`, `settings.service.ts` | Estadísticas y auditoría, gestión de usuarios (rol, suspensión) y ajustes de la app, con cada cambio auditado. |

### `src/repositories/`: único lugar con SQL

| Archivo | Qué hace |
|---|---|
| `users.repo.ts` | Usuarios. El hash de contraseña nunca sale por la API. |
| `authAccounts.repo.ts` | Cuentas sociales vinculadas. |
| `refreshTokens.repo.ts`, `authTokens.repo.ts` | Tokens de refresco (con revocación atómica) y códigos de un solo uso. |
| `catalogCommon.repo.ts` | Operaciones comunes a lugares, productos y videos. |
| `places.repo.ts`, `products.repo.ts`, `videos.repo.ts` | Búsqueda con filtros, detalle, alta y modificación de cada tipo. |
| `reviews.repo.ts`, `ratings.repo.ts` | Reseñas y recálculo del promedio (solo con reseñas visibles). |
| `favorites.repo.ts` | Favoritos, con `INSERT IGNORE` para que agregar dos veces no duplique. |
| `reports.repo.ts` | Reportes. |
| `lookups.repo.ts` | Catálogos de apoyo. |
| `featured.repo.ts` | Destacados actuales e historial. |
| `settings.repo.ts` | Ajustes de la app, valores por defecto, catálogos iniciales en una base nueva y ampliación del campo de proveedores de video. |
| `audit.repo.ts` | Registro de auditoría de acciones del admin. |

### `src/validators/`

Esquemas Zod de entrada: definen qué se acepta en cada endpoint.

| Archivo | Qué valida |
|---|---|
| `common.ts` | Piezas reutilizables: email, contraseña (máx. 72 bytes), código de 6 dígitos, paginación. |
| `auth.validators.ts`, `oauth.validators.ts`, `user.validators.ts` | Registro y login, flujo OAuth, perfil, baja de cuenta y gestión de roles. |
| `catalog.common.ts` | Filtros de listado comunes a lugares, productos y videos. |
| `places.validators.ts`, `products.validators.ts`, `videos.validators.ts` | Alta, edición y listado de cada tipo. |
| `reviews.validators.ts`, `favorites.validators.ts`, `reports.validators.ts`, `moderation.validators.ts` | Reseñas, favoritos, reportes y moderación. |
| `lookups.validators.ts`, `admin.validators.ts` | Catálogos de apoyo, destacados, auditoría y ajustes. |

### `src/utils/`

| Archivo | Qué hace |
|---|---|
| `AppError.ts` | Error de negocio con estado HTTP y código estable (`badRequest`, `forbidden`, `notFound`, `conflict`, etc.). |
| `crypto.ts` | Aleatorios seguros, SHA-256, código numérico de 6 dígitos y comparación en tiempo constante. |
| `password.ts` | Hash y verificación con bcrypt, con comparación de relleno para que un correo inexistente tarde igual. |
| `pagination.ts` | Paginación y construcción segura de filtros SQL, con escape de `%` y `_` en `LIKE`. |
| `slug.ts` | Convierte un título en slug (`Plaza Hormigón #2` → `plaza-hormigon-2`). |
| `storage.ts` | Borra archivos subidos y bloquea el recorrido de directorios (`..`). |
| `urls.ts` | Convierte rutas relativas de imágenes en URLs absolutas. |
| `imageUrl.ts` | Valida enlaces de imagen: solo https, sin credenciales ni IP ni localhost. |
| `videoUrl.ts` | Reconoce YouTube, Vimeo e Instagram (reels y posts), saca el identificador y arma la URL del reproductor. Otros sitios quedan como enlace externo. |

### `scripts/`

| Archivo | Qué hace |
|---|---|
| `setup-lib.ts` | Crea la base y recrea las tablas; con `--seed` carga datos de prueba. Es destructivo. |
| `db-setup.ts` | Comando `npm run db:setup` (y `db:seed`). |
| `create-admin.ts` | Crea o promueve un usuario según `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `ADMIN_ROLE` (admin, moderator o user). |

### `tests/`: 215 pruebas automáticas

| Archivo | Qué prueba |
|---|---|
| `globalSetup.ts`, `helpers.ts` | Preparan la base de pruebas y las utilidades comunes (app con límites altos, correos capturados, cuentas por rol). |
| `schema.test.ts` | Conexión, datos de prueba e integridad del esquema. |
| `auth.test.ts` | Registro, verificación de correo, login y sesión. |
| `oauth.test.ts`, `oauthProviders.test.ts` | Flujo social completo con un proveedor simulado. |
| `roles.test.ts` | Acceso por rol, gestión de roles y suspensión (todo validado en el servidor). |
| `places.test.ts`, `products.test.ts`, `videos.test.ts` | Contenido: listado, alta, edición, visibilidad, enlaces de video e Instagram y portada propia. |
| `images.test.ts` | Subida por archivo o por URL, y rechazo de enlaces inseguros. |
| `reviews.test.ts` | Reseñas, premoderación y concurrencia. |
| `favorites.test.ts`, `reports.test.ts`, `moderation.test.ts` | Favoritos, reportes y moderación. |
| `lookups.test.ts` | Catálogos de apoyo y permisos del admin. |
| `featured.test.ts` | Puntaje de destacados, selección automática y manual. |
| `home.admin.test.ts`, `activity.test.ts` | Portada, estadísticas, auditoría y actividad. |
| `deletion.test.ts` | Baja de cuenta con período de gracia y purga. |
| `defaults.test.ts` | Configuración inicial de producción y ampliación del campo de proveedores de video. |
| `brevo.test.ts` | Envío de correo por Brevo. |
| `changes.test.ts` | Aviso de cambios: solo cuentan las escrituras exitosas y cada tema cambia cuando corresponde. |
| `web.test.ts` | La web exportada se sirve bien desde el backend. |

---

## 5. `mobile/`: la app (Android y web)

### Configuración

| Archivo | Qué hace |
|---|---|
| `package.json` | Dependencias de Expo/React Native y scripts (`start`, `build:web`, `test`). |
| `app.json` | Datos de la app para Expo: nombre, ícono, paquete de Android, permisos, plugins y proyecto de EAS. |
| `eas.json` | Perfiles de build (`development`, `preview`, `production`). Define `EXPO_PUBLIC_API_URL`, la dirección del servidor que queda dentro del APK. |
| `babel.config.js` | Configuración de Babel para Expo. |
| `tsconfig.json`, `vitest.config.ts` | TypeScript y pruebas de la app. |
| `index.ts`, `App.tsx` | Punto de entrada: monta el tema, la sesión, el navegador y los diálogos propios (`DialogHost`). |

### `src/api/`

| Archivo | Qué hace |
|---|---|
| `client.ts` | Cliente HTTP: renueva el token cuando vence, maneja tiempos de espera (60 s para subir archivos) y traduce los errores. Es TypeScript puro, sin React. |
| `index.ts` | Crea el cliente con el almacén seguro del sistema (Keystore en Android) para guardar la sesión. |
| `services.ts` | Funciones por área: `authApi`, `meApi`, `catalogApi`, `reviewsApi`, `socialApi`, `staffApi`, `adminApi`. |

### `src/context/`, `src/navigation/`, `src/theme/`

| Archivo | Qué hace |
|---|---|
| `context/AuthContext.tsx` | Estado de sesión: restaura la sesión al abrir y la cierra si la renovación falla. Maneja login, registro, logout y OAuth. |
| `navigation/RootNavigator.tsx` | Pestañas y pantallas. En web, cada pantalla tiene su URL, así funcionan Atrás, Adelante y recargar. |
| `navigation/types.ts` | Tipos de las rutas y `useNav`. |
| `theme/ThemeContext.tsx` | Tema claro, oscuro o automático. |
| `theme/colors.ts` | Paleta de colores, espaciados y radios que usan todos los componentes. |

### `src/screens/`

| Archivo | Pantallas |
|---|---|
| `HomeScreen.tsx` | Inicio: destacado principal, spots y productos destacados, reseñas recientes. |
| `CatalogScreen.tsx` | Listados de lugares, productos y videos, con búsqueda y filtros. Dos columnas en pantallas anchas. |
| `DetailScreen.tsx` | Detalle de un lugar, producto o video, con galería y reproductor de video integrado. |
| `FormScreen.tsx` | Formulario para proponer o editar contenido: fotos por archivo o enlace, y portada del video. |
| `AuthScreens.tsx` | Login, registro, verificación de correo con código, recuperar contraseña y botones sociales. |
| `ProfileScreens.tsx` | Perfil, ajustes y verificación adicional por correo para acciones sensibles. |
| `ReviewReportScreens.tsx` | Escribir una reseña y reportar contenido. |
| `ListScreens.tsx` | Favoritos, "Mis propuestas", mis reseñas y actividad. |
| `StaffScreens.tsx` | Pantalla de moderación (moderador y admin). |
| `AdminScreens.tsx` | Panel de admin: resumen, usuarios, catálogos, destacados, auditoría y ajustes. |

### `src/components/`, `src/lib/` y otros

| Archivo | Qué hace |
|---|---|
| `components/ui.tsx` | Componentes base (tarjeta, botón, campos, chips, títulos) y los diálogos propios: `showError`, `confirm` y `notify`, que reemplazan a los `alert` y `confirm` del navegador. |
| `components/cards.tsx` | Tarjetas de contenido (`ContentCard`) y la tarjeta grande del inicio (`HeroCard`), con proporciones fijas para que las imágenes no se estiren. |
| `components/ReviewsSection.tsx` | Lista de reseñas con promedio y distribución. |
| `lib/embed.ts` | Arma el HTML del reproductor y limita a qué sitios puede navegar. Etiquetas de proveedor (YouTube, Vimeo, Instagram). |
| `lib/images.ts` | Elegir fotos de la galería, armar el formulario de subida y soportar fotos por enlace. |
| `lib/pkce.ts` | PKCE para el inicio de sesión social (funciones puras). |
| `lib/validate.ts` | Validaciones de formulario en el cliente. El servidor siempre vuelve a validar. |
| `hooks.ts` | `useAsync` (carga con recarga) y `usePaginated` (listas con paginación). Ambos tienen `refresh`, una recarga en silencio. |
| `live.ts` | Actualización automática: `useLiveRefresh(tema, refresh)` recarga la pantalla cuando el servidor avisa de un cambio. |
| `lib/liveStore.ts` | Consulta `GET /changes` cada 10 s solo mientras haya pantallas suscriptas y la app esté en primer plano. |
| `config.ts` | Dirección del servidor: `EXPO_PUBLIC_API_URL` o `app.json`. |
| `types.ts` | Tipos compartidos: usuario, tarjetas y detalles de contenido. |

### `tests/` (22 pruebas)

| Archivo | Qué prueba |
|---|---|
| `client.test.ts` | Armado de URLs, cliente de API y renovación de sesión. |
| `pkce.test.ts` | Generación y lectura de PKCE. |
| `embed.test.ts` | HTML del reproductor y bloqueo de navegación a sitios ajenos. |
| `liveStore.test.ts` | Aviso de cambios: solo al tema que cambió, pausa en segundo plano y tolerancia a errores de red. |

---

## 6. `docs/`

| Archivo | Contenido |
|---|---|
| `MANUAL_DE_USUARIO.md` | Cómo usar la app, por rol (usuario, moderador, admin). |
| `GUIA_INSTALACION.md` | Instalar y ejecutar el proyecto en local. |
| `API.md` | Referencia de todos los endpoints. |
| `DATABASE.md` | Modelo de datos y decisiones de diseño. |
| `DEPLOY_RENDER.md` | Desplegar en Render con MySQL de Aiven. |
| `EAS_APK.md` | Generar el APK con EAS. |
| `OAUTH.md` | Configurar Google, GitHub y Discord. |
| `FEATURED_ALGORITHM.md` | Cómo se eligen los destacados de la portada. |
| `PROGRESS.md` | Estado del proyecto y decisiones tomadas. |
| `GUIA_DE_ARCHIVOS.md` | Este archivo. |

---

## 7. Carpetas generadas (no se editan a mano)

| Carpeta | Qué es |
|---|---|
| `backend/public/` | La web exportada con `npm run build:web`. El backend la sirve. Cada build crea un `index-<hash>.js` nuevo y hay que borrar los viejos. |
| `backend/uploads/` | Imágenes subidas por los usuarios. En Render gratis el disco se borra en cada reinicio, así que las fotos por archivo no persisten (por eso existe la opción de pegar un enlace). |
| `node_modules/` | Dependencias instaladas. No se sube a git. |
