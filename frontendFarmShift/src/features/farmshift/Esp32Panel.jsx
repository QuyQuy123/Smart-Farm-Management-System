import { useEffect, useRef, useState } from 'react';
import { connectEsp32, ESP32_TOPIC_PREFIX } from '../../services/esp32MqttService';
import styles from './IotView.module.css';

const channels = [1, 2, 3, 4];
const labels = ['Quạt', 'Đèn', 'Phun nước', 'Thiết bị khác'];

export function Esp32Panel({ active, onActiveChange }) {
  const connection = useRef(null);
  const [status, setStatus] = useState('connecting');
  const [messages, setMessages] = useState({});
  const [assignments, setAssignments] = useState(labels);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    connectEsp32({
      onConnection: value => {
        if (cancelled) return;
        setStatus(value);
        if (value !== 'connected') setMessages({});
        else setError('');
      },
      onMessage: ({ topic, payload }) => {
        if (!cancelled) setMessages(current => ({ ...current, [topic]: payload.trim() }));
      },
      onError: message => { if (!cancelled) setError(message); },
    }).then(client => {
      if (cancelled) client.disconnect();
      else connection.current = client;
    }).catch(cause => {
      if (!cancelled) { setStatus('error'); setError(cause.message); }
    });
    return () => {
      cancelled = true;
      connection.current?.disconnect();
      connection.current = null;
    };
  }, [active]);

  const read = suffix => messages[`${ESP32_TOPIC_PREFIX}/${suffix}`];
  const send = async (channel, enabled) => {
    try {
      setError('');
      await connection.current.publishRelay(channel, enabled ? '1' : '0');
    } catch (cause) { setError(cause.message); }
  };
  const reading = (suffix, unit) => {
    const value = read(suffix);
    return value && Number.isFinite(Number(value)) ? `${value} ${unit}` : '—';
  };

  return <section className={styles.environment} aria-label="ESP32 dùng chung">
    <header className={styles.environmentHeading}>
      <div><h3>ESP32 dùng chung</h3><p>Các chuồng sử dụng cùng cảm biến và relay.</p></div>
      <button type="button" className="farmshift-btn farmshift-btn-secondary" onClick={() => {
        setMessages({});
        setStatus('connecting');
        setError('');
        onActiveChange(!active);
      }}>{active ? 'Ngắt kết nối thiết bị phần cứng' : 'Kết nối thiết bị phần cứng'}</button>
    </header>
    {active && <>
      <p role="status">{status === 'connected' ? 'Đã kết nối thiết bị phần cứng' : status === 'connecting' ? 'Đang kết nối thiết bị phần cứng…' : 'Thiết bị phần cứng mất kết nối'}</p>
      {error && <p role="alert">{error}</p>}
      <div className={styles.sensorGrid}>
        {channels.slice(0, 3).map(channel => <article key={channel} className={styles.device}>
          <h4>{read(`config/sensor${channel}/name`) || `Cảm biến ${channel}`}</h4>
          <p>Nhiệt độ {reading(`temp${channel}`, '°C')}</p>
          <p>Độ ẩm {reading(`humi${channel}`, '%')}</p>
        </article>)}
      </div>
      {channels.map((channel, index) => {
        const state = read(`relay${channel}/status`);
        const known = ['ON', 'OFF', '1', '0'].includes(state);
        const enabled = state === 'ON' || state === '1';
        return <article className={styles.device} key={channel}>
          <div className={styles.deviceTop}>
            <div className={styles.deviceInfo}>
              <h4>{read(`config/relay${channel}/name`) || `Relay ${channel}`}</h4>
              <p>{known ? (enabled ? 'Đang bật' : 'Đang tắt') : 'Chưa nhận trạng thái ESP32'}</p>
            </div>
            {known ? <button type="button" role="switch" aria-label={`Bật tắt relay ${channel}`} aria-checked={enabled}
              className={styles.toggle} disabled={status !== 'connected'} onClick={() => send(channel, !enabled)}><span /></button>
              : <div>
                <button type="button" className="farmshift-btn farmshift-btn-secondary" disabled={status !== 'connected'} onClick={() => send(channel, true)}>Bật</button>
                <button type="button" className="farmshift-btn farmshift-btn-secondary" disabled={status !== 'connected'} onClick={() => send(channel, false)}>Tắt</button>
              </div>}
          </div>
          <select className="farmshift-form-control" aria-label={`Thiết bị của relay ${channel}`} value={assignments[index]}
            onChange={event => {
              const value = event.target.value;
              setAssignments(current => current.map((label, slot) => slot === index ? value : label));
            }}>{labels.map(label => <option key={label}>{label}</option>)}</select>
        </article>;
      })}
    </>}
  </section>;
}
