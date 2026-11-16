/** Documento HTML del reproductor: se carga con `baseUrl` propio para que YouTube/Instagram reciban un origen https real (evita el error 153). */
export function playerHtml(embedUrl: string): string {
  const src = embedUrl + (embedUrl.includes('?') ? '&' : '?') + 'playsinline=1&rel=0';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<style>html,body{margin:0;height:100%;background:#000}iframe{position:absolute;inset:0;width:100%;height:100%;border:0}</style></head>`
    + `<body><iframe src="${src.replace(/"/g, '&quot;')}" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></body></html>`;
}

export const PROVIDER_LABEL: Record<string, string> = { youtube: 'YouTube', vimeo: 'Vimeo', instagram: 'Instagram', other: 'Enlace externo' };

const EMBED_HOSTS = ['youtube.com', 'youtube-nocookie.com', 'vimeo.com', 'instagram.com', 'cdninstagram.com', 'google.com', 'gstatic.com', 'ytimg.com'];

/** Permite solo la carga inicial y los marcos internos del proveedor; cualquier otra navegación se bloquea. */
export function allowNavigation(url: string, base: string, isTopFrame = true): boolean {
  if (url === 'about:blank' || url.startsWith(base)) return true;
  if (!isTopFrame) return true;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return EMBED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch { return false; }
}
