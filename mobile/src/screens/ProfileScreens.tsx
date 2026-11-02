import React, { useState } from 'react';
import { View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Avatar, Banner, Body, Button, Card, Chip, Input, Muted, Pill, Row, Screen, SectionTitle, Title, confirm, showError, usePrompt } from '../components/ui';
import { useAuth, OAUTH_MESSAGES, type Provider } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';
import { api } from '../api';
import { authApi, meApi } from '../api/services';
import { useAsync } from '../hooks';
import { useNav } from '../navigation/types';
import { API_URL } from '../config';
import { parseAuthRedirect } from '../lib/pkce';
import { passwordProblem } from '../lib/validate';
import type { ThemePref } from '../types';

const ROLE_LABEL = { user: 'Usuario', moderator: 'Moderador', admin: 'Administrador' } as const;

export function ProfileScreen() {
  const nav = useNav(); const { user, signOut, isStaff, isAdmin } = useAuth();
  if (!user) {
    return (
      <Screen edges={['top']}>
        <Title size={26}>Tu perfil</Title>
        <Card><View style={{ padding: 16, gap: 10 }}><Body>Creá una cuenta para reseñar, guardar favoritos y proponer spots.</Body><Button title="Iniciar sesión" onPress={() => nav.navigate('Login')} /><Button title="Crear cuenta" variant="secondary" onPress={() => nav.navigate('Register')} /></View></Card>
        <Button title="Ajustes y apariencia" variant="ghost" onPress={() => nav.navigate('Settings')} />
      </Screen>
    );
  }
  const Item = ({ label, onPress }: { label: string; onPress: () => void }) => <Card onPress={onPress}><View style={{ padding: 14, flexDirection: 'row', justifyContent: 'space-between' }}><Body>{label}</Body><Muted>›</Muted></View></Card>;
  return (
    <Screen edges={['top']}>
      <Row gap={14}><Avatar name={user.displayName} uri={user.avatarUrl} size={64} /><View style={{ flex: 1, gap: 2 }}><Title size={22}>{user.displayName}</Title><Muted>{user.email}</Muted><Row><Pill text={ROLE_LABEL[user.role]} tone={isStaff ? 'warning' : 'muted'} />{user.emailVerified ? <Pill text="Correo verificado" tone="success" /> : null}</Row></View></Row>
      {!user.emailVerified ? <Banner tone="warning" text="Tu correo no está verificado." action={{ label: 'Verificar ahora', onPress: () => nav.navigate('VerifyEmail') }} /> : null}
      {user.status === 'pending_deletion' ? <Banner tone="danger" text="Tu cuenta está programada para eliminarse. Podés cancelarlo en Ajustes." action={{ label: 'Ir a Ajustes', onPress: () => nav.navigate('Settings') }} /> : null}
      {user.bio ? <Body>{user.bio}</Body> : null}
      <SectionTitle title="Mi actividad" />
      <Item label="Mis favoritos" onPress={() => nav.navigate('Favorites')} />
      <Item label="Mis reseñas" onPress={() => nav.navigate('MyReviews')} />
      <Item label="Mis propuestas" onPress={() => nav.navigate('Submissions')} />
      <Item label="Actividad reciente" onPress={() => nav.navigate('Activity')} />
      {isStaff ? (<><SectionTitle title="Equipo" /><Item label="Moderación" onPress={() => nav.navigate('Moderation')} /></>) : null}
      {isAdmin ? <Item label="Panel de administración" onPress={() => nav.navigate('Admin')} /> : null}
      <SectionTitle title="Cuenta" />
      <Item label="Ajustes" onPress={() => nav.navigate('Settings')} />
      <Button title="Cerrar sesión" variant="secondary" onPress={() => confirm('Cerrar sesión', '¿Querés salir de tu cuenta?', signOut, 'Salir')} />
    </Screen>
  );
}

/** Verificación adicional: código por correo -> token de 5 minutos. */
function useSensitive() {
  const prompt = usePrompt();
  const get = async (): Promise<string | null> => {
    await authApi.sensitiveRequest();
    const code = await prompt.ask('Código de confirmación', 'Te lo enviamos por correo (6 dígitos)');
    if (!code) return null;
    return (await authApi.sensitiveConfirm(code.trim())).sensitiveToken;
  };
  return { get, element: prompt.element, ask: prompt.ask };
}

