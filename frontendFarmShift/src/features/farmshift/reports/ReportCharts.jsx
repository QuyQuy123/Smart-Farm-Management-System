// src/features/farmshift/reports/ReportCharts.jsx
// Toàn bộ biểu đồ SVG tương tác cho 8 phân hệ Báo cáo & Thống kê FarmShift (Zero Tailwind).
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, BarChart3, PieChart, Scale, Warehouse } from 'lucide-react';
import styles from '../ReportsView.module.css';
import {
  CHART_COLORS,
  INVENTORY_CATEGORY_META,
  buildDonutArcs,
  classifyItemCategory,
  fmtNum,
  fmtVnd,
  formatUnitMap,
  mergeUnitMaps,
  niceTicks,
  shortMoney,
} from './reportUtils';

/* ── Reusable SVG Tooltip ──────────────────────────────────────────────────────────────────── */
export function ChartTooltip({ tip }) {
  if (!tip) return null;
  const safeLeft = Math.min(86, Math.max(14, tip.x));
  return (
    <div
      className={styles.chartTooltip}
      style={{ left: `${safeLeft}%`, top: `${Math.max(16, tip.y)}px` }}
      role="status"
    >
      <strong>{tip.title}</strong>
      {tip.lines.map((line, i) => (
        <span key={i}>{line}</span>
      ))}
    </div>
  );
}

