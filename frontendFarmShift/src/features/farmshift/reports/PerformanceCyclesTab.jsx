// src/features/farmshift/reports/PerformanceCyclesTab.jsx
import React, { useMemo, useState } from 'react';
import { Eye, Search } from 'lucide-react';
import { ResponsiveDataTable } from '../../../components/common/ResponsiveDataTable';
import styles from '../ReportsView.module.css';
import { fmtDate, fmtNum, fmtVnd } from './reportUtils';
import {
  FcrComparisonChart,
  HarvestAreaDonutChart,
  HarvestRevenueChart,
  WeightAndAdgChart,
} from './ReportCharts';
import { CycleSummaryDrawer } from './CycleSummaryDrawer';

export function PerformanceCyclesTab({
  filteredCycles,
  filteredGrowth,
  filteredHarvest,
  growthLookup,
  harvestLookup,
  searchTerm,
  onSearchChange,
}) {
  const [selectedCycle, setSelectedCycle] = useState(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const totalPages = Math.max(1, Math.ceil(filteredCycles.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedCycles = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredCycles.slice(start, start + pageSize);
  }, [filteredCycles, safePage]);

  const columns = useMemo(() => [
    {
      key: 'cycleCode',
      label: 'Mã lứa & Chuồng',
      primary: true,
      render: (_, c) => (
        <div>
          <strong className={styles.codeCell}>{c.cycleCode}</strong>
          <div className={styles.subCell}>{c.barnName} · {c.areaName || '—'}</div>
          {c.breed && <div className={styles.subCell}>{c.breed}</div>}
        </div>
      ),
    },
    {
      key: 'period',
      label: 'Thời gian nuôi',
      render: (_, c) => (
        <div>
          <span>{fmtDate(c.startDate)}</span>
          <div className={styles.subCell}>{c.endDate ? `→ ${fmtDate(c.endDate)}` : '→ Đang nuôi'}</div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Trạng thái',
      isBadge: true,
      render: (status) => (
        <span className={status === 'ACTIVE' ? styles.mintBadge : styles.sageBadge}>
          {status === 'ACTIVE' ? 'Đang nuôi' : 'Đã kết thúc'}
        </span>
      ),
    },
    {
      key: 'headcount',
      label: 'Nhập / Còn / Xuất',
      render: (_, c) => (
        <span className={styles.numCell}>
          {fmtNum(c.totalIn)} / {fmtNum(c.currentQuantity)} / {fmtNum(c.harvested)}
        </span>
      ),
    },
    {
      key: 'fcr',
      label: 'FCR',
      render: (val) => (val != null ? <strong>{fmtNum(val, 2)}</strong> : '—'),
    },
    {
      key: 'totalCost',
      label: 'Tổng chi phí',
      hideOnTablet: true,
      render: (val) => fmtVnd(val),
    },
    {
      key: 'revenue',
      label: 'Doanh thu',
      hideOnTablet: true,
      render: (val) => fmtVnd(val),
    },
    {
      key: 'profit',
      label: 'Lãi / Lỗ',
      render: (val, c) => {
        const p = Number(val || 0);
        return (
          <span className={p >= 0 ? styles.positiveText : c.isWip ? styles.subCell : styles.negativeText}>
            {p > 0 ? '+' : ''}{fmtVnd(p)}
          </span>
        );
      },
    },
    {
      key: 'actions',
      label: '',
      isAction: true,
      render: (_, c) => (
        <button
          type="button"
          className={styles.rowActionBtn}
          aria-label={`Xem tổng kết lứa ${c.cycleCode}`}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedCycle(c);
          }}
        >
          <Eye size={14} /> Chi tiết
        </button>
      ),
    },
  ], []);

  const selectedGrowth = selectedCycle
    ? (growthLookup.byId.get(selectedCycle.cycleId) || growthLookup.byCode.get(selectedCycle.cycleCode) || null)
    : null;
  const selectedHarvest = selectedCycle
    ? (harvestLookup.byId.get(selectedCycle.cycleId) || harvestLookup.byCode.get(selectedCycle.cycleCode) || null)
    : null;

  return (
    <div className={styles.stack}>
      <div className={styles.analyticsGridEqual}>
        <FcrComparisonChart cycles={filteredGrowth} />
        <WeightAndAdgChart cycles={filteredGrowth} />
      </div>

      {filteredHarvest.length > 0 && (
        <div className={styles.analyticsGridEqual}>
          <HarvestRevenueChart rows={filteredHarvest} />
          <HarvestAreaDonutChart rows={filteredHarvest} />
        </div>
      )}

      <div className={`farmshift-card ${styles.performanceList}`}>
        <div className={styles.sectionToolbar}>
          <div className={styles.sectionTitleGroup}>
            <h3 className={styles.sectionTitle}>Danh sách Lứa nuôi &amp; Hiệu suất Kỹ thuật</h3>
            <span className={styles.sectionSubtitle}>
              Nhấp vào một dòng lứa nuôi để mở bảng tổng kết chi tiết (chỉ đọc)
            </span>
          </div>
          <div className={styles.searchWrap}>
            <Search size={15} className={styles.searchIcon} />
            <input
              type="search"
              className={styles.searchInput}
              aria-label="Tìm kiếm lứa nuôi"
              placeholder="Tìm mã lứa, chuồng, khu, giống..."
              value={searchTerm}
              onChange={(e) => {
                onSearchChange(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        <ResponsiveDataTable
          columns={columns}
          data={pagedCycles}
          rowKey={(row, idx) => row.cycleId ?? row.cycleCode ?? idx}
          mode="card-on-mobile"
          tableClassName={`${styles.compactTable} ${styles.performanceTable}`}
          onRowClick={(row) => setSelectedCycle(row)}
          emptyState="Chưa có lứa nuôi phù hợp với bộ lọc hiện tại."
          pagination={{
            page: safePage,
            totalPages,
            totalItems: filteredCycles.length,
            onPageChange: setPage,
          }}
        />
      </div>

      <CycleSummaryDrawer
        cycle={selectedCycle}
        growthRow={selectedGrowth}
        harvestRow={selectedHarvest}
        onClose={() => setSelectedCycle(null)}
      />
    </div>
  );
}
