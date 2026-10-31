import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dark, light, type Palette } from './colors';
import type { ThemePref } from '../types';

const KEY = 'spotcheck.theme';
interface ThemeCtx { colors: Palette; preference: ThemePref; setPreference: (p: ThemePref) => void; isDark: boolean }
const Ctx = createContext<ThemeCtx>({ colors: light, preference: 'system', setPreference: () => {}, isDark: false });

/** Tema claro/oscuro/automático (según el sistema). La preferencia se guarda en el dispositivo. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [preference, setPref] = useState<ThemePref>('system');
  useEffect(() => { AsyncStorage.getItem(KEY).then((v) => { if (v === 'light' || v === 'dark' || v === 'system') setPref(v); }).catch(() => {}); }, []);
  const setPreference = useCallback((p: ThemePref) => { setPref(p); AsyncStorage.setItem(KEY, p).catch(() => {}); }, []);
  const isDark = preference === 'system' ? system === 'dark' : preference === 'dark';
  const value = useMemo(() => ({ colors: isDark ? dark : light, preference, setPreference, isDark }), [isDark, preference, setPreference]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useTheme = () => useContext(Ctx);
