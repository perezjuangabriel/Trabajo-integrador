import React from 'react';
import { Platform } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer, type LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from '../theme/ThemeContext';
import { HomeScreen } from '../screens/HomeScreen';
import { CatalogScreen } from '../screens/CatalogScreen';
import { DetailScreen } from '../screens/DetailScreen';
import { FormScreen } from '../screens/FormScreen';
import { ReportScreen, ReviewFormScreen } from '../screens/ReviewReportScreens';
import { ForgotScreen, LoginScreen, RegisterScreen, VerifyEmailScreen } from '../screens/AuthScreens';
import { ProfileScreen, SettingsScreen } from '../screens/ProfileScreens';
import { ActivityScreen, FavoritesScreen, MyReviewsScreen, SubmissionsScreen } from '../screens/ListScreens';
import { ModerationScreen } from '../screens/StaffScreens';
import { AdminAuditScreen, AdminCatalogScreen, AdminDashboardScreen, AdminFeaturedScreen, AdminSettingsScreen, AdminUsersScreen } from '../screens/AdminScreens';
import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();
const PlacesTab = () => <CatalogScreen kind="place" />;
const ProductsTab = () => <CatalogScreen kind="product" />;
const VideosTab = () => <CatalogScreen kind="video" />;

function Tabs() {
  const { colors: c } = useTheme();
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, tabBarIconStyle: { display: 'none' }, tabBarLabelStyle: { fontSize: 13, fontWeight: '700', paddingVertical: 10 }, tabBarActiveTintColor: c.primary, tabBarInactiveTintColor: c.muted, tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border } }}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Inicio', tabBarAccessibilityLabel: 'Inicio' }} />
      <Tab.Screen name="Places" component={PlacesTab} options={{ title: 'Spots', tabBarAccessibilityLabel: 'Spots' }} />
      <Tab.Screen name="Products" component={ProductsTab} options={{ title: 'Productos', tabBarAccessibilityLabel: 'Productos' }} />
      <Tab.Screen name="Videos" component={VideosTab} options={{ title: 'Videos', tabBarAccessibilityLabel: 'Videos' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Perfil', tabBarAccessibilityLabel: 'Perfil' }} />
    </Tab.Navigator>
  );
}

// Solo en web: cada pantalla tiene su URL, así funcionan Atrás/Adelante, recargar y compartir enlaces.
// En el teléfono no se usa (el esquema spotcheck:// queda reservado para volver del login con Google/GitHub/Discord).
const num = (v: string) => Number(v);
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [],
  config: {
    screens: {
      Main: { path: '', screens: { Home: '', Places: 'spots', Products: 'productos', Videos: 'videos', Profile: 'perfil' } },
      Detail: { path: 'ver/:kind/:id', parse: { id: num } },
      Form: { path: 'proponer/:kind/:id?', parse: { id: num } },
      Login: 'ingresar', Register: 'registro', Forgot: 'recuperar', VerifyEmail: 'verificar',
      Favorites: 'favoritos', MyReviews: 'mis-resenas', Activity: 'actividad', Submissions: 'propuestas', Settings: 'ajustes',
      Moderation: 'moderacion', Admin: 'admin', AdminUsers: 'admin/usuarios', AdminCatalog: 'admin/catalogos', AdminFeatured: 'admin/destacados', AdminAudit: 'admin/auditoria', AdminSettings: 'admin/configuracion',
    },
  },
};

export function RootNavigator() {
  const { colors: c, isDark } = useTheme();
  const base = isDark ? DarkTheme : DefaultTheme;
  const theme = { ...base, colors: { ...base.colors, background: c.bg, card: c.surface, text: c.text, border: c.border, primary: c.primary, notification: c.primary } };
  const header = { headerStyle: { backgroundColor: c.surface }, headerTintColor: c.text, headerTitleStyle: { fontWeight: '700' as const }, contentStyle: { backgroundColor: c.bg } };
  return (
    <NavigationContainer theme={theme} linking={Platform.OS === 'web' ? linking : undefined} documentTitle={{ formatter: (o) => (o?.title ? `${o.title} · SPOTCHECK` : 'SPOTCHECK') }}>
      <Stack.Navigator screenOptions={header}>
        <Stack.Screen name="Main" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen name="Detail" component={DetailScreen} options={{ title: '' }} />
        <Stack.Screen name="Form" component={FormScreen} options={{ title: 'Propuesta' }} />
        <Stack.Screen name="ReviewForm" component={ReviewFormScreen} options={{ title: 'Reseña', presentation: 'modal' }} />
        <Stack.Screen name="Report" component={ReportScreen} options={{ title: 'Reportar', presentation: 'modal' }} />
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Iniciar sesión', presentation: 'modal' }} />
        <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Crear cuenta', presentation: 'modal' }} />
        <Stack.Screen name="Forgot" component={ForgotScreen} options={{ title: 'Recuperar contraseña' }} />
        <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} options={{ title: 'Verificar correo' }} />
        <Stack.Screen name="Favorites" component={FavoritesScreen} options={{ title: 'Mis favoritos' }} />
        <Stack.Screen name="MyReviews" component={MyReviewsScreen} options={{ title: 'Mis reseñas' }} />
        <Stack.Screen name="Activity" component={ActivityScreen} options={{ title: 'Mi actividad' }} />
        <Stack.Screen name="Submissions" component={SubmissionsScreen} options={{ title: 'Mis propuestas' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Ajustes' }} />
        <Stack.Screen name="Moderation" component={ModerationScreen} options={{ title: 'Moderación' }} />
        <Stack.Screen name="Admin" component={AdminDashboardScreen} options={{ title: 'Administración' }} />
        <Stack.Screen name="AdminUsers" component={AdminUsersScreen} options={{ title: 'Usuarios y roles' }} />
        <Stack.Screen name="AdminCatalog" component={AdminCatalogScreen} options={{ title: 'Catálogos' }} />
        <Stack.Screen name="AdminFeatured" component={AdminFeaturedScreen} options={{ title: 'Destacados' }} />
        <Stack.Screen name="AdminAudit" component={AdminAuditScreen} options={{ title: 'Auditoría' }} />
        <Stack.Screen name="AdminSettings" component={AdminSettingsScreen} options={{ title: 'Configuración' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
