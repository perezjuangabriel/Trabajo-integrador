import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

/** `remote` = enlace externo (https): se guarda solo la URL, sin subir archivo. */
export interface LocalImage { uri: string; name: string; type: string; remote?: boolean }

/** Abre la galería (pide permiso). Devuelve [] si el usuario cancela. */
export async function pickImages(max = 1): Promise<LocalImage[]> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('Necesitamos permiso para acceder a tus fotos. Podés habilitarlo en los ajustes del teléfono.');
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: max > 1, selectionLimit: max, quality: 0.7 });
  if (r.canceled) return [];
  return r.assets.map((a, i) => ({ uri: a.uri, name: a.fileName ?? `foto-${Date.now()}-${i}.jpg`, type: a.mimeType ?? 'image/jpeg' }));
}
/** multipart con el campo `image` que espera la API (JPEG, PNG o WebP, máx. 5 MB). En web hay que mandar un Blob real. */
export async function toForm(img: LocalImage): Promise<FormData> {
  const f = new FormData();
  if (Platform.OS === 'web') f.append('image', await (await fetch(img.uri)).blob(), img.name);
  else f.append('image', { uri: img.uri, name: img.name, type: img.type } as unknown as Blob);
  return f;
}
