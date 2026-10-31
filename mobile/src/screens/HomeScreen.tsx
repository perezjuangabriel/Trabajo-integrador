import React from 'react';
import { ScrollView, View } from 'react-native';
import { ContentCard } from '../components/cards';
import { Banner, Body, Button, Card, EmptyView, ErrorView, Loading, Muted, Row, Screen, SectionTitle, Stars, Title, fmtDate } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { catalogApi } from '../api/services';
import { useAsync } from '../hooks';
import { useNav } from '../navigation/types';
import type { Kind } from '../types';

const QUICK: { label: string; emoji: string; go: (n: ReturnType<typeof useNav>) => void }[] = [
  { label: 'Spots', emoji: '📍', go: (n) => (n as any).navigate('Main', { screen: 'Places' }) },
  { label: 'Productos', emoji: '🛹', go: (n) => (n as any).navigate('Main', { screen: 'Products' }) },
  { label: 'Videos', emoji: '🎬', go: (n) => (n as any).navigate('Main', { screen: 'Videos' }) },
  { label: 'Favoritos', emoji: '❤️', go: (n) => n.navigate('Favorites') },
];

export function HomeScreen() {
  const nav = useNav(); const { user, offline, refreshUser } = useAuth();
  const { data, error, loading, reload } = useAsync(() => catalogApi.home(), []);
  const open = (kind: Kind, id: number) => nav.navigate('Detail', { kind, id });
  if (loading && !data) return <Screen><Loading label="Cargando la home…" /></Screen>;
  if (error && !data) return <Screen><ErrorView error={error} onRetry={reload} /></Screen>;
  if (!data) return null;
  const empty = !data.featuredPlace && !data.featuredProduct && !data.featuredVideo && !data.popularPlaces.length;
  return (
    <Screen edges={['top']} refresh={{ refreshing: loading, onRefresh: reload }}>
      <Row><View style={{ flex: 1 }}><Title size={26}>{user ? `Hola, ${user.displayName}` : 'SPOTCHECK'}</Title><Muted>Descubrí, puntuá y reseñá el skate de tu ciudad.</Muted></View>
        {!user ? <Button title="Entrar" small onPress={() => nav.navigate('Login')} /> : null}</Row>
      {offline ? <Banner tone="warning" text="Sin conexión: no pudimos restaurar tu sesión." action={{ label: 'Reintentar', onPress: refreshUser }} /> : null}
      {user && !user.emailVerified ? <Banner text="Verificá tu correo para proponer contenido y reseñar." action={{ label: 'Verificar ahora', onPress: () => nav.navigate('VerifyEmail') }} /> : null}
      <Row gap={10} wrap>{QUICK.map((q) => (
        <Card key={q.label} onPress={() => q.go(nav)} style={{ width: '47%' }}>
          <View style={{ padding: 14, alignItems: 'center', gap: 4 }}><Title size={26}>{q.emoji}</Title><Body>{q.label}</Body></View>
        </Card>))}</Row>
      {empty ? <EmptyView title="Todavía no hay contenido" hint="Sé el primero en proponer un spot." action={{ label: 'Proponer un spot', onPress: () => (user ? nav.navigate('Form', { kind: 'place' }) : nav.navigate('Login')) }} /> : null}
      {data.featuredVideo ? (<><SectionTitle title="🎬 Video de la semana" /><ContentCard kind="video" item={data.featuredVideo} wide onPress={() => open('video', data.featuredVideo!.id)} /></>) : null}
      {data.featuredPlace ? (<><SectionTitle title="📍 Spot destacado" /><ContentCard kind="place" item={data.featuredPlace} wide onPress={() => open('place', data.featuredPlace!.id)} /></>) : null}
      {data.featuredProduct ? (<><SectionTitle title="🛹 Producto destacado" /><ContentCard kind="product" item={data.featuredProduct} wide onPress={() => open('product', data.featuredProduct!.id)} /></>) : null}
      {data.recentReviews.length ? (<>
        <SectionTitle title="Reseñas recientes" />
        {data.recentReviews.slice(0, 5).map((r, i) => (
          <Card key={i} onPress={() => open(r.target.kind, r.target.id)}>
            <View style={{ padding: 12, gap: 4 }}><Row><Stars value={r.rating} /><Muted>{r.author} · {fmtDate(r.createdAt)}</Muted></Row><Title size={15}>{r.target.name}</Title><Body>{r.comment}</Body></View>
          </Card>))}
      </>) : null}
      {data.popularPlaces.length ? (<>
        <SectionTitle title="Spots populares" action={{ label: 'Ver todos', onPress: () => (nav as any).navigate('Main', { screen: 'Places' }) }} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>{data.popularPlaces.map((p) => <View key={p.id} style={{ width: 240 }}><ContentCard kind="place" item={p} onPress={() => open('place', p.id)} /></View>)}</ScrollView>
      </>) : null}
      {data.popularProducts.length ? (<>
        <SectionTitle title="Productos populares" action={{ label: 'Ver todos', onPress: () => (nav as any).navigate('Main', { screen: 'Products' }) }} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>{data.popularProducts.map((p) => <View key={p.id} style={{ width: 240 }}><ContentCard kind="product" item={p} onPress={() => open('product', p.id)} /></View>)}</ScrollView>
      </>) : null}
    </Screen>
  );
}
