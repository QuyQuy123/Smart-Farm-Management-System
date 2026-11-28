import { useEffect, useState } from 'react';
import { Droplets, Thermometer, TrendingUp } from 'lucide-react';
import styles from './IotView.module.css';

const COLORS = { temp1: '#c77421', temp3: '#008577' };
const AVERAGE_COLORS = { average: '#5265b8' };
const seriesLabel = sensor => sensor === 'average' ? 'Trung bình hai cảm biến' : `Cảm biến ${sensor.slice(-1)}`;

function averageTemperatures(points) {
  const first = points.filter(point => point.sensor === 'temp1').sort((a, b) => a.time - b.time);
  const third = points.filter(point => point.sensor === 'temp3').sort((a, b) => a.time - b.time);
  const average = [];
  let index = 0;
  for (const reading of first) {
    while (index < third.length && third[index].time < reading.time - 1000) index++;
    const other = third[index];
    if (!other || other.time > reading.time + 1000) continue;
    average.push({ sensor: 'average', time: Math.max(reading.time, other.time), value: (reading.value + other.value) / 2 });
    index++;
  }
  return average;
}
const dateLabel = time => new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short', timeStyle: 'medium', timeZone: 'Asia/Bangkok',
}).format(time);

export function IotEnvironment({ barnName, readings = {}, connected = false, history = [], liveHistory = [] }) {
  const [range, setRange] = useState('live');
  const [display, setDisplay] = useState('sensors');
  const [clock, setClock] = useState(Date.now);
  const [selected, setSelected] = useState(null);
  const live = range === 'live';
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 3000);
    return () => clearInterval(timer);
  }, []);
  const duration = live ? 60_000 : 60 * 60 * 1000;
  const end = live ? Math.max(clock, liveHistory.at(-1)?.time ?? clock) : clock;
  const start = end - duration;
  const recent = (live ? liveHistory : history).filter(point => point.time >= start && point.time <= end);
  const isAverage = display === 'average';
  const visible = isAverage ? averageTemperatures(recent) : recent;
  const colors = isAverage ? AVERAGE_COLORS : COLORS;
  const values = visible.map(point => point.value);
  const low = Math.floor(Math.min(...values)) - 1;
  const high = Math.ceil(Math.max(...values)) + 1;
  const x = time => 55 + (time - start) / duration * 610;
  const y = value => 190 - (value - low) / (high - low) * 155;
  return <section className={styles.environment} aria-label={`Môi trường ${barnName}`}>
    <header className={styles.environmentHeading}><div><h3>Môi trường chuồng nuôi</h3><p>Theo dõi nhiệt độ và độ ẩm · {barnName}</p></div><span className={styles.sensorStatus}>{!connected ? 'Thiết bị phần cứng chưa kết nối' : Object.keys(readings).length ? 'Đã nhận số đo' : 'Đang chờ số đo ESP32'}</span></header>
    <div className={styles.sensorGrid}>
      {[1, 3].flatMap(channel => [
        { key: `temp${channel}`, label: 'Nhiệt độ hiện tại', unit: '°C', Icon: Thermometer, color: styles.temperatureIcon },
        { key: `humi${channel}`, label: 'Độ ẩm hiện tại', unit: '%', Icon: Droplets, color: styles.humidityIcon },
      ].map(({ key, label, unit, Icon, color }) => <article key={key} className={styles.sensorCard}>
        <span className={color}><Icon size={23} /></span>
        <div><h4>{label} · Cảm biến {channel}</h4>
          <strong>{readings[key]?.toLocaleString('vi-VN') ?? '—'} <small>{unit}</small></strong>
          {readings[key] === undefined && <p>Chưa có dữ liệu</p>}
        </div>
      </article>))}
    </div>
    <div className={styles.chartPanel}>
      <header className={styles.chartHeading}><div><h4><TrendingUp size={18} />Diễn biến nhiệt độ</h4><p>Lưu số đo 1 giờ gần nhất trên trình duyệt này</p></div>
        <div className={styles.chartRanges} role="group" aria-label="Khoảng thời gian biểu đồ">
          <button type="button" aria-pressed={live} onClick={() => { setClock(Date.now()); setRange('live'); setSelected(null); }}>Trực tiếp</button>
          <button type="button" aria-pressed={range === 'hour'} onClick={() => { setClock(Date.now()); setRange('hour'); setSelected(null); }}>1 giờ gần nhất</button>
        </div></header>
      <div className={styles.chartRanges} role="group" aria-label="Dữ liệu biểu đồ nhiệt độ">
        <button type="button" aria-pressed={!isAverage} onClick={() => { setDisplay('sensors'); setSelected(null); }}>Từng cảm biến</button>
        <button type="button" aria-pressed={isAverage} onClick={() => { setDisplay('average'); setSelected(null); }}>Nhiệt độ trung bình</button>
      </div>
      {visible.length ? <>
        <div className={styles.chartReadout} aria-live="polite">{selected
          ? `${seriesLabel(selected.sensor)} · ${dateLabel(selected.time)} · ${selected.value.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} °C`
          : 'Rê chuột hoặc chạm vào biểu đồ để xem số đo'}</div>
        <div className={styles.chartScroll}><svg viewBox="0 0 700 235" className={styles.temperatureChart}
          role="group" aria-label={`Biểu đồ nhiệt độ ${barnName}`}
          onPointerLeave={() => setSelected(null)}
          onPointerMove={event => {
            const bounds = event.currentTarget.getBoundingClientRect();
            const horizontal = (event.clientX - bounds.left) * 700 / bounds.width;
            const vertical = (event.clientY - bounds.top) * 235 / bounds.height;
            const distance = point => Math.hypot(x(point.time) - horizontal, y(point.value) - vertical);
            setSelected(visible.reduce((closest, point) => distance(point) < distance(closest) ? point : closest));
          }}>
          <text x="16" y="18">°C</text>
          {[0, 1, 2, 3, 4].map(index => {
            const level = low + (high - low) * index / 4;
            return <g key={index}><line x1="55" y1={y(level)} x2="665" y2={y(level)} stroke="#e6ece8" strokeDasharray="4 4" />
              <text x="10" y={y(level) + 4}>{level.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}</text></g>;
          })}
          {[0, 1, 2, 3, 4].map(index => {
            const time = start + index * duration / 4;
            const options = live ? { hour: '2-digit', minute: '2-digit', second: '2-digit' }
              : { hour: '2-digit', minute: '2-digit' };
            return <text key={index} x={x(time)} y="220" textAnchor="middle">{new Intl.DateTimeFormat('vi-VN', { ...options, timeZone: 'Asia/Bangkok' }).format(time)}</text>;
          })}
          {Object.entries(colors).map(([sensor, color]) => {
            const samples = visible.filter(point => point.sensor === sensor).sort((a, b) => a.time - b.time);
            return <g key={sensor}>
              <polyline points={samples.map(point => `${x(point.time)},${y(point.value)}`).join(' ')} fill="none" stroke={color} strokeWidth="2.5" />
              {samples.map(point => <circle key={point.time} cx={x(point.time)} cy={y(point.value)} r={selected === point ? 6 : 2.5}
                fill={color} onClick={() => setSelected(point)} />)}
            </g>;
          })}
        </svg></div>
        <footer className={styles.chartFooter}>{Object.entries(colors).map(([sensor, color]) =>
          <span key={sensor}><i style={{ background: color }} />{seriesLabel(sensor)}</span>)}</footer>
      </> : <div className={styles.chartEmpty}><Thermometer size={30} strokeWidth={1.4} />
        <strong>{isAverage ? 'Chưa đủ số đo để tính trung bình' : 'Chưa có lịch sử nhiệt độ'}</strong>
        <p>{isAverage ? 'Cần số đo của cả hai cảm biến trong vòng 1 giây.' : 'Biểu đồ ghi số đo khi ứng dụng đang mở và kết nối thiết bị.'}</p>
      </div>}
    </div>
  </section>;
}

