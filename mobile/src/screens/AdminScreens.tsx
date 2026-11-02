import React, { useState } from 'react';
import { FlatList, Modal, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ContentCard } from '../components/cards';
import { Banner, Body, Button, Card, Chip, EmptyView, ErrorView, Input, Loading, Muted, Pill, Row, Screen, SectionTitle, Title, confirm, fmtDate, showError, usePrompt } from '../components/ui';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { adminApi, catalogApi } from '../api/services';
import { useAsync, usePaginated } from '../hooks';
import { useNav } from '../navigation/types';
import type { FeaturedSlot, Kind, LookupItem, User } from '../types';

function AdminOnly({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  return isAdmin ? <>{children}</> : <Screen><Banner tone="danger" text="Esta sección es solo para el administrador general." /></Screen>;
}

export function AdminDashboardScreen() {
  const nav = useNav(); const { colors: c } = useTheme();
  const st = useAsync(() => adminApi.stats(), []);
  const s = st.data;
  const max = Math.max(1, ...(s?.reviewsPerDay.map((d) => d.count) ?? [1]));
  const Stat = ({ label, value }: { label: string; value: number | string }) => <Card style={{ width: '48%' }}><View style={{ padding: 12 }}><Title size={24}>{value}</Title><Muted>{label}</Muted></View></Card>;
  return (
    <AdminOnly><Screen refresh={{ refreshing: st.loading, onRefresh: st.reload }}>
      <Title size={24}>Panel de administración</Title>
      {st.loading && !s ? <Loading /> : st.error && !s ? <ErrorView error={st.error} onRetry={st.reload} /> : s ? (<>
        <Row wrap gap={8}>
          <Stat label="Usuarios" value={s.users.total} /><Stat label="Altas (30 días)" value={s.users.new30d} />
          <Stat label="Reseñas visibles" value={s.reviews.visible} /><Stat label="Reportes abiertos" value={s.reports.open} />
          <Stat label="Spots publicados" value={s.content.places.published ?? 0} /><Stat label="Productos publicados" value={s.content.products.published ?? 0} />
          <Stat label="Videos publicados" value={s.content.videos.published ?? 0} /><Stat label="Favoritos" value={s.favorites} />
        </Row>
        {Object.values(s.pendingModeration).some((n) => n > 0) ? <Banner tone="warning" text={`Pendientes de moderación — spots: ${s.pendingModeration.places}, productos: ${s.pendingModeration.products}, videos: ${s.pendingModeration.videos}, reseñas: ${s.pendingModeration.reviews}`} action={{ label: 'Ir a moderación', onPress: () => nav.navigate('Moderation') }} /> : null}
        <SectionTitle title="Reseñas por día (14 días)" />
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 90, gap: 4 }}>{s.reviewsPerDay.map((d) => <View key={d.day} style={{ flex: 1, height: Math.max(4, (d.count / max) * 80), backgroundColor: c.primary, borderRadius: 3 }} accessibilityLabel={`${d.day}: ${d.count}`} />)}</View>
        {!s.reviewsPerDay.length ? <Muted>Sin reseñas recientes.</Muted> : null}
        <SectionTitle title="Mejor puntuados" />
        {[...s.topRated.places.map((p) => ({ ...p, t: 'Spot' })), ...s.topRated.products.map((p) => ({ ...p, t: 'Producto' }))].slice(0, 6).map((p) => <Muted key={`${p.t}${p.id}`} size={14}>{p.t} · {p.name} — {p.avgRating.toFixed(1)}★ ({p.reviewCount})</Muted>)}
      </>) : null}
      <SectionTitle title="Gestión" />
      {([['Usuarios y roles', 'AdminUsers'], ['Categorías, marcas y ciudades', 'AdminCatalog'], ['Destacados de Home', 'AdminFeatured'], ['Moderación y reportes', 'Moderation'], ['Auditoría', 'AdminAudit'], ['Configuración', 'AdminSettings']] as const).map(([l, r]) => <Button key={r} title={l} variant="secondary" onPress={() => nav.navigate(r)} />)}
    </Screen></AdminOnly>
  );
}

