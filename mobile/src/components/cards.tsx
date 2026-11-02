import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Card, Muted, Pill, RatingLine, Row, STATUS_PILL, Title, fmtMoney, useStyles } from './ui';
import { useTheme } from '../theme/ThemeContext';
import { radius } from '../theme/colors';
import type { AnyCard, Kind, PlaceCard, ProductCard, VideoCard } from '../types';

const isVideo = (c: AnyCard): c is VideoCard => 'title' in c;
export const cardTitle = (c: AnyCard) => (isVideo(c) ? c.title : c.name);
const KIND_LABEL: Record<Kind, string> = { place: 'Spot', product: 'Producto', video: 'Video' };

// Defensivo: al cambiar de pestaña (Mis propuestas, Favoritos…) la lista conserva un instante los elementos del tipo anterior.
function subtitle(kind: Kind, item: AnyCard) {
  if (kind === 'place') { const p = item as PlaceCard; return `${p.city?.name ?? ''}${p.zone ? ` · ${p.zone}` : ''}`; }
  if (kind === 'product') return (item as ProductCard).brand?.name ?? '';
  const v = item as VideoCard; return v.provider === 'other' ? 'Enlace externo' : v.provider ?? '';
}
const imageOf = (item: AnyCard) => (isVideo(item) ? item.thumbnailUrl : (item as PlaceCard | ProductCard).coverUrl);

/** Etiqueta flotante sobre la foto. */
function Badge({ text, solid }: { text: string; solid?: boolean }) {
  const { colors: c } = useTheme();
  return <Text style={{ backgroundColor: solid ? c.primary : 'rgba(0,0,0,0.6)', color: solid ? c.onPrimary : '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.6, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill, overflow: 'hidden', textTransform: 'uppercase' }}>{text}</Text>;
}
function PlayButton({ size = 56 }: { size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center', paddingLeft: size * 0.08 }}><View style={{ width: 0, height: 0, borderTopWidth: size * 0.19, borderBottomWidth: size * 0.19, borderLeftWidth: size * 0.3, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: '#111111' }} /></View>;
}

/** Tarjeta única para spots, productos y videos: foto protagonista, etiquetas flotantes, título y puntuación. */
export function ContentCard({ kind, item, onPress, showStatus, wide, badge }: { kind: Kind; item: AnyCard; onPress: () => void; showStatus?: boolean; wide?: boolean; badge?: string }) {
  const s = useStyles((p) => ({ img: { width: '100%', aspectRatio: wide ? 16 / 9 : 16 / 10, backgroundColor: p.surfaceAlt }, body: { padding: 14, gap: 5 } }));
  const uri = imageOf(item);
  const price = kind === 'product' ? fmtMoney((item as ProductCard).price) : null;
  return (
    <Card onPress={onPress}>
      <View>
        {uri ? <Image source={{ uri }} style={s.img} contentFit="cover" transition={200} accessibilityLabel={cardTitle(item)} />
          : <View style={[s.img, { alignItems: 'center', justifyContent: 'center' }]}><Title size={16}>{KIND_LABEL[kind]}</Title></View>}
        <View style={{ position: 'absolute', left: 10, top: 10, flexDirection: 'row', gap: 6 }}>
          <Badge text={item.category?.name ?? KIND_LABEL[kind]} />{badge ? <Badge text={badge} solid /> : null}
        </View>
        {kind === 'video' ? <View style={{ position: 'absolute', right: 12, bottom: 12 }}><PlayButton size={44} /></View> : null}
      </View>
      <View style={s.body}>
        <Title size={17}>{cardTitle(item)}</Title>
        <Muted>{subtitle(kind, item)}</Muted>
        <Row gap={10} wrap><RatingLine avg={item.avgRating} count={item.reviewCount} />{price ? <Title size={15}>{price}</Title> : null}</Row>
        {showStatus && STATUS_PILL[item.status] ? <Pill {...STATUS_PILL[item.status]} /> : null}
        {showStatus && item.rejectionReason ? <Muted>Motivo: {item.rejectionReason}</Muted> : null}
      </View>
    </Card>
  );
}

/** Portada grande del Home: foto a todo el ancho con el título encima. Para el video se muestra el botón de reproducir. */
export function HeroCard({ kind, item, label, onPress }: { kind: Kind; item: AnyCard; label: string; onPress: () => void }) {
  const { colors: c } = useTheme();
  const uri = imageOf(item);
  const count = item.reviewCount;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${cardTitle(item)}`} onPress={onPress}
      style={({ pressed }) => [{ width: '100%', aspectRatio: 16 / 10, minHeight: 240, maxHeight: 440, borderRadius: radius.lg + 4, overflow: 'hidden', backgroundColor: c.surfaceAlt, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 6 }, pressed && { transform: [{ scale: 0.98 }] }]}>
      {uri ? <Image source={{ uri }} style={{ position: 'absolute', width: '100%', height: '100%' }} contentFit="cover" transition={250} /> : null}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '75%', backgroundColor: 'rgba(0,0,0,0.28)' }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%', backgroundColor: 'rgba(0,0,0,0.5)' }} />
      <View style={{ position: 'absolute', left: 14, top: 14, flexDirection: 'row', gap: 6 }}><Badge text={label} solid /><Badge text={item.category?.name ?? KIND_LABEL[kind]} /></View>
      {kind === 'video' ? <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}><PlayButton size={68} /></View> : null}
      <View style={{ position: 'absolute', left: 16, right: 16, bottom: 16, gap: 4 }}>
        <Text numberOfLines={2} style={{ color: '#FFFFFF', fontSize: 26, fontWeight: '900', letterSpacing: -0.5 }}>{cardTitle(item)}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>{subtitle(kind, item)}{count ? `  ·  ${item.avgRating.toFixed(1)} de 5 (${count})` : ''}</Text>
      </View>
    </Pressable>
  );
}
