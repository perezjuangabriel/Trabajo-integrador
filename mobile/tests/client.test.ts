import { describe, it, expect, vi } from 'vitest';
import { createApiClient, ApiError, buildQuery, type Tokens, type TokenStorage } from '../src/api/client';

const memoryStorage = (initial: Tokens | null): TokenStorage & { value: Tokens | null } => {
  const s = { value: initial, get: async () => s.value, set: async (t: Tokens) => { s.value = t; }, clear: async () => { s.value = null; } };
  return s;
};
const res = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const expired = () => res(401, { error: { code: 'TOKEN_EXPIRED', message: 'vencido' } });

describe('buildQuery', () => {
  it('omite vacíos y codifica valores', () => {
    expect(buildQuery({ q: 'a b&c', page: 2, x: undefined, y: null, z: '' })).toBe('?q=a%20b%26c&page=2');
    expect(buildQuery({})).toBe('');
  });
});

describe('cliente de API', () => {
  it('devuelve data, adjunta el token y arma la URL con query', async () => {
    const fetchFn = vi.fn(async () => res(200, { data: { ok: true } }));
    const api = createApiClient({ baseUrl: 'http://x/api', storage: memoryStorage({ accessToken: 'A1', refreshToken: 'R1' }), fetchFn: fetchFn as any });
    expect(await api.get('/things', { page: 1 })).toEqual({ ok: true });
    const [url, init] = fetchFn.mock.calls[0] as any;
    expect(url).toBe('http://x/api/things?page=1');
    expect(init.headers.Authorization).toBe('Bearer A1');
  });
  it('204 devuelve undefined y auth="none" no envía token', async () => {
    const fetchFn = vi.fn(async () => res(204));
    const api = createApiClient({ baseUrl: 'http://x', storage: memoryStorage({ accessToken: 'A', refreshToken: 'R' }), fetchFn: fetchFn as any });
    expect(await api.post('/logout', {}, { auth: 'none' })).toBeUndefined();
    expect((fetchFn.mock.calls[0] as any)[1].headers.Authorization).toBeUndefined();
  });
  it('sin sesión y auth requerida falla sin llamar a la red; con auth opcional llama sin token', async () => {
    const fetchFn = vi.fn(async () => res(200, { data: 1 }));
    const api = createApiClient({ baseUrl: 'http://x', storage: memoryStorage(null), fetchFn: fetchFn as any });
    await expect(api.get('/private')).rejects.toMatchObject({ code: 'TOKEN_MISSING' });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(await api.get('/public', undefined, { auth: 'optional' })).toBe(1);
  });
  it('mapea los errores del servidor (código, mensaje y detalles de validación)', async () => {
    const fetchFn = async () => res(400, { error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: [{ field: 'email', message: 'Correo inválido' }] } });
    const api = createApiClient({ baseUrl: 'http://x', storage: memoryStorage(null), fetchFn: fetchFn as any });
    const err = await api.post('/auth/register', {}, { auth: 'none' }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 400, code: 'VALIDATION_ERROR', details: [{ field: 'email' }] });
  });
  it('un fallo de red se traduce a NETWORK con mensaje útil', async () => {
    const api = createApiClient({ baseUrl: 'http://x', storage: memoryStorage(null), fetchFn: (async () => { throw new TypeError('Network request failed'); }) as any });
    await expect(api.get('/x', undefined, { auth: 'none' })).rejects.toMatchObject({ code: 'NETWORK', status: 0 });
  });
  it('un timeout se traduce a TIMEOUT', async () => {
    const fetchFn = (_u: string, init: RequestInit) => new Promise((_r, rej) => init.signal!.addEventListener('abort', () => rej(Object.assign(new Error('abort'), { name: 'AbortError' }))));
    const api = createApiClient({ baseUrl: 'http://x', storage: memoryStorage(null), fetchFn: fetchFn as any, timeoutMs: 20 });
    await expect(api.get('/x', undefined, { auth: 'none' })).rejects.toMatchObject({ code: 'TIMEOUT' });
  });
});

