// src/__tests__/realtimeSync.test.jsx
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { resolveWebSocketUrl, processSyncPayload } from '../services/realtimeSocket';
import { dataCache } from '../services/dataCache';
import { CLIENT_SESSION_ID } from '../utils/clientSession';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';

describe('STOMP WebSocket Realtime Sync & Deploy URL Resolution', () => {
  beforeEach(() => {
    dataCache.clearAll();
  });

  describe('resolveWebSocketUrl across environments', () => {
    it('prefers explicit VITE_WS_URL when configured', () => {
      expect(
        resolveWebSocketUrl({
          wsUrl: 'wss://ws.farmshift.vn/api/ws',
          apiUrl: 'https://api.farmshift.vn/api',
        })
      ).toBe('wss://ws.farmshift.vn/api/ws');
    });

    it('derives wss://.../api/ws from HTTPS VITE_API_URL for Vercel + Render deploys', () => {
      expect(
        resolveWebSocketUrl({
          wsUrl: '',
          apiUrl: 'https://farmshift-api.onrender.com/api',
        })
      ).toBe('wss://farmshift-api.onrender.com/api/ws');

      expect(
        resolveWebSocketUrl({
          wsUrl: '',
          apiUrl: 'https://farmshift-api.onrender.com/',
        })
      ).toBe('wss://farmshift-api.onrender.com/api/ws');
    });

    it('derives same-origin ws:// or wss:// for Docker Nginx / Vite dev relative /api', () => {
      expect(
        resolveWebSocketUrl({
          wsUrl: '',
          apiUrl: '/api',
          locationObj: { protocol: 'http:', host: 'localhost:5173' },
        })
      ).toBe('ws://localhost:5173/api/ws');

      expect(
        resolveWebSocketUrl({
          wsUrl: '',
          apiUrl: '/api',
          locationObj: { protocol: 'https:', host: 'farm.company.vn' },
        })
      ).toBe('wss://farm.company.vn/api/ws');
    });
  });

  describe('processSyncPayload STOMP event handling', () => {
    it('ignores self-originated echoes to prevent duplicate fetches on the editing tab', () => {
      dataCache.set('/purchases', [{ id: 1 }]);
      dataCache.set('/reports', { total: 100 });

      const processed = processSyncPayload(
        JSON.stringify({
          type: 'DATA_CHANGED',
          resource: '/purchases',
          method: 'POST',
          actor: 'ketoan@farmshift.local',
          originClientId: CLIENT_SESSION_ID,
        })
      );

      expect(processed).toBe(false);
      expect(dataCache.peek('/purchases')).not.toBeNull();
      expect(dataCache.peek('/reports')).not.toBeNull();
    });

    it('invalidates dependent modules and dispatches remote source for cross-window edits', () => {
      dataCache.set('/purchases', [{ id: 1 }]);
      dataCache.set('/reports', { total: 100 });
      dataCache.set('/inventory-items', [{ id: 5 }]);
      dataCache.set('/farm', { name: 'Trang trại A' });

      const listener = vi.fn();
      window.addEventListener('farmshift:cache-invalidated', listener);

      const processed = processSyncPayload(
        JSON.stringify({
          type: 'DATA_CHANGED',
          resource: '/purchases',
          method: 'POST',
          actor: 'ketoan@farmshift.local',
          originClientId: 'other_window_id',
        })
      );

      window.removeEventListener('farmshift:cache-invalidated', listener);

      expect(processed).toBe(true);
      expect(dataCache.peek('/purchases')).toBeNull();
      expect(dataCache.peek('/reports')).toBeNull();
      expect(dataCache.peek('/inventory-items')).toBeNull();
      expect(dataCache.peek('/farm')).not.toBeNull();
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].detail.source).toBe('remote');
    });

    it('invalidates all farm caches when receiving /all (e.g. from AI Assistant mutations)', () => {
      dataCache.set('/reports', { total: 1 });
      dataCache.set('/today-tasks', [{ id: 2 }]);
      dataCache.set('/purchases', [{ id: 3 }]);

      const processed = processSyncPayload(
        JSON.stringify({
          type: 'DATA_CHANGED',
          resource: '/all',
          method: 'AI',
          originClientId: 'ai_tab',
        })
      );

      expect(processed).toBe(true);
      expect(dataCache.peek('/reports')).toBeNull();
      expect(dataCache.peek('/today-tasks')).toBeNull();
      expect(dataCache.peek('/purchases')).toBeNull();
    });
  });

  describe('useRealtimeRefresh React hook', () => {
    function TestObserver({ watchPrefixes, onRefresh }) {
      useRealtimeRefresh(watchPrefixes, onRefresh, { debounceMs: 50 });
      return null;
    }

    it('skips local api-mutation echoes but triggers debounced refresh on remote & reconnect updates', async () => {
      vi.useFakeTimers();
      const onRefresh = vi.fn();
      render(<TestObserver watchPrefixes={['/reports', '/purchases']} onRefresh={onRefresh} />);

      // 1. Local API mutation echo -> ignored
      act(() => {
        dataCache.invalidateForMutation('/purchases', { source: 'api-mutation' });
        vi.advanceTimersByTime(100);
      });
      expect(onRefresh).not.toHaveBeenCalled();

      // 2. Rapid burst of 2 remote updates -> debounced into 1 UI refresh
      act(() => {
        dataCache.invalidateForMutation('/purchases', { source: 'remote' });
        dataCache.invalidateForMutation('/sales', { source: 'remote' });
        vi.advanceTimersByTime(60);
      });
      expect(onRefresh).toHaveBeenCalledTimes(1);

      // 3. Reconnect synchronization -> triggers refresh regardless of prefixes
      act(() => {
        dataCache.invalidateAllFarmData({ source: 'reconnect' });
        vi.advanceTimersByTime(60);
      });
      expect(onRefresh).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });
  });
});
