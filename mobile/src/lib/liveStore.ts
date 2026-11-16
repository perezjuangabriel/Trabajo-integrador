// Aviso de cambios del servidor: consulta `fetchVersions` cada `intervalMs` mientras haya pantallas suscriptas y la app esté en primer plano.
// Función pura (sin React Native) para poder probarla.
export type Topic = 'content' | 'reviews';
export type Versions = Record<Topic, string>;

export function createLiveStore(fetchVersions: () => Promise<Versions>, intervalMs = 10_000) {
  const subs = new Map<number, { topic: Topic; cb: () => void }>();
  let seen: Versions | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let active = true; let busy = false; let n = 0;

  const tick = async () => {
    if (busy) return; busy = true;
    try {
      const v = await fetchVersions();
      const prev = seen; seen = v;
      if (prev) for (const s of [...subs.values()]) if (v[s.topic] !== prev[s.topic]) s.cb();
    } catch { /* sin conexión o servidor dormido: se reintenta en el próximo ciclo */ } finally { busy = false; }
  };
  const sync = () => {
    if (subs.size === 0) seen = null; // sin pantallas que avisar: la próxima vez se toma una referencia nueva
    const want = active && subs.size > 0;
    if (want && !timer) { void tick(); timer = setInterval(tick, intervalMs); }
    else if (!want && timer) { clearInterval(timer); timer = null; }
  };

  return {
    subscribe(topic: Topic, cb: () => void) {
      const id = ++n; subs.set(id, { topic, cb }); sync();
      return () => { subs.delete(id); sync(); };
    },
    /** Primer plano / segundo plano. Al volver, consulta enseguida y compara con lo último visto. */
    setActive(value: boolean) { active = value; sync(); },
    tick,
  };
}
