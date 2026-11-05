// src/__tests__/dataCache.test.jsx
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import {
  dataCache,
  DataCache,
  buildCacheKey,
  shouldSkipCache,
  normalizeCacheKey,
  INVALIDATION_MATRIX
} from '../services/dataCache';
import { useCachedQuery } from '../hooks/useCachedQuery';

describe('DataCache Core Engine & Invalidation Matrix', () => {
  let cache;

  beforeEach(() => {
    cache = new DataCache();
    cache.setUserScope('test-user@farmshift.local');
    cache.clearAll();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    cache.destroy();
  });

  describe('Key normalization and buildCacheKey', () => {
    it('normalizes URLs with or without /api prefix consistently', () => {
      expect(normalizeCacheKey('/purchases')).toBe('/api/purchases');
      expect(normalizeCacheKey('/api/purchases')).toBe('/api/purchases');
      expect(normalizeCacheKey('inventory-items')).toBe('/api/inventory-items');
    });

    it('builds sorted query string cache keys', () => {
      const key1 = buildCacheKey('/purchases', { b: 2, a: 1 });
      const key2 = buildCacheKey('/purchases', { a: 1, b: 2 });
      expect(key1).toBe('/purchases?a=1&b=2');
      expect(key1).toBe(key2);
      expect(buildCacheKey('/purchases', {})).toBe('/purchases');
    });

    it('identifies non-cacheable routes (auth, voice, uploads)', () => {
      expect(shouldSkipCache('/auth/login')).toBe(true);
      expect(shouldSkipCache('/ai/assistant/stream')).toBe(true);
      expect(shouldSkipCache('/voice/chat')).toBe(true);
      expect(shouldSkipCache('/files/upload')).toBe(true);
      expect(shouldSkipCache('/purchases', { skipCache: true })).toBe(true);
      expect(shouldSkipCache('/purchases', {})).toBe(false);
    });
  });

  describe('RAM Cache & Synchronous Peek', () => {
    it('sets and peeks data synchronously in 0ms', () => {
      const mockData = [{ id: 1, name: 'Cám Higro' }];
      cache.set('/purchases', mockData);

      expect(cache.peek('/purchases')).toEqual(mockData);
      expect(cache.peek('/api/purchases')).toEqual(mockData);
    });

    it('unwraps Axios response object automatically on peek', () => {
      const axiosRes = {
        data: { success: true, data: [{ id: 10, code: 'PO-001' }] },
        status: 200,
        statusText: 'OK'
      };
      cache.set('/purchases', axiosRes);

      expect(cache.peek('/purchases')).toEqual([{ id: 10, code: 'PO-001' }]);
      expect(cache.get('/purchases')).toBe(axiosRes);
    });

    it('returns null and purges expired entries', async () => {
      cache.set('/temp', { id: 1 }, 20); // 20ms TTL
      expect(cache.get('/temp')).toEqual({ id: 1 });

      await new Promise(r => setTimeout(r, 40));
      expect(cache.get('/temp')).toBeNull();
      expect(cache.peek('/temp')).toBeNull();
    });
  });

  describe('Test 2: In-Flight Request Deduplication', () => {
    it('executes only 1 network call for multiple simultaneous requests to the same endpoint', async () => {
      let networkCalls = 0;
      const fetcher = vi.fn().mockImplementation(async () => {
        networkCalls++;
        await new Promise(r => setTimeout(r, 30));
        return { data: { success: true, data: [{ id: 1, name: 'Item 1' }] }, status: 200 };
      });

      // Trigger 3 simultaneous calls
      const [res1, res2, res3] = await Promise.all([
        cache.fetchWithCache('/inventory-items', fetcher),
        cache.fetchWithCache('/inventory-items', fetcher),
        cache.fetchWithCache('/inventory-items', fetcher)
      ]);

      expect(networkCalls).toBe(1);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(res1).toBe(res2);
      expect(res2).toBe(res3);
    });
  });

  describe('Test 3: Mutation Auto-Invalidation Matrix', () => {
    it.each(['confirm', 'undo'])('clears stock, cycle finance and daily plans after task %s', () => {
      const keys = ['/inventory-items', '/inventory', '/cycles/10', '/cycles/10/daily-plan', '/daily-plan', '/dashboard'];
      keys.forEach(key => cache.set(key, { stale: true }));
      cache.invalidateForMutation('/cycles/10/daily-plan/tasks');
      keys.forEach(key => expect(cache.get(key)).toBeNull());
      const persisted = new DataCache({ attachListeners: false });
      persisted.setUserScope('test-user@farmshift.local');
      keys.forEach(key => expect(persisted.get(key)).toBeNull());
    });

    it('invalidates dependent cache entries when a mutation occurs', () => {
      cache.set('/purchases', [{ id: 1 }]);
      cache.set('/inventory-items', [{ id: 2 }]);
      cache.set('/suppliers', [{ id: 3 }]);
      cache.set('/cashbook', [{ id: 4 }]);
      cache.set('/farm', { name: 'Trại Miền Bình' });

      expect(cache.peek('/purchases')).not.toBeNull();
      expect(cache.peek('/inventory-items')).not.toBeNull();
      expect(cache.peek('/suppliers')).not.toBeNull();
      expect(cache.peek('/cashbook')).not.toBeNull();
      expect(cache.peek('/farm')).not.toBeNull();

      // Trigger POST /api/purchases mutation
      cache.invalidateForMutation('/purchases');

      // Check invalidated endpoints
      expect(cache.peek('/purchases')).toBeNull();
      expect(cache.peek('/inventory-items')).toBeNull();
      expect(cache.peek('/suppliers')).toBeNull();
      expect(cache.peek('/cashbook')).toBeNull();

      // Unrelated endpoint should remain intact
      expect(cache.peek('/farm')).not.toBeNull();
    });
  });

  describe('Test 4: Actionable AI Chatbot Event Invalidation', () => {
    it('invalidates all farm caches when farmshift:ai-action event fires with executed: true', () => {
      cache.set('/journal', [{ id: 1, note: 'Feed record' }]);
      cache.set('/today-tasks', [{ id: 2, task: 'Cho ăn' }]);
      cache.set('/dashboard', { kpis: { count: 5000 } });

      expect(cache.peek('/journal')).not.toBeNull();
      expect(cache.peek('/today-tasks')).not.toBeNull();
      expect(cache.peek('/dashboard')).not.toBeNull();

      // Dispatch global AI event
      window.dispatchEvent(new CustomEvent('farmshift:ai-action', {
        detail: {
          actionType: 'COMPOUND_LOG_FEED',
          executed: true,
          actionSummary: { title: 'Đã ghi cám 2 chuồng' }
        }
      }));

      expect(cache.peek('/journal')).toBeNull();
      expect(cache.peek('/today-tasks')).toBeNull();
      expect(cache.peek('/dashboard')).toBeNull();
    });

    it('does NOT invalidate cache on pure navigation AI action', () => {
      cache.set('/journal', [{ id: 1 }]);

      window.dispatchEvent(new CustomEvent('farmshift:ai-action', {
        detail: {
          actionType: 'NAVIGATE_AND_PREFILL',
          executed: true,
          navigateTo: '/journal'
        }
      }));

      expect(cache.peek('/journal')).not.toBeNull();
    });
  });

  describe('Test 5: Logout & Role/Session Isolation', () => {
    it('isolates cache by user scope and wipes completely on logout', () => {
      cache.setUserScope('owner@mienbinh.test');
      cache.set('/purchases', [{ id: 100, ownerData: true }]);
      expect(cache.peek('/purchases')).toEqual([{ id: 100, ownerData: true }]);

      // Switch user to worker
      cache.setUserScope('worker@mienbinh.test');
      expect(cache.peek('/purchases')).toBeNull();

      // Set worker cache
      cache.set('/today-tasks', [{ id: 200, workerData: true }]);
      expect(cache.peek('/today-tasks')).toEqual([{ id: 200, workerData: true }]);

      // Trigger logout via unauthorized event
      window.dispatchEvent(new Event('unauthorized'));
      expect(cache.peek('/today-tasks')).toBeNull();
    });
  });
});

