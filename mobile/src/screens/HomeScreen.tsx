import React from 'react';
import { ScrollView, View } from 'react-native';
import { ContentCard, HeroCard } from '../components/cards';
import { Banner, Body, Button, Card, Chip, EmptyView, ErrorView, Loading, Muted, Row, Screen, SectionTitle, Stars, Title, fmtDate } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { catalogApi } from '../api/services';
import { useAsync } from '../hooks';
import { useNav } from '../navigation/types';
import type { Kind } from '../types';

const QUICK: { label: string; go: (n: ReturnType<typeof useNav>) => void }[] = [
  { label: 'Spots', go: (n) => (n as any).navigate('Main', { screen: 'Places' }) },
  { label: 'Productos', go: (n) => (n as any).navigate('Main', { screen: 'Products' }) },
  { label: 'Videos', go: (n) => (n as any).navigate('Main', { screen: 'Videos' }) },
  { label: 'Favoritos', go: (n) => n.navigate('Favorites') },
];

export function HomeScreen() {
  const nav = useNav(); const { user, offline, refreshUser } = useAuth();
  const { data, error, loading, reload } = useAsync(() => catalogApi.home(), []);
  const open = (kind: Kind, id: number) => nav.navigate('Detail', { kind, id });
  if (loading && !data) return <Screen><Loading label="Cargando la home…" /></Screen>;
  if (error && !data) return <Screen><ErrorView error={error} onRetry={reload} /></Screen>;
  if (!data) return null;
  // El destacado va primero y no se repite entre los populares.
  const places = [...(data.featuredPlace ? [data.featuredPlace] : []), ...data.popularPlaces.filter((p) => p.id !== data.featuredPlace?.id)];
  const products = [...(data.featuredProduct ? [data.featuredProduct] : []), ...data.popularProducts.filter((p) => p.id !== data.featuredProduct?.id)];
  const hero = data.featuredVideo ? { kind: 'video' as Kind, item: data.featuredVideo, label: 'Video de la semana' }
    : data.featuredPlace ? { kind: 'place' as Kind, item: data.featuredPlace, label: 'Spot destacado' } : null;
  const empty = !data.featuredPlace && !data.featuredProduct && !data.featuredVideo && !data.popularPlaces.length;
  return (
    <Screen edges={['top']} refresh={{ refreshing: loading, onRefresh: reload }}>
      <Row><View style={{ flex: 1 }}><Title size={28}>{user ? `Hola, ${user.displayName}` : 'SPOTCHECK'}</Title><Muted>Spots, productos y videos del skate, puntuados por la comunidad.</Muted></View>
        {!user ? <Button title="Entrar" small onPress={() => nav.navigate('Login')} /> : null}</Row>
      {offline ? <Banner tone="warning" text="Sin conexión: no pudimos restaurar tu sesión." action={{ label: 'Reintentar', onPress: refreshUser }} /> : null}
      {user && !user.emailVerified ? <Banner text="Verificá tu correo para proponer contenido y reseñar." action={{ label: 'Verificar ahora', onPress: () => nav.navigate('VerifyEmail') }} /> : null}
      {hero ? <HeroCard kind={hero.kind} item={hero.item} label={hero.label} onPress={() => open(hero.kind, hero.item.id)} /> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{QUICK.map((q) => <Chip key={q.label} label={q.label} onPress={() => q.go(nav)} />)}</ScrollView>
      {empty ? <EmptyView title="Todavía no hay contenido" hint="Sé el primero en proponer un spot." action={{ label: 'Proponer un spot', onPress: () => (user ? nav.navigate('Form', { kind: 'place' }) : nav.navigate('Login')) }} /> : null}
      {places.length ? (<>
        <SectionTitle title="Spots destacados" action={{ label: 'Ver todos', onPress: () => (nav as any).navigate('Main', { screen: 'Places' }) }} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 8 }}>{places.map((p) => <View key={p.id} style={{ width: 270 }}><ContentCard kind="place" item={p} badge={p.id === data.featuredPlace?.id ? 'Destacado' : undefined} onPress={() => open('place', p.id)} /></View>)}</ScrollView>
      </>) : null}
      {products.length ? (<>
        <SectionTitle title="Productos destacados" action={{ label: 'Ver todos', onPress: () => (nav as any).navigate('Main', { screen: 'Products' }) }} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 8 }}>{products.map((p) => <View key={p.id} style={{ width: 270 }}><ContentCard kind="product" item={p} badge={p.id === data.featuredProduct?.id ? 'Destacado' : undefined} onPress={() => open('product', p.id)} /></View>)}</ScrollView>
      </>) : null}
      {data.recentReviews.length ? (<>
        <SectionTitle title="Reseñas recientes" />
        {data.recentReviews.slice(0, 5).map((r, i) => (
          <Card key={i} onPress={() => open(r.target.kind, r.target.id)}>
            <View style={{ padding: 12, gap: 4 }}><Row><Stars value={r.rating} /><Muted>{r.author} · {fmtDate(r.createdAt)}</Muted></Row><Title size={15}>{r.target.name}</Title><Body>{r.comment}</Body></View>
          </Card>))}
      </>) : null}
    </Screen>
  );
}
