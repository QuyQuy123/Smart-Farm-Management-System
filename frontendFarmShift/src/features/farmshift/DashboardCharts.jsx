import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { formatDay } from './farmAreaOptions';
import styles from './DashboardCharts.module.css';

/*
 * Biểu đồ của Bảng tin, vẽ SVG tay (project không có thư viện chart). Màu đã kiểm tra bằng bộ kiểm tra bảng màu (độ sáng,
 * độ bão hòa, tách màu cho người mù màu, tương phản trên nền trắng): xanh lá / xanh dương / đỏ đất. Trạng thái chuồng dùng
 * cùng màu với thẻ chuồng. Chữ luôn dùng màu chữ, không dùng màu chuỗi; mỗi biểu đồ có tooltip khi rê chuột.
 */
const C = { green: '#2d8a5e', blue: '#2a78d6', earth: '#b5654a', sage: '#7d968a', loss: '#9b3d2e', grid: '#e3ebe8', axis: '#c3cfca' };
const num = (value, digits = 0) => value == null ? '—' : Number(value).toLocaleString('vi-VN', { maximumFractionDigits: digits });
const money = value => `${num(value)}đ`;
const short = value => value >= 1e9 ? `${num(value / 1e9, 1)} tỷ` : value >= 1e6 ? `${num(value / 1e6, 1)} tr` : value >= 1e3 ? `${num(value / 1e3, 1)}k` : num(value);

/** Mốc trục y "tròn" (1, 2, 5 × 10^n) từ 0 đến >= max. */
const ticks = (max, count = 4) => {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(f => f * pow).find(s => s >= raw);
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => +(i * step).toFixed(6));
};

/** Thanh có đầu bo 4px ở phía xa trục, chân vuông dính trục. */
const barPath = (x, y, w, h, r = 4) => {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
};

function Tooltip({ tip }) {
  if (!tip) return null;
  return <div className={styles.tooltip} style={{ left: `${tip.x}%`, top: tip.y }} role="status">
    <strong>{tip.title}</strong>{tip.lines.map(line => <span key={line}>{line}</span>)}
  </div>;
}

function Legend({ items }) {
  return <div className={styles.legend}>{items.map(([color, label]) => <span key={label}><i style={{ background: color }} />{label}</span>)}</div>;
}

function ChartCard({ title, hint, children }) {
  return <figure className={styles.chart} aria-label={title}>
    <figcaption><strong>{title}</strong>{hint && <small>{hint}</small>}</figcaption>
    {children}
  </figure>;
}

const W = 520, H = 220, PAD = { l: 52, r: 12, t: 12, b: 34 };
const plotW = W - PAD.l - PAD.r, plotH = H - PAD.t - PAD.b;

function YGrid({ values, max, format }) {
  return values.map(v => {
    const y = PAD.t + plotH - (v / max) * plotH;
    return <g key={v}><line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke={C.grid} />
      <text x={PAD.l - 8} y={y + 4} textAnchor="end" className={styles.axisText}>{format(v)}</text></g>;
  });
}

/** Ngưỡng hao hụt cả lứa (chết + loại thải / tổng nhập): vượt thì tô đỏ đất. */
export const LOSS_THRESHOLD = 5;

