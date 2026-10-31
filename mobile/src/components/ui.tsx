import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type ImageStyle, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useTheme } from '../theme/ThemeContext';
import { radius, space, type Palette } from '../theme/colors';
import { ApiError } from '../api/client';

type Styles = { [key: string]: ViewStyle | TextStyle | ImageStyle };
export const useStyles = <T extends Styles>(make: (c: Palette) => T): T => { const { colors } = useTheme(); return useMemo(() => StyleSheet.create(make(colors)), [colors]); };
export const messageOf = (e: unknown) => (e instanceof ApiError ? e.details?.[0]?.message ?? e.message : e instanceof Error ? e.message : 'Ocurrió un error inesperado');
export const showError = (e: unknown, title = 'No se pudo completar') => { if (!(e instanceof ApiError && e.code === 'CANCELLED')) Alert.alert(title, messageOf(e)); };
export const confirm = (title: string, message: string, onOk: () => void, okText = 'Confirmar') =>
  Alert.alert(title, message, [{ text: 'Cancelar', style: 'cancel' }, { text: okText, style: 'destructive', onPress: onOk }]);
export const fmtDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const fmtMoney = (p: { amount: number; currency: string } | null) => (p ? `${p.currency} ${p.amount.toLocaleString('es-AR')}` : null);

/** Contenedor de pantalla: respeta las áreas seguras (barra de estado/gestos de Android) y el teclado. */
export function Screen({ children, scroll = true, padded = true, edges = ['bottom'], refresh }: { children: React.ReactNode; scroll?: boolean; padded?: boolean; edges?: ('top' | 'bottom')[]; refresh?: { refreshing: boolean; onRefresh: () => void } }) {
  const s = useStyles((c) => ({ root: { flex: 1, backgroundColor: c.bg }, pad: { padding: space.lg, gap: space.md, paddingBottom: space.xxl } }));
  return (
    <SafeAreaView style={s.root} edges={edges}>
      {scroll ? <ScrollView contentContainerStyle={padded ? s.pad : undefined} keyboardShouldPersistTaps="handled" refreshControl={refresh ? <RefreshControl refreshing={refresh.refreshing} onRefresh={refresh.onRefresh} /> : undefined}>{children}</ScrollView> : <View style={[{ flex: 1 }, padded && { padding: space.lg }]}>{children}</View>}
    </SafeAreaView>
  );
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
export function Button({ title, onPress, variant = 'primary', loading, disabled, small, style }: { title: string; onPress: () => void; variant?: Variant; loading?: boolean; disabled?: boolean; small?: boolean; style?: StyleProp<ViewStyle> }) {
  const { colors: c } = useTheme();
  const bg = { primary: c.primary, secondary: c.surfaceAlt, danger: c.danger, ghost: 'transparent' }[variant];
  const fg = { primary: c.onPrimary, secondary: c.text, danger: '#FFFFFF', ghost: c.primary }[variant];
  const off = disabled || loading;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: off }} disabled={off} onPress={onPress}
      style={({ pressed }) => [{ backgroundColor: bg, paddingVertical: small ? 8 : 13, paddingHorizontal: small ? 14 : 18, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', opacity: off ? 0.5 : pressed ? 0.85 : 1, minHeight: small ? 36 : 48 }, style]}>
      {loading ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontWeight: '700', fontSize: small ? 14 : 16 }}>{title}</Text>}
    </Pressable>
  );
}

export function Input({ label, error, hint, style, ...rest }: TextInputProps & { label?: string; error?: string | null; hint?: string }) {
  const { colors: c } = useTheme();
  return (
    <View style={{ gap: 4 }}>
      {label ? <Text style={{ color: c.text, fontWeight: '600' }}>{label}</Text> : null}
      <TextInput placeholderTextColor={c.muted} accessibilityLabel={label} {...rest}
        style={[{ backgroundColor: c.surface, color: c.text, borderWidth: 1, borderColor: error ? c.danger : c.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 }, rest.multiline && { minHeight: 96, textAlignVertical: 'top' }, style]} />
      {error ? <Text style={{ color: c.danger, fontSize: 13 }}>{error}</Text> : hint ? <Text style={{ color: c.muted, fontSize: 12 }}>{hint}</Text> : null}
    </View>
  );
}

