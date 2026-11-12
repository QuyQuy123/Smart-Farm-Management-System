// src/services/dataCache.js
// Centralized Smart Client-Side Data Cache Engine for FarmShift
// Supports RAM (Map) + sessionStorage, in-flight deduplication, and cross-module invalidation matrix.

export const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const STORAGE_PREFIX = 'farmshift_cache:';

export const INVALIDATION_MATRIX = {
  '/employees': [
    '/employees',
    '/users',
    '/user/profile',
    '/account',
    '/accounts',
    '/work-assignments',
    '/warehouse-responsibilities',
    '/barn-responsibilities'
  ],
  '/user/profile': [
    '/user/profile',
    '/employees',
    '/account'
  ],
  '/purchases': [
    '/purchases',
    '/inventory-items',
    '/inventory',
    '/warehouse-categories',
    '/warehouses',
    '/product-categories',
    '/product-types',
    '/products',
    '/measurement-units',
    '/units',
    '/suppliers',
    '/reports',
    '/dashboard'
  ],
  '/suppliers': [
    '/suppliers',
    '/purchases'
  ],
  '/purchase-tags': [
    '/purchase-tags',
    '/suppliers',
    '/purchases'
  ],
  '/internal-stock': [
    '/internal-stock',
    '/inventory-items',
    '/inventory',
    '/warehouse-categories',
    '/warehouses',
    '/product-categories',
    '/cycles',
    '/reports',
    '/dashboard'
  ],
  '/inventory-items': [
    '/inventory-items',
    '/inventory',
    '/warehouse-categories',
    '/warehouses',
    '/product-categories',
    '/product-types',
    '/products',
    '/measurement-units',
    '/units',
    '/brands',
    '/purchases',
    '/internal-stock',
    '/reports',
    '/dashboard'
  ],
  '/warehouse-categories': [
    '/warehouse-categories',
    '/warehouses',
    '/warehouse-responsibilities',
    '/inventory-items',
    '/inventory',
    '/internal-stock',
    '/purchases'
  ],
  '/warehouses': [
    '/warehouse-categories',
    '/warehouses',
    '/warehouse-responsibilities',
    '/inventory-items',
    '/inventory',
    '/internal-stock',
    '/purchases'
  ],
  '/product-categories': [
    '/product-categories',
    '/inventory-items',
    '/inventory',
    '/purchases',
    '/internal-stock'
  ],
  '/product-types': [
    '/product-types',
    '/product-categories',
    '/suppliers',
    '/purchases'
  ],
  '/measurement-units': [
    '/measurement-units',
    '/inventory-items',
    '/purchases'
  ],
  '/brands': [
    '/brands',
    '/inventory-items',
    '/purchases'
  ],
  '/barns': [
    '/barn-responsibilities',
    '/warehouse-responsibilities',
    '/work-assignments',
    '/daily-plan',
    '/barns',
    '/farm-areas',
    '/areas',
    '/cycles',
    '/flocks',
    '/journal',
    '/today-tasks',
    '/daily-plans',
    '/dashboard',
    '/reports'
  ],
  '/farm-areas': [
    '/farm-areas',
    '/areas',
    '/barns',
    '/warehouse-categories',
    '/warehouses',
    '/warehouse-responsibilities',
    '/inventory-items',
    '/inventory',
    '/today-tasks',
    '/daily-plans',
    '/daily-plan',
    '/barn-responsibilities',
    '/work-assignments',
    '/dashboard'
  ],
  '/areas': [
    '/farm-areas',
    '/areas',
    '/barns',
    '/warehouse-categories',
    '/warehouses',
    '/warehouse-responsibilities',
    '/inventory-items',
    '/inventory',
    '/today-tasks',
    '/daily-plans',
    '/daily-plan',
    '/barn-responsibilities',
    '/work-assignments',
    '/dashboard'
  ],
  '/cycles': [
    '/daily-plan',
    '/inventory-items',
    '/inventory',
    '/cycles',
    '/barns',
    '/flocks',
    '/journal',
    '/today-tasks',
    '/daily-plans',
    '/dashboard',
    '/reports'
  ],
  '/flocks': [
    '/flocks',
    '/cycles',
    '/barns',
    '/journal',
    '/today-tasks',
    '/daily-plans',
    '/dashboard',
    '/reports'
  ],
  '/journal': [
    '/journal',
    '/today-tasks',
    '/daily-plans',
    '/inventory-items',
    '/inventory',
    '/barns',
    '/cycles',
    '/reports',
    '/dashboard'
  ],
  '/today-tasks': [
    '/today-tasks',
    '/journal',
    '/daily-plans',
    '/inventory-items',
    '/inventory',
    '/barns',
    '/cycles',
    '/reports',
    '/dashboard'
  ],
  '/daily-plans': [
    '/daily-plans',
    '/today-tasks',
    '/journal',
    '/inventory-items',
    '/inventory',
    '/barns',
    '/cycles',
    '/reports',
    '/dashboard'
  ],
  '/sales-orders': [
    '/sales-orders',
    '/sales',
    '/customer-contacts',
    '/customers',
    '/barns',
    '/cycles',
    '/reports',
    '/dashboard'
  ],
  '/sales': [
    '/sales-orders',
    '/sales',
    '/customer-contacts',
    '/customers',
    '/barns',
    '/cycles',
    '/reports',
    '/dashboard'
  ],
  '/customer-contacts': [
    '/customer-contacts',
    '/customers',
    '/sales-orders',
    '/sales'
  ],
  '/customers': [
    '/customer-contacts',
    '/customers',
    '/sales-orders',
    '/sales'
  ],
  '/reports': [
    '/reports',
    '/dashboard'
  ],
  '/dashboard': [
    '/dashboard'
  ],
  '/users': [
    '/users',
    '/employees',
    '/accounts',
    '/work-assignments'
  ],
  '/work-tasks': [
    '/work-tasks',
    '/work-assignments',
    '/daily-plan',
    '/daily-plans',
    '/today-tasks'
  ],
  '/work-assignments': [
    '/work-assignments',
    '/warehouse-responsibilities',
    '/daily-plans',
    '/today-tasks'
  ],
  '/warehouse-responsibilities': [
    '/warehouse-responsibilities',
    '/warehouse-categories',
    '/warehouses'
  ],
  '/farm': [
    '/farm'
  ]
};