/** 1. Tỷ lệ hao hụt theo chuồng: cột ngang, xếp cao → thấp, đường nét đứt ở ngưỡng; chi tiết chết / loại thải trong tooltip. */
function LossRates({ barns }) {
  const [tip, setTip] = useState(null);
  const rows = barns.filter(b => b.totalIn > 0)
    .map(b => ({ ...b, rate: ((b.deaths + b.culls) / b.totalIn) * 100 }))
    .sort((a, b) => b.rate - a.rate);
  if (rows.length === 0) return <ChartCard title="Tỷ lệ hao hụt theo chuồng" hint={`Ngưỡng ${LOSS_THRESHOLD}% cả lứa`}>
    <p className={styles.empty}>Chưa có số liệu hao hụt.</p></ChartCard>;
  const xTicks = ticks(Math.max(...rows.map(r => r.rate), LOSS_THRESHOLD * 1.2), 5);
  const max = xTicks[xTicks.length - 1];
  const L = 86, R = 44, T = 8, rowH = 26, height = T + rows.length * rowH + 26;
  const width = W, plot = width - L - R;
  const X = value => L + (value / max) * plot;
  return <ChartCard title="Tỷ lệ hao hụt theo chuồng" hint={`(Chết + loại thải) / số nhập của lứa · ngưỡng ${LOSS_THRESHOLD}%`}>
    <div className={styles.plot} onMouseLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={rows.map(r => `${r.barnName} ${num(r.rate, 2)}%`).join(', ')}>
        {xTicks.map(v => <g key={v}><line x1={X(v)} x2={X(v)} y1={T} y2={height - 22} stroke={C.grid} />
          <text x={X(v)} y={height - 8} textAnchor="middle" className={styles.axisText}>{num(v, 1)}%</text></g>)}
        <line x1={L} x2={L} y1={T} y2={height - 22} stroke={C.axis} />
        {rows.map((r, i) => {
          const y = T + i * rowH + 5, h = rowH - 10, w = X(r.rate) - L;
          const over = r.rate > LOSS_THRESHOLD;
          const show = () => setTip({ x: (Math.min(X(r.rate), width - 70) / width) * 100, y: y - 4, title: r.barnName,
            lines: [`Hao hụt ${num(r.rate, 2)}% · ${num(r.deaths + r.culls)} con`, `Chết ${num(r.deaths)} · loại thải ${num(r.culls)} / nhập ${num(r.totalIn)}`] });
          return <g key={r.barnId} onMouseEnter={show} onFocus={show} tabIndex={0}>
            <rect x={0} y={T + i * rowH} width={width} height={rowH} fill="transparent" />
            <text x={L - 8} y={y + h / 2 + 4} textAnchor="end" className={styles.axisText}>{r.barnName.length > 11 ? `${r.barnName.slice(0, 10)}…` : r.barnName}</text>
            {w > 0 && <path d={`M${L},${y}H${L + w - Math.min(4, w)}Q${L + w},${y} ${L + w},${y + Math.min(4, w)}V${y + h - Math.min(4, w)}Q${L + w},${y + h} ${L + w - Math.min(4, w)},${y + h}H${L}Z`}
              fill={over ? C.loss : C.green} />}
            <text x={L + Math.max(w, 0) + 6} y={y + h / 2 + 4} className={styles.barValue}>{num(r.rate, 2)}%</text>
          </g>;
        })}
        <line x1={X(LOSS_THRESHOLD)} x2={X(LOSS_THRESHOLD)} y1={T - 2} y2={height - 22} stroke={C.loss} strokeDasharray="5 4" strokeWidth="1.5" />
        <text x={X(LOSS_THRESHOLD) + 4} y={T + 8} className={styles.axisText}>ngưỡng {LOSS_THRESHOLD}%</text>
      </svg>
      <Tooltip tip={tip} />
    </div>
    <Legend items={[[C.green, `Dưới ngưỡng ${LOSS_THRESHOLD}%`], [C.loss, `Vượt ngưỡng ${LOSS_THRESHOLD}%`]]} />
  </ChartCard>;
}
/** 2. Cơ cấu chi phí các lứa đang nuôi: donut 3 phần, khe 2px giữa các phần. */
function CostDonut({ finance }) {
  const [tip, setTip] = useState(null);
  const parts = [['Con giống', finance.chickCost, C.green], ['Cám', finance.feedCost, C.blue], ['Chi khác', finance.otherCost, C.earth]]
    .map(([label, value, color]) => ({ label, value: Number(value || 0), color })).filter(p => p.value > 0);
  const total = parts.reduce((s, p) => s + p.value, 0);
  const R = 78, r = 50, cx = 110, cy = 105;
  let angle = -Math.PI / 2;
  const arcs = parts.map(p => {
    const a0 = angle, a1 = angle + (p.value / total) * Math.PI * 2;
    angle = a1;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const pt = (rad, a) => `${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`;
    const d = parts.length === 1
      ? `M${cx - R},${cy}A${R},${R} 0 1 1 ${cx + R},${cy}A${R},${R} 0 1 1 ${cx - R},${cy}M${cx - r},${cy}A${r},${r} 0 1 0 ${cx + r},${cy}A${r},${r} 0 1 0 ${cx - r},${cy}Z`
      : `M${pt(R, a0)}A${R},${R} 0 ${large} 1 ${pt(R, a1)}L${pt(r, a1)}A${r},${r} 0 ${large} 0 ${pt(r, a0)}Z`;
    return { ...p, d, mid: (a0 + a1) / 2 };
  });
  return <ChartCard title="Cơ cấu chi phí các lứa đang nuôi" hint={`Tổng ${money(total)}`}>
    {total === 0 ? <p className={styles.empty}>Chưa có chi phí.</p> : <div className={styles.donutRow}>
      <div className={styles.plot} onMouseLeave={() => setTip(null)}>
        <svg viewBox="0 0 220 210" className={styles.donut} role="img" aria-label={arcs.map(a => `${a.label} ${money(a.value)}`).join(', ')}>
          {arcs.map(a => {
            const show = () => setTip({ x: ((cx + (R + 6) * Math.cos(a.mid)) / 220) * 100, y: cy + (R + 6) * Math.sin(a.mid) - 10, title: a.label,
              lines: [money(a.value), `${num((a.value / total) * 100, 1)}% tổng chi`] });
            return <path key={a.label} d={a.d} fill={a.color} stroke="#fff" strokeWidth="2" onMouseEnter={show} onFocus={show} tabIndex={0} />;
          })}
          <text x={cx} y={cy - 2} textAnchor="middle" className={styles.donutValue}>{short(total)}</text>
          <text x={cx} y={cy + 16} textAnchor="middle" className={styles.axisText}>tổng chi</text>
        </svg>
        <Tooltip tip={tip} />
      </div>
      <ul className={styles.donutLegend}>{arcs.map(a => <li key={a.label}><i style={{ background: a.color }} />
        <span>{a.label}</span><b>{num((a.value / total) * 100, 1)}%</b><small>{money(a.value)}</small></li>)}</ul>
    </div>}
  </ChartCard>;
}