export function AdminUsersScreen() {
  const { user: me } = useAuth(); const prompt = usePrompt();
  const [q, setQ] = useState(''); const [role, setRole] = useState<string | undefined>();
  const list = usePaginated<User>((p) => adminApi.users({ page: p, pageSize: 20, q: q.trim() || undefined, role }), [q, role]);
  const act = (fn: () => Promise<unknown>) => fn().then(list.reload).catch((e) => showError(e));
  const manage = (u: User) => {
    if (u.id === me?.id || u.role === 'admin') return showError(new Error('No se puede modificar al administrador.'), 'Acción no permitida');
    confirm(u.displayName, `${u.email}\nRol: ${u.role} · Estado: ${u.status}`, () => {}, 'Cerrar');
  };
  const Actions = ({ u }: { u: User }) => (
    <Row wrap>
      {u.role === 'user' ? <Button small variant="secondary" title="Hacer moderador" onPress={() => act(() => adminApi.setRole(u.id, 'moderator'))} /> : null}
      {u.role === 'moderator' ? <Button small variant="secondary" title="Quitar moderador" onPress={() => act(() => adminApi.setRole(u.id, 'user'))} /> : null}
      {u.status === 'suspended' ? <Button small title="Reactivar" onPress={() => act(() => adminApi.reactivate(u.id))} />
        : <Button small variant="danger" title="Suspender" onPress={async () => { const r = await prompt.ask('Motivo de la suspensión', 'Mínimo 3 caracteres'); if (r) act(() => adminApi.suspend(u.id, r)); }} />}
    </Row>);
  return (
    <AdminOnly><Screen scroll={false}>
      {prompt.element}
      <Input value={q} onChangeText={setQ} placeholder="Buscar por nombre o correo" autoCapitalize="none" />
      <Row wrap>{[undefined, 'user', 'moderator', 'admin'].map((r) => <Chip key={String(r)} label={r ?? 'Todos'} active={role === r} onPress={() => setRole(r)} />)}</Row>
      {list.loading && !list.items.length ? <Loading /> : list.error && !list.items.length ? <ErrorView error={list.error} onRetry={list.reload} /> : (
        <FlatList data={list.items} keyExtractor={(u) => String(u.id)} contentContainerStyle={{ gap: 10, paddingVertical: 10 }} onEndReached={list.loadMore} refreshing={list.loading} onRefresh={list.reload}
          ListEmptyComponent={<EmptyView title="Sin resultados" />}
          renderItem={({ item: u }) => <Card onPress={() => manage(u)}><View style={{ padding: 12, gap: 6 }}><Row><View style={{ flex: 1 }}><Title size={16}>{u.displayName}</Title><Muted>{u.email}</Muted></View><Pill text={u.role} tone={u.role === 'user' ? 'muted' : 'warning'} />{u.status !== 'active' ? <Pill text={u.status} tone="danger" /> : null}</Row>
            {u.id !== me?.id && u.role !== 'admin' ? <Actions u={u} /> : null}</View></Card>} />)}
    </Screen></AdminOnly>
  );
}

type Group = 'categories' | 'brands' | 'cities';
export function AdminCatalogScreen() {
  const prompt = usePrompt();
  const [group, setGroup] = useState<Group>('categories'); const [ctype, setCtype] = useState<Kind>('place');
  const list = usePaginated<LookupItem>((p) => adminApi.lookupList(group, { page: p, type: group === 'categories' ? ctype : undefined }), [group, ctype]);
  const run = (fn: () => Promise<unknown>) => fn().then(list.reload).catch((e) => showError(e));
  const add = async () => { const n = await prompt.ask('Nombre nuevo'); if (n) run(() => adminApi.lookupCreate(group, group === 'categories' ? { type: ctype, name: n } : { name: n })); };
  const rename = async (i: LookupItem) => { const n = await prompt.ask(`Renombrar «${i.name}»`); if (n) run(() => adminApi.lookupUpdate(group, i.id, { name: n })); };
  const del = (i: LookupItem) => confirm('Eliminar', `«${i.name}»: si está en uso se desactiva en lugar de borrarse.`, async () => { try { const r = await adminApi.lookupDelete(group, i.id); list.reload(); if (r.result === 'deactivated') showError(new Error('Estaba en uso: quedó desactivado.'), 'Desactivado'); } catch (e) { showError(e); } }, 'Eliminar');
  return (
    <AdminOnly><Screen scroll={false}>
      {prompt.element}
      <Row wrap>{(['categories', 'brands', 'cities'] as Group[]).map((g) => <Chip key={g} label={{ categories: 'Categorías', brands: 'Marcas', cities: 'Ciudades' }[g]} active={group === g} onPress={() => setGroup(g)} />)}</Row>
      {group === 'categories' ? <Row>{(['place', 'product', 'video'] as Kind[]).map((k) => <Chip key={k} label={{ place: 'Spots', product: 'Productos', video: 'Videos' }[k]} active={ctype === k} onPress={() => setCtype(k)} />)}</Row> : null}
      <Button title="＋ Agregar" small onPress={add} />
      {list.loading && !list.items.length ? <Loading /> : list.error && !list.items.length ? <ErrorView error={list.error} onRetry={list.reload} /> : (
        <FlatList data={list.items} keyExtractor={(i) => String(i.id)} contentContainerStyle={{ gap: 8, paddingVertical: 10 }} ListEmptyComponent={<EmptyView title="Nada todavía" />}
          renderItem={({ item: i }) => <Card><View style={{ padding: 10, gap: 6 }}><Row><View style={{ flex: 1 }}><Body>{i.name}</Body>{i.region ? <Muted>{i.region}</Muted> : null}</View>{i.isActive === false ? <Pill text="Inactiva" tone="danger" /> : null}</Row>
            <Row wrap><Button small variant="secondary" title="Renombrar" onPress={() => rename(i)} />
              {i.isActive !== undefined ? <Button small variant="secondary" title={i.isActive ? 'Desactivar' : 'Activar'} onPress={() => run(() => adminApi.lookupUpdate(group, i.id, { isActive: !i.isActive }))} /> : null}
              <Button small variant="ghost" title="Eliminar" onPress={() => del(i)} /></Row></View></Card>} />)}
    </Screen></AdminOnly>
  );
}

