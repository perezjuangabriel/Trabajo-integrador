import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { RouteProp, useRoute } from '@react-navigation/native';
import { Banner, Button, Chip, ErrorView, Input, Loading, Muted, Row, Screen, Select, SectionTitle, Title, messageOf, showError } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { catalogApi } from '../api/services';
import { useAsync } from '../hooks';
import { RootStackParamList, useNav } from '../navigation/types';
import { isUrl, toNumber } from '../lib/validate';
import { pickImages, type LocalImage } from '../lib/images';
import type { Img, Kind, PlaceDetail, ProductDetail, VideoDetail } from '../types';

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Campo para sumar una foto por enlace https (se guarda solo la URL; no se descarga ni verifica). */
export function AddByUrl({ onAdd, disabled }: { onAdd: (i: LocalImage) => void; disabled?: boolean }) {
  const [url, setUrl] = useState('');
  const ok = /^https:\/\/[^\s/]+\.[^\s/]+\S*$/i.test(url.trim()) && url.trim().length <= 500;
  if (disabled) return null;
  return (
    <View style={{ gap: 6 }}>
      <Input label="O pegá el enlace de una foto (https)" value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" placeholder="https://..." />
      <Button title="Agregar por enlace" variant="secondary" small disabled={!ok} onPress={() => { onAdd({ uri: url.trim(), name: 'enlace', type: 'url', remote: true }); setUrl(''); }} />
    </View>
  );
}

function ImagesField({ existing, onRemove, added, setAdded, max }: { existing: Img[]; onRemove: (i: Img) => void; added: LocalImage[]; setAdded: (a: LocalImage[]) => void; max: number }) {
  const room = max - existing.length - added.length;
  const add = async () => { try { const picked = await pickImages(Math.max(1, room)); setAdded([...added, ...picked].slice(0, max - existing.length)); } catch (e) { showError(e); } };
  return (
    <View style={{ gap: 8 }}>
      <SectionTitle title="Fotos" />
      <Row wrap>
        {existing.map((i) => <View key={i.id}><Image source={{ uri: i.url }} style={{ width: 84, height: 84, borderRadius: 8 }} /><Muted><Muted>{' '}</Muted></Muted><Chip label="Quitar" onPress={() => onRemove(i)} /></View>)}
        {added.map((i) => <View key={i.uri}><Image source={{ uri: i.uri }} style={{ width: 84, height: 84, borderRadius: 8 }} /><Chip label="Quitar" onPress={() => setAdded(added.filter((x) => x !== i))} /></View>)}
      </Row>
      {room > 0 ? <Button title={`Agregar fotos (${room} disponibles)`} variant="secondary" small onPress={add} /> : <Muted>Máximo de fotos alcanzado.</Muted>}
      <AddByUrl disabled={room <= 0} onAdd={(i) => setAdded([...added, i])} />
      <Muted>Archivo JPEG, PNG o WebP de hasta 5 MB, o un enlace https (si el sitio de origen borra la foto, desaparece de SPOTCHECK).</Muted>
    </View>
  );
}