/** 3. Việc 7 ngày gần nhất: cột chồng đã xong + bỏ lỡ / quá giờ, khe 2px giữa hai phần. */
function TaskHistory({ days }) {
  const [tip, setTip] = useState(null);
  const yTicks = ticks(Math.max(...days.map(d => d.done + d.missed), 1));
  const max = yTicks[yTicks.length - 1];
  const slot = plotW / days.length;
  const bw = Math.min(34, slot * 0.55);
  return <ChartCard title="Việc 7 ngày gần nhất" hint="Hôm nay: việc chưa xong mà đã quá giờ">
    <div className={styles.plot} onMouseLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={days.map(d => `${formatDay(d.date)}: xong ${d.done}/${d.total}`).join(', ')}>
        <YGrid values={yTicks} max={max} format={v => num(v)} />
        <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + plotH} y2={PAD.t + plotH} stroke={C.axis} />
        {days.map((d, i) => {
          const x = PAD.l + i * slot + (slot - bw) / 2;
          const hDone = (d.done / max) * plotH, hMiss = (d.missed / max) * plotH;
          const base = PAD.t + plotH;
          const today = i === days.length - 1;
          const show = () => setTip({ x: ((x + bw / 2) / W) * 100, y: base - hDone - hMiss - 8, title: today ? 'Hôm nay' : formatDay(d.date),
            lines: [`Đã xong ${d.done}/${d.total}`, `${today ? 'Quá giờ' : 'Bỏ lỡ'} ${d.missed}`] });
          return <g key={d.date} onMouseEnter={show} onFocus={show} tabIndex={0}>
            <rect x={PAD.l + i * slot} y={PAD.t} width={slot} height={plotH} fill="transparent" />
            {hDone > 0 && <path d={hMiss > 0 ? `M${x},${base}V${base - hDone}H${x + bw}V${base}Z` : barPath(x, base - hDone, bw, hDone)} fill={C.green} />}
            {hMiss > 0 && <path d={barPath(x, base - hDone - hMiss, bw, Math.max(hMiss - (hDone > 0 ? 2 : 0), 1))} fill={C.earth} />}
            <text x={x + bw / 2} y={H - 14} textAnchor="middle" className={styles.axisText}>{today ? 'Hôm nay' : formatDay(d.date).slice(0, 5)}</text>
          </g>;
        })}
      </svg>
      <Tooltip tip={tip} />
    </div>
    <Legend items={[[C.green, 'Đã xong'], [C.earth, 'Bỏ lỡ / quá giờ']]} />
  </ChartCard>;
}

