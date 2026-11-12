// Browser transport for the same broker used by the ESP32 on TCP port 1883.
export const ESP32_BROKER_URL = 'wss://broker.emqx.io:8084/mqtt';
export const ESP32_TOPIC_PREFIX = 'quyquy/iotproject/esp32';
export const relayControlTopic = relay => {
  if (!Number.isInteger(relay) || relay < 1 || relay > 4) throw new Error('Relay phải từ 1 đến 4.');
  return `${ESP32_TOPIC_PREFIX}/relay${relay}/control`;
};
export const relayStatusTopics = [1, 2, 3, 4].map(relay => `${ESP32_TOPIC_PREFIX}/relay${relay}/status`);
export const deviceNameTopics = [
  ...[1, 2, 3].map(sensor => `${ESP32_TOPIC_PREFIX}/config/sensor${sensor}/name`),
  ...[1, 2, 3, 4].map(relay => `${ESP32_TOPIC_PREFIX}/config/relay${relay}/name`),
];

/** Explicit connection only. No commands or retained control messages on connect. */
export async function connectEsp32({ onConnection = () => {}, onMessage = () => {}, onError = () => {} } = {}) {
  const { default: mqtt } = await import('mqtt');
  const client = mqtt.connect(ESP32_BROKER_URL, {
    clientId: `farmshift_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`,
    clean: true,
    connectTimeout: 10000,
    reconnectPeriod: 3000,
    resubscribe: false,
    // Never replay queued control messages after reconnecting.
    queueQoSZero: false,
  });
  let closed = false;
  onConnection('connecting');
  client.on('connect', () => {
    if (closed) return;
    client.subscribe([...relayStatusTopics, ...deviceNameTopics], { qos: 0 }, error => {
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
      const topic = relayControlTopic(relay);
      return new Promise((resolve, reject) => client.publish(topic, payload, { qos: 0, retain: false }, error => error ? reject(error) : resolve()));
    },
    disconnect() {
      closed = true;
      client.removeAllListeners();
      client.end(true);
    },
  };
}