export function FormScreen() {
  const { params } = useRoute<RouteProp<RootStackParamList, 'Form'>>();
  const { kind, id } = params as { kind: Kind; id?: number };
  const nav = useNav(); const { user, isStaff } = useAuth();
  const edit = id !== undefined;
  const existing = useAsync(() => (edit ? catalogApi.get(kind, id!) : Promise.resolve(null)), [kind, id]);
  const cats = useAsync(() => catalogApi.categories(kind), [kind]);
  const cities = useAsync(() => (kind === 'place' ? catalogApi.cities() : Promise.resolve(null)), [kind]);
  const brands = useAsync(() => (kind === 'product' ? catalogApi.brands() : Promise.resolve(null)), [kind]);
  const opts = useAsync(() => (kind === 'place' ? catalogApi.options() : Promise.resolve(null)), [kind]);

  // --- estado del formulario (un solo objeto simple para los tres tipos) ---
  const [f, setF] = useState({
    name: '', description: '', categoryId: null as number | null, extraCats: [] as number[], cityId: null as number | null, newCity: false, cityName: '', cityRegion: '',
    zone: '', address: '', lat: '', lng: '', surfaceId: null as number | null, obstacles: [] as number[], amenities: [] as number[], days: [] as number[], opens: '10:00', closes: '20:00',
    brandId: null as number | null, price: '', currency: 'ARS', specs: [] as { key: string; value: string }[], url: '',
  });
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const [imgs, setImgs] = useState<Img[]>([]); const [added, setAdded] = useState<LocalImage[]>([]); const [removed, setRemoved] = useState<Img[]>([]);
  const [busy, setBusy] = useState(false); const [tried, setTried] = useState(false);

  useEffect(() => { // precarga al editar
    const d = existing.data as (PlaceDetail & ProductDetail & VideoDetail) | null; if (!d) return;
    if (kind === 'place') set({ name: d.name, description: d.description ?? '', categoryId: d.category.id, extraCats: d.extraCategories.map((x) => x.id), cityId: d.city.id, zone: d.zone ?? '', address: d.address ?? '',
      lat: d.latitude != null ? String(d.latitude) : '', lng: d.longitude != null ? String(d.longitude) : '', surfaceId: d.surfaceType?.id ?? null, obstacles: d.obstacles.map((x) => x.id), amenities: d.amenities.map((x) => x.id),
      days: d.hours.map((h) => h.weekday), opens: d.hours[0]?.opensAt ?? '10:00', closes: d.hours[0]?.closesAt ?? '20:00' });
    if (kind === 'product') set({ name: d.name, description: d.description ?? '', categoryId: d.category.id, brandId: d.brand.id, price: d.price ? String(d.price.amount) : '', currency: d.price?.currency ?? 'ARS', specs: d.specs });
    if (kind === 'video') set({ name: d.title, description: d.description ?? '', categoryId: d.category.id, url: d.url });
    if (kind !== 'video') setImgs(d.images);
  }, [existing.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const errors: Record<string, string | null> = {
    name: f.name.trim().length < 3 ? 'Mínimo 3 caracteres' : null,
    category: f.categoryId ? null : 'Elegí una categoría',
    city: kind !== 'place' ? null : f.newCity ? (f.cityName.trim().length < 2 ? 'Escribí el nombre de la ciudad' : null) : f.cityId ? null : 'Elegí una ciudad',
    coords: kind !== 'place' ? null : (f.lat === '') !== (f.lng === '') ? 'Completá latitud y longitud' : f.lat !== '' && ((toNumber(f.lat) ?? 999) < -90 || (toNumber(f.lat) ?? 999) > 90 || (toNumber(f.lng) ?? 999) < -180 || (toNumber(f.lng) ?? 999) > 180) ? 'Coordenadas inválidas' : null,
    hours: kind !== 'place' || !f.days.length ? null : HHMM.test(f.opens) && HHMM.test(f.closes) && f.closes > f.opens ? null : 'Horario inválido (HH:MM, el cierre debe ser posterior a la apertura)',
    brand: kind !== 'product' || f.brandId ? null : 'Elegí una marca',
    price: kind !== 'product' || f.price === '' || (toNumber(f.price) ?? -1) >= 0 ? null : 'Precio inválido',
    url: kind !== 'video' ? null : isUrl(f.url) ? null : 'Ingresá un enlace http(s) válido',
  };
  const invalid = Object.values(errors).some(Boolean);

  const submit = async () => {
    setTried(true);
    if (invalid) return;
    setBusy(true);
    try {
      const desc = f.description.trim() || null;
      let body: Record<string, unknown>;
      if (kind === 'place') {
        body = { name: f.name.trim(), description: desc, categoryId: f.categoryId, categoryIds: f.extraCats.filter((x) => x !== f.categoryId), zone: f.zone.trim() || null, address: f.address.trim() || null,
          latitude: f.lat === '' ? null : toNumber(f.lat), longitude: f.lng === '' ? null : toNumber(f.lng), surfaceTypeId: f.surfaceId, obstacleIds: f.obstacles, amenityIds: f.amenities,
          hours: f.days.map((d) => ({ weekday: d, opensAt: f.opens, closesAt: f.closes })),
          ...(f.newCity ? { newCity: { name: f.cityName.trim(), ...(f.cityRegion.trim() ? { region: f.cityRegion.trim() } : {}) } } : { cityId: f.cityId }) };
      } else if (kind === 'product') {
        body = { name: f.name.trim(), description: desc, brandId: f.brandId, categoryId: f.categoryId, price: f.price === '' ? null : { amount: toNumber(f.price), currency: f.currency.trim().toUpperCase() }, specs: f.specs.filter((s) => s.key.trim() && s.value.trim()) };
      } else body = { title: f.name.trim(), description: desc, url: f.url.trim(), categoryId: f.categoryId };

      const saved = edit ? await catalogApi.update(kind, id!, body) : await catalogApi.create(kind, body);
      let failed = 0; let why = '';
      for (const r of removed) await catalogApi.deleteImage(kind, saved.id, r.id).catch((e) => { failed++; why = messageOf(e); });
      for (const img of added) await catalogApi.uploadImage(kind, saved.id, img).catch((e) => { failed++; why = messageOf(e); });
      const note = failed ? `\n\nNo se pudieron procesar ${failed} foto(s)${why ? `: ${why}` : ''}. Podés agregarlas editando.` : '';
      if (!edit && !isStaff) showError(new Error(`Tu propuesta quedó pendiente de revisión. Te mostramos su estado en "Mis propuestas".${note}`), '¡Gracias!');
      else if (note) showError(new Error(note.trim()), 'Guardado con avisos');
      nav.replace('Detail', { kind, id: saved.id });
    } catch (e) { showError(e, 'No pudimos guardar'); } finally { setBusy(false); }
  };

  if (!user) return <Screen><EmptyLogin onPress={() => nav.replace('Login')} /></Screen>;
  if (edit && existing.loading) return <Screen><Loading /></Screen>;
  if (existing.error) return <Screen><ErrorView error={existing.error} onRetry={existing.reload} /></Screen>;
  const catOptions = (cats.data?.items ?? []).map((c) => ({ value: c.id, label: c.name }));
  const lookup = (items?: { id: number; name: string }[]) => (items ?? []).map((i) => ({ value: i.id, label: i.name }));
  const E = (k: string) => (tried ? errors[k] : null);

  return (
    <Screen>
      <Title size={22}>{edit ? 'Editar' : 'Proponer'} {{ place: 'un spot', product: 'un producto', video: 'un video' }[kind]}</Title>
      {!user.emailVerified ? <Banner tone="warning" text="Necesitás verificar tu correo para publicar." action={{ label: 'Verificar', onPress: () => nav.navigate('VerifyEmail') }} /> : null}
      {!isStaff && !edit ? <Muted>Tu propuesta la revisa el equipo de moderación antes de publicarse.</Muted> : null}
      <Input label={kind === 'video' ? 'Título' : 'Nombre'} value={f.name} onChangeText={(v) => set({ name: v })} error={E('name')} maxLength={kind === 'video' ? 160 : 120} />
      {kind === 'video' ? <Input label="Enlace del video" value={f.url} onChangeText={(v) => set({ url: v })} autoCapitalize="none" keyboardType="url" error={E('url')} hint="YouTube, Vimeo u otro sitio. Se reproduce dentro de la app solo si el proveedor lo permite." /> : null}
      <Select label="Categoría" value={f.categoryId} options={catOptions} onChange={(v) => set({ categoryId: v })} />
      {E('category') ? <Muted>{E('category')}</Muted> : null}
      {kind === 'product' ? (<><Select label="Marca" value={f.brandId} options={lookup(brands.data?.items)} onChange={(v) => set({ brandId: v })} />{E('brand') ? <Muted>{E('brand')}</Muted> : null}
        <Row><View style={{ flex: 2 }}><Input label="Precio orientativo (opcional)" value={f.price} onChangeText={(v) => set({ price: v })} keyboardType="numeric" error={E('price')} /></View><View style={{ flex: 1 }}><Input label="Moneda" value={f.currency} onChangeText={(v) => set({ currency: v })} autoCapitalize="characters" maxLength={3} /></View></Row></>) : null}
      <Input label="Descripción" value={f.description} onChangeText={(v) => set({ description: v })} multiline maxLength={kind === 'video' ? 3000 : 5000} />
      {kind === 'place' ? (<>
        <SectionTitle title="Ubicación" />
        <Row wrap><Chip label="Ciudad existente" active={!f.newCity} onPress={() => set({ newCity: false })} /><Chip label="Otra ciudad" active={f.newCity} onPress={() => set({ newCity: true })} /></Row>
        {f.newCity ? (<><Input label="Ciudad" value={f.cityName} onChangeText={(v) => set({ cityName: v })} error={E('city')} /><Input label="Provincia o región (opcional)" value={f.cityRegion} onChangeText={(v) => set({ cityRegion: v })} /></>)
          : (<><Select label="Ciudad" value={f.cityId} options={lookup(cities.data?.items)} onChange={(v) => set({ cityId: v })} />{E('city') ? <Muted>{E('city')}</Muted> : null}</>)}
        <Input label="Barrio o zona" value={f.zone} onChangeText={(v) => set({ zone: v })} />
        <Input label="Dirección" value={f.address} onChangeText={(v) => set({ address: v })} />
        <Row><View style={{ flex: 1 }}><Input label="Latitud" value={f.lat} onChangeText={(v) => set({ lat: v })} keyboardType="numbers-and-punctuation" /></View><View style={{ flex: 1 }}><Input label="Longitud" value={f.lng} onChangeText={(v) => set({ lng: v })} keyboardType="numbers-and-punctuation" /></View></Row>
        {E('coords') ? <Muted>{E('coords')}</Muted> : <Muted>Opcional. Podés copiar las coordenadas desde tu app de mapas.</Muted>}
        <SectionTitle title="Características" />
        <Select label="Superficie" value={f.surfaceId} options={lookup(opts.data?.surfaceTypes)} onChange={(v) => set({ surfaceId: v })} allowClear placeholder="No sé" />
        <Muted>También es…</Muted><Row wrap>{catOptions.filter((c) => c.value !== f.categoryId).map((c) => <Chip key={c.value} label={c.label} active={f.extraCats.includes(c.value)} onPress={() => set({ extraCats: toggle(f.extraCats, c.value) })} />)}</Row>
        <Muted>Obstáculos</Muted><Row wrap>{(opts.data?.obstacleTypes ?? []).map((o) => <Chip key={o.id} label={o.name} active={f.obstacles.includes(o.id)} onPress={() => set({ obstacles: toggle(f.obstacles, o.id) })} />)}</Row>
        <Muted>Servicios</Muted><Row wrap>{(opts.data?.amenities ?? []).map((o) => <Chip key={o.id} label={o.name} active={f.amenities.includes(o.id)} onPress={() => set({ amenities: toggle(f.amenities, o.id) })} />)}</Row>
        <Muted>Horario (si se conoce): elegí los días</Muted><Row wrap>{DAYS.map((d, i) => <Chip key={d} label={d} active={f.days.includes(i)} onPress={() => set({ days: toggle(f.days, i) })} />)}</Row>
        {f.days.length ? <Row><View style={{ flex: 1 }}><Input label="Abre (HH:MM)" value={f.opens} onChangeText={(v) => set({ opens: v })} /></View><View style={{ flex: 1 }}><Input label="Cierra (HH:MM)" value={f.closes} onChangeText={(v) => set({ closes: v })} /></View></Row> : null}
        {E('hours') ? <Muted>{E('hours')}</Muted> : null}
      </>) : null}
      {kind === 'product' ? (<>
        <SectionTitle title="Especificaciones" />
        {f.specs.map((s, i) => <Row key={i}><View style={{ flex: 1 }}><Input placeholder="Ej.: Ancho" value={s.key} onChangeText={(v) => set({ specs: f.specs.map((x, j) => (j === i ? { ...x, key: v } : x)) })} /></View><View style={{ flex: 1 }}><Input placeholder="8.25 in" value={s.value} onChangeText={(v) => set({ specs: f.specs.map((x, j) => (j === i ? { ...x, value: v } : x)) })} /></View><Chip label="Quitar" onPress={() => set({ specs: f.specs.filter((_, j) => j !== i) })} /></Row>)}
        {f.specs.length < 20 ? <Button small variant="secondary" title="Agregar especificación" onPress={() => set({ specs: [...f.specs, { key: '', value: '' }] })} /> : null}
      </>) : null}
      {kind !== 'video' ? <ImagesField existing={imgs} onRemove={(i) => { setImgs(imgs.filter((x) => x.id !== i.id)); setRemoved([...removed, i]); }} added={added} setAdded={setAdded} max={8} /> : null}
      {tried && invalid ? <Banner tone="danger" text="Revisá los campos marcados." /> : null}
      <Button title={edit ? 'Guardar cambios' : 'Enviar'} onPress={submit} loading={busy} />
    </Screen>
  );
}
const EmptyLogin = ({ onPress }: { onPress: () => void }) => <View style={{ gap: 10 }}><Title>Iniciá sesión</Title><Muted>Necesitás una cuenta para proponer contenido.</Muted><Button title="Iniciar sesión" onPress={onPress} /></View>;
