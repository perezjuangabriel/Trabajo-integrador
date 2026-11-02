import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../config';
import { createApiClient, type TokenStorage, type Tokens } from './client';

const KEY = 'spotcheck.session';
// Credenciales de sesión en el almacén seguro del sistema (Keystore en Android), no en AsyncStorage.
const secure: TokenStorage = {
  get: async () => { const raw = await SecureStore.getItemAsync(KEY); return raw ? (JSON.parse(raw) as Tokens) : null; },
  set: (t) => SecureStore.setItemAsync(KEY, JSON.stringify(t)),
  clear: () => SecureStore.deleteItemAsync(KEY),
};
// shortcut: en web no existe almacén seguro, se usa localStorage (expuesto a XSS); la versión web es para desarrollo/demo, no para producción.
const browser: TokenStorage = {
  get: async () => { const raw = localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as Tokens) : null; },
  set: async (t) => localStorage.setItem(KEY, JSON.stringify(t)),
  clear: async () => localStorage.removeItem(KEY),
};
const storage = Platform.OS === 'web' ? browser : secure;

let lostHandler: (() => void) | null = null;
export const onSessionLost = (fn: (() => void) | null) => { lostHandler = fn; };
export const api = createApiClient({ baseUrl: API_URL, storage, onSessionLost: () => lostHandler?.() });
