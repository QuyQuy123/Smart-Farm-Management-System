// src/features/farmshift/reports/CycleSummaryDrawer.jsx
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Stethoscope, X } from 'lucide-react';
import styles from '../ReportsView.module.css';
import { fmtDate, fmtNum, fmtVnd } from './reportUtils';

export function CycleSummaryDrawer({ cycle, growthRow, harvestRow, onClose }) {
  useEffect(() => {
    if (!cycle) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [cycle, onClose]);

  if (!cycle) return null;

  const isClosed = cycle.status !== 'ACTIVE';
  const profit = Number(cycle.profit || 0);
  const revenue = Number(cycle.revenue || 0);
  const totalCost = Number(cycle.totalCost || 0);
  const harvestedKg = Number(harvestRow?.totalWeightKg ?? cycle.harvestedWeightKg ?? 0);
  const harvestedHead = Number(harvestRow?.totalHead ?? cycle.harvested ?? 0);
  const avgSalePrice = harvestRow?.avgPricePerKg ?? cycle.avgSellingPricePerKg;
  const fcr = cycle.fcr ?? growthRow?.fcr ?? null;
  const avgWeight = cycle.avgWeightKg ?? growthRow?.avgWeightKg ?? harvestRow?.avgWeightPerBird ?? null;
  const adg = growthRow?.adgGrams ?? null;
  const feedKg = growthRow?.feedKg ?? null;
  const feedPerBirdKg = growthRow?.feedPerBirdKg ?? null;
  const losses = Number(cycle.deaths || 0) + Number(cycle.culls || 0);

  // TODO(BE): Bổ sung diseaseCount, diseaseMedicineCost và danh sách tóm tắt đợt bệnh vào /api/reports/summary
  const diseaseCount = cycle.diseaseCount ?? null;
  const diseaseList = Array.isArray(cycle.diseases) ? cycle.diseases : null;
  const medicineAmount = cycle.hasSeparateMedicine ? cycle.medicineCost : null;

  return (
    <div
      className={styles.drawerOverlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Chi tiết tổng kết lứa ${cycle.cycleCode}`}
    >
      <aside
        className={styles.drawerPanel}
        onClick={(e) => e.stopPropagation()}
        data-testid="cycle-summary-drawer"
      >
        <header className={styles.drawerHeader}>
          <div>
            <div className={styles.drawerTitleRow}>
              <h3 className={styles.drawerTitle}>{cycle.cycleCode} · {cycle.barnName}</h3>
              <span className={isClosed ? styles.sageBadge : styles.mintBadge}>
                {isClosed ? 'Đã kết thúc' : 'Đang nuôi'}
              </span>
            </div>
            <p className={styles.drawerSubtitle}>
              {cycle.areaName || 'Trang trại'} · {cycle.breed || 'Gà thịt'} · {fmtDate(cycle.startDate)} – {cycle.endDate ? fmtDate(cycle.endDate) : 'Hiện tại'}
            </p>
          </div>
          <button
            type="button"
            className={styles.drawerCloseBtn}
            onClick={onClose}
            aria-label="Đóng chi tiết lứa"
          >
            <X size={18} />
          </button>
        </header>

        <div className={styles.drawerBody}>
          <section className={styles.drawerSection}>
            <h4 className={styles.drawerSectionTitle}>Tổng quan Tài chính</h4>
            <div className={styles.drawerKpiGrid}>
              <div className={styles.drawerStat}>
                <span>Doanh thu</span>
                <strong className={styles.positiveText}>{fmtVnd(revenue)}</strong>
              </div>
              <div className={styles.drawerStat}>
                <span>Tổng chi phí</span>
                <strong>{fmtVnd(totalCost)}</strong>
              </div>
              <div className={styles.drawerStat}>
                <span>Lợi nhuận ròng</span>
                <strong className={profit >= 0 ? styles.positiveText : styles.negativeText}>
                  {profit > 0 ? '+' : ''}{fmtVnd(profit)}
                </strong>
              </div>
              <div className={styles.drawerStat}>
                <span>Biên lợi nhuận</span>
                <strong>{revenue > 0 && cycle.marginPct != null ? `${fmtNum(cycle.marginPct, 1)}%` : '—'}</strong>
              </div>
            </div>
            <dl className={styles.drawerFacts}>
              <div><dt>Chi phí con giống</dt><dd>{fmtVnd(cycle.chickCost)}</dd></div>
              <div><dt>Chi phí cám</dt><dd>{fmtVnd(cycle.feedCost)}</dd></div>
              <div>
                <dt>{cycle.hasSeparateMedicine ? 'Vắc-xin & Thuốc thú y' : 'Thuốc, vắc-xin & CP khác'}</dt>
                <dd>{fmtVnd(cycle.hasSeparateMedicine ? cycle.medicineCost : cycle.otherCost)}</dd>
              </div>
              {cycle.hasSeparateMedicine && (
                <div><dt>Chi phí vận hành khác</dt><dd>{fmtVnd(cycle.otherDirectCost)}</dd></div>
              )}
              <div><dt>Giá vốn sản xuất / kg</dt><dd>{cycle.costPerKg ? `${fmtVnd(cycle.costPerKg)}/kg` : '—'}</dd></div>
            </dl>
          </section>

          <section className={styles.drawerSection}>
            <h4 className={styles.drawerSectionTitle}>Sản lượng thu hoạch &amp; Tăng trọng</h4>
            <dl className={styles.drawerFacts}>
              <div><dt>Số con nhập / hiện nuôi</dt><dd>{fmtNum(cycle.totalIn)} / {fmtNum(cycle.currentQuantity)} con</dd></div>
              <div><dt>Số con xuất bán</dt><dd>{fmtNum(harvestedHead)} con</dd></div>
              <div><dt>Sản lượng thu hoạch</dt><dd>{fmtNum(harvestedKg, 1)} kg</dd></div>
              <div><dt>Trọng lượng TB</dt><dd>{avgWeight != null ? `${fmtNum(avgWeight, 2)} kg/con` : '—'}</dd></div>
              <div><dt>Giá bán TB</dt><dd>{avgSalePrice ? `${fmtVnd(avgSalePrice)}/kg` : '—'}</dd></div>
              <div><dt>Hệ số FCR</dt><dd>{fcr != null ? fmtNum(fcr, 2) : '—'}</dd></div>
              <div><dt>Tăng trọng ADG</dt><dd>{adg != null ? `${fmtNum(adg, 1)} g/ngày` : '—'}</dd></div>
            </dl>
          </section>

          <section className={styles.drawerSection}>
            <h4 className={styles.drawerSectionTitle}>Tiêu thụ cám &amp; Hao hụt</h4>
            <dl className={styles.drawerFacts}>
              <div><dt>Tổng cám tiêu thụ</dt><dd>{feedKg != null ? `${fmtNum(feedKg, 1)} kg` : '—'}</dd></div>
              <div><dt>Cám bình quân / con</dt><dd>{feedPerBirdKg != null ? `${fmtNum(feedPerBirdKg, 2)} kg/con` : '—'}</dd></div>
              <div><dt>Hao hụt (Chết / Loại)</dt><dd>{fmtNum(losses)} con ({fmtNum(cycle.deaths)} chết · {fmtNum(cycle.culls)} loại)</dd></div>
              <div><dt>Tỷ lệ sống</dt><dd>{fmtNum(cycle.survivalRate, 1)}%</dd></div>
            </dl>
          </section>

          <section className={styles.drawerSection}>
            <h4 className={styles.drawerSectionTitle}>
              <Stethoscope size={15} color="#007968" /> Chi phí thuốc &amp; Lịch sử bệnh
            </h4>
            <dl className={styles.drawerFacts}>
              <div>
                <dt>Chi phí thuốc &amp; vắc-xin</dt>
                <dd>{medicineAmount != null ? fmtVnd(medicineAmount) : fmtVnd(cycle.otherCost)}</dd>
              </div>
              {diseaseCount != null && (
                <div><dt>Số đợt bệnh ghi nhận</dt><dd>{fmtNum(diseaseCount)} đợt</dd></div>
              )}
            </dl>
            {diseaseList && diseaseList.length > 0 ? (
              <ul className={styles.drawerDiseaseList}>
                {diseaseList.map((d, idx) => (
                  <li key={d.id || idx}>
                    <strong>{d.diseaseName}</strong> · {fmtDate(d.startDate)}
                    {d.totalMedicineCost != null ? ` (${fmtVnd(d.totalMedicineCost)})` : ''}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.drawerNote}>
                Chưa có chi tiết từng đợt bệnh từ API tổng hợp; xem đầy đủ nhật ký điều trị tại trang chi tiết chuồng.
              </p>
            )}
          </section>
        </div>

        <footer className={styles.drawerFooter}>
          {cycle.barnId != null && (
            <Link
              to={`/barns/${encodeURIComponent(cycle.barnId)}?cycle=${encodeURIComponent(cycle.cycleId)}`}
              className="farmshift-btn farmshift-btn-secondary"
            >
              Mở trang chuồng <ArrowUpRight size={14} />
            </Link>
          )}
          <button type="button" className="farmshift-btn farmshift-btn-primary" onClick={onClose}>
            Đóng
          </button>
        </footer>
      </aside>
    </div>
  );
}
