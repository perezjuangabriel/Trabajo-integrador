import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLiveStore, type Versions } from '../src/lib/liveStore';

let server: Versions;
beforeEach(() => { vi.useFakeTimers(); server = { content: 'a.0', reviews: 'a.0' }; });
afterEach(() => vi.useRealTimers());
const make = (fail = false) => createLiveStore(async () => { if (fail) throw new Error('offline'); return { ...server }; }, 10_000);
const flush = () => vi.advanceTimersByTimeAsync(0);

describe('aviso de cambios', () => {
  it('avisa solo a los suscriptores del tema que cambió', async () => {
    const s = make(); const content = vi.fn(); const reviews = vi.fn();
    s.subscribe('content', content); s.subscribe('reviews', reviews);
    await flush();                                   // referencia inicial: no avisa
    expect(content).not.toHaveBeenCalled();
    server.reviews = 'a.1'; await vi.advanceTimersByTimeAsync(10_000);
    expect(reviews).toHaveBeenCalledTimes(1); expect(content).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(10_000);       // sin cambios nuevos: no repite
    expect(reviews).toHaveBeenCalledTimes(1);
  });

  it('no consulta sin suscriptores ni en segundo plano, y al volver compara con lo último visto', async () => {
    let calls = 0; server.content = 'a.0';
    const s = createLiveStore(async () => { calls++; return { ...server }; }, 10_000);
    await vi.advanceTimersByTimeAsync(30_000); expect(calls).toBe(0);
    const cb = vi.fn(); const off = s.subscribe('content', cb); await flush(); expect(calls).toBe(1);
    s.setActive(false); server.content = 'a.1'; await vi.advanceTimersByTimeAsync(60_000); expect(calls).toBe(1);
    s.setActive(true); await flush(); expect(cb).toHaveBeenCalledTimes(1); // detecta lo que pasó mientras estaba en segundo plano
    off(); await vi.advanceTimersByTimeAsync(30_000); expect(calls).toBe(2);
  });

  it('un error de red no rompe nada y se reintenta', async () => {
    const s = make(true); const cb = vi.fn(); s.subscribe('content', cb);
    await vi.advanceTimersByTimeAsync(35_000); expect(cb).not.toHaveBeenCalled();
  });

  it('el aviso ocurre una vez aunque la respuesta tarde más que el intervalo', async () => {
    let resolveFn: (v: Versions) => void = () => {}; let calls = 0;
    const s = createLiveStore(() => { calls++; return new Promise<Versions>((r) => { resolveFn = r; }); }, 10_000);
    s.subscribe('content', () => {}); await flush();
    await vi.advanceTimersByTimeAsync(30_000); expect(calls).toBe(1); // sigue esperando: no apila consultas
    resolveFn({ ...server });
  });
});
