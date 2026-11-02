import { Platform } from 'react-native';
import Constants from 'expo-constants';

// URL de la API: EXPO_PUBLIC_API_URL (se fija al compilar con EAS, ver eas.json) o `extra.apiUrl` de app.json.
// 10.0.2.2 es el "localhost" de la PC visto desde el emulador de Android; en un teléfono real hay que usar la IP de la PC o la URL pública.
// En web: si la página la sirve el propio backend (Render) se usa su mismo origen; con `expo start --web` (puerto 8081) se apunta al backend local.
const webUrl = () => (typeof window !== 'undefined' && window.location.port !== '8081' ? `${window.location.origin}/api/v1` : 'http://localhost:3000/api/v1');
const DEFAULT_URL = Platform.OS === 'web' ? webUrl() : 'http://10.0.2.2:3000/api/v1';
const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string };
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || extra.apiUrl || DEFAULT_URL).replace(/\/+$/, '');