export const normalizeCacheKey = (key) => {
  if (!key) return '';
  let str = String(key).trim();
  if (!str.startsWith('/')) str = '/' + str;
  if (!str.startsWith('/api/') && str !== '/api') {
    str = '/api' + str;
  }
  return str;
};

export const buildCacheKey = (url, params) => {
  if (!params || typeof params !== 'object' || Object.keys(params).length === 0) {
    return url;
  }
  const searchParams = new URLSearchParams();
  Object.keys(params)
    .sort()
    .forEach((k) => {
      const val = params[k];
      if (val !== undefined && val !== null && val !== '') {
        searchParams.append(k, String(val));
      }
    });
  const qs = searchParams.toString();
  return qs ? `${url}?${qs}` : url;
};

export const shouldSkipCache = (url, config = {}) => {
  if (!url) return true;
  if (config.skipCache === true) return true;
  const lowerUrl = String(url).toLowerCase();
  if (lowerUrl.includes('/auth/')) return true;
  if (lowerUrl.includes('/ai/') || lowerUrl.includes('/voice/')) return true;
  if (lowerUrl.includes('/files/upload') || lowerUrl.includes('/export')) return true;
  if (config.responseType === 'blob' || config.responseType === 'arraybuffer') return true;
  return false;
};

export const getPersistedTab = (key, defaultTab) => {
  if (typeof window === 'undefined') return defaultTab;
  if (typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || process.env?.VITEST)) {
    return defaultTab;
  }
  try {
    return window.sessionStorage?.getItem(key) || defaultTab;
  } catch {
    return defaultTab;
  }
};

export const setPersistedTab = (key, tab) => {
  if (typeof window === 'undefined') return;
  if (typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || process.env?.VITEST)) {
    return;
  }
  try {
    window.sessionStorage?.setItem(key, tab);
  } catch {}
};

export class DataCache {
  constructor(options = {}) {
    this.memoryCache = new Map();
    this.inFlightPromises = new Map();
    this.currentScope = null;
    if (options.attachListeners !== false) {
      this.initGlobalListeners();
    }
  }

