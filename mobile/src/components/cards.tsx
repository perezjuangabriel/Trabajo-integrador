import React from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { Card, Muted, Pill, RatingLine, Row, STATUS_PILL, Title, fmtMoney, useStyles } from './ui';
import { useTheme } from '../theme/ThemeContext';
import type { AnyCard, Kind, PlaceCard, ProductCard, VideoCard } from '../types';

const isVideo = (c: AnyCard): c is VideoCard => 'title' in c;
export const cardTitle = (c: AnyCard) => (isVideo(c) ? c.title : c.name);

/** Tarjeta única para spots, productos y videos: imagen, título, datos clave y puntuación. */
export function ContentCard({ kind, item, onPress, showStatus, wide }: { kind: Kind; item: AnyCard; onPress: () => void; showStatus?: boolean; wide?: boolean }) {
  const { colors: c } = useTheme();
  const s = useStyles((p) => ({ img: { width: '100%', height: wide ? 160 : 120, backgroundColor: p.surfaceAlt }, body: { padding: 12, gap: 4 } }));
  const uri = isVideo(item) ? item.thumbnailUrl : (item as PlaceCard | ProductCard).coverUrl;
  const sub = kind === 'place' ? `${(item as PlaceCard).category.name} · ${(item as PlaceCard).city.name}${(item as PlaceCard).zone ? ` · ${(item as PlaceCard).zone}` : ''}`
    : kind === 'product' ? `${(item as ProductCard).brand.name} · ${(item as ProductCard).category.name}` : `${(item as VideoCard).category.name} · ${(item as VideoCard).provider === 'other' ? 'Enlace externo' : (item as VideoCard).provider}`;
  const price = kind === 'product' ? fmtMoney((item as ProductCard).price) : null;
  return (
    <Card onPress={onPress}>
      {uri ? <Image source={{ uri }} style={s.img} contentFit="cover" transition={150} accessibilityLabel={cardTitle(item)} />
        : <View style={[s.img, { alignItems: 'center', justifyContent: 'center' }]}><Title size={16}>{kind === 'place' ? 'Spot' : kind === 'product' ? 'Producto' : 'Video'}</Title></View>}
      <View style={s.body}>
        <Title size={16}>{cardTitle(item)}</Title>
        <Muted>{sub}</Muted>
        <Row gap={10} wrap><RatingLine avg={item.avgRating} count={item.reviewCount} />{price ? <Title size={14}>{price}</Title> : null}</Row>
        {showStatus && STATUS_PILL[item.status] ? <Pill {...STATUS_PILL[item.status]} /> : null}
        {showStatus && item.rejectionReason ? <Muted>Motivo: {item.rejectionReason}</Muted> : null}
      </View>
    </Card>
  );
}
