import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../utils/api';
import { dataCache, DataCache } from '../services/dataCache';
import { getBarnResponsibilities, saveAreaWorkerAssignments, setAreaWorkers, setBarnWorkers, inheritAreaWorkers } from '../services/workAssignmentService';

const originalAdapter = api.defaults.adapter;

beforeEach(() => {
  dataCache.clearAll();
  sessionStorage.clear();
});

afterEach(() => {
  api.defaults.adapter = originalAdapter;
  dataCache.clearAll();
});

describe('responsibility cache after saving assignments', () => {
  it.each([
    ['area and barn assignments', () => saveAreaWorkerAssignments(10, { workerIds: [1], applyToAll: true, barns: [] })],
    ['area defaults', () => setAreaWorkers(10, [1])],
    ['barn override', () => setBarnWorkers(11, [1])],
    ['restore inheritance', () => inheritAreaWorkers(11)],
  ])('fetches the saved workers after %s', async (_name, save) => {
    let workers = [];
    const adapter = vi.fn(async config => {
      if (config.method !== 'get') workers = [{ id: 1, fullName: 'Nguyễn An' }];
      return { data: { success: true, data: { workers } }, status: 200, statusText: 'OK', headers: {}, config };
    });
    api.defaults.adapter = adapter;

    expect((await getBarnResponsibilities()).workers).toEqual([]);
    expect((await getBarnResponsibilities()).workers).toEqual([]);
    expect(adapter).toHaveBeenCalledTimes(1);
    dataCache.set('/work-assignments?date=2026-11-04', { workers: [] });
    dataCache.set('/daily-plan', { workers: [] });

    await save();

    // Both RAM and persisted cache must be cleared before the settings reload.
    expect(dataCache.get('/barn-responsibilities')).toBeNull();
    expect(new DataCache({ attachListeners: false }).get('/barn-responsibilities')).toBeNull();
    expect(dataCache.get('/work-assignments?date=2026-11-04')).toBeNull();
    expect(dataCache.get('/daily-plan')).toBeNull();
    expect((await getBarnResponsibilities()).workers).toEqual([{ id: 1, fullName: 'Nguyễn An' }]);
    expect(adapter).toHaveBeenCalledTimes(3);
  });
});