/* ── Chart 1: Interactive Grouped Bar Chart — Doanh thu, Chi phí & Lợi nhuận theo Chuồng/Lứa ─ */
export function CycleProfitBarChart({ cycles }) {
  const [tip, setTip] = useState(null);
  const visible = useMemo(() => cycles.slice(0, 8), [cycles]);

  if (!visible.length) {
    return (
      <section className={styles.chartCard} aria-label="Biểu đồ Doanh thu, Chi phí và Lợi nhuận theo chuồng">
        <div className={styles.chartHeader}>
          <div className={styles.chartTitleGroup}>
            <h3 className={styles.chartTitle}><BarChart3 size={16} color="#007968" /> Doanh thu, Chi phí &amp; Lãi/Lỗ theo Chuồng</h3>
            <span className={styles.chartSubtitle}>Chưa có dữ liệu lứa nuôi trong bộ lọc hiện tại</span>
          </div>
        </div>
        <p className={styles.chartEmpty}>Không có dữ liệu hạch toán để vẽ biểu đồ.</p>
      </section>
    );
  }

  const W = 640;
  const H = 246;
  const PAD = { l: 58, r: 16, t: 18, b: 36 };
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;

  const maxPos = Math.max(
    1,
    ...visible.flatMap((c) => [Number(c.revenue || 0), Number(c.totalCost || 0), Math.max(0, Number(c.profit || 0))])
  );
  const minNeg = Math.min(0, ...visible.map((c) => Number(c.profit || 0)));
  const spanPos = niceTicks(maxPos, 4).slice(-1)[0];
  const spanNeg = minNeg < 0 ? niceTicks(Math.abs(minNeg), 2).slice(-1)[0] : 0;
  const totalSpan = spanPos + spanNeg || 1;

  const Y = (val) => PAD.t + ((spanPos - val) / totalSpan) * plotH;
  const zeroY = Y(0);

  const posTicks = niceTicks(spanPos, 3).filter((t) => t <= spanPos);
  const yTicks = spanNeg > 0 ? [-spanNeg, ...posTicks] : posTicks;

  const groupW = plotW / visible.length;
  const barW = Math.min(18, Math.max(8, (groupW - 18) / 3));

  return (
    <section className={styles.chartCard} aria-label="Biểu đồ Doanh thu, Chi phí và Lợi nhuận theo chuồng">
      <div className={styles.chartHeader}>
        <div className={styles.chartTitleGroup}>
          <h3 className={styles.chartTitle}><BarChart3 size={16} color="#007968" /> Doanh thu, Chi phí &amp; Lãi/Lỗ theo Chuồng</h3>
          <span className={styles.chartSubtitle}>
            Hiển thị {visible.length} lứa {cycles.length > 8 ? `(trên tổng ${cycles.length} lứa lọc)` : ''} · Rê chuột vào cột để xem chi tiết
          </span>
        </div>
        <div className={styles.chartLegend}>
          <span className={styles.chartLegendItem}><i className={styles.chartLegendSwatch} style={{ background: CHART_COLORS.revenue }} />Doanh thu</span>
          <span className={styles.chartLegendItem}><i className={styles.chartLegendSwatch} style={{ background: CHART_COLORS.cost }} />Tổng chi phí</span>
          <span className={styles.chartLegendItem}><i className={styles.chartLegendSwatch} style={{ background: CHART_COLORS.profitPos }} />Lãi / Lỗ</span>
        </div>
      </div>

      <div className={styles.svgPlot} onMouseLeave={() => setTip(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Biểu đồ cột Doanh thu Chi phí Lợi nhuận theo chuồng">
          {yTicks.map((tick) => {
            const yPos = Y(tick);
            return (
              <g key={tick}>
                <line
                  x1={PAD.l}
                  x2={W - PAD.r}
                  y1={yPos}
                  y2={yPos}
                  stroke={tick === 0 ? CHART_COLORS.axis : CHART_COLORS.grid}
                  strokeWidth={tick === 0 ? 1.4 : 1}
                />
                <text x={PAD.l - 8} y={yPos + 4} textAnchor="end" className={styles.axisText}>
                  {shortMoney(tick)}
                </text>
              </g>
            );
          })}

          {visible.map((c, idx) => {
            const cx = PAD.l + idx * groupW + groupW / 2;
            const rev = Number(c.revenue || 0);
            const cost = Number(c.totalCost || 0);
            const profit = Number(c.profit || 0);
            const xStart = cx - (barW * 3 + 6) / 2;

            const revH = Math.max(0, zeroY - Y(rev));
            const costH = Math.max(0, zeroY - Y(cost));
            const profTop = profit >= 0 ? Y(profit) : zeroY;
            const profH = Math.abs(Y(profit) - zeroY);

            const showTooltip = () => {
              const lines = [
                `Doanh thu: ${fmtVnd(rev)}`,
                `Tổng chi phí: ${fmtVnd(cost)}`,
              ];
              if (c.hasCostBreakdown) {
                lines.push(`• Giống: ${fmtVnd(c.chickCost)} | Cám: ${fmtVnd(c.feedCost)} | Khác: ${fmtVnd(c.otherCost)}`);
              }
              lines.push(
                `Lợi nhuận ròng: ${profit >= 0 ? '+' : ''}${fmtVnd(profit)}${c.marginPct !== null ? ` (${fmtNum(c.marginPct, 1)}%)` : ''}${c.isWip ? ' · Đang nuôi (WIP)' : ''}`
              );
              if (c.costPerKg) lines.push(`Giá vốn sản xuất: ${fmtVnd(c.costPerKg)}/kg`);
              if (c.fcr !== null) lines.push(`FCR: ${fmtNum(c.fcr, 2)} · Tỷ lệ sống: ${fmtNum(c.survivalRate, 1)}%`);
              setTip({
                x: (cx / W) * 100,
                y: Math.min(Y(rev), Y(cost), profTop),
                title: `${c.barnName} (${c.cycleCode})`,
                lines,
              });
            };

            const rawBarn = String(c.barnName || c.cycleCode || '—').trim();
            const displayLabel = rawBarn.length > 13 ? `${rawBarn.slice(0, 12)}…` : rawBarn;
            const labelY = PAD.t + plotH + 18;

            return (
              <g
                key={c.cycleId || idx}
                onMouseEnter={showTooltip}
                onFocus={showTooltip}
                onClick={showTooltip}
                onTouchStart={showTooltip}
                tabIndex={0}
                style={{ cursor: 'pointer' }}
              >
                <rect x={PAD.l + idx * groupW} y={PAD.t} width={groupW} height={plotH} fill="transparent" />
                <rect x={xStart} y={Y(rev)} width={barW} height={revH} rx="3" fill={CHART_COLORS.revenue} />
                <rect x={xStart + barW + 3} y={Y(cost)} width={barW} height={costH} rx="3" fill={CHART_COLORS.cost} />
                <rect
                  x={xStart + (barW + 3) * 2}
                  y={profTop}
                  width={barW}
                  height={Math.max(2, profH)}
                  rx="3"
                  fill={profit >= 0 ? CHART_COLORS.profitPos : c.isWip ? '#94a3b8' : CHART_COLORS.profitNeg}
                />
                <text
                  x={cx}
                  y={labelY}
                  textAnchor="middle"
                  className={styles.axisText}
                  fontSize="11"
                >
                  {displayLabel}
                </text>
              </g>
            );
          })}
        </svg>
        <ChartTooltip tip={tip} />
      </div>
    </section>
  );
}

/* ── Chart 2: Donut Chart — Cơ cấu Chi phí Chăn nuôi (Giống - Cám - Vắc-xin/Thuốc - Khác) ── */
export function CostStructureDonutChart({
  chickCost,
  feedCost,
  otherCost,
  medicineCost,
  diseaseMedicineCost = 0,
  otherDirectCost,
  totalCost,
}) {
  const [tip, setTip] = useState(null);

  const medVal = Number(medicineCost || 0);
  const diseaseMedVal = Math.max(0, Number(diseaseMedicineCost || 0));
  const preventiveMedVal = diseaseMedVal > 0 ? Math.max(0, medVal - diseaseMedVal) : medVal;
  const directOtherVal = Number(otherDirectCost || 0);
  const hasSeparateMedicine = medVal > 0 || diseaseMedVal > 0 || directOtherVal > 0;

  const componentSum = Number(chickCost || 0) + Number(feedCost || 0) + (hasSeparateMedicine ? medVal + directOtherVal : Number(otherCost || 0));
  const hasBreakdown = componentSum > 0;
  const effectiveTotal = hasBreakdown ? componentSum : Number(totalCost || 0);

  const segments = hasBreakdown
    ? (hasSeparateMedicine
        ? [
            { key: 'chick', label: 'Con giống', value: Number(chickCost || 0), color: CHART_COLORS.chick },
            { key: 'feed', label: 'Thức ăn (Cám)', value: Number(feedCost || 0), color: CHART_COLORS.feed },
            ...(diseaseMedVal > 0
              ? [
                  { key: 'diseaseMed', label: 'Thuốc trị bệnh', value: diseaseMedVal, color: CHART_COLORS.medicine },
                  { key: 'vaccine', label: 'Vắc-xin & Phòng bệnh', value: preventiveMedVal, color: CHART_COLORS.vaccine },
                ]
              : [
                  { key: 'medicine', label: 'Vắc-xin & Thuốc thú y', value: medVal, color: CHART_COLORS.vaccine },
                ]),
            { key: 'operating', label: 'Chi phí khác', value: directOtherVal, color: CHART_COLORS.operating },
          ]
        : [
            { key: 'chick', label: 'Con giống', value: Number(chickCost || 0), color: CHART_COLORS.chick },
            { key: 'feed', label: 'Thức ăn (Cám)', value: Number(feedCost || 0), color: CHART_COLORS.feed },
            { key: 'other', label: 'Vắc-xin, Thuốc & CP khác', value: Number(otherCost || 0), color: CHART_COLORS.other },
          ]
      ).filter((s) => s.value > 0)
    : effectiveTotal > 0
      ? [{ key: 'total', label: 'Tổng chi phí lứa (chưa bóc tách)', value: effectiveTotal, color: CHART_COLORS.fallback }]
      : [];

  const R = 76;
  const r = 49;
  const cx = 105;
  const cy = 100;
  const arcs = buildDonutArcs(segments, effectiveTotal, cx, cy, R, r);

  return (
    <section className={styles.chartCard} aria-label="Biểu đồ Cơ cấu chi phí chăn nuôi">
      <div className={styles.chartHeader}>
        <div className={styles.chartTitleGroup}>
          <h3 className={styles.chartTitle}><PieChart size={16} color="#0284c7" /> Cơ cấu Chi phí Chăn nuôi</h3>
          <span className={styles.chartSubtitle}>Tỷ trọng Con giống · Cám · Vắc-xin/Thuốc &amp; Chi phí khác</span>
        </div>
      </div>

      {effectiveTotal <= 0 ? (
        <p className={styles.chartEmpty}>Chưa phát sinh chi phí trong phạm vi đang lọc.</p>
      ) : (
        <div className={styles.donutLayout}>
          <div className={`${styles.donutSvgWrap} ${styles.svgPlot}`} onMouseLeave={() => setTip(null)}>
            <svg viewBox="0 0 210 200" role="img" aria-label={`Tổng chi phí ${fmtVnd(effectiveTotal)}`}>
              {arcs.map((arc) => {
                const showTip = () =>
                  setTip({
                    x: ((cx + (R + 6) * Math.cos(arc.mid)) / 210) * 100,
                    y: cy + (R + 6) * Math.sin(arc.mid),
                    title: arc.label,
                    lines: [fmtVnd(arc.value), `Chiếm ${fmtNum(arc.pct, 1)}% tổng chi phí`],
                  });
                return (
                  <path
                    key={arc.key}
                    d={arc.d}
                    fill={arc.color}
                    stroke="#ffffff"
                    strokeWidth="2"
                    tabIndex={0}
                    onMouseEnter={showTip}
                    onFocus={showTip}
                    onClick={showTip}
                    onTouchStart={showTip}
                    style={{ cursor: 'pointer' }}
                  />
                );
              })}
              <text x={cx} y={cy - 2} textAnchor="middle" className={styles.donutCenterValue}>
                {shortMoney(effectiveTotal)}
              </text>
              <text x={cx} y={cy + 15} textAnchor="middle" className={styles.donutCenterLabel}>
                tổng chi phí
              </text>
            </svg>
            <ChartTooltip tip={tip} />
          </div>

          <ul className={styles.donutLegendList}>
            {arcs.map((arc) => (
              <li key={arc.key} className={styles.donutLegendItem}>
                <div className={styles.donutLegendTop}>
                  <span className={styles.donutLegendName}>
                    <i className={styles.chartLegendSwatch} style={{ background: arc.color }} />
                    {arc.label}
                  </span>
                  <div className={styles.donutLegendAmounts}>
                    <span className={styles.donutLegendPct}>{fmtNum(arc.pct, 1)}%</span>
                    <span className={styles.donutLegendMoney}>{fmtVnd(arc.value)}</span>
                  </div>
                </div>
                <div className={styles.progressTrack}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${Math.min(100, arc.pct)}%`, background: arc.color }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/* ── Chart 2B: Interactive Donut Chart — Tỷ trọng Gà · Cám · Vắc-xin & Thuốc · Tồn Kho ───── */
export function InventoryProportionDonutChart({
  mode,
  onModeChange,
  stockBreakdown,
  capitalStats,
  activeCategoryFilter,
  onSelectCategoryFilter,
}) {
  const [tip, setTip] = useState(null);
  const isCapitalMode = mode === 'capital';

  const rawSegments = useMemo(() => {
    if (isCapitalMode) {
      const feedStockVal = Number(stockBreakdown.FEED?.value || 0) + Number(stockBreakdown.GRAIN?.value || 0);
      const medVacStockVal = Number(stockBreakdown.VACCINE?.value || 0) + Number(stockBreakdown.MEDICINE?.value || 0);
      const supplyStockVal = Number(stockBreakdown.SUPPLY?.value || 0);

      const feedQtyText = formatUnitMap(
        mergeUnitMaps(stockBreakdown.FEED?.unitMap, stockBreakdown.GRAIN?.unitMap),
        { compact: true, maxItems: 2 }
      );
      const medVacQtyText = formatUnitMap(
        mergeUnitMaps(stockBreakdown.VACCINE?.unitMap, stockBreakdown.MEDICINE?.unitMap),
        { compact: true, maxItems: 2 }
      );
      const supplyQtyText = formatUnitMap(stockBreakdown.SUPPLY?.unitMap, { compact: true, maxItems: 2 });

      const feedUsed = Number(capitalStats.feedCost || 0);
      const chickVal = Number(capitalStats.chickCost || 0);
      const hasSepMed = Number(capitalStats.medicineCost || 0) + Number(capitalStats.otherDirectCost || 0) > 0;
      const medUsed = hasSepMed ? Number(capitalStats.medicineCost || 0) : 0;
      const otherUsed = hasSepMed ? Number(capitalStats.otherDirectCost || 0) : Number(capitalStats.otherCost || 0);

      return [
        {
          key: 'FEED_ALL',
          filterKey: 'FEED_ALL',
          label: 'Thức ăn & Kho Cám',
          sub: `Tồn kho: ${feedQtyText ? `${feedQtyText} (${shortMoney(feedStockVal)})` : shortMoney(feedStockVal)}${feedUsed > 0 ? ` · Đã dùng lứa: ${shortMoney(feedUsed)}` : ''}`,
          qtyText: feedQtyText,
          value: feedStockVal + feedUsed,
          color: CHART_COLORS.feed,
        },
        {
          key: 'CHICK',
          filterKey: null,
          label: 'Đàn gà & Con giống',
          sub: `${fmtNum(capitalStats.currentLive)} con đang nuôi (nhập ${fmtNum(capitalStats.totalIn)} con)`,
          qtyText: `${fmtNum(capitalStats.currentLive)} con đang nuôi`,
          value: chickVal,
          color: CHART_COLORS.chick,
        },
        {
          key: 'MED_VAC',
          filterKey: 'MED_VAC',
          label: 'Vắc-xin & Thuốc thú y',
          sub: `Tồn kho: ${medVacQtyText ? `${medVacQtyText} (${shortMoney(medVacStockVal)})` : shortMoney(medVacStockVal)}${medUsed > 0 ? ` · Đã dùng lứa: ${shortMoney(medUsed)}` : ''}`,
          qtyText: medVacQtyText,
          value: medVacStockVal + medUsed,
          color: CHART_COLORS.vaccine,
        },
        {
          key: 'SUPPLY_OTHER',
          filterKey: 'SUPPLY',
          label: 'Vật tư & Chi phí khác',
          sub: `Tồn kho: ${supplyQtyText ? `${supplyQtyText} (${shortMoney(supplyStockVal)})` : shortMoney(supplyStockVal)}${otherUsed > 0 ? ` · CP khác: ${shortMoney(otherUsed)}` : ''}`,
          qtyText: supplyQtyText,
          value: supplyStockVal + otherUsed,
          color: CHART_COLORS.supply,
        },
      ].filter((s) => s.value > 0);
    }

    return ['FEED', 'VACCINE', 'MEDICINE', 'GRAIN', 'SUPPLY']
      .map((catKey) => {
        const meta = INVENTORY_CATEGORY_META[catKey];
        const bucket = stockBreakdown[catKey] || { value: 0, count: 0, unitMap: {} };
        const qtyText = formatUnitMap(bucket.unitMap, { compact: true, maxItems: 3 });
        const exactQtyText = formatUnitMap(bucket.unitMap, { compact: false, maxItems: 5 });
        return {
          key: catKey,
          filterKey: catKey,
          label: meta.label,
          sub: `SL: ${qtyText || '0'} · ${bucket.count} mặt hàng`,
          qtyText: exactQtyText || qtyText,
          value: bucket.value,
          color: meta.color,
        };
      })
      .filter((s) => s.value > 0);
  }, [isCapitalMode, stockBreakdown, capitalStats]);

  const effectiveTotal = rawSegments.reduce((s, seg) => s + seg.value, 0);
  const cx = 105;
  const cy = 100;
  const R = 76;
  const r = 49;
  const arcs = buildDonutArcs(rawSegments, effectiveTotal, cx, cy, R, r);

  const handleToggleSlice = (filterKey) => {
    if (!filterKey || !onSelectCategoryFilter) return;
    onSelectCategoryFilter(activeCategoryFilter === filterKey ? 'ALL' : filterKey);
  };

  return (
    <section className={styles.chartCard} aria-label="Biểu đồ Tròn Tỷ trọng Cám, Gà và Vắc-xin">
      <div className={styles.chartHeader}>
        <div className={styles.chartTitleGroup}>
          <h3 className={styles.chartTitle}>
            <PieChart size={16} color="#007968" />
            {isCapitalMode ? 'Tỷ trọng Vốn Cám · Gà · Vắc-xin' : 'Cơ cấu Giá trị & Số lượng Tồn Kho Vật tư'}
          </h3>
          <span className={styles.chartSubtitle}>
            {isCapitalMode
              ? 'So sánh tỷ trọng vốn giữa Thức ăn/Cám, Đàn gà và Vắc-xin/Thuốc · Kèm lượng tồn thực tế'
              : 'Phân bổ tỷ trọng tiền và số lượng theo từng nhóm hàng · Bấm vào lát cắt để lọc mặt hàng'}
          </span>
        </div>

        <div className={styles.modeSwitchGroup} role="group" aria-label="Chế độ biểu đồ tỷ trọng kho">
          <button
            type="button"
            className={`${styles.modeSwitchBtn} ${isCapitalMode ? styles.modeSwitchBtnActive : ''}`}
            onClick={() => onModeChange('capital')}
          >
            Gà · Cám · Vắc-xin
          </button>
          <button
            type="button"
            className={`${styles.modeSwitchBtn} ${!isCapitalMode ? styles.modeSwitchBtnActive : ''}`}
            onClick={() => onModeChange('stock')}
          >
            Trong kho (Vật tư)
          </button>
        </div>
      </div>

      {effectiveTotal <= 0 ? (
        <p className={styles.chartEmpty}>Chưa có dữ liệu tồn kho hoặc vốn đàn gà để vẽ biểu đồ tỷ trọng.</p>
      ) : (
        <div className={styles.donutLayout}>
          <div className={`${styles.donutSvgWrap} ${styles.svgPlot}`} onMouseLeave={() => setTip(null)}>
            <svg viewBox="0 0 210 200" role="img" aria-label={`Biểu đồ tròn tỷ trọng tổng ${fmtVnd(effectiveTotal)}`}>
              {arcs.map((arc) => {
                const isSelected = arc.filterKey && activeCategoryFilter === arc.filterKey;
                const isDimmed = activeCategoryFilter !== 'ALL' && arc.filterKey && activeCategoryFilter !== arc.filterKey;
                const showTip = () =>
                  setTip({
                    x: ((cx + (R + 6) * Math.cos(arc.mid)) / 210) * 100,
                    y: cy + (R + 6) * Math.sin(arc.mid),
                    title: arc.label,
                    lines: [
                      fmtVnd(arc.value),
                      `Tỷ trọng: ${fmtNum(arc.pct, 1)}%`,
                      arc.sub,
                    ].filter(Boolean),
                  });
                return (
                  <path
                    key={arc.key}
                    d={arc.d}
                    fill={arc.color}
                    fillOpacity={isDimmed ? 0.35 : 1}
                    stroke="#ffffff"
                    strokeWidth={isSelected ? '3' : '2'}
                    tabIndex={0}
                    onMouseEnter={showTip}
                    onFocus={showTip}
                    onTouchStart={showTip}
                    onClick={() => { showTip(); handleToggleSlice(arc.filterKey); }}
                    style={{ cursor: arc.filterKey ? 'pointer' : 'default', transition: 'fill-opacity 0.15s ease' }}
                  />
                );
              })}
              <text x={cx} y={cy - 2} textAnchor="middle" className={styles.donutCenterValue}>
                {shortMoney(effectiveTotal)}
              </text>
              <text x={cx} y={cy + 15} textAnchor="middle" className={styles.donutCenterLabel}>
                {isCapitalMode ? 'tổng nguồn vốn' : 'tổng tồn kho'}
              </text>
            </svg>
            <ChartTooltip tip={tip} />
          </div>

          <ul className={styles.donutLegendList}>
            {arcs.map((arc) => {
              const isSelected = arc.filterKey && activeCategoryFilter === arc.filterKey;
              return (
                <li
                  key={arc.key}
                  className={`${styles.donutLegendItem} ${styles.donutInteractiveItem} ${isSelected ? styles.donutInteractiveItemActive : ''}`}
                >
                  <button
                    type="button"
                    className={styles.donutInteractiveBtn}
                    onClick={() => handleToggleSlice(arc.filterKey)}
                    title={arc.filterKey ? 'Bấm để lọc bảng kiểm kê bên dưới theo nhóm này' : undefined}
                  >
                    <div className={styles.donutLegendTop}>
                      <span className={styles.donutLegendName}>
                        <i className={styles.chartLegendSwatch} style={{ background: arc.color }} />
                        {arc.label}
                      </span>
                      <div className={styles.donutLegendAmounts}>
                        <span className={styles.donutLegendPct}>{fmtNum(arc.pct, 1)}%</span>
                        <span className={styles.donutLegendMoney}>{fmtVnd(arc.value)}</span>
                      </div>
                    </div>
                    <div className={styles.progressTrack}>
                      <div
                        className={styles.progressFill}
                        style={{ width: `${Math.min(100, arc.pct)}%`, background: arc.color }}
                      />
                    </div>
                    {arc.sub && <span className={styles.donutSubMeta}>{arc.sub}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

/* ── Chart 2C: Visual Warehouse Bars SVG + Quantity & Value Allocation Panel ───────────────────── */
export function WarehouseVisualPanel({
  warehouses,
  stockBreakdown,
  selectedWarehouse,
  onSelectWarehouse,
  activeCategoryFilter,
  onSelectCategoryFilter,
}) {
  const [tip, setTip] = useState(null);

  const whGroups = useMemo(() => {
    let feedWh = 0;
    let medWh = 0;
    let otherWh = 0;
    let feedUnits = {};
    let medUnits = {};
    let otherUnits = {};
    for (const w of warehouses) {
      const kind = String(w.kind || '').toUpperCase();
      const lower = String(w.name || '').toLowerCase();
      if (kind === 'FEED' || (!kind && lower.includes('cám'))) {
        feedWh += w.value;
        feedUnits = mergeUnitMaps(feedUnits, w.unitMap);
      } else if (kind === 'MEDICINE' || (!kind && (lower.includes('thuốc') || lower.includes('vắc')))) {
        medWh += w.value;
        medUnits = mergeUnitMaps(medUnits, w.unitMap);
      } else {
        otherWh += w.value;
        otherUnits = mergeUnitMaps(otherUnits, w.unitMap);
      }
    }
    const rawTotal = feedWh + medWh + otherWh;
    const sum = rawTotal || 1;
    return {
      feedWh,
      medWh,
      otherWh,
      totalVal: rawTotal,
      allUnitsText: formatUnitMap(mergeUnitMaps(feedUnits, medUnits, otherUnits), { compact: true, maxItems: 4 }),
      feedQtyText: formatUnitMap(feedUnits, { compact: true, maxItems: 2 }),
      medQtyText: formatUnitMap(medUnits, { compact: true, maxItems: 3 }),
      otherQtyText: formatUnitMap(otherUnits, { compact: true, maxItems: 2 }),
      sum,
      feedPct: (feedWh / sum) * 100,
      medPct: (medWh / sum) * 100,
      otherPct: (otherWh / sum) * 100,
    };
  }, [warehouses]);

  const allocCards = useMemo(() => {
    const feed = stockBreakdown?.FEED || { value: 0, count: 0, unitMap: {} };
    const grain = stockBreakdown?.GRAIN || { value: 0, count: 0, unitMap: {} };
    const vaccine = stockBreakdown?.VACCINE || { value: 0, count: 0, unitMap: {} };
    const med = stockBreakdown?.MEDICINE || { value: 0, count: 0, unitMap: {} };
    const supply = stockBreakdown?.SUPPLY || { value: 0, count: 0, unitMap: {} };

    const medSupplyVal = Number(med.value || 0) + Number(supply.value || 0);
    const medSupplyCount = Number(med.count || 0) + Number(supply.count || 0);
    const medSupplyUnits = mergeUnitMaps(med.unitMap, supply.unitMap);
    const totalVal = Number(feed.value || 0) + Number(grain.value || 0) + Number(vaccine.value || 0) + medSupplyVal;

    const pct = (v) => (totalVal > 0 ? (v / totalVal) * 100 : 0);

    return [
      {
        key: 'FEED',
        filterKey: 'FEED',
        label: 'Cám công nghiệp',
        color: CHART_COLORS.feed,
        value: Number(feed.value || 0),
        pct: pct(Number(feed.value || 0)),
        count: Number(feed.count || 0),
        qtyText: formatUnitMap(feed.unitMap, { compact: true, maxItems: 2 }),
      },
      {
        key: 'GRAIN',
        filterKey: 'GRAIN',
        label: 'Ngũ cốc & Nguyên liệu',
        color: CHART_COLORS.grain,
        value: Number(grain.value || 0),
        pct: pct(Number(grain.value || 0)),
        count: Number(grain.count || 0),
        qtyText: formatUnitMap(grain.unitMap, { compact: true, maxItems: 2 }),
      },
      {
        key: 'VACCINE',
        filterKey: 'VACCINE',
        label: 'Vắc-xin phòng bệnh',
        color: CHART_COLORS.vaccine,
        value: Number(vaccine.value || 0),
        pct: pct(Number(vaccine.value || 0)),
        count: Number(vaccine.count || 0),
        qtyText: formatUnitMap(vaccine.unitMap, { compact: true, maxItems: 2 }),
      },
      {
        key: 'MED_SUPPLY',
        filterKey: Number(supply.count || 0) > 0 ? 'MED_SUPPLY' : 'MEDICINE',
        label: Number(supply.count || 0) > 0 ? 'Thuốc thú y & Vật tư' : 'Thuốc thú y & Bổ trợ',
        color: CHART_COLORS.medicine,
        value: medSupplyVal,
        pct: pct(medSupplyVal),
        count: medSupplyCount,
        qtyText: formatUnitMap(medSupplyUnits, { compact: true, maxItems: 3 }),
      },
    ];
  }, [stockBreakdown]);

  const maxWhVal = Math.max(1, ...warehouses.map((w) => Number(w.value || 0)));
  const L = 132;
  const R = 288;
  const T = 8;
  const rowH = 26;
  const W = 640;
  const H = T + Math.max(1, warehouses.length) * rowH + 10;
  const plotW = W - L - R;
  const X = (v) => L + (v / maxWhVal) * plotW;

  return (
    <section className={styles.chartCard} aria-label="Phân bổ giá trị và số lượng tồn kho theo kho">
      <div className={styles.chartHeader}>
        <div className={styles.chartTitleGroup}>
          <h3 className={styles.chartTitle}><Warehouse size={16} color="#007968" /> Phân bổ Kho Cám vs Kho Thuốc (Tiền &amp; Số lượng)</h3>
          <span className={styles.chartSubtitle}>Bấm vào cột kho hoặc thẻ nhóm bên dưới để lọc chi tiết mặt hàng</span>
        </div>
        <Link to="/inventory" className={styles.moduleNavLink}>
          Kiểm kê kho vật tư <ArrowUpRight size={14} />
        </Link>
      </div>

      {warehouses.length > 0 && (
        <div className={styles.warehouseGroupBox}>
          <div className={styles.warehouseGroupHead}>
            <span>Phân bổ theo khối kho lưu trữ</span>
            <span>
              {fmtVnd(whGroups.totalVal)}
              {whGroups.allUnitsText ? ` · ${whGroups.allUnitsText}` : ''}
            </span>
          </div>
          <div className={styles.warehouseGroupTrack}>
            {whGroups.feedPct > 0 && (
              <div
                className={styles.warehouseGroupSeg}
                style={{ width: `${whGroups.feedPct}%`, background: '#0284c7' }}
                title={`Khối Kho Cám: ${fmtVnd(whGroups.feedWh)} (${whGroups.feedQtyText || '0'})`}
              />
            )}
            {whGroups.medPct > 0 && (
              <div
                className={styles.warehouseGroupSeg}
                style={{ width: `${whGroups.medPct}%`, background: '#7c3aed' }}
                title={`Khối Kho Thuốc & Vắc-xin: ${fmtVnd(whGroups.medWh)} (${whGroups.medQtyText || '0'})`}
              />
            )}
            {whGroups.otherPct > 0 && (
              <div
                className={styles.warehouseGroupSeg}
                style={{ width: `${whGroups.otherPct}%`, background: '#14b8a6' }}
                title={`Kho khác: ${fmtVnd(whGroups.otherWh)} (${whGroups.otherQtyText || '0'})`}
              />
            )}
          </div>
          <div className={styles.warehouseGroupLegend}>
            <span className={styles.chartLegendItem}>
              <i className={styles.chartLegendSwatch} style={{ background: '#0284c7' }} />
              Khối Kho Cám: <strong>{fmtNum(whGroups.feedPct, 1)}%</strong> ({shortMoney(whGroups.feedWh)}
              {whGroups.feedQtyText ? ` · ${whGroups.feedQtyText}` : ''})
            </span>
            <span className={styles.chartLegendItem}>
              <i className={styles.chartLegendSwatch} style={{ background: '#7c3aed' }} />
              Khối Kho Thuốc/Vắc-xin: <strong>{fmtNum(whGroups.medPct, 1)}%</strong> ({shortMoney(whGroups.medWh)}
              {whGroups.medQtyText ? ` · ${whGroups.medQtyText}` : ''})
            </span>
            {whGroups.otherWh > 0 && (
              <span className={styles.chartLegendItem}>
                <i className={styles.chartLegendSwatch} style={{ background: '#14b8a6' }} />
                Kho khác: <strong>{fmtNum(whGroups.otherPct, 1)}%</strong> ({shortMoney(whGroups.otherWh)}
                {whGroups.otherQtyText ? ` · ${whGroups.otherQtyText}` : ''})
              </span>
            )}
          </div>
        </div>
      )}

      {warehouses.length > 0 ? (
        <div className={styles.svgPlot} onMouseLeave={() => setTip(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Biểu đồ giá trị và số lượng tồn kho theo từng kho">
            {warehouses.map((wh, i) => {
              const val = Number(wh.value || 0);
              const sharePct = whGroups.totalVal > 0 ? (val / whGroups.totalVal) * 100 : 0;
              const y = T + i * rowH + 4;
              const barH = rowH - 10;
              const w = Math.max(4, X(val) - L);
              const isSelected = selectedWarehouse === wh.name;
              const isMedWh = String(wh.kind || '').toUpperCase() === 'MEDICINE'
                || String(wh.name || '').toLowerCase().includes('thuốc');
              const isFeedWh = String(wh.kind || '').toUpperCase() === 'FEED'
                || String(wh.name || '').toLowerCase().includes('cám');
              const baseFill = isMedWh ? '#7c3aed' : (isFeedWh ? '#0284c7' : '#14b8a6');
              const shortWhName = wh.name.length > 19 ? `${wh.name.slice(0, 18)}…` : wh.name;
              const qtyShortRaw = formatUnitMap(wh.unitMap, { compact: true, shortNumbers: true, maxItems: 2 });
              const qtyExact = formatUnitMap(wh.unitMap, { compact: false, maxItems: 6 });
              const textX = L + w + 6;
              const maxBarChars = Math.max(18, Math.floor((W - textX - 6) / 5.8));
              let barLabel = `${shortMoney(val)}${qtyShortRaw ? ` · ${qtyShortRaw}` : ` (${wh.skus})`}`;
              if (barLabel.length > maxBarChars && qtyShortRaw) {
                const compactNoParens = qtyShortRaw.replace(/\s*\([^)]*\)/g, '');
                barLabel = `${shortMoney(val)} · ${compactNoParens}`;
              }
              if (barLabel.length > maxBarChars && qtyShortRaw) {
                const qtySingle = formatUnitMap(wh.unitMap, { compact: true, shortNumbers: true, maxItems: 1 }).replace(/\s*\([^)]*\)/g, '');
                barLabel = `${shortMoney(val)}${qtySingle ? ` · ${qtySingle}` : ''}`;
              }
              if (barLabel.length > maxBarChars) {
                barLabel = `${barLabel.slice(0, Math.max(1, maxBarChars - 1))}…`;
              }

              const showTip = () =>
                setTip({
                  x: (X(val) / W) * 100,
                  y,
                  title: wh.name,
                  lines: [
                    `Giá trị tồn: ${fmtVnd(val)} (${fmtNum(sharePct, 1)}%)`,
                    `Số lượng tồn: ${qtyExact || '0'}`,
                    `${wh.skus} mặt hàng · Bấm để lọc theo kho`,
                  ],
                });

              return (
                <g
                  key={wh.name}
                  tabIndex={0}
                  onMouseEnter={showTip}
                  onFocus={showTip}
                  onTouchStart={showTip}
                  onClick={() => { showTip(); onSelectWarehouse(isSelected ? 'ALL' : wh.name); }}
                  style={{ cursor: 'pointer' }}
                >
                  <rect
                    x={0}
                    y={T + i * rowH}
                    width={W}
                    height={rowH}
                    rx="4"
                    fill={isSelected ? '#e8f6f1' : 'transparent'}
                  />
                  <text x={L - 8} y={y + barH / 2 + 4} textAnchor="end" className={styles.axisText}>
                    {shortWhName}
                  </text>
                  <rect
                    x={L}
                    y={y}
                    width={w}
                    height={barH}
                    rx="4"
                    fill={baseFill}
                    fillOpacity={selectedWarehouse !== 'ALL' && !isSelected ? 0.35 : 1}
                  />
                  <text x={textX} y={y + barH / 2 + 4} className={styles.barValueText}>
                    {barLabel}
                  </text>
                </g>
              );
            })}
          </svg>
          <ChartTooltip tip={tip} />
        </div>
      ) : (
        <p className={styles.chartEmpty}>Không có dữ liệu kho lưu trữ phù hợp.</p>
      )}

      <div className={styles.allocGrid}>
        {allocCards.map((card) => {
          const isSelected = activeCategoryFilter === card.filterKey
            || (card.key === 'MED_SUPPLY' && activeCategoryFilter === 'MED_VAC');
          return (
            <button
              key={card.key}
              type="button"
              className={`${styles.healthCard} ${isSelected ? styles.healthCardActive : ''}`}
              onClick={() => onSelectCategoryFilter && onSelectCategoryFilter(isSelected ? 'ALL' : card.filterKey)}
              title={`Bấm để lọc bảng kiểm kê theo ${card.label}`}
            >
              <div className={styles.allocTop}>
                <span className={styles.healthLabel} style={{ color: card.color }}>{card.label}</span>
                <span className={styles.allocPct}>{fmtNum(card.pct, 1)}%</span>
              </div>
              <span className={styles.healthCount}>{shortMoney(card.value)}</span>
              <span className={styles.allocQty}>
                {card.qtyText ? `${card.qtyText} · ` : ''}{card.count} mặt hàng
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ── Chart 2D: Internal Stock Category Donut + Top Destinations ─────────────────────────────── */
export function InternalStockVisualRow({ items }) {
  const [tip, setTip] = useState(null);

  const { segments, totalAmt, destinations } = useMemo(() => {
    const catMap = new Map();
    const dstMap = new Map();
    let total = 0;

    for (const iv of items) {
      const amt = Number(iv.totalAmount || 0);
      total += amt;
      const meta = classifyItemCategory({
        name: iv.itemName,
        categoryName: iv.categoryName,
        warehouseName: iv.sourceWarehouse,
      });
      const prev = catMap.get(meta.key) || { key: meta.key, label: meta.label, color: meta.color, value: 0, count: 0 };
      prev.value += amt;
      prev.count += 1;
      catMap.set(meta.key, prev);

      const dst = iv.targetDestination || 'Khác';
      const prevD = dstMap.get(dst) || { name: dst, value: 0, count: 0 };
      prevD.value += amt;
      prevD.count += 1;
      dstMap.set(dst, prevD);
    }

    return {
      segments: Array.from(catMap.values()).filter((s) => s.value > 0).sort((a, b) => b.value - a.value),
      totalAmt: total,
      destinations: Array.from(dstMap.values()).sort((a, b) => b.value - a.value).slice(0, 6),
    };
  }, [items]);

  const arcs = buildDonutArcs(segments, totalAmt);

  return (
    <div className={styles.analyticsGridEqual}>
      <section className={styles.chartCard} aria-label="Biểu đồ Cơ cấu vật tư xuất nội bộ">
        <div className={styles.chartHeader}>
          <div className={styles.chartTitleGroup}>
            <h3 className={styles.chartTitle}><PieChart size={16} color="#0284c7" /> Tỷ trọng Vật tư Luân chuyển Nội bộ</h3>
            <span className={styles.chartSubtitle}>Cám · Ngũ cốc · Vắc-xin · Thuốc thú y · Vật tư khác</span>
          </div>
        </div>
        {totalAmt <= 0 ? (
          <p className={styles.chartEmpty}>Chưa có giá trị xuất / chuyển kho nội bộ trong kỳ.</p>
        ) : (
          <div className={styles.donutLayout}>
            <div className={`${styles.donutSvgWrap} ${styles.svgPlot}`} onMouseLeave={() => setTip(null)}>
              <svg viewBox="0 0 210 200" role="img" aria-label={`Tổng giá trị nội bộ ${fmtVnd(totalAmt)}`}>
                {arcs.map((arc) => {
                  const showTip = () =>
                    setTip({
                      x: ((105 + 82 * Math.cos(arc.mid)) / 210) * 100,
                      y: 100 + 82 * Math.sin(arc.mid),
                      title: arc.label,
                      lines: [fmtVnd(arc.value), `Chiếm ${fmtNum(arc.pct, 1)}% (${arc.count} dòng)`],
                    });
                  return (
                    <path
                      key={arc.key}
                      d={arc.d}
                      fill={arc.color}
                      stroke="#ffffff"
                      strokeWidth="2"
                      tabIndex={0}
                      onMouseEnter={showTip}
                      onFocus={showTip}
                      onClick={showTip}
                      onTouchStart={showTip}
                      style={{ cursor: 'pointer' }}
                    />
                  );
                })}
                <text x={105} y={98} textAnchor="middle" className={styles.donutCenterValue}>{shortMoney(totalAmt)}</text>
                <text x={105} y={115} textAnchor="middle" className={styles.donutCenterLabel}>luân chuyển</text>
              </svg>
              <ChartTooltip tip={tip} />
            </div>
            <ul className={styles.donutLegendList}>
              {arcs.map((arc) => (
                <li key={arc.key} className={styles.donutLegendItem}>
                  <div className={styles.donutLegendTop}>
                    <span className={styles.donutLegendName}>
                      <i className={styles.chartLegendSwatch} style={{ background: arc.color }} />
                      {arc.label} ({arc.count})
                    </span>
                    <div className={styles.donutLegendAmounts}>
                      <span className={styles.donutLegendPct}>{fmtNum(arc.pct, 1)}%</span>
                      <span className={styles.donutLegendMoney}>{fmtVnd(arc.value)}</span>
                    </div>
                  </div>
                  <div className={styles.progressTrack}>
                    <div className={styles.progressFill} style={{ width: `${Math.min(100, arc.pct)}%`, background: arc.color }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className={styles.chartCard} aria-label="Nơi nhận vật tư nội bộ nhiều nhất">
        <div className={styles.chartHeader}>
          <div className={styles.chartTitleGroup}>
            <h3 className={styles.chartTitle}><BarChart3 size={16} color="#007968" /> Nơi nhận / Chuồng tiếp nhận nhiều nhất</h3>
            <span className={styles.chartSubtitle}>Xếp theo tổng giá trị vật tư đã điều chuyển</span>
          </div>
        </div>
        {destinations.length === 0 ? (
          <p className={styles.chartEmpty}>Chưa có nơi nhận phát sinh trong kỳ.</p>
        ) : (
          <ul className={styles.rankedList}>
            {destinations.map((d) => {
              const maxD = destinations[0].value || 1;
              return (
                <li key={d.name} className={styles.rankedItem}>
                  <div className={styles.rankedItemTop}>
                    <span className={styles.rankedName}>{d.name} ({d.count} lượt)</span>
                    <span className={styles.rankedValue}>{fmtVnd(d.value)}</span>
                  </div>
                  <div className={styles.progressTrack}>
                    <div className={styles.progressFill} style={{ width: `${Math.max(4, (d.value / maxD) * 100)}%`, background: '#007968' }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

const ACTIVITY_MODULE_COLORS = {
  'Ghi nhật ký': '#007968',
  'Đàn gia cầm': '#db2777',
  'Nhập hàng': '#0284c7',
  'Bán hàng': '#d97706',
  'Xuất nhập nội bộ': '#7c3aed',
};

/* ── Chart 2E: Activity Breakdown by Module + Top Staff ────────────────────────────────────── */
export function ActivityVisualRow({ items, activeModule, onSelectModule }) {
  const [tip, setTip] = useState(null);

  const { modSegments, totalOps, topActors } = useMemo(() => {
    const modMap = new Map();
    const actMap = new Map();
    for (const a of items) {
      const m = a.module || 'Khác';
      const prevM = modMap.get(m) || { key: m, label: m, value: 0, color: ACTIVITY_MODULE_COLORS[m] || '#64748b' };
      prevM.value += 1;
      modMap.set(m, prevM);

      const actor = a.actor || 'Hệ thống';
      const prevA = actMap.get(actor) || { name: actor, count: 0, modules: new Set() };
      prevA.count += 1;
      prevA.modules.add(m);
      actMap.set(actor, prevA);
    }
    return {
      modSegments: Array.from(modMap.values()).sort((a, b) => b.value - a.value),
      totalOps: items.length,
      topActors: Array.from(actMap.values()).sort((a, b) => b.count - a.count).slice(0, 6),
    };
  }, [items]);

  const arcs = buildDonutArcs(modSegments, totalOps);

  return (
    <div className={styles.analyticsGridEqual}>
      <section className={styles.chartCard} aria-label="Biểu đồ Phân bổ hoạt động theo phân hệ">
        <div className={styles.chartHeader}>
          <div className={styles.chartTitleGroup}>
            <h3 className={styles.chartTitle}><PieChart size={16} color="#007968" /> Tỷ trọng Hoạt động theo Phân hệ</h3>
            <span className={styles.chartSubtitle}>Bấm vào nhóm phân hệ để lọc nhật ký bên dưới</span>
          </div>
        </div>
        {totalOps === 0 ? (
          <p className={styles.chartEmpty}>Chưa có hoạt động nào được ghi nhận.</p>
        ) : (
          <div className={styles.donutLayout}>
            <div className={`${styles.donutSvgWrap} ${styles.svgPlot}`} onMouseLeave={() => setTip(null)}>
              <svg viewBox="0 0 210 200" role="img" aria-label={`Tổng ${totalOps} hoạt động`}>
                {arcs.map((arc) => {
                  const isSelected = activeModule === arc.key;
                  const showTip = () =>
                    setTip({
                      x: ((105 + 82 * Math.cos(arc.mid)) / 210) * 100,
                      y: 100 + 82 * Math.sin(arc.mid),
                      title: arc.label,
                      lines: [`${arc.value} thao tác (${fmtNum(arc.pct, 1)}%)`, 'Bấm để lọc theo phân hệ này'],
                    });
                  return (
                    <path
                      key={arc.key}
                      d={arc.d}
                      fill={arc.color}
                      fillOpacity={activeModule !== 'ALL' && !isSelected ? 0.35 : 1}
                      stroke="#ffffff"
                      strokeWidth={isSelected ? '3' : '2'}
                      tabIndex={0}
                      onMouseEnter={showTip}
                      onFocus={showTip}
                      onTouchStart={showTip}
                      onClick={() => { showTip(); onSelectModule(isSelected ? 'ALL' : arc.key); }}
                      style={{ cursor: 'pointer' }}
                    />
                  );
                })}
                <text x={105} y={98} textAnchor="middle" className={styles.donutCenterValue}>{totalOps}</text>
                <text x={105} y={115} textAnchor="middle" className={styles.donutCenterLabel}>thao tác</text>
              </svg>
              <ChartTooltip tip={tip} />
            </div>
            <ul className={styles.donutLegendList}>
              {arcs.map((arc) => {
                const isSelected = activeModule === arc.key;
                return (
                  <li
                    key={arc.key}
                    className={`${styles.donutLegendItem} ${styles.donutInteractiveItem} ${isSelected ? styles.donutInteractiveItemActive : ''}`}
                  >
                    <button
                      type="button"
                      className={styles.donutInteractiveBtn}
                      onClick={() => onSelectModule(isSelected ? 'ALL' : arc.key)}
                    >
                      <div className={styles.donutLegendTop}>
                        <span className={styles.donutLegendName}>
                          <i className={styles.chartLegendSwatch} style={{ background: arc.color }} />
                          {arc.label}
                        </span>
                        <div className={styles.donutLegendAmounts}>
                          <span className={styles.donutLegendPct}>{fmtNum(arc.pct, 1)}%</span>
                          <span className={styles.donutLegendMoney}>{arc.value} lượt</span>
                        </div>
                      </div>
                      <div className={styles.progressTrack}>
                        <div className={styles.progressFill} style={{ width: `${Math.min(100, arc.pct)}%`, background: arc.color }} />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      <section className={styles.chartCard} aria-label="Nhân sự và đối tác hoạt động nhiều nhất">
        <div className={styles.chartHeader}>
          <div className={styles.chartTitleGroup}>
            <h3 className={styles.chartTitle}><BarChart3 size={16} color="#0284c7" /> Nhân sự &amp; Đối tác Phát sinh Nghiệp vụ</h3>
            <span className={styles.chartSubtitle}>Xếp theo tần suất thực hiện nghiệp vụ trong kỳ</span>
          </div>
        </div>
        {topActors.length === 0 ? (
          <p className={styles.chartEmpty}>Chưa có dữ liệu nhân sự thực hiện.</p>
        ) : (
          <ul className={styles.rankedList}>
            {topActors.map((a) => {
              const maxA = topActors[0].count || 1;
              return (
                <li key={a.name} className={styles.rankedItem}>
                  <div className={styles.rankedItemTop}>
                    <span className={styles.rankedName}>
                      {a.name} <span className={styles.donutSubMeta}>({Array.from(a.modules).join(', ')})</span>
                    </span>
                    <span className={styles.rankedValue}>{a.count} thao tác</span>
                  </div>
                  <div className={styles.progressTrack}>
                    <div className={styles.progressFill} style={{ width: `${Math.max(5, (a.count / maxA) * 100)}%`, background: '#0284c7' }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ── Chart 3: Horizontal Bar SVG — So sánh FCR giữa các Chuồng (Ngưỡng 2.20) ────────────────── */
export function FcrComparisonChart({ cycles }) {
  const [tip, setTip] = useState(null);
  const rows = useMemo(() => cycles.filter((g) => g.fcr !== null && g.fcr !== undefined).slice(0, 10), [cycles]);

  if (!rows.length) return null;

  const targetFcr = 2.2;
  const maxVal = Math.max(targetFcr * 1.25, ...rows.map((r) => Number(r.fcr || 0))) * 1.1;
  const L = 128;
  const R = 68;
  const T = 18;
  const rowH = 28;
  const W = 640;
  const H = T + rows.length * rowH + 26;
  const plotW = W - L - R;
  const X = (v) => L + (Math.min(v, maxVal) / maxVal) * plotW;

  return (
    <section className={styles.chartCard} aria-label="Biểu đồ So sánh FCR theo chuồng">
      <div className={styles.chartHeader}>
        <div className={styles.chartTitleGroup}>
          <h3 className={styles.chartTitle}><BarChart3 size={16} color="#007968" /> So sánh Hệ số chuyển đổi thức ăn (FCR) theo Chuồng</h3>
          <span className={styles.chartSubtitle}>FCR càng thấp càng tiết kiệm cám · Đường đứt nét là mức chuẩn {fmtNum(targetFcr, 2)}</span>
        </div>
        <div className={styles.chartLegend}>
          <span className={styles.chartLegendItem}><i className={styles.chartLegendSwatch} style={{ background: '#007968' }} />Rất tốt (&le; 2,0)</span>
          <span className={styles.chartLegendItem}><i className={styles.chartLegendSwatch} style={{ background: '#0284c7' }} />Đạt chuẩn (&le; 2,3)</span>
          <span className={styles.chartLegendItem}><i className={styles.chartLegendSwatch} style={{ background: '#d97706' }} />Cần tối ưu (&gt; 2,3)</span>
        </div>
      </div>

      <div className={styles.svgPlot} onMouseLeave={() => setTip(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Biểu đồ ngang FCR các chuồng">
          <line x1={L} x2={L} y1={T} y2={H - 22} stroke={CHART_COLORS.axis} />
          {[0, 1, 2, 2.5, 3].filter((t) => t <= maxVal).map((t) => (
            <g key={t}>
              <line x1={X(t)} x2={X(t)} y1={T} y2={H - 22} stroke={CHART_COLORS.grid} />
              <text x={X(t)} y={H - 7} textAnchor="middle" className={styles.axisText}>{fmtNum(t, 1)}</text>
            </g>
          ))}

          {rows.map((g, i) => {
            const val = Number(g.fcr || 0);
            const y = T + i * rowH + 5;
            const h = rowH - 11;
            const w = Math.max(2, X(val) - L);
            const fill = val <= 2.0 ? '#007968' : val <= 2.3 ? '#0284c7' : '#d97706';
            const label = `${g.barnName} (${g.cycleCode})`;
            const showTip = () =>
              setTip({
                x: (X(val) / W) * 100,
                y,
                title: label,
                lines: [
                  `Hệ số FCR: ${fmtNum(val, 2)}`,
                  `Cân TB: ${g.avgWeightKg ? `${fmtNum(g.avgWeightKg, 2)} kg` : '—'} · Cám: ${fmtNum(g.feedKg, 0)} kg`,
                  `Tỷ lệ sống: ${fmtNum(g.survivalRate, 1)}%${g.adgGrams ? ` · ADG: ${fmtNum(g.adgGrams, 1)} g/ngày` : ''}`,
                ],
              });

            return (
              <g key={g.cycleId || i} onMouseEnter={showTip} onFocus={showTip} onClick={showTip} onTouchStart={showTip} tabIndex={0} style={{ cursor: 'pointer' }}>
                <rect x={0} y={T + i * rowH} width={W} height={rowH} fill="transparent" />
                <text x={L - 8} y={y + h / 2 + 4} textAnchor="end" className={styles.axisText}>
                  {label.length > 18 ? `${label.slice(0, 17)}…` : label}
                </text>
                <rect x={L} y={y} width={w} height={h} rx="4" fill={fill} />
                <text x={L + w + 6} y={y + h / 2 + 4} className={styles.barValueText}>{fmtNum(val, 2)}</text>
              </g>
            );
          })}

          <line
            x1={X(targetFcr)}
            x2={X(targetFcr)}
            y1={T - 4}
            y2={H - 22}
            stroke="#dc2626"
            strokeDasharray="5 4"
            strokeWidth="1.5"
          />
          <text x={X(targetFcr) + 4} y={T + 6} className={styles.axisText} fill="#dc2626">
            Chuẩn {fmtNum(targetFcr, 2)}
          </text>
        </svg>
        <ChartTooltip tip={tip} />
      </div>
    </section>
  );
}

/* ── Chart 4: Harvest Revenue Comparison Bar Chart ─────────────────────────────────────────── */
export function HarvestRevenueChart({ rows }) {
  const [tip, setTip] = useState(null);
  const topRows = useMemo(() => rows.slice(0, 8), [rows]);
  if (!topRows.length) return null;

  const maxRev = Math.max(1, ...topRows.map((h) => Number(h.totalRevenue || 0)));
  const L = 128;
  const R = 148;
  const T = 12;
  const rowH = 28;
  const W = 640;
  const H = T + topRows.length * rowH + 14;
  const plotW = W - L - R;
  const X = (v) => L + (v / maxRev) * plotW;

  return (
    <section className={styles.chartCard} aria-label="Biểu đồ Doanh thu thu hoạch theo chuồng">
      <div className={styles.chartHeader}>
        <div className={styles.chartTitleGroup}>
          <h3 className={styles.chartTitle}><BarChart3 size={16} color="#007968" /> Doanh thu &amp; Sản lượng Thu hoạch theo Chuồng</h3>
          <span className={styles.chartSubtitle}>Xếp theo các lứa xuất chuồng gần nhất</span>
        </div>
      </div>

      <div className={styles.svgPlot} onMouseLeave={() => setTip(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Biểu đồ doanh thu thu hoạch">
          {topRows.map((h, i) => {
            const rev = Number(h.totalRevenue || 0);
            const y = T + i * rowH + 5;
            const barH = rowH - 11;
            const w = Math.max(2, X(rev) - L);
            const label = `${h.barnName} · ${h.cycleCode}`;
            const showTip = () =>
              setTip({
                x: (X(rev) / W) * 100,
                y,
                title: label,
                lines: [
                  `Doanh thu: ${fmtVnd(rev)}`,
                  `Sản lượng: ${fmtNum(h.totalWeightKg, 1)} kg (${fmtNum(h.totalHead)} con)`,
                  `Giá bình quân: ${fmtVnd(h.avgPricePerKg)}/kg`,
                ],
              });

            return (
              <g key={h.cycleId || i} onMouseEnter={showTip} onFocus={showTip} onClick={showTip} onTouchStart={showTip} tabIndex={0} style={{ cursor: 'pointer' }}>
                <rect x={0} y={T + i * rowH} width={W} height={rowH} fill="transparent" />
                <text x={L - 8} y={y + barH / 2 + 4} textAnchor="end" className={styles.axisText}>
                  {label.length > 18 ? `${label.slice(0, 17)}…` : label}
                </text>
                <rect x={L} y={y} width={w} height={barH} rx="4" fill="#007968" />
                <text x={L + w + 6} y={y + barH / 2 + 4} className={styles.barValueText}>
                  {shortMoney(rev)} ({fmtNum(h.totalWeightKg, 0)} kg)
                </text>
              </g>
            );
          })}
        </svg>
        <ChartTooltip tip={tip} />
      </div>
    </section>
  );
}

/* ── Chart 5: Sales Payment & Debt SVG Donut Chart ─────────────────────────────────────────── */
export function SalesPaymentDonutChart({ paidAmount, debtAmount, orders, activeStatus, onSelectStatus }) {
  const [hovered, setHovered] = useState(null);
  const paid = Math.max(0, Number(paidAmount || 0));
  const debt = Math.max(0, Number(debtAmount || 0));
  const total = paid + debt;

  const r = 60;
  const cx = 90;
  const cy = 90;
  const circ = 2 * Math.PI * r;

  const slices = useMemo(() => {
    const raw = [
      { key: 'paid', label: 'Tiền đã thu thực tế', value: paid, color: '#007968' },
      { key: 'debt', label: 'Còn phải thu (Công nợ)', value: debt, color: '#d97706' },
    ];
    let offset = 0;
    return raw.map((s) => {
      const pct = total > 0 ? (s.value / total) * 100 : 0;
      const len = (pct / 100) * circ;
      const item = { ...s, pct, len, offset };
      offset += len;
      return item;
    });
  }, [paid, debt, total, circ]);

  const statusBreakdown = useMemo(() => {
    const counts = { PAID: 0, PARTIAL: 0, CREDIT: 0 };
    for (const o of orders) {
      if (o.status === 'DEBT') counts.CREDIT += 1;
      else if (counts[o.status] !== undefined) counts[o.status] += 1;
    }
    return [
      { key: 'PAID', label: 'Thanh toán đủ', count: counts.PAID, color: '#007968' },
      { key: 'PARTIAL', label: 'Một phần', count: counts.PARTIAL, color: '#0284c7' },
      { key: 'CREDIT', label: 'Ghi nợ', count: counts.CREDIT, color: '#d97706' },
    ];
  }, [orders]);

  const paidPct = total > 0 ? (paid / total) * 100 : 0;
  const activeSlice = hovered !== null ? slices[hovered] : null;

  return (
    <section className={styles.chartCard} aria-label="Tiến độ thu tiền bán hàng">
      <div className={styles.chartHeader}>
        <div className={styles.chartTitleGroup}>
          <h3 className={styles.chartTitle}>
            <PieChart size={16} color="#007968" /> Cơ cấu Thu tiền &amp; Công nợ Bán hàng
          </h3>
          <span className={styles.chartSubtitle}>
            Tỷ lệ thu tiền thực tế so với dư nợ thương lái · Nhấp trạng thái để lọc đơn
          </span>
        </div>
        <Link to="/sales?tab=orders" className={styles.moduleNavLink}>
          Quản lý bán hàng <ArrowUpRight size={14} />
        </Link>
      </div>

      {total <= 0 ? (
        <p className={styles.chartEmpty}>Chưa phát sinh doanh thu bán hàng trong kỳ báo cáo.</p>
      ) : (
        <div className={styles.donutLayout}>
          <div className={styles.donutSvgWrap}>
            <svg viewBox="0 0 180 180" role="img" aria-label="Biểu đồ tròn thu hồi công nợ bán hàng">
              <circle cx={cx} cy={cy} r={r} fill="none" stroke="#eef4f2" strokeWidth="22" />
              {slices.map((s, i) => (
                <circle
                  key={s.key}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={hovered === i ? 26 : 22}
                  strokeDasharray={`${s.len} ${Math.max(0, circ - s.len)}`}
                  strokeDashoffset={-s.offset}
                  transform={`rotate(-90 ${cx} ${cy})`}
                  style={{ cursor: 'pointer', transition: 'stroke-width 0.15s ease' }}
                  onMouseEnter={() => setHovered(i)}
                  onTouchStart={() => setHovered(i)}
                  onClick={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                />
              ))}
              <text x={cx} y={cy - 10} textAnchor="middle" className={styles.donutCenterSub}>
                {activeSlice ? activeSlice.label.slice(0, 16) : 'ĐÃ THU HỒI'}
              </text>
              <text x={cx} y={cy + 8} textAnchor="middle" className={styles.donutCenterLabel}>
                {activeSlice ? `${fmtNum(activeSlice.pct, 1)}%` : `${fmtNum(paidPct, 1)}%`}
              </text>
              <text x={cx} y={cy + 23} textAnchor="middle" className={styles.donutCenterSub}>
                {activeSlice ? shortMoney(activeSlice.value) : shortMoney(total)}
              </text>
            </svg>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <ul className={styles.donutLegendList}>
              {slices.map((s, i) => (
                <li
                  key={s.key}
                  className={styles.donutLegendRow}
                  onMouseEnter={() => setHovered(i)}
                  onTouchStart={() => setHovered(i)}
                  onClick={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <span className={styles.donutLegendLeft}>
                    <i className={styles.chartLegendSwatch} style={{ background: s.color }} />
                    <span>{s.label}</span>
                  </span>
                  <span className={styles.donutLegendRight}>
                    {fmtVnd(s.value)}
                    <span className={styles.donutPctBadge}>{fmtNum(s.pct, 1)}%</span>
                  </span>
                </li>
              ))}
            </ul>

            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
              {statusBreakdown.map((st) => {
                const isSelected = activeStatus === st.key;
                return (
                  <button
                    key={st.key}
                    type="button"
                    className={`${styles.filterPill} ${isSelected ? styles.filterPillActive : ''}`}
                    style={{ padding: '4px 10px', fontSize: '11.5px' }}
                    onClick={() => onSelectStatus && onSelectStatus(isSelected ? 'ALL' : st.key)}
                  >
                    <i
                      className={styles.pillDot}
                      style={{ background: isSelected ? '#ffffff' : st.color }}
                    />
                    <span>{st.label}: {st.count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ── Chart 6: Purchase Payment & Category Structure SVG Donut Chart ─────────────────────────── */
export function PurchaseStructureDonutChart({ paidAmount, debtAmount, invoices }) {
  const [mode, setMode] = useState('payment');
  const [hovered, setHovered] = useState(null);

  const slicesData = useMemo(() => {
    if (mode === 'payment') {
      const paid = Math.max(0, Number(paidAmount || 0));
      const debt = Math.max(0, Number(debtAmount || 0));
      return [
        { key: 'paid', label: 'Đã thanh toán NCC', value: paid, color: '#007968', count: null },
        { key: 'debt', label: 'Còn nợ phải trả NCC', value: debt, color: '#dc2626', count: null },
      ];
    }
    const groups = {
      FEED: { key: 'FEED', label: 'Kho Cám & Thức ăn', value: 0, count: 0, color: '#0284c7' },
      MED: { key: 'MED', label: 'Kho Thuốc & Vắc-xin', value: 0, count: 0, color: '#7c3aed' },
      CHICK: { key: 'CHICK', label: 'Con giống & Khác', value: 0, count: 0, color: '#d97706' },
    };
    for (const inv of invoices) {
      if (String(inv.stockStatus || '').toLowerCase() === 'đã hủy') continue;
      const wh = String(inv.warehouseSummary || '').toLowerCase();
      const amt = Number(inv.totalAmount || 0);
      if (wh.includes('cám') || wh.includes('thức ăn') || wh.includes('ngô')) {
        groups.FEED.value += amt;
        groups.FEED.count += 1;
      } else if (wh.includes('thuốc') || wh.includes('vắc') || wh.includes('vac') || wh.includes('thú y')) {
        groups.MED.value += amt;
        groups.MED.count += 1;
      } else {
        groups.CHICK.value += amt;
        groups.CHICK.count += 1;
      }
    }
    return Object.values(groups).filter((g) => g.value > 0 || g.count > 0);
  }, [mode, paidAmount, debtAmount, invoices]);

  const total = slicesData.reduce((s, d) => s + d.value, 0);
  const r = 60;
  const cx = 90;
  const cy = 90;
  const circ = 2 * Math.PI * r;

  let offset = 0;
  const slices = slicesData.map((s) => {
    const pct = total > 0 ? (s.value / total) * 100 : 0;
    const len = (pct / 100) * circ;
    const item = { ...s, pct, len, offset };
    offset += len;
    return item;
  });

  const activeSlice = hovered !== null && slices[hovered] ? slices[hovered] : null;
  const paidPct = total > 0 && mode === 'payment' ? ((Number(paidAmount || 0) / total) * 100) : 0;

  return (
    <section className={styles.chartCard} aria-label="Tiến độ thanh toán nhà cung cấp">
      <div className={styles.chartHeader}>
        <div className={styles.chartTitleGroup}>
          <h3 className={styles.chartTitle}>
            <PieChart size={16} color="#007968" /> Thanh toán &amp; Cơ cấu Nhập hàng NCC
          </h3>
          <span className={styles.chartSubtitle}>
            {mode === 'payment'
              ? 'Tỷ lệ thanh toán và dư nợ nhà cung cấp (không tính HĐ hủy)'
              : 'Tỷ trọng giá trị nhập theo nhóm Kho Cám · Kho Thuốc · Con giống'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div className={styles.chartModeSwitch} role="group" aria-label="Chế độ biểu đồ nhập hàng">
            <button
              type="button"
              className={`${styles.chartModeBtn} ${mode === 'payment' ? styles.chartModeBtnActive : ''}`}
              onClick={() => { setMode('payment'); setHovered(null); }}
            >
              Thanh toán NCC
            </button>
            <button
              type="button"
              className={`${styles.chartModeBtn} ${mode === 'category' ? styles.chartModeBtnActive : ''}`}
              onClick={() => { setMode('category'); setHovered(null); }}
            >
              Theo nhóm kho
            </button>
          </div>
          <Link to="/purchases" className={styles.moduleNavLink}>
            Quản lý nhập hàng <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>

      {total <= 0 ? (
        <p className={styles.chartEmpty}>Chưa có hóa đơn nhập hàng hợp lệ trong kỳ báo cáo.</p>
      ) : (
        <div className={styles.donutLayout}>
          <div className={styles.donutSvgWrap}>
            <svg viewBox="0 0 180 180" role="img" aria-label="Biểu đồ tròn cơ cấu nhập hàng">
              <circle cx={cx} cy={cy} r={r} fill="none" stroke="#eef4f2" strokeWidth="22" />
              {slices.map((s, i) => (
                <circle
                  key={s.key}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={hovered === i ? 26 : 22}
                  strokeDasharray={`${s.len} ${Math.max(0, circ - s.len)}`}
                  strokeDashoffset={-s.offset}
                  transform={`rotate(-90 ${cx} ${cy})`}
                  style={{ cursor: 'pointer', transition: 'stroke-width 0.15s ease' }}
                  onMouseEnter={() => setHovered(i)}
                  onTouchStart={() => setHovered(i)}
                  onClick={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                />
              ))}
              <text x={cx} y={cy - 10} textAnchor="middle" className={styles.donutCenterSub}>
                {activeSlice ? activeSlice.label.slice(0, 16) : (mode === 'payment' ? 'ĐÃ TẤT TOÁN' : 'TỔNG NHẬP')}
              </text>
              <text x={cx} y={cy + 8} textAnchor="middle" className={styles.donutCenterLabel}>
                {activeSlice
                  ? `${fmtNum(activeSlice.pct, 1)}%`
                  : (mode === 'payment' ? `${fmtNum(paidPct, 1)}%` : shortMoney(total))}
              </text>
              <text x={cx} y={cy + 23} textAnchor="middle" className={styles.donutCenterSub}>
                {activeSlice ? shortMoney(activeSlice.value) : fmtVnd(total)}
              </text>
            </svg>
          </div>

          <ul className={styles.donutLegendList}>
            {slices.map((s, i) => (
              <li
                key={s.key}
                className={styles.donutLegendRow}
                onMouseEnter={() => setHovered(i)}
                onTouchStart={() => setHovered(i)}
                onClick={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              >
                <span className={styles.donutLegendLeft}>
                  <i className={styles.chartLegendSwatch} style={{ background: s.color }} />
                  <span>
                    {s.label}
                    {s.count !== null ? ` (${s.count} HĐ)` : ''}
                  </span>
                </span>
                <span className={styles.donutLegendRight}>
                  {fmtVnd(s.value)}
                  <span className={styles.donutPctBadge}>{fmtNum(s.pct, 1)}%</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/* ── Chart 7: Harvest Revenue & Weight Share SVG Donut Chart ────────────────────────────────── */
const HARVEST_DONUT_PALETTE = ['#007968', '#0284c7', '#d97706', '#7c3aed', '#db2777', '#64748b'];

export function HarvestAreaDonutChart({ rows }) {
  const [hovered, setHovered] = useState(null);

  const slicesData = useMemo(() => {
    if (!rows.length) return [];
    const sorted = [...rows].sort((a, b) => Number(b.totalRevenue || 0) - Number(a.totalRevenue || 0));
    const top = sorted.slice(0, 5).map((h, idx) => ({
      key: `${h.cycleId || idx}`,
      label: `${h.barnName} (${h.cycleCode})`,
      revenue: Number(h.totalRevenue || 0),
      weightKg: Number(h.totalWeightKg || 0),
      head: Number(h.totalHead || 0),
      color: HARVEST_DONUT_PALETTE[idx % HARVEST_DONUT_PALETTE.length],
    }));
    if (sorted.length > 5) {
      const rest = sorted.slice(5);
      top.push({
        key: 'other-barns',
        label: `Chuồng khác (${rest.length} lứa)`,
        revenue: rest.reduce((s, r) => s + Number(r.totalRevenue || 0), 0),
        weightKg: rest.reduce((s, r) => s + Number(r.totalWeightKg || 0), 0),
        head: rest.reduce((s, r) => s + Number(r.totalHead || 0), 0),
        color: HARVEST_DONUT_PALETTE[5],
      });
    }
    return top;
  }, [rows]);

  if (!slicesData.length) return null;

  const totalRev = slicesData.reduce((s, d) => s + d.revenue, 0);
  const totalKg = slicesData.reduce((s, d) => s + d.weightKg, 0);
  const r = 60;
  const cx = 90;
  const cy = 90;
  const circ = 2 * Math.PI * r;

  const { slices } = slicesData.reduce(
    (acc, s) => {
      const pct = totalRev > 0 ? (s.revenue / totalRev) * 100 : 0;
      const len = (pct / 100) * circ;
      return {
        offset: acc.offset + len,
        slices: [...acc.slices, { ...s, pct, len, offset: acc.offset }],
      };
    },
    { offset: 0, slices: [] }
  );

  const activeSlice = hovered !== null && slices[hovered] ? slices[hovered] : null;

  return (
    <section className={styles.chartCard} aria-label="Biểu đồ Tỷ trọng thu hoạch theo chuồng">
      <div className={styles.chartHeader}>
        <div className={styles.chartTitleGroup}>
          <h3 className={styles.chartTitle}>
            <PieChart size={16} color="#007968" /> Tỷ trọng Thu hoạch theo Chuồng &amp; Lứa
          </h3>
          <span className={styles.chartSubtitle}>Cơ cấu đóng góp doanh thu và sản lượng xuất bán</span>
        </div>
      </div>

      <div className={styles.donutLayout}>
        <div className={styles.donutSvgWrap}>
          <svg viewBox="0 0 180 180" role="img" aria-label="Biểu đồ tròn tỷ trọng thu hoạch">
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#eef4f2" strokeWidth="22" />
            {slices.map((s, i) => (
              <circle
                key={s.key}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={hovered === i ? 26 : 22}
                strokeDasharray={`${s.len} ${Math.max(0, circ - s.len)}`}
                strokeDashoffset={-s.offset}
                transform={`rotate(-90 ${cx} ${cy})`}
                style={{ cursor: 'pointer', transition: 'stroke-width 0.15s ease' }}
                onMouseEnter={() => setHovered(i)}
                onTouchStart={() => setHovered(i)}
                onClick={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              />
            ))}
            <text x={cx} y={cy - 10} textAnchor="middle" className={styles.donutCenterSub}>
              {activeSlice ? activeSlice.label.slice(0, 15) : 'TỔNG SẢN LƯỢNG'}
            </text>
            <text x={cx} y={cy + 8} textAnchor="middle" className={styles.donutCenterLabel}>
              {activeSlice ? `${fmtNum(activeSlice.weightKg, 0)} kg` : `${fmtNum(totalKg, 0)} kg`}
            </text>
            <text x={cx} y={cy + 23} textAnchor="middle" className={styles.donutCenterSub}>
              {activeSlice ? `${fmtNum(activeSlice.pct, 1)}% DT` : `${rows.length} lứa thu hoạch`}
            </text>
          </svg>
        </div>

        <ul className={styles.donutLegendList}>
          {slices.map((s, i) => (
            <li
              key={s.key}
              className={styles.donutLegendRow}
              onMouseEnter={() => setHovered(i)}
              onTouchStart={() => setHovered(i)}
              onClick={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className={styles.donutLegendLeft}>
                <i className={styles.chartLegendSwatch} style={{ background: s.color }} />
                <span>{s.label} · {fmtNum(s.weightKg, 0)} kg</span>
              </span>
              <span className={styles.donutLegendRight}>
                {shortMoney(s.revenue)}
                <span className={styles.donutPctBadge}>{fmtNum(s.pct, 1)}%</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ── Chart 8: Weight vs Target & ADG Comparison SVG Chart ───────────────────────────────────── */
export function WeightAndAdgChart({ cycles }) {
  const [tip, setTip] = useState(null);
  const rows = useMemo(
    () => cycles.filter((g) => Number(g.avgWeightKg || 0) > 0 || Number(g.adgGrams || 0) > 0).slice(0, 10),
    [cycles]
  );

  if (!rows.length) return null;

  const maxW = Math.max(
    2.5,
    ...rows.map((r) => Math.max(Number(r.avgWeightKg || 0), Number(r.targetWeightKg || 2.2)))
  ) * 1.15;
  const L = 128;
  const R = 136;
  const T = 18;
  const rowH = 28;
  const W = 640;
  const H = T + rows.length * rowH + 26;
  const plotW = W - L - R;
  const X = (v) => L + (Math.min(v, maxW) / maxW) * plotW;

  return (
    <section className={styles.chartCard} aria-label="Biểu đồ Trọng lượng và ADG theo chuồng">
      <div className={styles.chartHeader}>
        <div className={styles.chartTitleGroup}>
          <h3 className={styles.chartTitle}>
            <Scale size={16} color="#0284c7" /> Trọng lượng TB Thực tế &amp; Tốc độ Tăng trọng (ADG)
          </h3>
          <span className={styles.chartSubtitle}>
            So sánh biểu trọng cân mẫu thực tế (kg/con) với mục tiêu xuất chuồng và ADG (g/ngày)
          </span>
        </div>
      </div>

      <div className={styles.svgPlot} onMouseLeave={() => setTip(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Biểu đồ trọng lượng và ADG các chuồng">
          <line x1={L} x2={L} y1={T} y2={H - 22} stroke={CHART_COLORS.axis} />
          {[0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0].filter((t) => t <= maxW).map((t) => (
            <g key={t}>
              <line x1={X(t)} x2={X(t)} y1={T} y2={H - 22} stroke={CHART_COLORS.grid} />
              <text x={X(t)} y={H - 7} textAnchor="middle" className={styles.axisText}>{fmtNum(t, 1)}kg</text>
            </g>
          ))}

          {rows.map((g, i) => {
            const actualW = Number(g.avgWeightKg || 0);
            const targetW = Number(g.targetWeightKg || 2.2);
            const y = T + i * rowH + 5;
            const h = rowH - 11;
            const w = Math.max(2, X(actualW) - L);
            const targetX = X(targetW);
            const pctTarget = targetW > 0 ? (actualW / targetW) * 100 : 0;
            const fill = pctTarget >= 95 ? '#007968' : pctTarget >= 80 ? '#0284c7' : '#d97706';
            const label = `${g.barnName} (${g.cycleCode})`;
            const showTip = () =>
              setTip({
                x: (X(actualW) / W) * 100,
                y,
                title: label,
                lines: [
                  `Trọng lượng TB: ${fmtNum(actualW, 2)} kg / Mục tiêu ${fmtNum(targetW, 2)} kg (${fmtNum(pctTarget, 0)}%)`,
                  `Tốc độ tăng trọng ADG: ${g.adgGrams ? `${fmtNum(g.adgGrams, 1)} g/ngày` : '—'}`,
                  `Tăng trọng đàn: ${fmtNum(g.gainKg, 1)} kg · Hiện nuôi: ${fmtNum(g.currentQuantity)} con`,
                ],
              });

            return (
              <g key={g.cycleId || i} onMouseEnter={showTip} onFocus={showTip} onClick={showTip} onTouchStart={showTip} tabIndex={0} style={{ cursor: 'pointer' }}>
                <rect x={0} y={T + i * rowH} width={W} height={rowH} fill="transparent" />
                <text x={L - 8} y={y + h / 2 + 4} textAnchor="end" className={styles.axisText}>
                  {label.length > 18 ? `${label.slice(0, 17)}…` : label}
                </text>
                <rect x={L} y={y} width={Math.max(2, targetX - L)} height={h} rx="4" fill="#e2ece9" />
                <rect x={L} y={y} width={w} height={h} rx="4" fill={fill} />
                <line x1={targetX} x2={targetX} y1={y - 2} y2={y + h + 2} stroke="#0f172a" strokeWidth="1.5" />
                <text x={Math.max(L + w, targetX) + 6} y={y + h / 2 + 4} className={styles.barValueText}>
                  {fmtNum(actualW, 2)} kg{g.adgGrams ? ` · ${fmtNum(g.adgGrams, 1)}g/ng` : ''}
                </text>
              </g>
            );
          })}
        </svg>
        <ChartTooltip tip={tip} />
      </div>
    </section>
  );
}