export function SettingsScreen() {
  const nav = useNav(); const { user, setUser, signOut, refreshUser } = useAuth(); const { preference, setPreference } = useTheme();
  const sens = useSensitive();
  const [name, setName] = useState(user?.displayName ?? ''); const [bio, setBio] = useState(user?.bio ?? ''); const [saving, setSaving] = useState(false);
  const [cur, setCur] = useState(''); const [next, setNext] = useState(''); const [pwBusy, setPwBusy] = useState(false);
  const linked = useAsync(() => (user ? meApi.linked() : Promise.resolve({ accounts: [] })), [user?.id]);
  const [health, setHealth] = useState<string | null>(null);

  const chooseTheme = async (p: ThemePref) => { setPreference(p); if (user) meApi.update({ themePreference: p }).then((r) => setUser(r.user)).catch(() => {}); };
  const saveProfile = async () => { setSaving(true); try { setUser((await meApi.update({ displayName: name.trim(), bio: bio.trim() || null })).user); showError(new Error('Perfil actualizado'), 'Listo'); } catch (e) { showError(e); } finally { setSaving(false); } };
  const changePw = async () => {
    const problem = passwordProblem(next);
    if (!cur || problem) return showError(new Error(problem ?? 'Ingresá tu contraseña actual'), 'Revisá los datos');
    setPwBusy(true);
    try { const s = await authApi.changePassword(cur, next); await api.setTokens({ accessToken: s.accessToken, refreshToken: s.refreshToken }); setCur(''); setNext(''); showError(new Error('Las demás sesiones se cerraron.'), 'Contraseña cambiada'); } catch (e) { showError(e); } finally { setPwBusy(false); }
  };
  const link = async (p: Provider) => {
    try {
      const redirect = Linking.createURL('auth');
      const { url } = await authApi.linkStart(p, redirect);
      const r = await WebBrowser.openAuthSessionAsync(url, redirect);
      if (r.type !== 'success') return;
      const { error } = parseAuthRedirect(r.url);
      if (error) throw new Error(OAUTH_MESSAGES[error] ?? 'No se pudo vincular la cuenta');
      linked.reload();
    } catch (e) { showError(e, 'Vincular cuenta'); }
  };
  const unlink = (p: string) => confirm('Desvincular', `Vas a quitar ${p} como método de acceso.`, async () => {
    try { const t = await sens.get(); if (!t) return; await authApi.unlink(p, t); linked.reload(); } catch (e) { showError(e); }
  }, 'Desvincular');
  const requestDelete = () => confirm('Eliminar cuenta', 'Se eliminarán tus reseñas, favoritos y datos personales después de un período de gracia. Podés cancelarlo durante ese plazo.', async () => {
    try {
      if (!user!.emailVerified) throw new Error('Verificá tu correo para poder eliminar tu cuenta.');
      const t = await sens.get(); if (!t) return;
      const password = user!.hasPassword ? await sens.ask('Confirmá tu contraseña', 'Contraseña actual') : undefined;
      if (user!.hasPassword && !password) return;
      const r = await meApi.requestDeletion(password ?? undefined, t);
      await refreshUser();
      showError(new Error(`Tu cuenta se eliminará el ${new Date(r.deletionScheduledFor).toLocaleDateString('es-AR')}. Podés cancelarlo desde acá.`), 'Baja solicitada');
    } catch (e) { showError(e); }
  }, 'Continuar');
  const test = async () => { setHealth('Probando…'); try { const r = await fetch(`${API_URL}/health`); setHealth(r.ok ? 'Conectado' : `Respondió ${r.status}`); } catch { setHealth('No se pudo conectar'); } };

  return (
    <Screen>
      {sens.element}
      <SectionTitle title="Apariencia" />
      <Row wrap>{([['system', 'Sistema'], ['light', 'Claro'], ['dark', 'Oscuro']] as const).map(([v, l]) => <Chip key={v} label={l} active={preference === v} onPress={() => chooseTheme(v)} />)}</Row>
      {user ? (<>
        <SectionTitle title="Perfil" />
        <Input label="Nombre" value={name} onChangeText={setName} /><Input label="Sobre vos" value={bio} onChangeText={setBio} multiline maxLength={500} />
        <Button title="Guardar perfil" onPress={saveProfile} loading={saving} disabled={name.trim().length < 2} />
        <SectionTitle title="Métodos de acceso" />
        {(linked.data?.accounts ?? []).map((a) => <Row key={a.provider}><Pill text={a.provider} tone="success" /><View style={{ flex: 1 }}><Muted>{a.email ?? ''}</Muted></View><Button small variant="ghost" title="Quitar" onPress={() => unlink(a.provider)} /></Row>)}
        <Row wrap>{(['google', 'github', 'discord'] as Provider[]).filter((p) => !(linked.data?.accounts ?? []).some((a) => a.provider === p)).map((p) => <Chip key={p} label={`Vincular ${p}`} onPress={() => link(p)} />)}</Row>
        {user.hasPassword ? (<>
          <SectionTitle title="Cambiar contraseña" />
          <Input label="Contraseña actual" value={cur} onChangeText={setCur} secureTextEntry /><Input label="Nueva contraseña" value={next} onChangeText={setNext} secureTextEntry hint="Mínimo 8 caracteres, con letras y números" />
          <Button title="Cambiar contraseña" variant="secondary" onPress={changePw} loading={pwBusy} />
        </>) : <Muted>Tu cuenta entra solo con un proveedor externo. Para crear una contraseña usá "Olvidé mi contraseña" en el inicio de sesión.</Muted>}
        <SectionTitle title="Zona de peligro" />
        {user.status === 'pending_deletion'
          ? <Button title="Cancelar la eliminación de mi cuenta" onPress={async () => { try { await meApi.cancelDeletion(); await refreshUser(); } catch (e) { showError(e); } }} />
          : user.role === 'admin' ? <Muted>Un administrador no puede eliminar su cuenta desde la app.</Muted> : <Button title="Eliminar mi cuenta" variant="danger" onPress={requestDelete} />}
        <Button title="Cerrar sesión" variant="secondary" onPress={() => confirm('Cerrar sesión', '¿Querés salir?', async () => { await signOut(); nav.goBack(); }, 'Salir')} />
      </>) : null}
      <SectionTitle title="Conexión" />
      <Muted>Servidor: {API_URL}</Muted>
      <Button small variant="secondary" title="Probar conexión" onPress={test} />{health ? <Body>{health}</Body> : null}
    </Screen>
  );
}