/** 4. Tăng trọng theo ngày tuổi: đường cân TB thực tế, mốc mục tiêu xuất chuồng nét đứt; chọn chuồng. */
function GrowthChart({ growth }) {
  const usable = growth.filter(g => g.points.length > 0);
  const [barnId, setBarnId] = useState(() => (usable.find(g => g.points.length > 1) || usable[0])?.barnId);
  const [tip, setTip] = useState(null);
  const g = usable.find(item => item.barnId === barnId) || usable[0];
  if (!g) return <ChartCard title="Tăng trọng theo ngày tuổi"><p className={styles.empty}>Chưa có số cân.</p></ChartCard>;
  const target = g.targetWeightKg != null && g.targetDay ? { day: g.targetDay, kg: Number(g.targetWeightKg) } : null;
  const maxDay = Math.max(...g.points.map(p => p.ageDays), target?.day || 0, 7);
  const yTicks = ticks(Math.max(...g.points.map(p => Number(p.avgWeightKg)), target?.kg || 0, 0.1));
  const maxKg = yTicks[yTicks.length - 1];
  const X = day => PAD.l + (day / maxDay) * plotW;
  const Y = kg => PAD.t + plotH - (kg / maxKg) * plotH;
  const line = g.points.map((p, i) => `${i ? 'L' : 'M'}${X(p.ageDays)},${Y(Number(p.avgWeightKg))}`).join('');
  const xTicks = ticks(maxDay, 5).filter(d => d <= maxDay);
  return <ChartCard title="Tăng trọng theo ngày tuổi" hint={g.points.length < 2 ? 'Chưa có lần cân mẫu, mới có cân lúc nhập' : 'Cân TB (kg/con) từ các lần cân mẫu'}>
    <label className={styles.select}>Chuồng
      <select value={g.barnId} onChange={event => { setBarnId(Number(event.target.value)); setTip(null); }} aria-label="Chọn chuồng xem tăng trọng">
        {usable.map(item => <option key={item.barnId} value={item.barnId}>{item.barnName}</option>)}
      </select>
    </label>
    <div className={styles.plot} onMouseLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${g.barnName}: ${g.points.map(p => `ngày ${p.ageDays} ${num(p.avgWeightKg, 2)} kg`).join(', ')}`}>
        <YGrid values={yTicks} max={maxKg} format={v => `${num(v, 2)} kg`} />
        <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + plotH} y2={PAD.t + plotH} stroke={C.axis} />
        {xTicks.map(d => <text key={d} x={X(d)} y={H - 14} textAnchor="middle" className={styles.axisText}>{d}</text>)}
        <text x={W - PAD.r} y={H - 2} textAnchor="end" className={styles.axisText}>ngày tuổi</text>
        {target && <g>
          <line x1={PAD.l} x2={X(target.day)} y1={Y(target.kg)} y2={Y(target.kg)} stroke={C.sage} strokeDasharray="5 4" strokeWidth="1.5" />
          <circle cx={X(target.day)} cy={Y(target.kg)} r="5" fill="#fff" stroke={C.sage} strokeWidth="2"
            onMouseEnter={() => setTip({ x: (X(target.day) / W) * 100, y: Y(target.kg) - 10, title: 'Mục tiêu xuất chuồng', lines: [`Ngày ${target.day}: ${num(target.kg, 2)} kg/con`] })} />
        </g>}
        {g.points.length > 1 && <path d={line} fill="none" stroke={C.green} strokeWidth="2" strokeLinejoin="round" />}
        {g.points.map(p => {
          const show = () => setTip({ x: (X(p.ageDays) / W) * 100, y: Y(Number(p.avgWeightKg)) - 10, title: `Ngày tuổi ${p.ageDays}`,
            lines: [`${num(p.avgWeightKg, 3)} kg/con`, formatDay(p.date)] });
          return <g key={`${p.ageDays}-${p.date}`} onMouseEnter={show} onFocus={show} tabIndex={0}>
            <circle cx={X(p.ageDays)} cy={Y(Number(p.avgWeightKg))} r="12" fill="transparent" />
            <circle cx={X(p.ageDays)} cy={Y(Number(p.avgWeightKg))} r="4.5" fill={C.green} stroke="#fff" strokeWidth="2" />
          </g>;
        })}
      </svg>
      <Tooltip tip={tip} />
    </div>
    <Legend items={[[C.green, `Cân TB thực tế · ${g.barnName}`], ...(target ? [[C.sage, 'Mục tiêu xuất chuồng']] : [])]} />
  </ChartCard>;
}

/** Mục "Biểu đồ" của Bảng tin: lưới 2×2 (điện thoại 1 cột). Cơ cấu chi phí chỉ có khi được xem tiền. */
export function DashboardCharts({ data }) {
  const growth = data.growth || [];
  const history = data.taskHistory || [];
  return <section className={styles.section} aria-label="Biểu đồ">
    <header><h3><BarChart3 size={17} />Biểu đồ</h3></header>
    <div className={styles.grid}>
      {data.barns.length > 0 && <LossRates barns={data.barns} />}
      {data.finance && <CostDonut finance={data.finance} />}
      {history.length > 0 && <TaskHistory days={history} />}
      {growth.length > 0 && <GrowthChart growth={growth} />}
    </div>
  </section>;
}
