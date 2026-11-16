import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { api } from './api';
import { createLiveStore, type Topic, type Versions } from './lib/liveStore';

const store = createLiveStore(() => api.get<Versions>('/changes', undefined, { auth: 'none' }));
AppState.addEventListener('change', (s) => store.setActive(s === 'active'));

/** Llama a `refresh` cuando el servidor avisa de un cambio del tema. Si la pantalla no está a la vista, espera a que vuelva. */
export function useLiveRefresh(topic: Topic, refresh: () => void) {
  const focused = useIsFocused();
  const focusedRef = useRef(focused); focusedRef.current = focused;
  const refreshRef = useRef(refresh); refreshRef.current = refresh;
  const pending = useRef(false);
  useEffect(() => store.subscribe(topic, () => { if (focusedRef.current) refreshRef.current(); else pending.current = true; }), [topic]);
  useEffect(() => { if (focused && pending.current) { pending.current = false; refreshRef.current(); } }, [focused]);
}
