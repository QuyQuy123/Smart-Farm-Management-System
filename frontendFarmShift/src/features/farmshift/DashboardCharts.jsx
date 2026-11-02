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
const plotH = H - PAD.t - PAD.b;

function YGrid({ values, max, format, width = W, height = plotH }) {
  return values.map(v => {
    const y = PAD.t + height - (v / max) * height;
    return <g key={v}><line x1={PAD.l} x2={width - PAD.r} y1={y} y2={y} stroke={C.grid} />
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

/** Màu từng chuồng trên biểu đồ tăng trọng: 8 màu phân biệt được với nhau và trên nền trắng, lặp lại khi nhiều chuồng hơn. */
const BARN_COLORS = ['#2d8a5e', '#2a78d6', '#b5654a', '#8a5cc2', '#c2862a', '#1f9aa6', '#c2457a', '#6b7f2a'];
/** Biểu đồ tăng trọng chiếm cả hàng nên vẽ trên khung rộng hơn để chữ trục không bị phóng to. */
const GW = 1040, GH = 300;
const gPlotW = GW - PAD.l - PAD.r, gPlotH = GH - PAD.t - PAD.b;

/**
 * 3. Tăng trọng theo ngày tuổi: mỗi chuồng đang nuôi một đường cân TB (kg/con) theo ngày tuổi, mốc mục tiêu xuất chuồng nét đứt.
 * Rê chuột lên tên chuồng ở chú thích để làm nổi đường của chuồng đó.
 */
function GrowthChart({ growth }) {
  const [tip, setTip] = useState(null);
  const [focus, setFocus] = useState(null);
  const series = growth.filter(g => g.points.length > 0).map((g, index) => ({ ...g, color: BARN_COLORS[index % BARN_COLORS.length] }));
  if (!series.length) return <ChartCard title="Tăng trọng theo ngày tuổi"><p className={styles.empty}>Chưa có số cân.</p></ChartCard>;
  const targets = [...new Map(series.filter(g => g.targetWeightKg != null && g.targetDay)
    .map(g => [`${g.targetDay}:${Number(g.targetWeightKg)}`, { day: g.targetDay, kg: Number(g.targetWeightKg) }])).values()];
  const points = series.flatMap(g => g.points);
  const maxDay = Math.max(...points.map(p => p.ageDays), ...targets.map(target => target.day), 7);
  const yTicks = ticks(Math.max(...points.map(p => Number(p.avgWeightKg)), ...targets.map(target => target.kg), 0.1));
  const maxKg = yTicks[yTicks.length - 1];
  const X = day => PAD.l + (day / maxDay) * gPlotW;
  const Y = kg => PAD.t + gPlotH - (kg / maxKg) * gPlotH;
  const xTicks = ticks(maxDay, 6).filter(d => d <= maxDay);
  const weighed = series.filter(g => g.points.length > 1).length;
  return <ChartCard title="Tăng trọng theo ngày tuổi"
    hint={`Cân TB (kg/con) các chuồng đang nuôi · ${weighed}/${series.length} chuồng đã có lần cân mẫu`}>
    <div className={styles.plot} onMouseLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${GW} ${GH}`} role="img"
        aria-label={series.map(g => `${g.barnName}: ${g.points.map(p => `ngày ${p.ageDays} ${num(p.avgWeightKg, 2)} kg`).join(', ')}`).join('; ')}>
        <YGrid values={yTicks} max={maxKg} format={v => `${num(v, 2)} kg`} width={GW} height={gPlotH} />
        <line x1={PAD.l} x2={GW - PAD.r} y1={PAD.t + gPlotH} y2={PAD.t + gPlotH} stroke={C.axis} />
        {xTicks.map(d => <text key={d} x={X(d)} y={GH - 14} textAnchor="middle" className={styles.axisText}>{d}</text>)}
        <text x={GW - PAD.r} y={GH - 2} textAnchor="end" className={styles.axisText}>ngày tuổi</text>
        {targets.map(target => <g key={`${target.day}:${target.kg}`}>
          <line x1={PAD.l} x2={X(target.day)} y1={Y(target.kg)} y2={Y(target.kg)} stroke={C.sage} strokeDasharray="5 4" strokeWidth="1.5" />
          <circle cx={X(target.day)} cy={Y(target.kg)} r="5" fill="#fff" stroke={C.sage} strokeWidth="2"
            onMouseEnter={() => setTip({ x: (X(target.day) / GW) * 100, y: Y(target.kg) - 10, title: 'Mục tiêu xuất chuồng',
              lines: [`Ngày ${target.day}: ${num(target.kg, 2)} kg/con`] })} />
        </g>)}
        {series.map(g => {
          const dim = focus != null && focus !== g.barnId;
          const path = g.points.map((p, i) => `${i ? 'L' : 'M'}${X(p.ageDays)},${Y(Number(p.avgWeightKg))}`).join('');
          return <g key={g.barnId} opacity={dim ? 0.18 : 1} data-barn={g.barnName}>
            {g.points.length > 1 && <path d={path} fill="none" stroke={g.color} strokeWidth={focus === g.barnId ? 3 : 2} strokeLinejoin="round" />}
            {g.points.map(p => {
              const show = () => setTip({ x: (X(p.ageDays) / GW) * 100, y: Y(Number(p.avgWeightKg)) - 10, title: `${g.barnName} · ngày tuổi ${p.ageDays}`,
                lines: [`${num(p.avgWeightKg, 3)} kg/con`, formatDay(p.date)] });
              return <g key={`${p.ageDays}-${p.date}`} onMouseEnter={show} onFocus={show} tabIndex={0}>
                <circle cx={X(p.ageDays)} cy={Y(Number(p.avgWeightKg))} r="10" fill="transparent" />
                <circle cx={X(p.ageDays)} cy={Y(Number(p.avgWeightKg))} r="4" fill={g.color} stroke="#fff" strokeWidth="1.5" />
              </g>;
            })}
          </g>;
        })}
      </svg>
      <Tooltip tip={tip} />
    </div>
    <div className={styles.legend} onMouseLeave={() => setFocus(null)}>
      {series.map(g => <button key={g.barnId} type="button" className={styles.legendBarn} aria-pressed={focus === g.barnId}
        onMouseEnter={() => setFocus(g.barnId)} onFocus={() => setFocus(g.barnId)} onBlur={() => setFocus(null)}
        onClick={() => setFocus(current => (current === g.barnId ? null : g.barnId))}>
        <i style={{ background: g.color }} />{g.barnName}</button>)}
      {targets.length > 0 && <span><i style={{ background: C.sage }} />Mục tiêu xuất chuồng</span>}
    </div>
  </ChartCard>;
}

/** Mục "Biểu đồ" của Bảng tin: lưới 2 cột (điện thoại 1 cột). Cơ cấu chi phí chỉ có khi được xem tiền. */
export function DashboardCharts({ data }) {
  const growth = data.growth || [];
  return <section className={styles.section} aria-label="Biểu đồ">
    <header><h3><BarChart3 size={17} />Biểu đồ</h3></header>
    <div className={styles.grid}>
      {data.barns.length > 0 && <LossRates barns={data.barns} />}
      {data.finance && <CostDonut finance={data.finance} />}
      {growth.length > 0 && <GrowthChart growth={growth} />}
    </div>
  </section>;
}
