// src/hooks/useRealtimeRefresh.js
// Subscribes active React views to real-time remote cache invalidations and AI actions.
import { useEffect, useRef } from 'react';

const normalizeWatchPrefix = (prefix) => {
  const clean = String(prefix || '').trim().replace(/^\/api/, '').replace(/\/+$/, '');
  return clean.startsWith('/') ? clean : `/${clean}`;
};

const matchesAnyPrefix = (prefixes, normalizedWatchList) => {
  if (!Array.isArray(prefixes) || prefixes.length === 0) return false;
  return prefixes.some((raw) => {
    const clean = normalizeWatchPrefix(raw);
    return normalizedWatchList.some((w) => clean === w || clean.startsWith(`${w}/`) || w.startsWith(`${clean}/`));
  });
};

export function useRealtimeRefresh(watchPrefixes, onRefresh, options = {}) {
  const { debounceMs = 200, skipLocalApiMutation = true, enabled = true } = options;
  const callbackRef = useRef(onRefresh);
  useEffect(() => {
    callbackRef.current = onRefresh;
  }, [onRefresh]);

  const watchKey = Array.isArray(watchPrefixes) ? watchPrefixes.join('|') : String(watchPrefixes || '');

  useEffect(() => {
    if (!enabled || !watchKey || typeof window === 'undefined') return undefined;

    const normalizedWatchList = watchKey
      .split('|')
      .map((item) => item.trim())
      .filter(Boolean)
      .map(normalizeWatchPrefix);

    if (normalizedWatchList.length === 0) return undefined;

    let timerId = null;
    const scheduleRefresh = (detail) => {
      if (timerId) clearTimeout(timerId);
      timerId = setTimeout(() => {
        timerId = null;
        callbackRef.current?.(detail);
      }, debounceMs);
    };

    const handleCacheInvalidated = (event) => {
      const detail = event?.detail || {};
      if (skipLocalApiMutation && detail.source === 'api-mutation') {
        return;
      }
      if (detail.source === 'reconnect' || matchesAnyPrefix(detail.prefixes, normalizedWatchList)) {
        scheduleRefresh(detail);
      }
    };

    window.addEventListener('farmshift:cache-invalidated', handleCacheInvalidated);
    return () => {
      if (timerId) clearTimeout(timerId);
      window.removeEventListener('farmshift:cache-invalidated', handleCacheInvalidated);
    };
  }, [watchKey, debounceMs, skipLocalApiMutation, enabled]);
}
