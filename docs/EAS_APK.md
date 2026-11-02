# Generar el APK con EAS

Requisitos: cuenta gratuita en expo.dev, backend ya desplegado (ver `DEPLOY_RENDER.md`).

```bash
cd mobile
npm install
npm install -g eas-cli
eas login
eas init                      # vincula el proyecto (crea el projectId en app.json)
```
1. Editar `mobile/eas.json`: reemplazar `https://TU-APP.onrender.com/api/v1` por la URL real en los perfiles `preview` y `production` (`EXPO_PUBLIC_API_URL`).
2. Compilar: `eas build --platform android --profile preview` → al terminar, EAS entrega un enlace de descarga del `.apk`.
3. Instalarlo en el teléfono (permitir orígenes desconocidos).

Notas
- Esquema de deep link: `spotcheck://` (paquete `com.spotcheck.app`); debe coincidir con `OAUTH_APP_REDIRECTS` del backend.
- Desarrollo local contra tu PC: `EXPO_PUBLIC_API_URL=http://IP-DE-TU-PC:3000/api/v1 npx expo start` (el emulador Android usa `10.0.2.2`, ya es el valor por defecto).
- Los íconos de `mobile/assets/` son **marcadores provisorios**; reemplázalos por el diseño final (1024×1024) antes de publicar.
- No incluyas claves en `eas.json`: solo la URL pública de la API.
