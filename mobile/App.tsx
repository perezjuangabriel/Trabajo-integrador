import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { DialogHost, Loading } from './src/components/ui';

// Si el usuario tiene una preferencia de tema guardada en su cuenta, se adopta al iniciar sesión.
function ThemeSync() {
  const { user } = useAuth(); const { setPreference } = useTheme();
  useEffect(() => { if (user?.themePreference) setPreference(user.themePreference); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
function Gate() {
  const { loading } = useAuth(); const { isDark } = useTheme();
  return <>{loading ? <Loading label="Iniciando…" /> : <RootNavigator />}<DialogHost /><StatusBar style={isDark ? 'light' : 'dark'} /><ThemeSync /></>;
}
export default function App() {
  return <SafeAreaProvider><ThemeProvider><AuthProvider><Gate /></AuthProvider></ThemeProvider></SafeAreaProvider>;
}
