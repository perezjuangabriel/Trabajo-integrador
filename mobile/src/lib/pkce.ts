// PKCE (S256) para el inicio de sesión social. Funciones puras: el hash y los bytes aleatorios se inyectan.
export const toBase64Url = (base64: string) => base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function bytesToBase64Url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '') + (i + 2 < bytes.length ? B64[n & 63] : '');
  }
  return toBase64Url(out);
}

/** verifier = 32 bytes aleatorios en base64url (43 caracteres); challenge = base64url(sha256(verifier)). */
export async function createPkce(randomBytes: (n: number) => Uint8Array, sha256Base64: (s: string) => Promise<string>) {
  const verifier = bytesToBase64Url(randomBytes(32));
  return { verifier, challenge: toBase64Url(await sha256Base64(verifier)) };
}

/** Lee ?code= / ?error= / ?linked= de la URL de retorno de la app. */
export function parseAuthRedirect(url: string): { code?: string; error?: string; linked?: string } {
  const q = url.split('#')[0].split('?')[1] ?? '';
  const out: Record<string, string> = {};
  for (const pair of q.split('&')) { const [k, v = ''] = pair.split('='); if (k) out[decodeURIComponent(k)] = decodeURIComponent(v); }
  return { code: out.code, error: out.error, linked: out.linked };
}
