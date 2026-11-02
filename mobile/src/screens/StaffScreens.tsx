import React, { useState } from 'react';
import { FlatList, View } from 'react-native';
import { ContentCard } from '../components/cards';
import { Banner, Body, Button, Card, Chip, EmptyView, ErrorView, Loading, Muted, Pill, Row, Screen, Stars, Title, showError, usePrompt, fmtDate } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { staffApi } from '../api/services';
import { usePaginated } from '../hooks';
import { useNav } from '../navigation/types';
import type { Kind } from '../types';

type Tab = 'proposals' | 'reviews' | 'reports' | 'logs';
const TABS: { k: Tab; l: string }[] = [{ k: 'proposals', l: 'Propuestas' }, { k: 'reviews', l: 'Reseñas' }, { k: 'reports', l: 'Reportes' }, { k: 'logs', l: 'Historial' }];

function Paged<T>({ list, render, empty }: { list: ReturnType<typeof usePaginated<T>>; render: (i: T) => React.ReactElement; empty: string }) {
  if (list.loading && !list.items.length) return <Loading />;
  if (list.error && !list.items.length) return <ErrorView error={list.error} onRetry={list.reload} />;
  return <FlatList data={list.items} keyExtractor={(_, i) => String(i)} renderItem={({ item }) => render(item)} contentContainerStyle={{ gap: 12, paddingVertical: 12 }}
    onEndReached={list.loadMore} onEndReachedThreshold={0.5} refreshing={list.loading} onRefresh={list.reload} ListEmptyComponent={<EmptyView title={empty} />} ListFooterComponent={list.loadingMore ? <Loading /> : undefined} />;
}

export function ModerationScreen() {
  const nav = useNav(); const { isStaff } = useAuth(); const prompt = usePrompt();
  const [tab, setTab] = useState<Tab>('proposals'); const [kind, setKind] = useState<Kind>('place'); const [rtype, setRtype] = useState<'review' | 'video_review'>('review');
  const queue = usePaginated((p) => (tab === 'proposals' ? staffApi.queue(kind, p) : Promise.resolve({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 })), [tab, kind]);
  const reviews = usePaginated((p) => (tab === 'reviews' ? staffApi.pendingReviews(rtype, p) : Promise.resolve({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 })), [tab, rtype]);
  const reports = usePaginated((p) => (tab === 'reports' ? staffApi.reports(p) : Promise.resolve({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 })), [tab]);
  const logs = usePaginated((p) => (tab === 'logs' ? staffApi.logs(p) : Promise.resolve({ items: [], page: 1, pageSize: 30, total: 0, totalPages: 1 })), [tab]);
  if (!isStaff) return <Screen><Banner tone="danger" text="Esta sección es solo para moderadores y administradores." /></Screen>;

  const run = async (fn: () => Promise<unknown>, after: () => void) => { try { await fn(); after(); } catch (e) { showError(e); } };
  const reject = async (k: string, id: number, after: () => void) => { const n = await prompt.ask('Motivo del rechazo', 'Se le muestra al autor'); if (n) run(() => staffApi.act(k, id, 'reject', n), after); };

  return (
    <Screen scroll={false}>
      {prompt.element}
      <Row wrap>{TABS.map((t) => <Chip key={t.k} label={t.l} active={tab === t.k} onPress={() => setTab(t.k)} />)}</Row>
      {tab === 'proposals' ? (<>
        <Row>{(['place', 'product', 'video'] as Kind[]).map((k) => <Chip key={k} label={{ place: 'Spots', product: 'Productos', video: 'Videos' }[k]} active={kind === k} onPress={() => setKind(k)} />)}</Row>
        <Paged list={queue} empty="No hay propuestas pendientes " render={(i) => (
          <View style={{ gap: 6 }}><ContentCard kind={kind} item={i} showStatus onPress={() => nav.navigate('Detail', { kind, id: i.id })} />
            <Row><View style={{ flex: 1 }}><Button small title="Aprobar" onPress={() => run(() => staffApi.act(kind, i.id, 'approve'), queue.reload)} /></View><View style={{ flex: 1 }}><Button small variant="danger" title="Rechazar" onPress={() => reject(kind, i.id, queue.reload)} /></View></Row></View>)} />
      </>) : null}
      {tab === 'reviews' ? (<>
        <Row><Chip label="Spots y productos" active={rtype === 'review'} onPress={() => setRtype('review')} /><Chip label="Videos" active={rtype === 'video_review'} onPress={() => setRtype('video_review')} /></Row>
        <Paged list={reviews} empty="No hay reseñas pendientes (se usan si la premoderación está activa)" render={(r) => (
          <Card><View style={{ padding: 12, gap: 6 }}><Title size={15}>{r.target.name}</Title><Row><Stars value={r.rating} /><Muted>{r.author.displayName}</Muted></Row><Body>{r.comment}</Body>
            <Row><Button small title="Aprobar" onPress={() => run(() => staffApi.act(rtype, r.id, 'approve'), reviews.reload)} /><Button small variant="danger" title="Ocultar" onPress={() => run(() => staffApi.act(rtype, r.id, 'hide', 'Rechazada en premoderación'), reviews.reload)} /></Row></View></Card>)} />
      </>) : null}
      {tab === 'reports' ? (
        <Paged list={reports} empty="No hay reportes abiertos " render={(r) => (
          <Card><View style={{ padding: 12, gap: 6 }}><Row><Pill text={r.reason} tone="warning" /><Muted>{r.target.type} #{r.target.id}</Muted></Row>
            <Title size={15}>{r.target.label ?? '(contenido no disponible)'}</Title>{r.details ? <Body>{r.details}</Body> : null}<Muted>Reportó {r.reporter?.displayName ?? '—'} · {fmtDate(r.createdAt)}</Muted>
            <Row wrap><Button small title="Resolver y ocultar" onPress={() => run(() => staffApi.resolve(r.id, true, 'Contenido ocultado'), reports.reload)} />
              <Button small variant="secondary" title="Resolver" onPress={() => run(() => staffApi.resolve(r.id, false), reports.reload)} />
              <Button small variant="ghost" title="Descartar" onPress={() => run(() => staffApi.dismiss(r.id), reports.reload)} /></Row></View></Card>)} />) : null}
      {tab === 'logs' ? <Paged list={logs} empty="Sin acciones registradas" render={(l) => <Card><View style={{ padding: 10 }}><Body>{l.action} · {l.targetType} #{l.targetId}</Body><Muted>{fmtDate(l.createdAt)}{l.note ? ` · ${l.note}` : ''}</Muted></View></Card>} /> : null}
    </Screen>
  );
}
