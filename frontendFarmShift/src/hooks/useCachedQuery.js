// src/hooks/useCachedQuery.js
// Standard React hook for instant cached data rendering and automatic cache integration
import { useState, useEffect, useCallback, useRef } from 'react';
import { dataCache, normalizeCacheKey } from '../services/dataCache';

export function useCachedQuery(key, fetcherFn, options = {}) {
  const { ttl, enabled = true, deps = [], forceRefresh = false } = options;
  const initial = dataCache.peek(key);
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(!initial && enabled);
  const [error, setError] = useState(null);
  const fetcherRef = useRef(fetcherFn);
  const mountedRef = useRef(true);

  useEffect(() => {
    fetcherRef.current = fetcherFn;
  }, [fetcherFn]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refetch = useCallback(async () => {
    if (mountedRef.current) setLoading(true);
    try {
      const res = await dataCache.fetchWithCache(key, () => fetcherRef.current(), {
        forceRefresh: true,
        ttl
      });
      const unwrapped = (res && typeof res === 'object' && 'data' in res && 'status' in res)
        ? (res.data?.data ?? res.data)
        : res;
      if (mountedRef.current) {
        setData(unwrapped);
        setError(null);
      }
      return unwrapped;
    } catch (err) {
      if (mountedRef.current) setError(err);
      throw err;
    } finally {
      if (mountedRef.current) setLoading(false);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, forceRefresh, ttl, ...deps]);

  // Listen to cache invalidation events
  useEffect(() => {
    if (!enabled) return undefined;
    const normalizedKey = normalizeCacheKey(key);
    const handleInvalidation = (event) => {
      const prefixes = event?.detail?.prefixes;
      if (!prefixes || prefixes.length === 0) {
        refetch().catch(() => {});
        return;
      }
      const match = (Array.isArray(prefixes) ? prefixes : [prefixes]).some(prefix => {
        const cleanPrefix = normalizeCacheKey(prefix);
        return normalizedKey === cleanPrefix
          || normalizedKey.startsWith(cleanPrefix + '/')
          || normalizedKey.startsWith(cleanPrefix + '?');
      });
      if (match) {
        refetch().catch(() => {});
      }
    };

    window.addEventListener('farmshift:cache-invalidated', handleInvalidation);
    return () => window.removeEventListener('farmshift:cache-invalidated', handleInvalidation);
  }, [key, enabled, refetch]);

  return { data, loading, error, refetch };
}

