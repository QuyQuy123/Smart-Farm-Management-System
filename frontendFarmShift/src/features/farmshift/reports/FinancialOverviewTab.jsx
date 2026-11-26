// src/features/farmshift/reports/FinancialOverviewTab.jsx
import React from 'react';
import {
  CheckCircle2,
  ReceiptText,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import styles from '../ReportsView.module.css';
import { fmtNum, fmtVnd, shortMoney } from './reportUtils';
import { CostStructureDonutChart, CycleProfitBarChart } from './ReportCharts';

export function FinancialOverviewTab({ summaryStats, filteredCycles }) {
  const hasRevenue = Number(summaryStats.totalRevenue || 0) > 0;
  const totalProfit = Number(summaryStats.totalProfit || 0);

  // Bảo toàn đồng bộ quy mô nhập khi đang có đàn nuôi ở chế độ Toàn thời gian
  const effectiveTotalIn =
    summaryStats.currentLive > 0 && summaryStats.totalIn === 0
      ? summaryStats.currentLive + summaryStats.harvested + summaryStats.lossCount
      : summaryStats.totalIn;

  const hasSeparateMed =
    Number(summaryStats.medicineCost || 0) > 0 || Number(summaryStats.otherDirectCost || 0) > 0;
  const costBreakdownText = hasSeparateMed
    ? `Giống: ${shortMoney(summaryStats.chickCost)} · Cám: ${shortMoney(summaryStats.feedCost)} · Thuốc/VX: ${shortMoney(summaryStats.medicineCost)} · Khác: ${shortMoney(summaryStats.otherDirectCost)}`
    : `Giống: ${shortMoney(summaryStats.chickCost)} · Cám: ${shortMoney(summaryStats.feedCost)} · Thuốc/VX & Khác: ${shortMoney(summaryStats.otherCost)}`;

  return (
    <div className={styles.stack}>
      <div className={styles.kpiGrid}>
        <div className={`${styles.kpiCard} ${styles.kpiCardHighlight}`}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Doanh thu xuất chuồng</span>
            <span className={styles.kpiIcon}><ShoppingCart size={16} /></span>
          </div>
          <div className={`${styles.kpiValue} ${styles.kpiValueAccent}`}>
            {fmtVnd(summaryStats.totalRevenue)}
          </div>
          <div className={styles.kpiSub}>
            {fmtNum(summaryStats.harvested)} con ({fmtNum(summaryStats.harvestedWeightKg, 1)} kg)
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Tổng chi phí lứa nuôi</span>
            <span className={`${styles.kpiIcon} ${styles.kpiIconBlue}`}><ReceiptText size={16} /></span>
          </div>
          <div className={styles.kpiValue}>{fmtVnd(summaryStats.totalCost)}</div>
          <div className={styles.kpiSub}>{costBreakdownText}</div>
        </div>

        <div className={`${styles.kpiCard} ${totalProfit >= 0 ? styles.kpiCardProfit : styles.kpiCardLoss}`}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Lợi nhuận ròng (Lãi/Lỗ)</span>
            <span className={`${styles.kpiIcon} ${totalProfit < 0 ? styles.kpiIconWarn : ''}`}>
              {totalProfit >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            </span>
          </div>
          <div className={styles.kpiValueRow}>
            <span className={`${styles.kpiValue} ${totalProfit >= 0 ? styles.kpiValueAccent : styles.kpiValueWarn}`}>
              {totalProfit > 0 ? '+' : ''}{fmtVnd(totalProfit)}
            </span>
            {hasRevenue ? (
              <span className={`${styles.marginPill} ${totalProfit >= 0 ? styles.marginPositive : styles.marginNegative}`}>
                Biên LN {fmtNum(summaryStats.profitMargin, 1)}%
              </span>
            ) : (
              <span className={styles.marginNeutral} title="Chưa phát sinh doanh thu">—</span>
            )}
          </div>
          <div className={styles.kpiSub}>
            {summaryStats.profitableCycles}/{filteredCycles.length} lứa có lãi dương
            {summaryStats.closedCycles > 0 ? ` · Đã chốt: ${summaryStats.realizedProfit >= 0 ? '+' : ''}${shortMoney(summaryStats.realizedProfit)}` : ''}
            {summaryStats.wipCost > 0 ? ` · Vốn đang nuôi (WIP): ${shortMoney(summaryStats.wipCost)}` : ''}
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Quy mô đàn &amp; Kỹ thuật</span>
            <span className={styles.kpiIcon}><CheckCircle2 size={16} /></span>
          </div>
          <div className={styles.kpiValue}>{fmtNum(summaryStats.currentLive)} con đang nuôi</div>
          <div className={styles.kpiSub}>
            Nhập {fmtNum(effectiveTotalIn)} · Tỷ lệ sống {fmtNum(summaryStats.survivalRate, 1)}%
            {summaryStats.avgFcr ? ` · FCR TB ${fmtNum(summaryStats.avgFcr, 2)}` : ''}
          </div>
        </div>
      </div>

      <div className={styles.analyticsGrid}>
        <CycleProfitBarChart cycles={filteredCycles} />
        <CostStructureDonutChart
          chickCost={summaryStats.chickCost}
          feedCost={summaryStats.feedCost}
          otherCost={summaryStats.otherCost}
          medicineCost={summaryStats.medicineCost}
          diseaseMedicineCost={summaryStats.diseaseMedicineCost}
          otherDirectCost={summaryStats.otherDirectCost}
          totalCost={summaryStats.totalCost}
        />
      </div>
    </div>
  );
}
