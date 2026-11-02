// src/hooks/useCachedQuery.js
// Standard React hook for instant cached data rendering and automatic cache integration
import { useState, useEffect, useCallback, useRef } from 'react';
import { dataCache } from '../services/dataCache';

export function useCachedQuery(key, fetcherFn, options = {}) {
  const { ttl, enabled = true, deps = [], forceRefresh = false } = options;
  const initial = dataCache.peek(key);
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(!initial && enabled);
  const [error, setError] = useState(null);
  const fetcherRef = useRef(fetcherFn);
  fetcherRef.current = fetcherFn;

  const refetch = useCallback(async (opts = {}) => {
    setLoading(true);
    try {
      const res = await dataCache.fetchWithCache(key, () => fetcherRef.current(), {
        forceRefresh: true,
        ttl
      });
      const unwrapped = (res && typeof res === 'object' && 'data' in res && 'status' in res)
        ? (res.data?.data ?? res.data)
        : res;
      setData(unwrapped);
      setError(null);
      return unwrapped;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [key, ttl]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    dataCache.fetchWithCache(key, () => fetcherRef.current(), { forceRefresh, ttl })
      .then(res => {
        if (!cancelled) {
          const unwrapped = (res && typeof res === 'object' && 'data' in res && 'status' in res)
            ? (res.data?.data ?? res.data)
            : res;
          setData(unwrapped);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [key, enabled, forceRefresh, ttl, ...deps]);

  // Listen to cache invalidation events
  useEffect(() => {
    const handleInvalidation = (event) => {
      const prefixes = event?.detail?.prefixes;
      if (!prefixes || prefixes.length === 0) {
        refetch().catch(() => {});
        return;
      }
      const match = (Array.isArray(prefixes) ? prefixes : [prefixes]).some(prefix =>
        key.startsWith(prefix) || key.startsWith(prefix.replace(/^\/api/, ''))
      );
      if (match) {
        refetch().catch(() => {});
      }
    };

    window.addEventListener('farmshift:cache-invalidated', handleInvalidation);
    return () => window.removeEventListener('farmshift:cache-invalidated', handleInvalidation);
  }, [key, refetch]);

  return { data, loading, error, refetch };
}

