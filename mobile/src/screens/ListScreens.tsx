import React, { useState } from 'react';
import { FlatList, View } from 'react-native';
import { ContentCard } from '../components/cards';
import { Card, Chip, EmptyView, ErrorView, Loading, Muted, Pill, Row, STATUS_PILL, Screen, Stars, Title, Body, fmtDate } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { meApi, socialApi } from '../api/services';
import { usePaginated } from '../hooks';
import { useNav } from '../navigation/types';
import type { Kind, Review } from '../types';

const KINDS: { k: Kind; l: string }[] = [{ k: 'place', l: 'Spots' }, { k: 'product', l: 'Productos' }, { k: 'video', l: 'Videos' }];
function KindTabs({ kind, onChange }: { kind: Kind; onChange: (k: Kind) => void }) { return <Row>{KINDS.map((x) => <Chip key={x.k} label={x.l} active={kind === x.k} onPress={() => onChange(x.k)} />)}</Row>; }
const NeedLogin = () => { const nav = useNav(); return <EmptyView title="Iniciá sesión" hint="Necesitás una cuenta para ver esto." action={{ label: 'Iniciar sesión', onPress: () => nav.navigate('Login') }} />; };

function Paged<T>({ list, render, empty }: { list: ReturnType<typeof usePaginated<T>>; render: (i: T) => React.ReactElement; empty: React.ReactElement }) {
  if (list.loading && !list.items.length) return <Loading />;
  if (list.error && !list.items.length) return <ErrorView error={list.error} onRetry={list.reload} />;
  return <FlatList data={list.items} keyExtractor={(_, i) => String(i)} renderItem={({ item }) => render(item)} contentContainerStyle={{ gap: 12, paddingVertical: 12 }} onEndReached={list.loadMore} onEndReachedThreshold={0.5}
    refreshing={list.loading} onRefresh={list.reload} ListEmptyComponent={empty} ListFooterComponent={list.loadingMore ? <Loading /> : undefined} />;
}

export function FavoritesScreen() {
  const nav = useNav(); const { user } = useAuth(); const [kind, setKind] = useState<Kind>('place');
  const list = usePaginated((p) => socialApi.favList(kind, p), [kind, user?.id]);
  if (!user) return <Screen><NeedLogin /></Screen>;
  return <Screen scroll={false}><KindTabs kind={kind} onChange={setKind} />
    <Paged list={list} render={(i) => <ContentCard kind={kind} item={i} onPress={() => nav.navigate('Detail', { kind, id: i.id })} />} empty={<EmptyView title="Todavía no guardaste favoritos" hint="Tocá 🤍 en cualquier spot, producto o video." />} /></Screen>;
}

export function SubmissionsScreen() {
  const nav = useNav(); const { user } = useAuth(); const [kind, setKind] = useState<Kind>('place');
  const list = usePaginated((p) => meApi.submissions(kind, p), [kind, user?.id]);
  if (!user) return <Screen><NeedLogin /></Screen>;
  return <Screen scroll={false}><KindTabs kind={kind} onChange={setKind} />
    <Paged list={list} render={(i) => <ContentCard kind={kind} item={i} showStatus onPress={() => nav.navigate('Detail', { kind, id: i.id })} />} empty={<EmptyView title="No enviaste propuestas" hint="Proponé un spot, producto o video desde su sección." />} /></Screen>;
}

export function MyReviewsScreen() {
  const nav = useNav(); const { user } = useAuth(); const [kind, setKind] = useState<Kind>('place');
  const list = usePaginated<Review>((p) => meApi.reviews(kind, p), [kind, user?.id]);
  if (!user) return <Screen><NeedLogin /></Screen>;
  return <Screen scroll={false}><KindTabs kind={kind} onChange={setKind} />
    <Paged list={list} empty={<EmptyView title="Todavía no escribiste reseñas" />} render={(r) => (
      <Card onPress={() => nav.navigate('Detail', { kind: r.target.kind, id: r.target.id })}><View style={{ padding: 12, gap: 4 }}>
        <Title size={16}>{r.target.name ?? 'Contenido'}</Title><Row><Stars value={r.rating} /><Muted>{fmtDate(r.createdAt)}</Muted></Row><Body>{r.comment}</Body>
        {r.status !== 'visible' && STATUS_PILL[r.status] ? <Pill {...STATUS_PILL[r.status]} /> : null}</View></Card>)} /></Screen>;
}

const ICON = { review: '⭐', favorite: '❤️', submission: '📤' } as const;
const VERB = { review: 'Reseñaste', favorite: 'Guardaste', submission: 'Propusiste' } as const;
export function ActivityScreen() {
  const nav = useNav(); const { user } = useAuth();
  const list = usePaginated((p) => meApi.activity(p), [user?.id]);
  if (!user) return <Screen><NeedLogin /></Screen>;
  return <Screen scroll={false}><Paged list={list} empty={<EmptyView title="Sin actividad todavía" hint="Tus reseñas, favoritos y propuestas aparecen acá." />} render={(a) => (
    <Card onPress={() => nav.navigate('Detail', { kind: a.target.kind, id: a.target.id })}><View style={{ padding: 12, gap: 2 }}>
      <Body>{ICON[a.type]} {VERB[a.type]} «{a.target.name}»{a.rating ? ` · ${a.rating}★` : ''}</Body><Muted>{fmtDate(a.at)}{a.status ? ` · ${STATUS_PILL[a.status]?.text ?? a.status}` : ''}</Muted></View></Card>)} /></Screen>;
}
