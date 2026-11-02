# SPOTCHECK — Guía de instalación y configuración

Cubre el entorno de desarrollo completo (base de datos, backend y app móvil) y cómo generar el APK.

## 0. Requisitos
| Herramienta | Versión | Para qué |
|---|---|---|
| Node.js | 20 o superior (probado con 22) | backend y app |
| MySQL 8 o MariaDB 10.6+ | XAMPP sirve | base de datos |
| Git | cualquiera | opcional |
| VS Code | cualquiera | recomendado (el repo trae `.vscode/` con tareas y depuración) |
| Teléfono Android con **Expo Go**, o Android Studio con un emulador | | probar la app |
| Cuenta gratuita en [expo.dev](https://expo.dev) | | solo para generar el APK |

## 1. Estructura
```
spotcheck/
├── backend/    API REST (Node + Express + MySQL)
├── database/   schema.sql · seed.sql · 00_create_database.sql
├── mobile/     App Expo SDK 58 (React Native + TypeScript)
├── docs/       documentación
└── package.json  atajos: setup, db:seed, dev, start, test, create-admin
```

## 2. Base de datos (MySQL / XAMPP)
1. Abrí el panel de XAMPP e iniciá **MySQL**. Por defecto: usuario `root`, sin contraseña, puerto `3306`.
2. No hace falta crear nada a mano: el siguiente paso (`npm run db:seed`) crea la base `spotcheck`, las 30 tablas y los datos de prueba.
   - Alternativa sin Node: en phpMyAdmin importá, en este orden, `database/00_create_database.sql`, `database/schema.sql` y `database/seed.sql`.
3. Si tu MySQL tiene contraseña u otro puerto, ajustalo en `backend/.env` (paso 3.2).

> ⚠️ `db:seed` **borra y recrea** la base `spotcheck`. Úsalo solo en desarrollo. Para producción usá `db:setup` (solo tablas, ver `DEPLOY_RAILWAY.md`).

## 3. Backend

### 3.1 Instalar dependencias
Desde la raíz del proyecto:
```bash
npm run setup          # equivale a: cd backend && npm install
```

### 3.2 Variables de entorno
```bash
cp backend/.env.example backend/.env     # en Windows: copy backend\.env.example backend\.env
```
Editá `backend/.env`. **Solo es obligatorio `JWT_ACCESS_SECRET`** (mínimo 32 caracteres); generá uno con:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

| Variable | Por defecto | Descripción |
|---|---|---|
| `NODE_ENV` | `development` | `production` en el servidor |
| `PORT` | `3000` | Puerto de la API |
| `DB_HOST` · `DB_PORT` · `DB_USER` · `DB_PASSWORD` · `DB_NAME` | `127.0.0.1` · `3306` · `root` · *(vacío)* · `spotcheck` | Conexión a MySQL local |
| `MYSQL_URL` | — | URL completa (Railway). Si existe, tiene prioridad sobre `DB_*` |
| `JWT_ACCESS_SECRET` | — | **Obligatoria.** Firma de los tokens de acceso |
| `JWT_ACCESS_TTL` | `15m` | Vida del token de acceso |
| `REFRESH_TOKEN_TTL_DAYS` | `30` | Vida de la sesión persistente |
| `CODE_TTL_MIN` · `SENSITIVE_TTL_MIN` | `15` · `5` | Vigencia de los códigos de 6 dígitos y del token de operación sensible |
| `BCRYPT_COST` | `12` | Costo del hash de contraseñas |
| `TRUST_PROXY` | `1` | Cantidad de proxies delante (Railway = 1; en local podés dejarlo) |
| `CORS_ORIGINS` | *(vacío)* | Orígenes permitidos; la app móvil no lo necesita |
| `RESEND_API_KEY` · `MAIL_FROM` | — | Correo real con Resend. **Sin clave no se envía nada**: en desarrollo el código se imprime en la consola del servidor |
| `UPLOADS_DIR` | `./uploads` | Carpeta de imágenes (en Railway, el volumen) |
| `PUBLIC_BASE_URL` | `http://localhost:3000` | URL pública del servidor; arma las URLs absolutas de las imágenes |
| `OAUTH_APP_REDIRECTS` | `spotcheck://auth` | Destinos permitidos para volver a la app (lista separada por comas) |
| `GOOGLE_*` · `GITHUB_*` · `DISCORD_*` | — | `CLIENT_ID` / `CLIENT_SECRET`. Ver `OAUTH.md`. Sin ellas, ese proveedor responde `503 PROVIDER_NOT_CONFIGURED` |

Nunca subas `.env` a Git (ya está en `.gitignore`).

### 3.3 Crear la base con datos de prueba y arrancar
```bash
npm run db:seed        # crea base, tablas y datos de prueba
npm run dev            # API con recarga automática en http://localhost:3000
```
Comprobá: abrí `http://localhost:3000/api/v1/health` → `{"data":{"status":"ok"}}`.
En VS Code también podés usar **F5** (depurar la API) o *Terminal → Ejecutar tarea…*.

### 3.4 Cuentas de prueba
Contraseña de todas: `Demo1234!`

| Correo | Rol |
|---|---|
| `admin@spotcheck.test` | admin |
| `mod@spotcheck.test` | moderador |
| `lucia@spotcheck.test`, `tomas@spotcheck.test`, `camila@spotcheck.test`, `bruno@spotcheck.test`, `valen@spotcheck.test` | usuario |

Son **solo para desarrollo**. En producción creá tu administrador real:
```bash
ADMIN_EMAIL=tu@correo.com ADMIN_PASSWORD='UnaClaveSegura1' npm run create-admin
```
(En Windows PowerShell: `$env:ADMIN_EMAIL="..."; $env:ADMIN_PASSWORD="..."; npm run create-admin`.) El rol admin **solo** se crea por este script.

### 3.5 Pruebas
```bash
npm test                 # 198 pruebas de integración con su propia base `spotcheck_test`
DB_PORT=3307 npm test    # contra otro servidor/puerto
```
Nunca tocan la base `spotcheck`.

## 4. App móvil (Expo)

### 4.1 Instalar
```bash
cd mobile
npm install
```

### 4.2 Apuntar la app a tu backend
La URL de la API se resuelve así (primero la que exista): variable `EXPO_PUBLIC_API_URL` → `extra.apiUrl` de `app.json` → `http://10.0.2.2:3000/api/v1`.

| Dónde corre la app | URL a usar |
|---|---|
| Emulador Android (Android Studio) | `http://10.0.2.2:3000/api/v1` (**ya es el valor por defecto**) |
| Teléfono real con Expo Go (misma red Wi‑Fi que la PC) | `http://IP-DE-TU-PC:3000/api/v1` (en Windows: `ipconfig`; en Mac/Linux: `ip a`) |
| Servidor desplegado | `https://TU-APP.up.railway.app/api/v1` |

Ejemplo para teléfono real:
```bash
# Linux / macOS
EXPO_PUBLIC_API_URL=http://192.168.1.50:3000/api/v1 npx expo start
# Windows PowerShell
$env:EXPO_PUBLIC_API_URL="http://192.168.1.50:3000/api/v1"; npx expo start
```
Si el teléfono no llega a la PC, permití el puerto 3000 en el firewall de Windows. Dentro de la app, **Perfil → Ajustes → Conexión → Probar conexión** confirma si el servidor responde.

### 4.3 Ejecutar
```bash
npx expo start            # escaneá el QR con Expo Go (Android) o presioná "a" para el emulador
```
Otros scripts: `npm run typecheck` (TypeScript) y `npm test` (16 pruebas del cliente de la API).

> **Limitación de Expo Go:** el inicio de sesión con Google/GitHub/Discord necesita el esquema propio `spotcheck://`, que solo existe en un build propio (APK o development build). Con Expo Go probá correo y contraseña. Detalle en `OAUTH.md`.

### 4.4 Ejecutar en el navegador (versión web)
Sirve para probar rápido desde la PC, sin teléfono. Está pensada para **desarrollo y demostración**, no como producción.
1. En `backend/.env` poné `CORS_ORIGINS=http://localhost:8081` y reiniciá el backend (sin esto el navegador bloquea las llamadas a la API).
2. En otra terminal:
   ```bash
   cd mobile
   npm install
   npm run web          # abre http://localhost:8081
   ```
   La app usa por defecto `http://localhost:3000/api/v1`.
3. Limitaciones en la web: la sesión se guarda en `localStorage` (no existe el almacén seguro del teléfono); los videos no se reproducen dentro de la app (se muestra la miniatura y el enlace al sitio original); el login con Google/GitHub/Discord no está verificado en web.

## 5. Generar el APK con EAS
Requiere: cuenta en expo.dev y un backend accesible por internet con HTTPS (ver `DEPLOY_RAILWAY.md`); un APK de release no puede hablar con `http://` plano.

```bash
cd mobile
npm install -g eas-cli
eas login
eas init                       # vincula el proyecto y escribe el projectId en app.json
```
1. En `mobile/eas.json`, reemplazá `https://TU-APP.up.railway.app/api/v1` por tu URL real en los perfiles `preview` y `production` (variable `EXPO_PUBLIC_API_URL`). **No pongas claves ahí**: solo la URL pública.
2. Generá el APK:
   ```bash
   eas build --platform android --profile preview
   ```
3. EAS compila en la nube (10–20 min) y al terminar muestra un **enlace de descarga del `.apk`** (también en expo.dev → tu proyecto → Builds).
4. Pasalo al teléfono, abrilo y permití "instalar apps desconocidas".

Datos del build: paquete `com.spotcheck.app`, esquema `spotcheck://`. Si cambiás el esquema, actualizá `OAUTH_APP_REDIRECTS` en el servidor. Los íconos de `mobile/assets/` son marcadores provisorios: reemplazalos (1024×1024) antes de publicar.

## 6. Problemas frecuentes
| Síntoma | Causa y solución |
|---|---|
| `Configuración de entorno inválida` al arrancar | Completá la variable en `backend/.env` (≥ 32 caracteres) |
| `ECONNREFUSED 127.0.0.1:3306` | MySQL no está iniciado (XAMPP) o el puerto/credenciales de `.env` no coinciden |
| `npm test` aborta por el nombre de la base | La base de pruebas debe terminar en `_test`; no la cambies |
| La app dice "No se pudo conectar" | Revisá la URL (sección 4.2), que el backend esté corriendo y que PC y teléfono estén en la misma red |
| Las imágenes no cargan en el teléfono | `PUBLIC_BASE_URL` debe ser alcanzable desde el teléfono (usá la IP de la PC, no `localhost`) |
| No llegan correos | Falta `RESEND_API_KEY`: en desarrollo mirá el código en la consola del backend |
| `expo export`/Metro falla con `babel-preset-expo` | Ejecutá `npm install` en `mobile/` (la dependencia ya está declarada) |
| Los scripts de este documento fallan en Windows | Usá PowerShell con la sintaxis de variables indicada, o Git Bash |
