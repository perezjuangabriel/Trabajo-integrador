import React, { useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { Avatar, Body, Button, Card, Chip, ErrorView, Loading, Muted, Pill, Row, STATUS_PILL, SectionTitle, Stars, Title, confirm, fmtDate, showError, usePrompt } from './ui';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { reviewsApi, staffApi } from '../api/services';
import { usePaginated, useAsync } from '../hooks';
import { useNav } from '../navigation/types';
import type { Kind, Review } from '../types';

const SORT = [{ k: 'newest', l: 'Recientes' }, { k: 'rating_desc', l: 'Mejores' }, { k: 'rating_asc', l: 'Peores' }];

export function ReviewsSection({ kind, id, canReview, reloadKey, onChanged }: { kind: Kind; id: number; canReview: boolean; reloadKey?: number; onChanged?: () => void }) {
  const nav = useNav(); const { user, isStaff } = useAuth(); const { colors: c } = useTheme();
  const [sort, setSort] = useState('newest'); const [rating, setRating] = useState<number | null>(null);
  const prompt = usePrompt();
  const summary = useAsync(() => reviewsApi.list(kind, id, { page: 1, pageSize: 1 }), [kind, id, reloadKey]);
  const list = usePaginated<Review>((page) => reviewsApi.list(kind, id, { page, pageSize: 10, sort, rating: rating ?? undefined }), [kind, id, sort, rating, reloadKey]);
  const mine = summary.data?.myReview ?? null;
  const dist = summary.data?.summary.distribution ?? {};
  const total = summary.data?.summary.reviewCount ?? 0;

  const write = () => (user ? nav.navigate('ReviewForm', { kind, id, review: mine ?? undefined }) : nav.navigate('Login'));
  const remove = (r: Review) => confirm('Eliminar reseña', 'Se quitará tu reseña y su puntuación.', async () => { try { await reviewsApi.remove(r); onChanged?.(); } catch (e) { showError(e); } }, 'Eliminar');
  const hide = async (r: Review) => { const note = await prompt.ask('Motivo para ocultar', 'Ej.: lenguaje ofensivo'); if (!note) return; try { await staffApi.act(r.type, r.id, 'hide', note); onChanged?.(); } catch (e) { showError(e); } };

  return (
    <View style={{ gap: 10 }}>
      {prompt.element}
      <SectionTitle title="Reseñas" />
      {summary.data ? (
        <Card><View style={{ padding: 14, flexDirection: 'row', gap: 16, alignItems: 'center' }}>
          <View style={{ alignItems: 'center' }}><Title size={34}>{total ? summary.data.summary.avgRating.toFixed(1) : '—'}</Title><Stars value={summary.data.summary.avgRating} /><Muted>{total} {total === 1 ? 'reseña' : 'reseñas'}</Muted></View>
          <View style={{ flex: 1, gap: 3 }}>{[5, 4, 3, 2, 1].map((n) => (
            <Row key={n} gap={6}><Muted>{n}★</Muted><View style={{ flex: 1, height: 6, backgroundColor: c.surfaceAlt, borderRadius: 3 }}><View style={{ width: `${total ? ((dist[String(n)] ?? 0) / total) * 100 : 0}%`, height: 6, backgroundColor: c.star, borderRadius: 3 }} /></View><Muted>{dist[String(n)] ?? 0}</Muted></Row>))}</View>
        </View></Card>) : null}
      {canReview ? <Button title={mine ? 'Editar mi reseña' : 'Escribir una reseña'} onPress={write} variant={mine ? 'secondary' : 'primary'} /> : null}
      {mine && mine.status !== 'visible' ? <Muted>Tu reseña está {mine.status === 'pending' ? 'pendiente de revisión' : 'oculta por moderación'} y no cuenta en la puntuación.</Muted> : null}
      <Row wrap>{SORT.map((o) => <Chip key={o.k} label={o.l} active={sort === o.k} onPress={() => setSort(o.k)} />)}
        {[5, 4, 3, 2, 1].map((n) => <Chip key={n} label={`${n}★`} active={rating === n} onPress={() => setRating(rating === n ? null : n)} />)}</Row>
      {list.loading && !list.items.length ? <Loading /> : list.error && !list.items.length ? <ErrorView error={list.error} onRetry={list.reload} />
        : !list.items.length ? <Muted>Todavía no hay reseñas{rating ? ' con esa puntuación' : ''}. {canReview ? '¡Escribí la primera!' : ''}</Muted>
        : list.items.map((r) => (
          <Card key={r.id}><View style={{ padding: 12, gap: 6 }}>
            <Row><Avatar name={r.author.displayName} uri={r.author.avatarUrl} size={34} /><View style={{ flex: 1 }}><Title size={15}>{r.author.displayName}{r.isMine ? ' (vos)' : ''}</Title><Muted>{fmtDate(r.createdAt)}</Muted></View><Stars value={r.rating} /></Row>
            <Body>{r.comment}</Body>
            {r.images.length ? <Row wrap>{r.images.map((im) => <Image key={im.id} source={{ uri: im.url }} style={{ width: 84, height: 84, borderRadius: 8 }} contentFit="cover" />)}</Row> : null}
            {r.status !== 'visible' && STATUS_PILL[r.status] ? <Pill {...STATUS_PILL[r.status]} /> : null}
            <Row gap={14}>
              {r.isMine ? (<><Muted>{'  '}</Muted><Button small variant="ghost" title="Editar" onPress={write} /><Button small variant="ghost" title="Eliminar" onPress={() => remove(r)} /></>)
                : (<>{user ? <Button small variant="ghost" title="Reportar" onPress={() => nav.navigate('Report', { targetType: r.type, targetId: r.id, label: `Reseña de ${r.author.displayName}` })} /> : null}
                  {isStaff && r.status === 'visible' ? <Button small variant="ghost" title="Ocultar" onPress={() => hide(r)} /> : null}</>)}
            </Row>
          </View></Card>))}
      {list.hasMore ? <Button title="Ver más reseñas" variant="secondary" onPress={list.loadMore} loading={list.loadingMore} /> : null}
    </View>
  );
}
