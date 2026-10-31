// Cliente HTTP de la API. NO importa módulos de React Native: recibe el almacenamiento y fetch por parámetro,
// así su lógica (renovación de sesión, errores) se prueba en Node (ver tests/client.test.ts).

export interface Tokens { accessToken: string; refreshToken: string }
export interface TokenStorage { get(): Promise<Tokens | null>; set(t: Tokens): Promise<void>; clear(): Promise<void> }

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: { field: string; message: string }[]) {
    super(message);
    this.name = 'ApiError';
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;
export interface RequestOptions { query?: Query; body?: unknown; form?: FormData; auth?: 'required' | 'optional' | 'none'; headers?: Record<string, string> }

export interface ApiClient {
  request<T>(method: string, path: string, opts?: RequestOptions): Promise<T>;
  get<T>(path: string, query?: Query, opts?: RequestOptions): Promise<T>;
  post<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T>;
  patch<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T>;
  put<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T>;
  del<T>(path: string, opts?: RequestOptions): Promise<T>;
  upload<T>(path: string, form: FormData): Promise<T>;
  setTokens(t: Tokens): Promise<void>;
  clearTokens(): Promise<void>;
  hasTokens(): Promise<boolean>;
  getTokens(): Promise<Tokens | null>;
}

export const buildQuery = (q?: Query) => {
  const p = Object.entries(q ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return p.length ? `?${p.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')}` : '';
};

export function createApiClient(cfg: {
  baseUrl: string; storage: TokenStorage; fetchFn?: typeof fetch; onSessionLost?: () => void; timeoutMs?: number;
}): ApiClient {
  const doFetch = cfg.fetchFn ?? fetch;
  const timeoutMs = cfg.timeoutMs ?? 20_000;
  let refreshing: Promise<boolean> | null = null; // una sola renovación a la vez (el refresh token rota y no admite pedidos paralelos)

  async function send(method: string, path: string, opts: RequestOptions, token: string | null): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json', ...opts.headers };
    if (token) headers.Authorization = `Bearer ${token}`;
    let body: BodyInit | undefined;
    if (opts.form) body = opts.form; // multipart: el Content-Type (con boundary) lo pone fetch
    else if (opts.body !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(opts.body); }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await doFetch(`${cfg.baseUrl}${path}${buildQuery(opts.query)}`, { method, headers, body, signal: ctrl.signal });
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw new ApiError(0, 'TIMEOUT', 'El servidor tardó demasiado en responder');
      throw new ApiError(0, 'NETWORK', 'No hay conexión con el servidor. Revisá tu internet e intentá de nuevo.');
    } finally { clearTimeout(timer); }
  }

  async function doRefresh(): Promise<boolean> {
    const tokens = await cfg.storage.get();
    if (!tokens) return false;
    try {
      const res = await send('POST', '/auth/refresh', { body: { refreshToken: tokens.refreshToken } }, null);
      if (!res.ok) { await cfg.storage.clear(); cfg.onSessionLost?.(); return false; }
      const json = await res.json();
      await cfg.storage.set({ accessToken: json.data.accessToken, refreshToken: json.data.refreshToken });
      return true;
    } catch (e) {
      // Sin red no se cierra la sesión: el usuario puede reintentar luego.
      if (e instanceof ApiError && (e.code === 'NETWORK' || e.code === 'TIMEOUT')) return false;
      throw e;
    }
  }
  const refreshOnce = () => (refreshing ??= doRefresh().finally(() => { refreshing = null; }));

  async function parse<T>(res: Response): Promise<T> {
    if (res.status === 204) return undefined as T;
    let json: any = null;
    try { json = await res.json(); } catch { /* cuerpo vacío o no JSON */ }
    if (!res.ok) {
      const e = json?.error;
      throw new ApiError(res.status, e?.code ?? 'HTTP_ERROR', e?.message ?? `Error ${res.status}`, e?.details);
    }
    return json?.data as T;
  }

  async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
    const auth = opts.auth ?? 'required';
    const tokens = auth === 'none' ? null : await cfg.storage.get();
    if (auth === 'required' && !tokens) throw new ApiError(401, 'TOKEN_MISSING', 'Iniciá sesión para continuar');
    let res = await send(method, path, opts, tokens?.accessToken ?? null);
    if (res.status === 401 && tokens) {
      const peek = await res.clone().json().catch(() => null);
      if (peek?.error?.code === 'TOKEN_EXPIRED' && (await refreshOnce())) {
        const fresh = await cfg.storage.get();
        res = await send(method, path, opts, fresh?.accessToken ?? null); // se reintenta UNA vez
      }
    }
    return parse<T>(res);
  }

  return {
    request,
    get: (path, query, opts) => request('GET', path, { ...opts, query }),
    post: (path, body, opts) => request('POST', path, { ...opts, body }),
    patch: (path, body, opts) => request('PATCH', path, { ...opts, body }),
    put: (path, body, opts) => request('PUT', path, { ...opts, body }),
    del: (path, opts) => request('DELETE', path, opts),
    upload: (path, form) => request('POST', path, { form }),
    setTokens: (t) => cfg.storage.set(t),
    clearTokens: () => cfg.storage.clear(),
    hasTokens: async () => (await cfg.storage.get()) !== null,
    getTokens: () => cfg.storage.get(),
  };
}
