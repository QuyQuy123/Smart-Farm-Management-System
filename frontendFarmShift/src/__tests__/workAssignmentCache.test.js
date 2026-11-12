import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../utils/api';
import { dataCache, DataCache } from '../services/dataCache';
import { getBarnResponsibilities, saveAreaWorkerAssignments, setAreaWorkers, setBarnWorkers, inheritAreaWorkers } from '../services/workAssignmentService';
import { getWorkBoard, createWorkTask, updateWorkTask, deleteWorkTask, checkWorkTask, uncheckWorkTask } from '../services/workAssignmentService';

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

describe('work board cache after task changes', () => {
  it.each([
    ['create', () => createWorkTask({ barnId: 11, title: 'Rửa máng uống' })],
    ['update', () => updateWorkTask(31, { title: 'Kiểm tra quạt' })],
    ['delete', () => deleteWorkTask(31)],
    ['check', () => checkWorkTask(31, '2026-11-12', '')],
    ['uncheck', () => uncheckWorkTask(31, '2026-11-12')],
  ])('reloads saved tasks after %s instead of reusing stale board data', async (_name, mutate) => {
    let tasks = [];
    const adapter = vi.fn(async config => {
      if (config.method !== 'get') tasks = [{ id: 31, title: 'Việc đã cập nhật' }];
      return { data: { success: true, data: { tasks } }, status: 200, statusText: 'OK', headers: {}, config };
    });
    api.defaults.adapter = adapter;
    const date = '2026-11-12';
    expect((await getWorkBoard(date)).tasks).toEqual([]);
    expect((await getWorkBoard(date)).tasks).toEqual([]);
    expect(adapter).toHaveBeenCalledTimes(1);
    const relatedKeys = ['/work-assignments?date=2026-11-13', '/daily-plan?date=' + date, '/daily-plans/farm?date=' + date];
    relatedKeys.forEach(key => dataCache.set(key, { tasks: [] }));

    await mutate();

    const persisted = new DataCache({ attachListeners: false });
    for (const key of ['/work-assignments?date=' + date, ...relatedKeys]) {
      expect(dataCache.get(key)).toBeNull();
      expect(persisted.get(key)).toBeNull();
    }
    expect((await getWorkBoard(date)).tasks).toEqual([{ id: 31, title: 'Việc đã cập nhật' }]);
    expect(adapter).toHaveBeenCalledTimes(3);
  });
});