describe('renovación de sesión', () => {
  it('ante TOKEN_EXPIRED renueva, guarda los tokens nuevos y reintenta UNA vez', async () => {
    const storage = memoryStorage({ accessToken: 'OLD', refreshToken: 'R1' });
    const calls: string[] = [];
    const fetchFn = vi.fn(async (url: string, init: any) => {
      calls.push(`${init.method} ${url.replace('http://x', '')} ${init.headers.Authorization ?? ''}`);
      if (url.endsWith('/auth/refresh')) return res(200, { data: { accessToken: 'NEW', refreshToken: 'R2' } });
      return init.headers.Authorization === 'Bearer NEW' ? res(200, { data: 'ok' }) : expired();
    });
    const api = createApiClient({ baseUrl: 'http://x', storage, fetchFn: fetchFn as any });
    expect(await api.get('/me')).toBe('ok');
    expect(storage.value).toEqual({ accessToken: 'NEW', refreshToken: 'R2' });
    expect(calls).toEqual(['GET /me Bearer OLD', 'POST /auth/refresh ', 'GET /me Bearer NEW']);
  });
  it('varios pedidos vencidos a la vez disparan UNA sola renovación (el refresh token rota)', async () => {
    const storage = memoryStorage({ accessToken: 'OLD', refreshToken: 'R1' });
    let refreshes = 0;
    const fetchFn = vi.fn(async (url: string, init: any) => {
      if (url.endsWith('/auth/refresh')) { refreshes++; await new Promise((r) => setTimeout(r, 15)); return res(200, { data: { accessToken: 'NEW', refreshToken: 'R2' } }); }
      return init.headers.Authorization === 'Bearer NEW' ? res(200, { data: url }) : expired();
    });
    const api = createApiClient({ baseUrl: 'http://x', storage, fetchFn: fetchFn as any });
    const out = await Promise.all([api.get('/a'), api.get('/b'), api.get('/c'), api.get('/d')]);
    expect(refreshes).toBe(1);
    expect(out).toEqual(['http://x/a', 'http://x/b', 'http://x/c', 'http://x/d']);
  });
  it('si la renovación es rechazada se borra la sesión y se avisa (onSessionLost)', async () => {
    const storage = memoryStorage({ accessToken: 'OLD', refreshToken: 'R1' });
    const lost = vi.fn();
    const fetchFn = async (url: string) => (url.endsWith('/auth/refresh') ? res(401, { error: { code: 'REFRESH_REUSED', message: 'x' } }) : expired());
    const api = createApiClient({ baseUrl: 'http://x', storage, fetchFn: fetchFn as any, onSessionLost: lost });
    await expect(api.get('/me')).rejects.toMatchObject({ code: 'TOKEN_EXPIRED' });
    expect(storage.value).toBeNull();
    expect(lost).toHaveBeenCalledTimes(1);
  });
  it('sin red durante la renovación NO se cierra la sesión', async () => {
    const storage = memoryStorage({ accessToken: 'OLD', refreshToken: 'R1' });
    const lost = vi.fn();
    const fetchFn = async (url: string) => { if (url.endsWith('/auth/refresh')) throw new TypeError('offline'); return expired(); };
    const api = createApiClient({ baseUrl: 'http://x', storage, fetchFn: fetchFn as any, onSessionLost: lost });
    await expect(api.get('/me')).rejects.toBeInstanceOf(ApiError);
    expect(storage.value).not.toBeNull();
    expect(lost).not.toHaveBeenCalled();
  });
  it('un 401 que no es TOKEN_EXPIRED (p. ej. credenciales) no intenta renovar', async () => {
    const fetchFn = vi.fn(async () => res(401, { error: { code: 'INVALID_CREDENTIALS', message: 'mal' } }));
    const api = createApiClient({ baseUrl: 'http://x', storage: memoryStorage({ accessToken: 'A', refreshToken: 'R' }), fetchFn: fetchFn as any });
    await expect(api.post('/auth/login', {})).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