describe('Test 1: React Component & Tab Navigation (Instant Cache Render)', () => {
  beforeEach(() => {
    dataCache.clearAll();
  });

  function MockTabView({ tabKey, fetcher }) {
    const { data, loading } = useCachedQuery(tabKey, fetcher);
    return (
      <div>
        <span data-testid="status">{loading ? 'LOADING' : 'READY'}</span>
        <ul data-testid="list">
          {data && data.map(item => <li key={item.id}>{item.name}</li>)}
        </ul>
      </div>
    );
  }

  it('renders loading on first visit, then renders immediately with loading=false on second visit without refetching', async () => {
    let fetchCount = 0;
    const fetcher = vi.fn().mockImplementation(async () => {
      fetchCount++;
      await new Promise(r => setTimeout(r, 20));
      return [{ id: 1, name: 'Chuồng A1' }, { id: 2, name: 'Chuồng A2' }];
    });

    // Visit 1: Initial mount -> loading = true -> data arrives
    const { unmount } = render(<MockTabView tabKey="/barns" fetcher={fetcher} />);
    expect(screen.getByTestId('status').textContent).toBe('LOADING');

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('READY');
      expect(screen.getByText('Chuồng A1')).toBeInTheDocument();
    });
    expect(fetchCount).toBe(1);

    // Unmount view (simulate navigating away to another tab)
    unmount();

    // Visit 2: Remount view (simulate returning to tab)
    render(<MockTabView tabKey="/barns" fetcher={fetcher} />);

    // Must render IMMEDIATELY with READY (no loading spinner flicker!)
    expect(screen.getByTestId('status').textContent).toBe('READY');
    expect(screen.getByText('Chuồng A1')).toBeInTheDocument();
    expect(screen.getByText('Chuồng A2')).toBeInTheDocument();

    // Underlying fetch was NOT called a second time
    expect(fetchCount).toBe(1);
  });
});
