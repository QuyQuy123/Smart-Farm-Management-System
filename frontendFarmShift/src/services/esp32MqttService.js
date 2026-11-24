import { api } from '../utils/api';

// Browser transport for the same broker used by the ESP32 on TCP port 1883.
export const ESP32_BROKER_URL = import.meta.env?.VITE_MQTT_BROKER_URL || 'wss://broker.emqx.io:8084/mqtt';
export const ESP32_TOPIC_PREFIX = import.meta.env?.VITE_MQTT_TOPIC_PREFIX || 'quyquy/iotproject/esp32';
export const relayControlTopic = (relay, prefix = ESP32_TOPIC_PREFIX) => {
  if (!Number.isInteger(relay) || relay < 1 || relay > 4) throw new Error('Relay phải từ 1 đến 4.');
  return `${prefix}/relay${relay}/control`;
};
export const relayStatusTopics = [1, 2, 3, 4].map(relay => `${ESP32_TOPIC_PREFIX}/relay${relay}/status`);
export const deviceNameTopics = [
  ...[1, 2, 3].map(sensor => `${ESP32_TOPIC_PREFIX}/config/sensor${sensor}/name`),
  ...[1, 2, 3, 4].map(relay => `${ESP32_TOPIC_PREFIX}/config/relay${relay}/name`),
];

/** Explicit connection only. No commands or retained control messages on connect. */
export async function connectEsp32({
  topicPrefix = ESP32_TOPIC_PREFIX,
  onConnection = () => {},
  onMessage = () => {},
  onError = () => {},
} = {}) {
  const { default: mqtt } = await import('mqtt');
  const effectivePrefix = topicPrefix || ESP32_TOPIC_PREFIX;
  const username = import.meta.env?.VITE_MQTT_USERNAME || undefined;
  const password = import.meta.env?.VITE_MQTT_PASSWORD || undefined;
  const client = mqtt.connect(ESP32_BROKER_URL, {
    clientId: `farmshift_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`,
    clean: true,
    connectTimeout: 10000,
    reconnectPeriod: 3000,
    resubscribe: false,
    // Never replay queued control messages after reconnecting.
    queueQoSZero: false,
    ...(username ? { username } : {}),
    ...(password ? { password } : {}),
  });
  let closed = false;
  onConnection('connecting');
  client.on('connect', () => {
    if (closed) return;
    const sensors = [1, 2, 3].flatMap(channel => ['temp', 'humi'].map(metric => `${effectivePrefix}/${metric}${channel}`));
    const relStatuses = [1, 2, 3, 4].map(relay => `${effectivePrefix}/relay${relay}/status`);
    const devNames = [
      ...[1, 2, 3].map(sensor => `${effectivePrefix}/config/sensor${sensor}/name`),
      ...[1, 2, 3, 4].map(relay => `${effectivePrefix}/config/relay${relay}/name`),
    ];
    client.subscribe([...relStatuses, ...devNames, ...sensors], { qos: 0 }, error => {
      if (closed) return;
      if (error) { onConnection('error'); onError(error.message); }
      else onConnection('connected');
    });
  });
  client.on('message', (topic, payload, packet) => {
    if (!closed) onMessage({ topic, payload: payload.toString(), retained: Boolean(packet?.retain), receivedAt: new Date().toISOString() });
  });
  client.on('reconnect', () => { if (!closed) onConnection('connecting'); });
  client.on('offline', () => { if (!closed) onConnection('disconnected'); });
  client.on('close', () => { if (!closed) onConnection('disconnected'); });
  client.on('error', error => { if (!closed) onError(error.message); });
  return {
    // The firmware's actual ON/OFF payload must be supplied by the caller.
    publishRelay(relay, payload) {
      if (closed || !client.connected) return Promise.reject(new Error('MQTT chưa kết nối.'));
      if (typeof payload !== 'string' || !payload.length) return Promise.reject(new Error('Thiếu payload điều khiển.'));
      const topic = relayControlTopic(relay, effectivePrefix);
      return new Promise((resolve, reject) => client.publish(topic, payload, { qos: 0, retain: false }, error => error ? reject(error) : resolve()));
    },
    disconnect() {
      closed = true;
      client.removeAllListeners();
      client.end(true);
    },
  };
}

export async function syncIotTelemetrySnapshot(payload) {
  if (!payload || !payload.barnId) return null;
  try {
    const res = await api.post('/iot/telemetry', payload);
    return res?.data ?? null;
  } catch {
    return null;
  }
}
