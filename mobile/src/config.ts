import Constants from 'expo-constants';

// URL de la API: EXPO_PUBLIC_API_URL (se fija al compilar con EAS, ver eas.json) o `extra.apiUrl` de app.json.
// 10.0.2.2 es el "localhost" de la PC visto desde el emulador de Android; en un teléfono real hay que usar la IP de la PC o la URL pública.
const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string };
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || extra.apiUrl || 'http://10.0.2.2:3000/api/v1').replace(/\/+$/, '');