export function AdminFeaturedScreen() {
  const prompt = usePrompt(); const { colors: c } = useTheme();
  const st = useAsync(() => adminApi.featured(), []);
  const [picking, setPicking] = useState<Kind | null>(null);
  const picker = usePaginated((p) => (picking ? catalogApi.list(picking, { page: p, pageSize: 20, sort: 'rating' }) : Promise.resolve({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 })), [picking]);
  const run = (fn: () => Promise<unknown>) => fn().then(st.reload).catch((e) => showError(e));
  const num = async (slot: Kind, field: 'periodHours' | 'minReviews' | 'recencyDays', label: string) => { const v = await prompt.ask(label, 'Número entero'); const n = Number(v); if (v && Number.isInteger(n)) run(() => adminApi.featuredSettings(slot, { [field]: n })); else if (v) showError(new Error('Ingresá un número entero'), 'Valor inválido'); };
  const names = { video: 'Video de la semana', product: 'Producto destacado', place: 'Spot destacado' } as const;
  return (
    <AdminOnly><Screen>
      {prompt.element}
      <Title size={22}>Destacados de Home</Title><Muted>Automático: el servidor elige por puntuación ponderada y rota cada período. Manual: elegís el contenido exacto.</Muted>
      {st.loading && !st.data ? <Loading /> : st.error && !st.data ? <ErrorView error={st.error} onRetry={st.reload} /> : (['video', 'product', 'place'] as Kind[]).map((slot) => {
        const s = st.data?.featured[slot] as FeaturedSlot | undefined; if (!s) return null;
        return (
          <Card key={slot}><View style={{ padding: 12, gap: 8 }}>
            <Title size={17}>{names[slot]}</Title>
            <Row wrap><Pill text={s.settings.mode === 'manual' ? 'Manual' : 'Automático'} tone="warning" />{s.current ? <Pill text={s.current.status === 'valid' ? 'Vigente' : s.current.status === 'expired' ? 'Vencido' : 'No disponible'} tone={s.current.status === 'valid' ? 'success' : 'danger'} /> : <Pill text="Sin destacado" tone="danger" />}</Row>
            {s.current ? <Body>{s.current.label} <Muted>({s.current.selection}{s.current.score ? ` · puntaje ${s.current.score}` : ''}{s.current.endsAt ? ` · hasta ${fmtDate(s.current.endsAt)}` : ' · sin vencimiento'})</Muted></Body> : null}
            <Muted>Período {s.settings.periodHours} h · mínimo {s.settings.minReviews} reseñas · actividad {s.settings.recencyDays} días</Muted>
            <Row wrap>
              <Button small variant="secondary" title={s.settings.mode === 'manual' ? 'Pasar a automático' : 'Pasar a manual'} onPress={() => run(() => adminApi.featuredSettings(slot, { mode: s.settings.mode === 'manual' ? 'automatic' : 'manual' }))} />
              <Button small title="Elegir contenido" onPress={() => setPicking(slot)} />
              {s.settings.mode === 'automatic' ? <Button small variant="secondary" title="Re-sortear ahora" onPress={() => run(() => adminApi.refreshFeatured(slot))} /> : null}
              <Button small variant="ghost" title="Período" onPress={() => num(slot, 'periodHours', 'Período en horas')} />
              <Button small variant="ghost" title="Mín. reseñas" onPress={() => num(slot, 'minReviews', 'Mínimo de reseñas')} />
            </Row>
          </View></Card>);
      })}
      <Modal visible={!!picking} animationType="slide" onRequestClose={() => setPicking(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, padding: 16, gap: 10 }}>
          <Title size={20}>Elegí el contenido a destacar</Title>
          {picker.loading && !picker.items.length ? <Loading /> : <FlatList data={picker.items} keyExtractor={(i) => String(i.id)} contentContainerStyle={{ gap: 10 }} onEndReached={picker.loadMore} ListEmptyComponent={<EmptyView title="No hay contenido publicado" />}
            renderItem={({ item }) => <ContentCard kind={picking!} item={item} onPress={() => { const slot = picking!; setPicking(null); run(() => adminApi.setFeatured(slot, item.id)); }} />} />}
          <Button title="Cancelar" variant="secondary" onPress={() => setPicking(null)} />
        </SafeAreaView>
      </Modal>
    </Screen></AdminOnly>
  );
}

