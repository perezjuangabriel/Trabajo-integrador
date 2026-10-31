import React, { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ContentCard } from '../components/cards';
import { Button, Chip, EmptyView, ErrorView, Input, Loading, Muted, Row, Select, Title, useStyles } from '../components/ui';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { catalogApi } from '../api/services';
import { useAsync, usePaginated } from '../hooks';
import { useNav } from '../navigation/types';
import { toNumber } from '../lib/validate';
import type { AnyCard, Kind } from '../types';

interface Filters { categoryId?: number | null; cityId?: number | null; brandId?: number | null; zone?: string; minRating?: number | null; minReviews?: number | null; minPrice?: string; maxPrice?: string; sort?: string }
const SORTS: Record<Kind, { value: string; label: string }[]> = {
  place: [{ value: 'newest', label: 'Más nuevos' }, { value: 'rating', label: 'Mejor puntuados' }, { value: 'reviews', label: 'Más reseñados' }, { value: 'name', label: 'Nombre (A-Z)' }],
  product: [{ value: 'newest', label: 'Más nuevos' }, { value: 'rating', label: 'Mejor puntuados' }, { value: 'reviews', label: 'Más reseñados' }, { value: 'name', label: 'Nombre (A-Z)' }, { value: 'price_asc', label: 'Precio: menor a mayor' }, { value: 'price_desc', label: 'Precio: mayor a menor' }],
  video: [{ value: 'newest', label: 'Más nuevos' }, { value: 'rating', label: 'Mejor puntuados' }, { value: 'reviews', label: 'Más reseñados' }, { value: 'title', label: 'Título (A-Z)' }],
};
const TITLES: Record<Kind, string> = { place: 'Spots y lugares', product: 'Productos', video: 'Videos' };
const RATINGS = [{ value: 3, label: '3 ★ o más' }, { value: 4, label: '4 ★ o más' }, { value: 4.5, label: '4,5 ★ o más' }];
const REVIEWS = [{ value: 1, label: '1 o más' }, { value: 3, label: '3 o más' }, { value: 5, label: '5 o más' }, { value: 10, label: '10 o más' }];

export function CatalogScreen({ kind }: { kind: Kind }) {
  const nav = useNav(); const { user } = useAuth(); const { colors: c } = useTheme();
  const s = useStyles((p) => ({ root: { flex: 1, backgroundColor: p.bg }, head: { padding: 16, paddingBottom: 8, gap: 10 }, fab: { position: 'absolute', right: 16, bottom: 16, backgroundColor: p.primary, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 999, elevation: 4 } }));
  const [text, setText] = useState(''); const [q, setQ] = useState('');
  const [filters, setFilters] = useState<Filters>({}); const [open, setOpen] = useState(false);
  useEffect(() => { const t = setTimeout(() => setQ(text.trim()), 350); return () => clearTimeout(t); }, [text]); // espera a que termine de escribir
  const applied = Object.entries(filters).filter(([k, v]) => v !== undefined && v !== null && v !== '' && k !== 'sort').length;

  const list = usePaginated<AnyCard>((page) => catalogApi.list(kind, {
    page, pageSize: 12, q: q || undefined, categoryId: filters.categoryId, cityId: filters.cityId, brandId: filters.brandId, zone: filters.zone || undefined,
    minRating: filters.minRating, minReviews: filters.minReviews, minPrice: toNumber(filters.minPrice ?? '') ?? undefined, maxPrice: toNumber(filters.maxPrice ?? '') ?? undefined, sort: filters.sort,
  }), [kind, q, JSON.stringify(filters)]);

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.head}>
        <Title size={24}>{TITLES[kind]}</Title>
        <Input value={text} onChangeText={setText} placeholder={`Buscar ${TITLES[kind].toLowerCase()}…`} returnKeyType="search" />
        <Row><Chip label={applied ? `Filtros (${applied})` : 'Filtros'} active={applied > 0} onPress={() => setOpen(true)} />
          <Chip label={SORTS[kind].find((o) => o.value === (filters.sort ?? 'newest'))?.label ?? ''} onPress={() => setOpen(true)} />
          <View style={{ flex: 1 }} /><Muted>{list.loading ? '' : `${list.total} resultados`}</Muted></Row>
      </View>
      {list.loading && !list.items.length ? <Loading /> : list.error && !list.items.length ? <ErrorView error={list.error} onRetry={list.reload} />
        : (
          <FlatList data={list.items} keyExtractor={(i) => String(i.id)} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 90 }}
            renderItem={({ item }) => <ContentCard kind={kind} item={item} onPress={() => nav.navigate('Detail', { kind, id: item.id })} />}
            onEndReached={list.loadMore} onEndReachedThreshold={0.5} refreshing={list.loading} onRefresh={list.reload}
            ListEmptyComponent={<EmptyView title="No encontramos resultados" hint={q || applied ? 'Probá con otra búsqueda o quitá filtros.' : 'Todavía no hay nada acá. ¡Proponé el primero!'}
              action={{ label: q || applied ? 'Limpiar filtros' : 'Proponer', onPress: () => (q || applied ? (setText(''), setFilters({})) : user ? nav.navigate('Form', { kind }) : nav.navigate('Login')) }} />}
            ListFooterComponent={list.loadingMore ? <Loading /> : list.error ? <ErrorView error={list.error} onRetry={list.loadMore} /> : undefined} />
        )}
      <Pressable accessibilityRole="button" accessibilityLabel="Proponer nuevo" style={s.fab} onPress={() => (user ? nav.navigate('Form', { kind }) : nav.navigate('Login'))}>
        <Text style={{ color: c.onPrimary, fontWeight: '800' }}>＋ Proponer</Text>
      </Pressable>
      <FilterSheet kind={kind} visible={open} value={filters} onClose={() => setOpen(false)} onApply={(f) => { setFilters(f); setOpen(false); }} />
    </SafeAreaView>
  );
}

