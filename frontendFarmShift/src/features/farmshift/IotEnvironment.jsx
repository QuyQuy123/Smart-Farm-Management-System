import { useId, useState } from 'react';
import { Droplets, Thermometer, TrendingUp } from 'lucide-react';
import styles from './IotView.module.css';

const SERIES = {
  day: { labels: ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00'], values: [25.2, 24.6, 25.1, 27.3, 29.4, 30.1, 28.2, 26.5] },
  week: { labels: ['Ngày 1', 'Ngày 2', 'Ngày 3', 'Ngày 4', 'Ngày 5', 'Ngày 6', 'Ngày 7'], values: [26.8, 27.5, 28.1, 27.2, 29.1, 28.4, 27.6] },
};

export function IotEnvironment({ barnName }) {
  const [range, setRange] = useState('day');
  const [preview, setPreview] = useState(false);
  const [selected, setSelected] = useState(null);
  const gradientId = useId();
  const series = SERIES[range];
  const x = index => 55 + index * 610 / (series.values.length - 1);
  const y = value => 190 - (value - 20) * 11;
  const points = series.values.map((value, index) => `${x(index)},${y(value)}`).join(' ');
  return <section className={styles.environment} aria-label={`Môi trường ${barnName}`}>
    <header className={styles.environmentHeading}><div><h3>Môi trường chuồng nuôi</h3><p>Theo dõi nhiệt độ và độ ẩm · {barnName}</p></div><span className={styles.sensorStatus}>Cảm biến chưa kết nối</span></header>
    <div className={styles.sensorGrid}>
      <article className={styles.sensorCard}><span className={styles.temperatureIcon}><Thermometer size={23} /></span><div><h4>Nhiệt độ hiện tại</h4><strong>— <small>°C</small></strong><p>Chưa có dữ liệu</p></div></article>
      <article className={styles.sensorCard}><span className={styles.humidityIcon}><Droplets size={23} /></span><div><h4>Độ ẩm hiện tại</h4><strong>— <small>%</small></strong><p>Chưa có dữ liệu</p></div></article>
    </div>
    <div className={styles.chartPanel}>
      <header className={styles.chartHeading}><div><h4><TrendingUp size={18} />Diễn biến nhiệt độ</h4><p>{preview ? 'Dữ liệu minh họa · Không phải số đo từ cảm biến' : 'Lịch sử nhiệt độ theo thời gian'}</p></div>
        <div className={styles.chartRanges} role="group" aria-label="Khoảng thời gian biểu đồ">
          <button type="button" aria-pressed={range === 'day'} onClick={() => { setRange('day'); setSelected(null); }}>24 giờ</button>
          <button type="button" aria-pressed={range === 'week'} onClick={() => { setRange('week'); setSelected(null); }}>7 ngày</button>
        </div></header>
      {preview ? <>
        <div className={styles.chartReadout} aria-live="polite">{selected === null ? 'Chọn điểm trên biểu đồ để xem nhiệt độ' : `${series.labels[selected]} · ${series.values[selected].toLocaleString('vi-VN')} °C (minh họa)`}</div>
        <div className={styles.chartScroll}><svg viewBox="0 0 700 235" className={styles.temperatureChart} role="group" aria-label={`Biểu đồ nhiệt độ minh họa ${range === 'day' ? '24 giờ' : '7 ngày'} của ${barnName}`}>
          <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#eea353" stopOpacity=".3" /><stop offset="100%" stopColor="#eea353" stopOpacity=".02" /></linearGradient></defs>
          <text x="16" y="18">°C</text>
          {[20, 24, 28, 32].map(value => <g key={value}><line x1="55" y1={y(value)} x2="665" y2={y(value)} stroke="#e6ece8" strokeDasharray="4 4" /><text x="18" y={y(value) + 4}>{value}</text></g>)}
          <polygon points={`55,190 ${points} 665,190`} fill={`url(#${gradientId})`} />
          <polyline points={points} fill="none" stroke="#dd8b38" strokeWidth="3" strokeLinejoin="round" />
          {series.values.map((value, index) => <g key={series.labels[index]}>
            <text x={x(index)} y="220" textAnchor="middle">{series.labels[index]}</text>
            <circle cx={x(index)} cy={y(value)} r={selected === index ? 7 : 5} fill="#fff" stroke="#dd8b38" strokeWidth="2" />
            <circle cx={x(index)} cy={y(value)} r="15" fill="transparent" role="button" tabIndex={0}
              aria-label={`${series.labels[index]}: ${value} °C, minh họa`}
              onMouseEnter={() => setSelected(index)} onFocus={() => setSelected(index)} onClick={() => setSelected(index)}
              onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(index); } }} />
          </g>)}
        </svg></div>
        <footer className={styles.chartFooter}><span><i />Nhiệt độ (°C) · {range === 'week' ? 'Trung bình ngày' : 'Theo giờ'}</span><button type="button" onClick={() => { setPreview(false); setSelected(null); }}>Ẩn minh họa</button></footer>
      </> : <div className={styles.chartEmpty}><Thermometer size={30} strokeWidth={1.4} /><strong>Chưa có lịch sử nhiệt độ</strong><p>Biểu đồ sẽ hiển thị khi cảm biến gửi dữ liệu về chuồng.</p><button type="button" onClick={() => setPreview(true)}>Xem minh họa biểu đồ</button></div>}
    </div>
  </section>;
}
