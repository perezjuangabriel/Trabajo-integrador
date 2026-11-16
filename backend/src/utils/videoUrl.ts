import { badRequest } from './AppError.js';

const YT_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com']);
const ID_RE = /^[A-Za-z0-9_-]{6,20}$/;

/**
 * Valida y normaliza un enlace de video. Solo http(s), sin credenciales.
 * Para YouTube/Vimeo extrae el ID (permite embeber y evita duplicados con otro formato de URL);
 * para otros sitios solo se guarda el enlace (la app lo abre fuera). No hay streaming propio.
 */
export function parseVideoUrl(raw) {
  let u;
  try { u = new URL(raw.trim()); } catch { throw badRequest('INVALID_VIDEO_URL', 'El enlace del video no es válido'); }
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) {
    throw badRequest('INVALID_VIDEO_URL', 'El enlace debe ser http(s) y sin credenciales');
  }
  const host = u.hostname.toLowerCase();

  let ytId = null;
  if (YT_HOSTS.has(host)) {
    if (u.pathname === '/watch') ytId = u.searchParams.get('v');
    else { const m = u.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)/); ytId = m?.[1] ?? null; }
  } else if (host === 'youtu.be') ytId = u.pathname.slice(1).split('/')[0] || null;
  if (ytId && ID_RE.test(ytId)) {
    return { url: `https://www.youtube.com/watch?v=${ytId}`, provider: 'youtube', externalId: ytId,
      thumbnailUrl: `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`, embedUrl: `https://www.youtube.com/embed/${ytId}` };
  }

  if (host === 'vimeo.com' || host === 'www.vimeo.com') {
    const m = u.pathname.match(/^\/(\d{5,12})(?:\/|$)/);
    if (m) return { url: `https://vimeo.com/${m[1]}`, provider: 'vimeo', externalId: m[1], thumbnailUrl: null, embedUrl: `https://player.vimeo.com/video/${m[1]}` };
  }

  if (host === 'instagram.com' || host === 'www.instagram.com') {
    // /reel/CODE, /reels/CODE, /p/CODE, /tv/CODE y la variante con usuario (/usuario/reel/CODE)
    const m = u.pathname.match(/^\/(?:[A-Za-z0-9._]+\/)?(reels?|p|tv)\/([A-Za-z0-9_-]{5,20})(?:\/|$)/);
    if (m) {
      const id = `${m[1] === 'reels' ? 'reel' : m[1]}/${m[2]}`;
      return { url: `https://www.instagram.com/${id}/`, provider: 'instagram', externalId: id, thumbnailUrl: null, embedUrl: `https://www.instagram.com/${id}/embed` };
    }
  }

  u.hash = '';
  return { url: u.toString(), provider: 'other', externalId: null, thumbnailUrl: null, embedUrl: null };
}

/** Reconstruye el embed desde lo guardado (la BD no lo almacena). */
export const embedUrlFor = (provider, externalId) =>
  provider === 'youtube' && externalId ? `https://www.youtube.com/embed/${externalId}`
  : provider === 'vimeo' && externalId ? `https://player.vimeo.com/video/${externalId}`
  : provider === 'instagram' && externalId && /^(reel|p|tv)\/[A-Za-z0-9_-]{5,20}$/.test(externalId) ? `https://www.instagram.com/${externalId}/embed` : null;