function FilterSheet({ kind, visible, value, onClose, onApply }: { kind: Kind; visible: boolean; value: Filters; onClose: () => void; onApply: (f: Filters) => void }) {
  const { colors: c } = useTheme();
  const [f, setF] = useState<Filters>(value);
  useEffect(() => { if (visible) setF(value); }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  const cats = useAsync(() => catalogApi.categories(kind), [kind]);
  const cities = useAsync(() => (kind === 'place' ? catalogApi.cities() : Promise.resolve(null)), [kind]);
  const brands = useAsync(() => (kind === 'product' ? catalogApi.brands() : Promise.resolve(null)), [kind]);
  const set = (p: Partial<Filters>) => setF((prev) => ({ ...prev, ...p }));
  const opts = (items?: { id: number; name: string }[]) => (items ?? []).map((i) => ({ value: i.id, label: i.name }));
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
          <Title size={22}>Filtros y orden</Title>
          <Select label="Ordenar por" value={f.sort ?? 'newest'} options={SORTS[kind]} onChange={(v) => set({ sort: v ?? 'newest' })} />
          <Select label="Categoría" value={f.categoryId} options={opts(cats.data?.items)} onChange={(v) => set({ categoryId: v })} allowClear placeholder="Todas" />
          {kind === 'place' ? (<>
            <Select label="Ciudad" value={f.cityId} options={opts(cities.data?.items)} onChange={(v) => set({ cityId: v })} allowClear placeholder="Todas" />
            <Input label="Zona o barrio" value={f.zone ?? ''} onChangeText={(v) => set({ zone: v })} />
          </>) : null}
          {kind === 'product' ? (<>
            <Select label="Marca" value={f.brandId} options={opts(brands.data?.items)} onChange={(v) => set({ brandId: v })} allowClear placeholder="Todas" />
            <Row><View style={{ flex: 1 }}><Input label="Precio mínimo" value={f.minPrice ?? ''} onChangeText={(v) => set({ minPrice: v })} keyboardType="numeric" /></View>
              <View style={{ flex: 1 }}><Input label="Precio máximo" value={f.maxPrice ?? ''} onChangeText={(v) => set({ maxPrice: v })} keyboardType="numeric" /></View></Row>
          </>) : null}
          <Select label="Puntuación" value={f.minRating} options={RATINGS} onChange={(v) => set({ minRating: v })} allowClear placeholder="Cualquiera" />
          <Select label="Cantidad de reseñas" value={f.minReviews} options={REVIEWS} onChange={(v) => set({ minReviews: v })} allowClear placeholder="Cualquiera" />
          <Button title="Aplicar" onPress={() => onApply(f)} />
          <Button title="Limpiar todo" variant="secondary" onPress={() => onApply({})} />
          <Button title="Cerrar" variant="ghost" onPress={onClose} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
