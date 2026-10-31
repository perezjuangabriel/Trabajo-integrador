import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../config';
import { createApiClient, type TokenStorage, type Tokens } from './client';

const KEY = 'spotcheck.session';
// Credenciales de sesión en el almacén seguro del sistema (Keystore en Android), no en AsyncStorage.
const storage: TokenStorage = {
  get: async () => { const raw = await SecureStore.getItemAsync(KEY); return raw ? (JSON.parse(raw) as Tokens) : null; },
  set: (t) => SecureStore.setItemAsync(KEY, JSON.stringify(t)),
  clear: () => SecureStore.deleteItemAsync(KEY),
};

let lostHandler: (() => void) | null = null;
export const onSessionLost = (fn: (() => void) | null) => { lostHandler = fn; };
export const api = createApiClient({ baseUrl: API_URL, storage, onSessionLost: () => lostHandler?.() });
