import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, View, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { Image } from 'expo-image';
import { RouteProp, useRoute } from '@react-navigation/native';
import { Banner, Body, MAX_WIDTH, Button, Chip, ErrorView, Loading, Muted, Pill, RatingLine, Row, STATUS_PILL, Screen, SectionTitle, Title, confirm, fmtMoney, showError, usePrompt } from '../components/ui';
import { ReviewsSection } from '../components/ReviewsSection';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { catalogApi, socialApi, staffApi } from '../api/services';
import { useAsync } from '../hooks';
import { RootStackParamList, useNav } from '../navigation/types';
import type { Kind, PlaceDetail, ProductDetail, VideoDetail } from '../types';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
type AnyDetail = PlaceDetail | ProductDetail | VideoDetail;

export function DetailScreen() {
  const { params } = useRoute<RouteProp<RootStackParamList, 'Detail'>>();
  const { kind, id } = params as { kind: Kind; id: number };
  const nav = useNav(); const { user, isStaff } = useAuth(); const { colors: c } = useTheme(); const width = Math.min(useWindowDimensions().width, MAX_WIDTH);
  const prompt = usePrompt();
  const [rk, setRk] = useState(0);
  const detail = useAsync(() => catalogApi.get(kind, id), [kind, id, rk]);
  const [fav, setFav] = useState(false);
  useEffect(() => { if (user) socialApi.favIds().then((f) => setFav(f[kind].includes(id))).catch(() => {}); else setFav(false); }, [user?.id, kind, id]);

  const d = detail.data as AnyDetail | null;
  const title = d ? ('title' in d ? d.title : d.name) : '';
  useEffect(() => { if (d) nav.setOptions({ title }); }, [d, title]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleFav = async () => {
    if (!user) return nav.navigate('Login');
    const next = !fav; setFav(next); // optimista: se revierte si falla
    try { next ? await socialApi.favAdd(kind, id) : await socialApi.favRemove(kind, id); } catch (e) { setFav(!next); showError(e); }
  };
  const remove = () => confirm('Eliminar', 'Se dará de baja este contenido. Esta acción la puede revertir un administrador.', async () => { try { await catalogApi.remove(kind, id); nav.goBack(); } catch (e) { showError(e); } }, 'Eliminar');
  const moderate = async (action: 'approve' | 'reject' | 'hide' | 'restore') => {
    let note: string | undefined;
    if (action === 'reject' || action === 'hide') { const n = await prompt.ask(action === 'reject' ? 'Motivo del rechazo' : 'Motivo para ocultar', 'Se le muestra al autor'); if (!n) return; note = n; }
    try { await staffApi.act(kind, id, action, note); setRk((x) => x + 1); } catch (e) { showError(e); }
  };

  if (detail.loading && !d) return <Screen><Loading /></Screen>;
  if (detail.error && !d) return <Screen><ErrorView error={detail.error} onRetry={detail.reload} /></Screen>;
  if (!d) return null;
  const published = d.status === 'published';

  return (
    <Screen padded={false}>
      {prompt.element}
      {kind === 'video' ? <VideoPlayer video={d as VideoDetail} width={width} /> : <Gallery images={(d as PlaceDetail | ProductDetail).images} width={width} />}
      <View style={{ padding: 16, gap: 12 }}>
        <Title size={24}>{title}</Title>
        <RatingLine avg={d.avgRating} count={d.reviewCount} />
        {!published && STATUS_PILL[d.status] ? <Row><Pill {...STATUS_PILL[d.status]} /><Muted>{d.status === 'pending' ? 'Visible solo para vos y el equipo de moderación' : ''}</Muted></Row> : null}
        {d.rejectionReason ? <Banner tone="danger" text={`Motivo del rechazo: ${d.rejectionReason}`} /> : null}
        <Row wrap>
          <Chip label={fav ? 'En favoritos' : 'Favorito'} active={fav} onPress={toggleFav} />
          {d.permissions.canEdit ? <Chip label="Editar" onPress={() => nav.navigate('Form', { kind, id })} /> : null}
          {user && published ? <Chip label="Reportar" onPress={() => nav.navigate('Report', { targetType: kind, targetId: id, label: title })} /> : null}
          {d.permissions.canDelete ? <Chip label="Eliminar" onPress={remove} /> : null}
        </Row>
        {isStaff ? (
          <Row wrap>
            {(d.status === 'pending' || d.status === 'rejected') ? <Button small title="Aprobar" onPress={() => moderate('approve')} /> : null}
            {d.status === 'pending' ? <Button small variant="danger" title="Rechazar" onPress={() => moderate('reject')} /> : null}
            {published ? <Button small variant="secondary" title="Ocultar" onPress={() => moderate('hide')} /> : null}
            {d.status === 'hidden' ? <Button small title="Restaurar" onPress={() => moderate('restore')} /> : null}
          </Row>) : null}
        {kind === 'place' ? <PlaceInfo p={d as PlaceDetail} /> : kind === 'product' ? <ProductInfo p={d as ProductDetail} /> : <VideoInfo v={d as VideoDetail} />}
        {d.submittedBy ? <Muted>Propuesto por {d.submittedBy.displayName}</Muted> : null}
        {published ? <ReviewsSection kind={kind} id={id} canReview reloadKey={rk} onChanged={() => setRk((x) => x + 1)} />
          : <Muted>Las reseñas se habilitan cuando el contenido está publicado.</Muted>}
      </View>
      <View style={{ height: 1, backgroundColor: c.bg }} />
    </Screen>
  );
}

function Gallery({ images, width }: { images: { id: number; url: string }[]; width: number }) {
  const { colors: c } = useTheme();
  if (!images.length) return <View style={{ height: 160, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}><Muted>Sin fotos todavía</Muted></View>;
  return <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>{images.map((im) => <Image key={im.id} source={{ uri: im.url }} style={{ width, aspectRatio: 16 / 10, maxHeight: 420, backgroundColor: c.surfaceAlt }} contentFit="cover" />)}</ScrollView>;
}

/** Reproduce dentro de la app solo si el proveedor lo permite (embedUrl); siempre ofrece abrir el enlace original. */
function VideoPlayer({ video, width }: { video: VideoDetail; width: number }) {
  const { colors: c } = useTheme();
  const [failed, setFailed] = useState(false);
  const h = Math.round((width * 9) / 16);
  return (
    <View>
      {video.embedUrl && !failed && Platform.OS !== 'web' ? ( // WebView no existe en web: ahí se muestra la miniatura y el enlace
        <View style={{ width, height: h, backgroundColor: '#000' }}>
          <WebView source={{ uri: video.embedUrl }} allowsFullscreenVideo javaScriptEnabled originWhitelist={['https://*']} mediaPlaybackRequiresUserAction
            onShouldStartLoadWithRequest={(r) => r.url.startsWith(video.embedUrl!.split('?')[0]) || r.url === 'about:blank'} // evita navegar fuera del reproductor
            onError={() => setFailed(true)} onHttpError={() => setFailed(true)} />
        </View>
      ) : video.thumbnailUrl ? <Image source={{ uri: video.thumbnailUrl }} style={{ width, height: h, backgroundColor: c.surfaceAlt }} contentFit="cover" />
        : <View style={{ width, height: h, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}><Muted>Video</Muted></View>}
      <View style={{ padding: 16, paddingBottom: 0, gap: 6 }}>
        {failed ? <Muted>Este video no permite reproducirse dentro de la app.</Muted> : !video.embedUrl ? <Muted>Este sitio no permite reproducción integrada: se abre en el navegador.</Muted> : null}
        <Button title={video.provider === 'youtube' ? 'Abrir en YouTube' : 'Abrir video original'} variant="secondary" small onPress={() => Linking.openURL(video.url).catch(() => showError(new Error('No se pudo abrir el enlace')))} />
      </View>
    </View>
  );
}

const Tags = ({ items }: { items: { id: number; name: string }[] }) => <Row wrap>{items.map((i) => <Chip key={i.id} label={i.name} />)}</Row>;
function PlaceInfo({ p }: { p: PlaceDetail }) {
  const geo = p.latitude != null && p.longitude != null ? `https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}` : null;
  return (<>
    <Row wrap><Chip label={p.category.name} active />{p.extraCategories.map((x) => <Chip key={x.id} label={x.name} />)}</Row>
    {p.description ? <Body>{p.description}</Body> : null}
    <Muted>{[p.address, p.zone, p.city.name].filter(Boolean).join(' · ')}</Muted>
    {geo ? <Button small variant="secondary" title="Ver en el mapa" onPress={() => Linking.openURL(geo)} /> : null}
    {p.surfaceType ? <Muted>Superficie: {p.surfaceType.name}</Muted> : null}
    {p.obstacles.length ? (<><SectionTitle title="Obstáculos" /><Tags items={p.obstacles} /></>) : null}
    {p.amenities.length ? (<><SectionTitle title="Servicios" /><Tags items={p.amenities} /></>) : null}
    {p.hours.length ? (<><SectionTitle title="Horarios" />{p.hours.map((h) => <Muted key={h.weekday} size={14}>{DAYS[h.weekday]}: {h.opensAt} – {h.closesAt}</Muted>)}</>) : null}
  </>);
}
function ProductInfo({ p }: { p: ProductDetail }) {
  return (<>
    <Row wrap><Chip label={p.brand.name} active /><Chip label={p.category.name} />{p.price ? <Title size={18}>{fmtMoney(p.price)}</Title> : null}</Row>
    {p.price ? <Muted>Precio orientativo</Muted> : null}
    {p.description ? <Body>{p.description}</Body> : null}
    {p.specs.length ? (<><SectionTitle title="Especificaciones" />{p.specs.map((s) => <Row key={s.key}><Muted size={14}>{s.key}:</Muted><Body>{s.value}</Body></Row>)}</>) : null}
  </>);
}
function VideoInfo({ v }: { v: VideoDetail }) {
  return (<><Row wrap><Chip label={v.category.name} active /><Chip label={v.provider === 'other' ? 'Enlace externo' : v.provider} /></Row>{v.description ? <Body>{v.description}</Body> : null}</>);
}
