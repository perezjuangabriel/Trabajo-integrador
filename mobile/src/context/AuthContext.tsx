import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as Crypto from 'expo-crypto';
import { api, onSessionLost } from '../api';
import { ApiError } from '../api/client';
import { authApi } from '../api/services';
import { createPkce, parseAuthRedirect } from '../lib/pkce';
import { API_URL } from '../config';
import type { User } from '../types';

export type Provider = 'google' | 'github' | 'discord';
interface AuthCtx {
  user: User | null; loading: boolean; offline: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithProvider: (p: Provider) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (u: User | null) => void;
  isStaff: boolean; isAdmin: boolean;
}
const Ctx = createContext<AuthCtx | null>(null);
WebBrowser.maybeCompleteAuthSession();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  const refreshUser = useCallback(async () => {
    if (!(await api.hasTokens())) { setUser(null); setLoading(false); return; }
    try {
      setUser((await authApi.me()).user); setOffline(false);
    } catch (e) {
      if (e instanceof ApiError && (e.code === 'NETWORK' || e.code === 'TIMEOUT')) setOffline(true); // sin red: se conserva la sesión guardada
      else { await api.clearTokens(); setUser(null); }
    } finally { setLoading(false); }
  }, []);

  // Al abrir la app se restaura la sesión guardada; si la renovación falla en cualquier momento, se cierra.
  useEffect(() => { onSessionLost(() => setUser(null)); refreshUser(); return () => onSessionLost(null); }, [refreshUser]);

  const startSession = useCallback(async (s: { user: User; accessToken: string; refreshToken: string }) => {
    await api.setTokens({ accessToken: s.accessToken, refreshToken: s.refreshToken });
    setUser(s.user); setOffline(false);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => startSession(await authApi.login(email.trim(), password)), [startSession]);
  const signUp = useCallback(async (email: string, password: string, name: string) => startSession(await authApi.register(email.trim(), password, name.trim())), [startSession]);

  /** Inicio de sesión social: el navegador del sistema abre el proveedor, el servidor hace el intercambio con sus secretos y vuelve con un código de un solo uso. */
  const signInWithProvider = useCallback(async (provider: Provider) => {
    const { verifier, challenge } = await createPkce((n) => Crypto.getRandomBytes(n), (s) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, s, { encoding: Crypto.CryptoEncoding.BASE64 }));
    const redirect = Linking.createURL('auth');
    const start = `${API_URL}/auth/oauth/${provider}/start?code_challenge=${challenge}&app_redirect=${encodeURIComponent(redirect)}`;
    const result = await WebBrowser.openAuthSessionAsync(start, redirect);
    if (result.type !== 'success') throw new ApiError(0, 'CANCELLED', 'Inicio de sesión cancelado');
    const { code, error } = parseAuthRedirect(result.url);
    if (error || !code) throw new ApiError(400, error ?? 'OAUTH_FAILED', OAUTH_MESSAGES[error ?? ''] ?? 'No se pudo completar el inicio de sesión');
    await startSession(await authApi.oauthExchange(code, verifier));
  }, [startSession]);

  /** Cierra sesión: revoca el refresh token en el servidor (si hay red) y borra las credenciales locales. */
  const signOut = useCallback(async () => {
    const tokens = await api.getTokens();
    setUser(null);
    if (tokens) await authApi.logout(tokens.refreshToken).catch(() => {}); // sin red igual se cierra localmente
    await api.clearTokens();
  }, []);

  const value = useMemo<AuthCtx>(() => ({
    user, loading, offline, signIn, signUp, signInWithProvider, signOut, refreshUser, setUser,
    isStaff: user?.role === 'moderator' || user?.role === 'admin', isAdmin: user?.role === 'admin',
  }), [user, loading, offline, signIn, signUp, signInWithProvider, signOut, refreshUser]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const OAUTH_MESSAGES: Record<string, string> = {
  ACCESS_DENIED: 'Cancelaste el acceso.', ACCOUNT_SUSPENDED: 'Tu cuenta está suspendida.', EMAIL_NOT_VERIFIED_BY_PROVIDER: 'El proveedor no entregó un correo verificado.',
  PROVIDER_ERROR: 'El proveedor no respondió. Probá de nuevo.', IDENTITY_ALREADY_LINKED: 'Esa cuenta ya está vinculada a otro usuario.', PROVIDER_NOT_CONFIGURED: 'Este método de acceso todavía no está configurado.',
};
export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return c;
}