export function AdminAuditScreen() {
  const list = usePaginated((p) => adminApi.audit(p), []);
  return (
    <AdminOnly><Screen scroll={false}>
      {list.loading && !list.items.length ? <Loading /> : list.error && !list.items.length ? <ErrorView error={list.error} onRetry={list.reload} /> : (
        <FlatList data={list.items} keyExtractor={(i) => String(i.id)} contentContainerStyle={{ gap: 8, paddingVertical: 10 }} onEndReached={list.loadMore} refreshing={list.loading} onRefresh={list.reload} ListEmptyComponent={<EmptyView title="Sin registros" />}
          renderItem={({ item: a }) => <Card><View style={{ padding: 10, gap: 2 }}><Body>{a.action}</Body><Muted>{a.actor?.displayName ?? 'Sistema'} · {a.entityType}{a.entityId ? ` #${a.entityId}` : ''} · {fmtDate(a.createdAt)}</Muted></View></Card>} />)}
    </Screen></AdminOnly>
  );
}

const SETTING_LABELS: Record<string, string> = { require_moderation_places: 'Moderar spots propuestos', require_moderation_products: 'Moderar productos propuestos', require_moderation_videos: 'Moderar videos propuestos', premoderate_reviews: 'Premoderar reseñas', account_deletion_grace_days: 'Días de gracia para eliminar cuenta' };
export function AdminSettingsScreen() {
  const st = useAsync(() => adminApi.settings(), []);
  const prompt = usePrompt();
  const toggle = async (key: string, on: boolean) => { try { await adminApi.updateSettings({ [key]: !on }); st.reload(); } catch (e) { showError(e); } };
  const days = async () => { const v = await prompt.ask('Días de gracia (1-90)'); const n = Number(v); if (v) { try { await adminApi.updateSettings({ account_deletion_grace_days: n }); st.reload(); } catch (e) { showError(e); } } };
  return (
    <AdminOnly><Screen>
      {prompt.element}
      <Title size={22}>Configuración</Title>
      {st.loading && !st.data ? <Loading /> : st.error && !st.data ? <ErrorView error={st.error} onRetry={st.reload} /> : (st.data?.settings ?? []).filter((s) => SETTING_LABELS[s.key]).map((s) => s.key === 'account_deletion_grace_days'
        ? <Card key={s.key} onPress={days}><View style={{ padding: 14, flexDirection: 'row', justifyContent: 'space-between' }}><Body>{SETTING_LABELS[s.key]}</Body><Title size={16}>{s.value}</Title></View></Card>
        : <Card key={s.key} onPress={() => toggle(s.key, s.value === '1')}><View style={{ padding: 14, flexDirection: 'row', justifyContent: 'space-between' }}><Body>{SETTING_LABELS[s.key]}</Body><Pill text={s.value === '1' ? 'Sí' : 'No'} tone={s.value === '1' ? 'success' : 'muted'} /></View></Card>)}
      <Muted>Los cambios rigen de inmediato y quedan en la auditoría.</Muted>
    </Screen></AdminOnly>
  );
}