  getUserScope() {
    if (this.currentScope) return this.currentScope;
    try {
      if (typeof window === 'undefined') return 'anonymous';
      const token = window.localStorage?.getItem('token') || window.sessionStorage?.getItem('token');
      if (!token) return 'anonymous';
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        return payload.sub || payload.email || token.slice(0, 16);
      }
      return token.slice(0, 16);
    } catch {
      return 'anonymous';
    }
  }

  setUserScope(scope) {
    if (this.currentScope && this.currentScope !== scope) {
      this.clearAll();
    }
    this.currentScope = scope;
  }

  getEntry(key) {
    const normalized = normalizeCacheKey(key);
    const now = Date.now();
    const currentScope = this.getUserScope();

    // 1. Check RAM
    if (this.memoryCache.has(normalized)) {
      const entry = this.memoryCache.get(normalized);
      if (entry.userScope && entry.userScope !== currentScope) {
        this.memoryCache.delete(normalized);
        return null;
      }
      if (now - entry.timestamp < entry.ttl) {
        return entry;
      }
      this.memoryCache.delete(normalized);
    }

    // 2. Fallback to sessionStorage
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const raw = window.sessionStorage.getItem(STORAGE_PREFIX + normalized);
        if (raw) {
          const entry = JSON.parse(raw);
          if (entry.userScope && entry.userScope !== currentScope) {
            window.sessionStorage.removeItem(STORAGE_PREFIX + normalized);
            return null;
          }
          if (now - entry.timestamp < entry.ttl) {
            // Reconstruct Axios response format if marked
            if (entry.data && entry.data.__isAxios) {
              entry.data = {
                data: entry.data.data,
                status: entry.data.status,
                statusText: entry.data.statusText || 'OK',
                headers: {},
                config: {}
              };
            }
            this.memoryCache.set(normalized, entry);
            return entry;
          } else {
            window.sessionStorage.removeItem(STORAGE_PREFIX + normalized);
          }
        }
      }
    } catch {
      // Ignore JSON/Storage errors
    }

    return null;
  }

  get(key) {
    const entry = this.getEntry(key);
    return entry ? entry.data : null;
  }

  peek(key) {
    const entry = this.getEntry(key);
    if (!entry) return null;
    let raw = entry.data;
    if (raw && typeof raw === 'object' && 'data' in raw && 'status' in raw) {
      raw = raw.data;
    }
    if (raw && typeof raw === 'object' && 'success' in raw && 'data' in raw) {
      return raw.data;
    }
    return raw;
  }

  peekData(key) {
    return this.peek(key);
  }

  set(key, data, customTtl) {
    const normalized = normalizeCacheKey(key);
    const ttl = typeof customTtl === 'number' && customTtl > 0 ? customTtl : DEFAULT_TTL_MS;
    const entry = {
      data,
      timestamp: Date.now(),
      ttl,
      userScope: this.getUserScope()
    };

    this.memoryCache.set(normalized, entry);

    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const payloadToStore = (data && typeof data === 'object' && 'data' in data && 'status' in data)
          ? { __isAxios: true, data: data.data, status: data.status, statusText: data.statusText }
          : data;
        const storageItem = {
          data: payloadToStore,
          timestamp: entry.timestamp,
          ttl: entry.ttl,
          userScope: entry.userScope
        };
        window.sessionStorage.setItem(STORAGE_PREFIX + normalized, JSON.stringify(storageItem));
      }
    } catch {
      // Ignore quota or circular structure errors
    }
  }

  delete(key) {
    const normalized = normalizeCacheKey(key);
    this.memoryCache.delete(normalized);
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem(STORAGE_PREFIX + normalized);
      }
    } catch {
      // Ignore
    }
  }

  invalidateByPrefix(prefixes) {
    const list = (Array.isArray(prefixes) ? prefixes : [prefixes])
      .filter(Boolean)
      .map(p => normalizeCacheKey(p));

    if (list.length === 0) return;

    // Delete in RAM
    for (const k of this.memoryCache.keys()) {
      if (list.some(prefix => k.startsWith(prefix) || k.startsWith(prefix.replace(/^\/api/, '')))) {
        this.memoryCache.delete(k);
      }
    }

    // Delete in sessionStorage
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const keysToRemove = [];
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const itemKey = window.sessionStorage.key(i);
          if (itemKey && itemKey.startsWith(STORAGE_PREFIX)) {
            const rawKey = itemKey.slice(STORAGE_PREFIX.length);
            if (list.some(prefix => rawKey.startsWith(prefix) || rawKey.startsWith(prefix.replace(/^\/api/, '')))) {
              keysToRemove.push(itemKey);
            }
          }
        }
        keysToRemove.forEach(k => window.sessionStorage.removeItem(k));
      }
    } catch {
      // Ignore
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('farmshift:cache-invalidated', { detail: { prefixes } }));
    }
  }

  invalidateForMutation(url) {
    if (!url) return;
    const cleanUrl = String(url).split('?')[0].replace(/^\/api/, '');
    const matchedPrefixes = new Set();

    for (const [triggerPrefix, targets] of Object.entries(INVALIDATION_MATRIX)) {
      const cleanTrigger = triggerPrefix.replace(/^\/api/, '');
      if (cleanUrl === cleanTrigger || cleanUrl.startsWith(cleanTrigger + '/') || cleanUrl.startsWith(cleanTrigger)) {
        targets.forEach(t => matchedPrefixes.add(t));
      }
    }

    if (matchedPrefixes.size === 0) {
      // Fallback: invalidate the base resource
      const segments = cleanUrl.split('/').filter(Boolean);
      if (segments.length > 0) {
        matchedPrefixes.add('/' + segments[0]);
      }
    }

    if (matchedPrefixes.size > 0) {
      this.invalidateByPrefix([...matchedPrefixes]);
    }
  }

  invalidateAllFarmData() {
    this.invalidateByPrefix([
      '/purchases',
      '/inventory-items',
      '/inventory',
      '/warehouse-categories',
      '/warehouses',
      '/warehouse-responsibilities',
      '/suppliers',
      '/purchase-tags',
      '/internal-stock',
      '/barns',
      '/barn-responsibilities',
      '/work-assignments',
      '/farm-areas',
      '/areas',
      '/cycles',
      '/flocks',
      '/daily-plans',
      '/journal',
      '/today-tasks',
      '/sales-orders',
      '/sales',
      '/customer-contacts',
      '/customers',
      '/reports',
      '/dashboard'
    ]);
  }

  clearAll() {
    this.memoryCache.clear();
    this.inFlightPromises.clear();
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const keysToRemove = [];
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const itemKey = window.sessionStorage.key(i);
          if (itemKey && itemKey.startsWith(STORAGE_PREFIX)) {
            keysToRemove.push(itemKey);
          }
        }
        keysToRemove.forEach(k => window.sessionStorage.removeItem(k));
      }
    } catch {
      // Ignore
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('farmshift:cache-cleared'));
    }
  }

  async fetchWithCache(key, fetcherFn, options = {}) {
    const { forceRefresh = false, ttl = DEFAULT_TTL_MS } = options;
    const normalized = normalizeCacheKey(key);

    if (!forceRefresh) {
      const cached = this.get(normalized);
      if (cached !== null) {
        return cached;
      }
      if (this.inFlightPromises.has(normalized)) {
        return this.inFlightPromises.get(normalized);
      }
    }

    const promise = (async () => {
      try {
        const result = await fetcherFn();
        this.set(normalized, result, ttl);
        return result;
      } finally {
        this.inFlightPromises.delete(normalized);
      }
    })();

    this.inFlightPromises.set(normalized, promise);
    return promise;
  }

  initGlobalListeners() {
    if (typeof window === 'undefined') return;

    this.aiActionListener = (event) => {
      const detail = event?.detail;
      if (!detail) return;
      const isNavigation = Boolean(detail.actionType && (detail.actionType.startsWith('NAVIGATE') || detail.actionType === 'NONE'));
      const isMutation = (detail.executed || (detail.actionType && !isNavigation)) && !isNavigation;
      if (isMutation) {
        this.invalidateAllFarmData();
      }
    };

    this.unauthorizedListener = () => {
      this.clearAll();
    };

    window.addEventListener('farmshift:ai-action', this.aiActionListener);
    window.addEventListener('unauthorized', this.unauthorizedListener);
  }

  destroy() {
    if (typeof window !== 'undefined') {
      if (this.aiActionListener) window.removeEventListener('farmshift:ai-action', this.aiActionListener);
      if (this.unauthorizedListener) window.removeEventListener('unauthorized', this.unauthorizedListener);
    }
    this.clearAll();
  }
}

export const dataCache = new DataCache();
