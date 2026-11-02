import React, { useState } from 'react';
import { View } from 'react-native';
import { Banner, Body, Button, Input, Muted, Row, Screen, Title, showError, messageOf, notify } from '../components/ui';
import { useAuth, type Provider } from '../context/AuthContext';
import { authApi } from '../api/services';
import { isCode, isEmail, passwordProblem } from '../lib/validate';
import { useNav } from '../navigation/types';

export function SocialButtons({ onDone }: { onDone?: () => void }) {
  const { signInWithProvider } = useAuth();
  const [busy, setBusy] = useState<Provider | null>(null);
  const go = async (p: Provider) => { setBusy(p); try { await signInWithProvider(p); onDone?.(); } catch (e) { showError(e, 'Inicio de sesión'); } finally { setBusy(null); } };
  return (
    <View style={{ gap: 8 }}>
      <Muted>o continuá con</Muted>
      <Button title="Google" variant="secondary" loading={busy === 'google'} disabled={!!busy} onPress={() => go('google')} />
      <Row><View style={{ flex: 1 }}><Button title="GitHub" variant="secondary" loading={busy === 'github'} disabled={!!busy} onPress={() => go('github')} /></View>
        <View style={{ flex: 1 }}><Button title="Discord" variant="secondary" loading={busy === 'discord'} disabled={!!busy} onPress={() => go('discord')} /></View></Row>
    </View>
  );
}

export function LoginScreen() {
  const nav = useNav(); const { signIn } = useAuth();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [tried, setTried] = useState(false);
  const submit = async () => {
    setTried(true);
    if (!isEmail(email) || !password) return;
    setBusy(true);
    try { await signIn(email, password); nav.goBack(); } catch (e) { showError(e, 'No pudimos iniciar sesión'); } finally { setBusy(false); }
  };
  return (
    <Screen>
      <Title size={26}>Entrá a SPOTCHECK</Title>
      <Muted>Reseñá spots, productos y videos con la comunidad.</Muted>
      <Input label="Correo" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" error={tried && !isEmail(email) ? 'Ingresá un correo válido' : null} />
      <Input label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" error={tried && !password ? 'Ingresá tu contraseña' : null} onSubmitEditing={submit} />
      <Button title="Iniciar sesión" onPress={submit} loading={busy} />
      <Button title="Olvidé mi contraseña" variant="ghost" onPress={() => nav.navigate('Forgot')} />
      <SocialButtons onDone={() => nav.goBack()} />
      <Button title="Crear cuenta" variant="secondary" onPress={() => nav.replace('Register')} />
      <Button title="Seguir sin cuenta" variant="ghost" onPress={() => nav.goBack()} />
    </Screen>
  );
}

export function RegisterScreen() {
  const nav = useNav(); const { signUp } = useAuth();
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [pw2, setPw2] = useState(''); const [busy, setBusy] = useState(false); const [tried, setTried] = useState(false);
  const errs = { name: name.trim().length < 2 ? 'Mínimo 2 caracteres' : null, email: isEmail(email) ? null : 'Ingresá un correo válido', pw: passwordProblem(pw), pw2: pw2 === pw ? null : 'Las contraseñas no coinciden' };
  const submit = async () => {
    setTried(true);
    if (Object.values(errs).some(Boolean)) return;
    setBusy(true);
    try { await signUp(email, pw, name); nav.replace('VerifyEmail'); } catch (e) { showError(e, 'No pudimos crear la cuenta'); } finally { setBusy(false); }
  };
  return (
    <Screen>
      <Title size={26}>Crear cuenta</Title>
      <Input label="Nombre" value={name} onChangeText={setName} error={tried ? errs.name : null} />
      <Input label="Correo" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" error={tried ? errs.email : null} />
      <Input label="Contraseña" value={pw} onChangeText={setPw} secureTextEntry hint="Mínimo 8 caracteres, con letras y números" error={tried ? errs.pw : null} />
      <Input label="Repetir contraseña" value={pw2} onChangeText={setPw2} secureTextEntry error={tried ? errs.pw2 : null} />
      <Button title="Registrarme" onPress={submit} loading={busy} />
      <SocialButtons onDone={() => nav.goBack()} />
      <Button title="Ya tengo cuenta" variant="ghost" onPress={() => nav.replace('Login')} />
    </Screen>
  );
}

export function VerifyEmailScreen() {
  const nav = useNav(); const { user, refreshUser } = useAuth();
  const [code, setCode] = useState(''); const [busy, setBusy] = useState(false); const [sent, setSent] = useState<string | null>(null);
  if (!user) return <Screen><Body>Iniciá sesión para verificar tu correo.</Body></Screen>;
  const verify = async () => {
    if (!isCode(code)) return showError(new Error('El código tiene 6 dígitos'), 'Código inválido');
    setBusy(true);
    try { await authApi.verifyEmail(user.email, code.trim()); await refreshUser(); notify('Correo verificado', 'Ya podés proponer contenido y escribir reseñas.', () => nav.navigate('Main')); } catch (e) { showError(e, 'No pudimos verificar'); } finally { setBusy(false); }
  };
  const resend = async () => { try { const r = await authApi.resendVerification(); setSent(r.emailSent ? 'Te enviamos un código nuevo.' : 'El servidor no pudo enviar el correo. Probá más tarde.'); } catch (e) { showError(e); } };
  return (
    <Screen>
      <Title size={24}>Verificá tu correo</Title>
      <Body>Te enviamos un código de 6 dígitos a {user.email}. Con el correo verificado podés proponer contenido y escribir reseñas.</Body>
      <Input label="Código" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
      <Button title="Verificar" onPress={verify} loading={busy} />
      <Button title="Reenviar código" variant="secondary" onPress={resend} />
      {sent ? <Banner text={sent} /> : null}
    </Screen>
  );
}

export function ForgotScreen() {
  const nav = useNav();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState(''); const [code, setCode] = useState(''); const [pw, setPw] = useState(''); const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!isEmail(email)) return showError(new Error('Ingresá un correo válido'), 'Correo inválido');
    setBusy(true);
    try { await authApi.forgot(email.trim()); setStep(2); } catch (e) { showError(e); } finally { setBusy(false); }
  };
  const reset = async () => {
    const problem = passwordProblem(pw);
    if (!isCode(code) || problem) return showError(new Error(problem ?? 'El código tiene 6 dígitos'), 'Revisá los datos');
    setBusy(true);
    try { await authApi.reset(email.trim(), code.trim(), pw); showError(new Error('Ya podés iniciar sesión con tu contraseña nueva.'), 'Contraseña actualizada'); nav.replace('Login'); } catch (e) { showError(new Error(messageOf(e)), 'No pudimos restablecerla'); } finally { setBusy(false); }
  };
  return (
    <Screen>
      <Title size={24}>Recuperar contraseña</Title>
      {step === 1 ? (<>
        <Body>Ingresá tu correo y te enviamos un código para crear una contraseña nueva.</Body>
        <Input label="Correo" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Button title="Enviar código" onPress={send} loading={busy} />
      </>) : (<>
        <Banner text="Si el correo está registrado, te llegó un código de 6 dígitos (vence en 15 minutos)." />
        <Input label="Código" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
        <Input label="Contraseña nueva" value={pw} onChangeText={setPw} secureTextEntry hint="Mínimo 8 caracteres, con letras y números" />
        <Button title="Cambiar contraseña" onPress={reset} loading={busy} />
        <Button title="Usar otro correo" variant="ghost" onPress={() => setStep(1)} />
      </>)}
    </Screen>
  );
}
