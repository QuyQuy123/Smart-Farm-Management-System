// src/services/realtimeSocket.js
// STOMP over WebSocket client for real-time cross-tab and cross-device cache synchronization.
import { Client } from '@stomp/stompjs';
import { CLIENT_SESSION_ID } from '../utils/clientSession';
import { dataCache } from './dataCache';

export const FARM_UPDATES_TOPIC = '/topic/farm-updates';

const isTestEnv = () =>
  Boolean(import.meta.env?.VITEST || import.meta.env?.MODE === 'test') ||
  globalThis.process?.env?.NODE_ENV === 'test' ||
  Boolean(globalThis.process?.env?.VITEST) ||
  typeof WebSocket === 'undefined';

/**
 * Resolves the STOMP WebSocket URL across local Vite dev, Docker Nginx gateway, and Vercel + Render deploys.
 */
export const resolveWebSocketUrl = ({ apiUrl, wsUrl, locationObj } = {}) => {
  const explicitWs = wsUrl !== undefined ? wsUrl : import.meta.env?.VITE_WS_URL;
  if (explicitWs && String(explicitWs).trim()) {
    return String(explicitWs).trim();
  }

  const rawApi = apiUrl !== undefined ? apiUrl : (import.meta.env?.VITE_API_URL || '/api');
  const apiStr = String(rawApi || '/api').trim();

  if (/^https?:\/\//i.test(apiStr)) {
    try {
      const parsed = new URL(apiStr);
      parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
      const cleanPath = parsed.pathname.replace(/\/+$/, '');
      if (cleanPath.endsWith('/ws')) {
        parsed.pathname = cleanPath;
      } else if (!cleanPath || cleanPath === '/') {
        parsed.pathname = '/api/ws';
      } else {
        parsed.pathname = `${cleanPath}/ws`;
      }
      parsed.search = '';
      parsed.hash = '';
      return parsed.toString();
    } catch {
      // Fall through to relative resolution
    }
  }

  const loc = locationObj !== undefined ? locationObj : (typeof window !== 'undefined' ? window.location : null);
  const relativeBase = apiStr.startsWith('/') ? apiStr.replace(/\/+$/, '') : '/api';
  const wsPath = relativeBase.endsWith('/ws') ? relativeBase : `${relativeBase}/ws`;

  if (loc && loc.host) {
    const wsProto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProto}//${loc.host}${wsPath}`;
  }

  return wsPath;
};

/**
 * Processes an incoming STOMP sync frame body and triggers targeted cache invalidation.
 */
export const processSyncPayload = (rawBody, { clientSessionId = CLIENT_SESSION_ID, cache = dataCache } = {}) => {
  if (!rawBody) return false;
  let payload = rawBody;
  if (typeof rawBody === 'string') {
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return false;
    }
  }
  if (!payload || payload.type !== 'DATA_CHANGED' || !payload.resource) {
    return false;
  }
  if (payload.originClientId && payload.originClientId === clientSessionId) {
    return false;
  }

  const meta = {
    source: 'remote',
    resource: payload.resource,
    method: payload.method,
    actor: payload.actor,
    timestamp: payload.timestamp,
  };

  if (payload.resource === '/all' || payload.resource === '/*' || payload.resource === '*') {
    cache.invalidateAllFarmData(meta);
    return true;
  }

  cache.invalidateForMutation(payload.resource, meta);
  return true;
};

class RealtimeSocketService {
  constructor() {
    this.client = null;
    this.currentToken = null;
    this.hasConnectedOnce = false;
    this.disconnectTimer = null;
  }

  connect(token) {
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }

    if (!token || isTestEnv()) {
      return;
    }

    if (this.client && this.currentToken === token) {
      if (!this.client.active) {
        this.client.activate();
      }
      return;
    }

    this.disconnect(true);
    this.currentToken = token;
    this.hasConnectedOnce = false;

    const brokerURL = resolveWebSocketUrl();
    const client = new Client({
      brokerURL,
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      reconnectDelay: 3000,
      heartbeatIncoming: 20000,
      heartbeatOutgoing: 20000,
      debug: () => {},
    });

    client.onConnect = () => {
      if (this.hasConnectedOnce) {
        dataCache.invalidateAllFarmData({ source: 'reconnect' });
      }
      this.hasConnectedOnce = true;

      client.subscribe(FARM_UPDATES_TOPIC, (frame) => {
        processSyncPayload(frame.body);
      });
    };

    client.onStompError = (frame) => {
      console.debug('STOMP broker error:', frame?.headers?.message || 'unknown');
    };

    client.onWebSocketError = () => {
      console.debug('WebSocket realtime connection interrupted; retrying...');
    };

    this.client = client;
    client.activate();
  }

  disconnect(immediate = false) {
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }

    if (!immediate) {
      this.disconnectTimer = setTimeout(() => {
        this.disconnectTimer = null;
        this.disconnect(true);
      }, 150);
      return;
    }

    const activeClient = this.client;
    this.client = null;
    this.currentToken = null;
    this.hasConnectedOnce = false;

    if (activeClient) {
      Promise.resolve(activeClient.deactivate()).catch(() => {});
    }
  }
}

export const realtimeSocket = new RealtimeSocketService();