export function Card({ children, onPress, style }: { children: React.ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const { colors: c } = useTheme();
  const base: ViewStyle = { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, overflow: 'hidden' };
  return onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.9 }, style]}>{children}</Pressable> : <View style={[base, style]}>{children}</View>;
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  const { colors: c } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!active }}
      style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: active ? c.primary : c.surfaceAlt, borderWidth: 1, borderColor: active ? c.primary : c.border }}>
      <Text style={{ color: active ? c.onPrimary : c.text, fontWeight: '600', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export function Stars({ value, size = 16, onChange }: { value: number; size?: number; onChange?: (v: number) => void }) {
  const { colors: c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 2 }} accessibilityLabel={`Puntuación ${value} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Text key={i} onPress={onChange ? () => onChange(i) : undefined} accessibilityRole={onChange ? 'button' : undefined} accessibilityLabel={onChange ? `${i} estrellas` : undefined}
          style={{ fontSize: size, color: i <= Math.round(value) ? c.star : c.border, padding: onChange ? 4 : 0 }}>★</Text>
      ))}
    </View>
  );
}
export function RatingLine({ avg, count }: { avg: number; count: number }) {
  const { colors: c } = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Stars value={avg} size={14} /><Text style={{ color: c.muted, fontSize: 13 }}>{count ? `${avg.toFixed(1)} · ${count} ${count === 1 ? 'reseña' : 'reseñas'}` : 'Sin reseñas'}</Text></View>;
}

export function Loading({ label }: { label?: string }) {
  const { colors: c } = useTheme();
  return <View style={{ padding: space.xxl, alignItems: 'center', gap: 8 }}><ActivityIndicator color={c.primary} size="large" />{label ? <Text style={{ color: c.muted }}>{label}</Text> : null}</View>;
}
export function ErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { colors: c } = useTheme();
  const offline = error instanceof ApiError && (error.code === 'NETWORK' || error.code === 'TIMEOUT');
  return (
    <View style={{ padding: space.xl, alignItems: 'center', gap: 10 }}>
      <Text style={{ fontSize: 34 }}>{offline ? '📡' : '⚠️'}</Text>
      <Text style={{ color: c.text, fontWeight: '700', fontSize: 16, textAlign: 'center' }}>{offline ? 'Sin conexión' : 'Algo salió mal'}</Text>
      <Text style={{ color: c.muted, textAlign: 'center' }}>{messageOf(error)}</Text>
      {onRetry ? <Button title="Reintentar" onPress={onRetry} small variant="secondary" /> : null}
    </View>
  );
}
export function EmptyView({ title, hint, action }: { title: string; hint?: string; action?: { label: string; onPress: () => void } }) {
  const { colors: c } = useTheme();
  return (
    <View style={{ padding: space.xl, alignItems: 'center', gap: 8 }}>
      <Text style={{ fontSize: 34 }}>🛹</Text>
      <Text style={{ color: c.text, fontWeight: '700', fontSize: 16, textAlign: 'center' }}>{title}</Text>
      {hint ? <Text style={{ color: c.muted, textAlign: 'center' }}>{hint}</Text> : null}
      {action ? <Button title={action.label} onPress={action.onPress} small /> : null}
    </View>
  );
}
export function Banner({ tone = 'info', text, action }: { tone?: 'info' | 'warning' | 'danger' | 'success'; text: string; action?: { label: string; onPress: () => void } }) {
  const { colors: c } = useTheme();
  const col = { info: c.primary, warning: c.warning, danger: c.danger, success: c.success }[tone];
  return (
    <View style={{ borderLeftWidth: 4, borderLeftColor: col, backgroundColor: c.surfaceAlt, padding: space.md, borderRadius: radius.sm, gap: 6 }}>
      <Text style={{ color: c.text }}>{text}</Text>
      {action ? <Text onPress={action.onPress} style={{ color: col, fontWeight: '700' }}>{action.label}</Text> : null}
    </View>
  );
}
export function SectionTitle({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  const { colors: c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: space.sm }}>
      <Text accessibilityRole="header" style={{ color: c.text, fontSize: 19, fontWeight: '800' }}>{title}</Text>
      {action ? <Text onPress={action.onPress} style={{ color: c.primary, fontWeight: '700' }}>{action.label}</Text> : null}
    </View>
  );
}
export function Avatar({ name, uri, size = 40 }: { name: string; uri?: string | null; size?: number }) {
  const { colors: c } = useTheme();
  return uri
    ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.surfaceAlt }} />
    : <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: c.onPrimary, fontWeight: '800', fontSize: size * 0.42 }}>{name.slice(0, 1).toUpperCase()}</Text></View>;
}
export function Pill({ text, tone = 'muted' }: { text: string; tone?: 'muted' | 'success' | 'warning' | 'danger' }) {
  const { colors: c } = useTheme();
  const col = { muted: c.muted, success: c.success, warning: c.warning, danger: c.danger }[tone];
  return <Text style={{ color: col, borderColor: col, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, fontSize: 11, fontWeight: '700', overflow: 'hidden', alignSelf: 'flex-start' }}>{text}</Text>;
}
export const STATUS_PILL: Record<string, { text: string; tone: 'muted' | 'success' | 'warning' | 'danger' }> = {
  pending: { text: 'Pendiente', tone: 'warning' }, published: { text: 'Publicado', tone: 'success' }, rejected: { text: 'Rechazado', tone: 'danger' }, hidden: { text: 'Oculto', tone: 'muted' },
  visible: { text: 'Visible', tone: 'success' },
};

/** Selector de una opción (hoja modal): sirve para categorías, marcas, ciudades, orden, etc. */
export function Select<T extends string | number>({ label, value, options, onChange, placeholder = 'Elegir…', allowClear }: { label?: string; value: T | null | undefined; options: { value: T; label: string }[]; onChange: (v: T | null) => void; placeholder?: string; allowClear?: boolean }) {
  const { colors: c } = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <View style={{ gap: 4 }}>
      {label ? <Text style={{ color: c.text, fontWeight: '600' }}>{label}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => setOpen(true)} style={{ backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: current ? c.text : c.muted, fontSize: 16 }}>{current?.label ?? placeholder}</Text><Text style={{ color: c.muted }}>▾</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' }} onPress={() => setOpen(false)}>
          <SafeAreaView edges={['bottom']} style={{ backgroundColor: c.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, maxHeight: '70%' }}>
            <ScrollView>
              {allowClear ? <Text onPress={() => { onChange(null); setOpen(false); }} style={{ padding: space.lg, color: c.muted }}>Sin filtro</Text> : null}
              {options.map((o) => (
                <Text key={String(o.value)} onPress={() => { onChange(o.value); setOpen(false); }} style={{ padding: space.lg, color: o.value === value ? c.primary : c.text, fontWeight: o.value === value ? '800' : '500', fontSize: 16 }}>{o.label}</Text>
              ))}
            </ScrollView>
          </SafeAreaView>
        </Pressable>
      </Modal>
    </View>
  );
}
export function Row({ children, gap = space.sm, wrap }: { children: React.ReactNode; gap?: number; wrap?: boolean }) {
  return <View style={{ flexDirection: 'row', gap, flexWrap: wrap ? 'wrap' : 'nowrap', alignItems: 'center' }}>{children}</View>;
}
export function Muted({ children, size = 13 }: { children: React.ReactNode; size?: number }) { const { colors: c } = useTheme(); return <Text style={{ color: c.muted, fontSize: size }}>{children}</Text>; }
export function Title({ children, size = 18 }: { children: React.ReactNode; size?: number }) { const { colors: c } = useTheme(); return <Text style={{ color: c.text, fontSize: size, fontWeight: '800' }}>{children}</Text>; }
export function Body({ children }: { children: React.ReactNode }) { const { colors: c } = useTheme(); return <Text style={{ color: c.text, fontSize: 15, lineHeight: 22 }}>{children}</Text>; }

/** Pedir un texto al usuario (Alert.prompt no existe en Android): devuelve la promesa con el texto o null si cancela. */
export function usePrompt() {
  const { colors: c } = useTheme();
  const [state, setState] = useState<{ title: string; hint?: string; resolve: (v: string | null) => void } | null>(null);
  const [text, setText] = useState('');
  const ask = (title: string, hint?: string) => new Promise<string | null>((resolve) => { setText(''); setState({ title, hint, resolve }); });
  const close = (v: string | null) => { state?.resolve(v); setState(null); };
  const element = (
    <Modal visible={!!state} transparent animationType="fade" onRequestClose={() => close(null)}>
      <View style={{ flex: 1, backgroundColor: c.overlay, justifyContent: 'center', padding: space.xl }}>
        <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md }}>
          <Title>{state?.title ?? ''}</Title>
          <Input value={text} onChangeText={setText} placeholder={state?.hint} autoFocus multiline />
          <Row gap={8}><View style={{ flex: 1 }}><Button title="Cancelar" variant="secondary" onPress={() => close(null)} /></View><View style={{ flex: 1 }}><Button title="Aceptar" onPress={() => close(text.trim() || null)} disabled={!text.trim()} /></View></Row>
        </View>
      </View>
    </Modal>
  );
  return { ask, element };
}
