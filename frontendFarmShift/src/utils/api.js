// d:\Smart-Farm-Management-System\frontendFarmShift\src\utils\api.js
import axios from 'axios';
import { getAuthToken, clearAuthToken } from './authStorage';
import { dataCache, buildCacheKey, shouldSkipCache } from '../services/dataCache';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach JWT token to every request
api.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle mutations and 401s globally
api.interceptors.response.use(
  (response) => {
    const method = response.config?.method?.toLowerCase();
    if (['post', 'put', 'patch', 'delete'].includes(method)) {
      dataCache.invalidateForMutation(response.config?.url);
    }
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear token and cache, force re-login if unauthorized
      clearAuthToken();
      dataCache.clearAll();
      // Dispatch event for AuthContext to catch and clear user state
      window.dispatchEvent(new Event('unauthorized'));
    }
    return Promise.reject(error);
  }
);

// Helper to guarantee standard AxiosResponse structure
const ensureAxiosResponse = (result, config = {}) => {
  if (result && typeof result === 'object' && 'data' in result && 'status' in result) {
    return result;
  }
  const isApiResponse = result && typeof result === 'object' && 'success' in result && 'data' in result;
  return {
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
    data: isApiResponse ? result : { success: true, data: result }
  };
};

// Wrap api.get with transparent caching & request deduplication
const originalGet = api.get.bind(api);
api.get = (url, config = {}) => {
  if (shouldSkipCache(url, config)) {
    return originalGet(url, config);
  }

  const { signal, forceRefresh, ttl, ...restConfig } = config;
  const cacheKey = buildCacheKey(url, restConfig.params);

  // Decouple background network fetch from caller's AbortSignal so React StrictMode or
  // debounced searches do not abort the background cached promise
  const cachePromise = dataCache
    .fetchWithCache(
      cacheKey,
      () => originalGet(url, restConfig),
      {
        forceRefresh: Boolean(forceRefresh),
        ttl
      }
    )
    .then((result) => ensureAxiosResponse(result, restConfig));

  if (!signal) {
    return cachePromise;
  }

  const createCancelError = () => {
    const err = new Error('canceled');
    err.name = 'CanceledError';
    err.code = 'ERR_CANCELED';
    return err;
  };

  if (signal.aborted) {
    return Promise.reject(createCancelError());
  }

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      reject(createCancelError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
    cachePromise
      .then((res) => {
        signal.removeEventListener('abort', onAbort);
        resolve(res);
      })
      .catch((err) => {
        signal.removeEventListener('abort', onAbort);
        reject(err);
      });
  });
};

api.uploadFile = async (file, folder = 'avatars') => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);
  const response = await api.post('/files/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data; // { success: true, data: { url: "..." } }
};
