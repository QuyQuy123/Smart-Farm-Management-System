import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { connectEsp32, ESP32_TOPIC_PREFIX } from '../services/esp32MqttService';
import { getIotSnapshot, startIotSession, stopIotSession } from '../services/iotSession';

vi.mock('../services/esp32MqttService', () => ({
  connectEsp32: vi.fn(), ESP32_TOPIC_PREFIX: 'test/esp32',
  relayStatusTopics: [1, 2, 3, 4].map(relay => `test/esp32/relay${relay}/status`),
}));
let callbacks;
const send = (sensor, value, retained = false) => callbacks.onMessage({
  topic: `${ESP32_TOPIC_PREFIX}/${sensor}`, payload: String(value), retained,
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-28T10:00:00Z'));
  localStorage.clear();
  connectEsp32.mockReset();
  connectEsp32.mockImplementation(async options => {
    callbacks = options;
    options.onConnection('connected');
    return { disconnect: vi.fn() };
  });
});
afterEach(() => { stopIotSession(); vi.useRealTimers(); });

it('shares a connection and restores only the last hour after restarting', async () => {
  await startIotSession();
  await startIotSession();
  expect(connectEsp32).toHaveBeenCalledTimes(1);
  send('temp1', 30);
  send('temp3', 32);
  vi.advanceTimersByTime(3000);
  expect(getIotSnapshot().history).toHaveLength(2);
  stopIotSession();
  vi.advanceTimersByTime(30 * 60 * 1000);
  await startIotSession();
  expect(getIotSnapshot().history).toHaveLength(2);
  expect(getIotSnapshot().readings).toEqual({});
  send('temp1', 35);
  vi.advanceTimersByTime(3000);
  expect(getIotSnapshot().history).toHaveLength(3);
  vi.advanceTimersByTime(31 * 60 * 1000);
  expect(getIotSnapshot().history).toHaveLength(1);
  stopIotSession();
  await startIotSession();
  expect(getIotSnapshot().history.map(point => point.value)).toEqual([35]);
});

it('does not turn retained, duplicate or stale readings into new history', async () => {
  await startIotSession();
  send('temp1', 40, true);
  vi.advanceTimersByTime(3000);
  expect(getIotSnapshot().history).toEqual([]);
  send('temp1', 31);
  send('temp3', 'invalid');
  vi.advanceTimersByTime(3000);
  vi.advanceTimersByTime(3000);
  expect(getIotSnapshot().history).toHaveLength(1);
  callbacks.onConnection('disconnected');
  expect(getIotSnapshot().readings).toEqual({});
  expect(getIotSnapshot().history).toHaveLength(1);
  vi.advanceTimersByTime(61 * 60 * 1000);
  expect(getIotSnapshot().history).toEqual([]);
});

it('keeps recording if browser storage is unavailable', async () => {
  const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  try {
    await startIotSession();
    send('temp1', 29);
    vi.advanceTimersByTime(3000);
    expect(getIotSnapshot().history[0].value).toBe(29);
  } finally { storage.mockRestore(); }
});
