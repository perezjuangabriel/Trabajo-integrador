import React, { useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { RouteProp, useRoute } from '@react-navigation/native';
import { Banner, Body, Button, Input, Muted, Row, Screen, Select, Stars, Title, showError } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { reviewsApi, socialApi } from '../api/services';
import { RootStackParamList, useNav } from '../navigation/types';
import { AddByUrl } from './FormScreen';
import { pickImages, type LocalImage } from '../lib/images';

export function ReviewFormScreen() {
  const { params } = useRoute<RouteProp<RootStackParamList, 'ReviewForm'>>();
  const { kind, id, review } = params;
  const nav = useNav(); const { user } = useAuth();
  const [rating, setRating] = useState(review?.rating ?? 0); const [comment, setComment] = useState(review?.comment ?? '');
  const [photos, setPhotos] = useState<LocalImage[]>([]); const [busy, setBusy] = useState(false); const [tried, setTried] = useState(false);
  const canPhotos = kind !== 'video';
  const submit = async () => {
    setTried(true);
    if (rating < 1 || comment.trim().length < 3) return;
    if (!user?.emailVerified) return showError(new Error('Verificá tu correo para escribir reseñas.'), 'Correo sin verificar');
    setBusy(true);
    try {
      const saved = review ? (await reviewsApi.update(review, { rating, comment: comment.trim() })).review : (await reviewsApi.create(kind, id, { rating, comment: comment.trim() })).review;
      let failed = 0;
      if (canPhotos) for (const p of photos.slice(0, Math.max(0, 4 - (review?.images.length ?? 0)))) await reviewsApi.uploadImage(saved.id, p).catch(() => { failed++; });
      if (failed) showError(new Error(`No se pudieron subir ${failed} foto(s).`), 'Reseña guardada');
      if (saved.status === 'pending') showError(new Error('Tu reseña será visible cuando el equipo de moderación la apruebe.'), 'Pendiente de revisión');
      nav.goBack();
    } catch (e) { showError(e, 'No pudimos guardar tu reseña'); } finally { setBusy(false); }
  };
  return (
    <Screen>
      <Title size={22}>{review ? 'Editar tu reseña' : 'Tu reseña'}</Title>
      {!user?.emailVerified ? <Banner tone="warning" text="Verificá tu correo para publicar reseñas." action={{ label: 'Verificar', onPress: () => nav.navigate('VerifyEmail') }} /> : null}
      <View style={{ gap: 4 }}><Body>Puntuación</Body><Stars value={rating} size={34} onChange={setRating} />{tried && rating < 1 ? <Muted>Elegí de 1 a 5 estrellas</Muted> : null}</View>
      <Input label="Comentario" value={comment} onChangeText={setComment} multiline maxLength={2000} error={tried && comment.trim().length < 3 ? 'Escribí al menos 3 caracteres' : null} hint={`${comment.length}/2000`} />
      {canPhotos ? (<>
        <Row wrap>{photos.map((p) => <Image key={p.uri} source={{ uri: p.uri }} style={{ width: 72, height: 72, borderRadius: 8 }} />)}</Row>
        <AddByUrl disabled={photos.length >= 4} onAdd={(i) => setPhotos([...photos, i].slice(0, 4))} />
        <Button small variant="secondary" title="Agregar fotos (máx. 4)" onPress={async () => { try { setPhotos([...photos, ...(await pickImages(4))].slice(0, 4)); } catch (e) { showError(e); } }} />
      </>) : null}
      <Button title={review ? 'Guardar cambios' : 'Publicar reseña'} onPress={submit} loading={busy} />
    </Screen>
  );
}

const REASONS = [{ value: 'spam', label: 'Spam o publicidad' }, { value: 'offensive', label: 'Contenido ofensivo' }, { value: 'inaccurate', label: 'Información incorrecta' }, { value: 'duplicate', label: 'Duplicado' }, { value: 'illegal', label: 'Contenido ilegal' }, { value: 'other', label: 'Otro motivo' }];
export function ReportScreen() {
  const { params } = useRoute<RouteProp<RootStackParamList, 'Report'>>();
  const nav = useNav();
  const [reason, setReason] = useState<string | null>(null); const [details, setDetails] = useState(''); const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!reason) return showError(new Error('Elegí un motivo'), 'Falta el motivo');
    setBusy(true);
    try { await socialApi.report({ targetType: params.targetType, targetId: params.targetId, reason, details: details.trim() || undefined }); showError(new Error('El equipo de moderación lo va a revisar.'), 'Gracias por avisar'); nav.goBack(); }
    catch (e) { showError(e, 'No pudimos enviar el reporte'); } finally { setBusy(false); }
  };
  return (
    <Screen>
      <Title size={22}>Reportar contenido</Title><Muted>{params.label}</Muted>
      <Select label="Motivo" value={reason} options={REASONS} onChange={setReason} />
      <Input label="Detalles (opcional)" value={details} onChangeText={setDetails} multiline maxLength={1000} />
      <Button title="Enviar reporte" onPress={send} loading={busy} />
    </Screen>
  );
}
