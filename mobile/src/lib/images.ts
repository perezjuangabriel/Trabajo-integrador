import * as ImagePicker from 'expo-image-picker';

export interface LocalImage { uri: string; name: string; type: string }

/** Abre la galería (pide permiso). Devuelve [] si el usuario cancela. */
export async function pickImages(max = 1): Promise<LocalImage[]> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('Necesitamos permiso para acceder a tus fotos. Podés habilitarlo en los ajustes del teléfono.');
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: max > 1, selectionLimit: max, quality: 0.7 });
  if (r.canceled) return [];
  return r.assets.map((a, i) => ({ uri: a.uri, name: a.fileName ?? `foto-${Date.now()}-${i}.jpg`, type: a.mimeType ?? 'image/jpeg' }));
}
/** multipart con el campo `image` que espera la API (JPEG, PNG o WebP, máx. 5 MB). */
export function toForm(img: LocalImage): FormData {
  const f = new FormData();
  f.append('image', { uri: img.uri, name: img.name, type: img.type } as unknown as Blob);
  return f;
}
