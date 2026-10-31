import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from './api/client';
import type { Page } from './types';

/** Carga una vez y permite recargar. `deps` reinicia la carga (p. ej. al cambiar un filtro). */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn); fnRef.current = fn;
  const seq = useRef(0);
  const reload = useCallback(async () => {
    const id = ++seq.current;
    setLoading(true); setError(null);
    try { const d = await fnRef.current(); if (id === seq.current) setData(d); } catch (e) { if (id === seq.current) setError(e); } finally { if (id === seq.current) setLoading(false); }
  }, []);
  useEffect(() => { reload(); }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, error, loading, reload, setData };
}

/** Lista paginada con "cargar más" y recarga. Ignora respuestas viejas si cambian los filtros a mitad de camino. */
export function usePaginated<T>(fetchPage: (page: number) => Promise<Page<T>>, deps: unknown[] = []) {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const fetchRef = useRef(fetchPage); fetchRef.current = fetchPage;
  const seq = useRef(0);

  const load = useCallback(async (target: number, reset: boolean) => {
    const id = ++seq.current;
    reset ? setLoading(true) : setLoadingMore(true); setError(null);
    try {
      const r = await fetchRef.current(target);
      if (id !== seq.current) return;
      setItems((prev) => (reset ? r.items : [...prev, ...r.items]));
      setPage(r.page); setTotal(r.total); setTotalPages(r.totalPages);
    } catch (e) { if (id === seq.current) setError(e); } finally { if (id === seq.current) { setLoading(false); setLoadingMore(false); } }
  }, []);
  useEffect(() => { load(1, true); }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  const loadMore = useCallback(() => { if (!loading && !loadingMore && page < totalPages) load(page + 1, false); }, [loading, loadingMore, page, totalPages, load]);
  const reload = useCallback(() => load(1, true), [load]);
  return { items, total, loading, loadingMore, error, reload, loadMore, hasMore: page < totalPages, setItems };
}

export const isAuthError = (e: unknown) => e instanceof ApiError && (e.status === 401 || e.code === 'TOKEN_MISSING');
