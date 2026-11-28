import { connectEsp32, ESP32_TOPIC_PREFIX, relayStatusTopics } from './esp32MqttService';

export const IOT_HISTORY_TTL = 60 * 60 * 1000;
const CACHE_KEY = `farmshift-iot-hour:${ESP32_TOPIC_PREFIX}`;
const listeners = new Set();
let client;
let pending;
let timer;
let generation = 0;
let latest = {};
let snapshot = { connection: 'disconnected', readings: {}, relayStates: {}, history: [], error: '' };

const recent = (points, now) => points.filter(point => point && ['temp1', 'temp3'].includes(point.sensor)
  && Number.isFinite(point.time) && Number.isFinite(point.value)
  && point.time >= now - IOT_HISTORY_TTL && point.time <= now);

function update(values) {
  snapshot = { ...snapshot, ...values };
  listeners.forEach(listener => listener());
}

function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
    return Array.isArray(saved) ? recent(saved, Date.now()) : [];
  } catch { return []; }
}

function refresh() {
  const now = Date.now();
  const readings = Object.fromEntries(Object.entries(latest)
    .filter(([, point]) => now - point.time <= 15000).map(([sensor, point]) => [sensor, point.value]));
  const history = recent(snapshot.history, now);
  for (const sensor of ['temp1', 'temp3']) {
    const point = latest[sensor];
    const last = history.findLast(item => item.sensor === sensor);
    if (point && !point.retained && now - point.time <= 15000 && (!last || point.time > last.time)) {
      history.push({ sensor, time: point.time, value: point.value });
    }
  }
  update({ readings, history });
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(history)); } catch { /* Keep the in-memory cache available. */ }
}

export function startIotSession() {
  if (pending) return pending;
  const current = ++generation;
  update({ history: restore(), error: '' });
  timer = setInterval(refresh, 3000);
  pending = connectEsp32({
    onConnection(connection) {
      if (current !== generation) return;
      if (connection !== 'connected') latest = {};
      update({ connection, ...(connection === 'connected' ? { error: '' } : { readings: {}, relayStates: {} }) });
    },
    onMessage({ topic, payload, retained }) {
      if (current !== generation) return;
      const sensor = ['temp1', 'humi1', 'temp3', 'humi3'].find(key => topic === `${ESP32_TOPIC_PREFIX}/${key}`);
      const value = payload.trim();
      if (sensor && value && Number.isFinite(Number(value))) {
        latest[sensor] = { value: Number(value), time: Date.now(), retained: Boolean(retained) };
      }
      const relay = relayStatusTopics.indexOf(topic) + 1;
      if (relay && ['ON', 'OFF'].includes(value)) update({ relayStates: { ...snapshot.relayStates, [relay]: value === 'ON' } });
    },
    onError() {
      if (current === generation) update({ error: 'Không thể kết nối thiết bị phần cứng.' });
    },
  }).then(connected => {
    if (current !== generation) connected.disconnect();
    else client = connected;
  }).catch(() => {
    if (current !== generation) return;
    clearInterval(timer);
    pending = null;
    update({ connection: 'disconnected', error: 'Không thể khởi tạo kết nối thiết bị phần cứng.' });
  });
  return pending;
}

export function stopIotSession() {
  generation++;
  clearInterval(timer);
  client?.disconnect();
  client = null;
  pending = null;
  latest = {};
  update({ connection: 'disconnected', readings: {}, relayStates: {}, history: [], error: '' });
}

export const subscribeIotSession = listener => { listeners.add(listener); return () => listeners.delete(listener); };
export const getIotSnapshot = () => snapshot;
export const getLatestIotReadings = () => latest;
export function publishIotRelay(relay, payload) {
  if (!client || snapshot.connection !== 'connected') return Promise.reject(new Error('MQTT chưa kết nối.'));
  return client.publishRelay(relay, payload);
}
