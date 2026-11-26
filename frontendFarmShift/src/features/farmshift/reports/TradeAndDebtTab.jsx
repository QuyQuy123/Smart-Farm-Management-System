// src/features/farmshift/reports/TradeAndDebtTab.jsx
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Search } from 'lucide-react';
import { ResponsiveDataTable } from '../../../components/common/ResponsiveDataTable';
import styles from '../ReportsView.module.css';
import {
  SALES_STATUS_LABELS,
  classifyPurchaseStatus,
  fmtDate,
  fmtNum,
  fmtVnd,
} from './reportUtils';
import { PurchaseStructureDonutChart, SalesPaymentDonutChart } from './ReportCharts';

export function TradeAndDebtTab({
  subTab,
  onSubTabChange,
  salesStats,
  purchaseStats,
  filteredSales,
  filteredPurchases,
  salesStatusFilter,
  onSalesStatusFilterChange,
  purchasePaymentFilter,
  onPurchasePaymentFilterChange,
  searchTerm,
  onSearchChange,
}) {
  const [salesPage, setSalesPage] = useState(1);
  const [purchasePage, setPurchasePage] = useState(1);
  const pageSize = 10;

  const activeStats = subTab === 'sales' ? salesStats : purchaseStats;
  const totalValue = subTab === 'sales' ? activeStats.totalRevenue : activeStats.totalAmount;
  const paidAmount = activeStats.paidAmount;
  const debtAmount = activeStats.debtAmount;

  const salesTotalPages = Math.max(1, Math.ceil(filteredSales.length / pageSize));
  const safeSalesPage = Math.min(salesPage, salesTotalPages);
  const pagedSales = useMemo(() => {
    const start = (safeSalesPage - 1) * pageSize;
    return filteredSales.slice(start, start + pageSize);
  }, [filteredSales, safeSalesPage]);

  const purchaseTotalPages = Math.max(1, Math.ceil(filteredPurchases.length / pageSize));
  const safePurchasePage = Math.min(purchasePage, purchaseTotalPages);
  const pagedPurchases = useMemo(() => {
    const start = (safePurchasePage - 1) * pageSize;
    return filteredPurchases.slice(start, start + pageSize);
  }, [filteredPurchases, safePurchasePage]);

  const salesColumns = useMemo(() => [
    {
      key: 'code',
      label: 'Mã đơn',
      primary: true,
      render: (code) => (
        <Link to={`/sales?tab=orders&search=${encodeURIComponent(code)}`} className={styles.drilldownLink}>
          <span className={styles.codeCell}>{code}</span>
          <ArrowUpRight size={12} />
        </Link>
      ),
    },
    { key: 'date', label: 'Ngày bán', render: (val) => fmtDate(val) },
    { key: 'customer', label: 'Khách hàng' },
    { key: 'flock', label: 'Đàn / Chuồng', hideOnTablet: true },
    {
      key: 'quantity',
      label: 'SL / KL',
      render: (_, o) => `${fmtNum(o.quantity)} con · ${fmtNum(o.totalWeight, 1)} kg`,
    },
    { key: 'totalAmount', label: 'Tổng tiền', render: (val) => <strong>{fmtVnd(val)}</strong> },
    { key: 'paidAmount', label: 'Đã thu', hideOnTablet: true, render: (val) => fmtVnd(val) },
    {
      key: 'debtAmount',
      label: 'Còn nợ',
      render: (val) => (
        <span className={Number(val || 0) > 0 ? styles.negativeText : styles.positiveText}>
          {fmtVnd(val)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Trạng thái',
      isBadge: true,
      render: (st) => {
        const badgeCls = st === 'PAID' ? styles.mintBadge : st === 'PARTIAL' ? styles.warnBadge : styles.dangerBadge;
        return <span className={badgeCls}>{SALES_STATUS_LABELS[st] || st}</span>;
      },
    },
  ], []);

  const purchaseColumns = useMemo(() => [
    {
      key: 'code',
      label: 'Mã hóa đơn',
      primary: true,
      render: (code, p) => (
        <Link to={`/purchases?invoice=${encodeURIComponent(p.id)}`} className={styles.drilldownLink}>
          <span className={styles.codeCell}>{code}</span>
          <ArrowUpRight size={12} />
        </Link>
      ),
    },
    { key: 'date', label: 'Ngày nhập', render: (val) => fmtDate(val) },
    { key: 'supplier', label: 'Nhà cung cấp' },
    { key: 'warehouseSummary', label: 'Kho / Chuồng', hideOnTablet: true },
    { key: 'totalAmount', label: 'Tổng tiền', render: (val) => <strong>{fmtVnd(val)}</strong> },
    { key: 'paidAmount', label: 'Đã trả', hideOnTablet: true, render: (val) => fmtVnd(val) },
    {
      key: 'debtAmount',
      label: 'Còn nợ',
      render: (val) => (
        <span className={Number(val || 0) > 0 ? styles.negativeText : styles.positiveText}>
          {fmtVnd(val)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Trạng thái',
      isBadge: true,
      render: (_, p) => {
        const cls = classifyPurchaseStatus(p);
        if (cls === 'CANCELLED') return <span className={styles.sageBadge}>Đã hủy</span>;
        if (cls === 'DEBT') return <span className={styles.dangerBadge}>Còn công nợ</span>;
        return <span className={styles.mintBadge}>Đã tất toán</span>;
      },
    },
  ], []);

  return (
    <div className={styles.stack}>
      <div className={styles.subHeaderRow}>
        <div className={styles.segmentedControl} role="tablist" aria-label="Phân mục mua bán và công nợ">
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'sales'}
            className={`${styles.segmentedBtn} ${subTab === 'sales' ? styles.segmentedBtnActive : ''}`}
            onClick={() => onSubTabChange('sales')}
          >
            Bán hàng &amp; Thu hoạch
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'purchases'}
            className={`${styles.segmentedBtn} ${subTab === 'purchases' ? styles.segmentedBtnActive : ''}`}
            onClick={() => onSubTabChange('purchases')}
          >
            Nhập hàng &amp; Nhà cung cấp
          </button>
        </div>
      </div>

      <div className={styles.kpiGrid3}>
        <div className={`${styles.kpiCard} ${styles.kpiCardHighlight}`}>
          <span className={styles.kpiLabel}>
            {subTab === 'sales' ? 'Tổng giá trị bán hàng' : 'Tổng giá trị nhập hàng'}
          </span>
          <strong className={styles.kpiValue}>{fmtVnd(totalValue)}</strong>
          <span className={styles.kpiSub}>
            {subTab === 'sales'
              ? `${fmtNum(salesStats.orderCount)} đơn · ${fmtNum(salesStats.totalWeightKg, 1)} kg`
              : `${fmtNum(purchaseStats.invoiceCount)} hóa đơn hợp lệ`}
          </span>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Đã thanh toán</span>
          <strong className={`${styles.kpiValue} ${styles.kpiValueAccent}`}>{fmtVnd(paidAmount)}</strong>
          <span className={styles.kpiSub}>Tỷ lệ thanh toán: {fmtNum(activeStats.paidPct, 1)}%</span>
        </div>

        <div className={styles.kpiCard}>
          <span className={styles.kpiLabel}>Công nợ còn lại</span>
          <strong className={`${styles.kpiValue} ${debtAmount > 0 ? styles.kpiValueWarn : styles.kpiValueAccent}`}>
            {fmtVnd(debtAmount)}
          </strong>
          <span className={styles.kpiSub}>
            {subTab === 'sales' ? 'Phải thu khách hàng' : 'Phải trả nhà cung cấp'}
          </span>
        </div>
      </div>

      {subTab === 'sales' ? (
        <>
          <SalesPaymentDonutChart
            paidAmount={salesStats.paidAmount}
            debtAmount={salesStats.debtAmount}
            orders={filteredSales}
            activeStatus={salesStatusFilter}
            onSelectStatus={(st) => {
              onSalesStatusFilterChange(st);
              setSalesPage(1);
            }}
          />

          <div className="farmshift-card">
            <div className={styles.sectionToolbar}>
              <div className={styles.pillRow}>
                {[
                  { key: 'ALL', label: `Tất cả đơn bán (${salesStats.statusCounts.ALL})` },
                  { key: 'PAID', label: `Đã thanh toán đủ (${salesStats.statusCounts.PAID})` },
                  { key: 'PARTIAL', label: `Thanh toán một phần (${salesStats.statusCounts.PARTIAL})` },
                  { key: 'CREDIT', label: `Ghi công nợ (${salesStats.statusCounts.CREDIT})` },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    className={`${styles.filterPill} ${salesStatusFilter === opt.key ? styles.filterPillActive : ''}`}
                    onClick={() => {
                      onSalesStatusFilterChange(opt.key);
                      setSalesPage(1);
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className={styles.searchWrap}>
                <Search size={15} className={styles.searchIcon} />
                <input
                  type="search"
                  className={styles.searchInput}
                  aria-label="Tìm kiếm đơn bán hàng"
                  placeholder="Tìm mã đơn, khách hàng, đàn..."
                  value={searchTerm}
                  onChange={(e) => {
                    onSearchChange(e.target.value);
                    setSalesPage(1);
                  }}
                />
              </div>
            </div>

            <ResponsiveDataTable
              columns={salesColumns}
              data={pagedSales}
              rowKey={(row, idx) => row.id ?? row.code ?? idx}
              mode="card-on-mobile"
              tableClassName={styles.compactTable}
              emptyState="Chưa có đơn bán hàng trong kỳ báo cáo."
              pagination={{
                page: safeSalesPage,
                totalPages: salesTotalPages,
                totalItems: filteredSales.length,
                onPageChange: setSalesPage,
              }}
            />
          </div>
        </>
      ) : (
        <>
          <PurchaseStructureDonutChart
            paidAmount={purchaseStats.paidAmount}
            debtAmount={purchaseStats.debtAmount}
            invoices={filteredPurchases}
          />

          <div className="farmshift-card">
            <div className={styles.sectionToolbar}>
              <div className={styles.pillRow}>
                {[
                  { key: 'ALL', label: `Tất cả hóa đơn (${purchaseStats.statusCounts.ALL})` },
                  { key: 'PAID', label: `Đã tất toán (${purchaseStats.statusCounts.PAID})` },
                  { key: 'DEBT', label: `Còn công nợ (${purchaseStats.statusCounts.DEBT})` },
                  { key: 'CANCELLED', label: `Đã hủy (${purchaseStats.statusCounts.CANCELLED})` },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    className={`${styles.filterPill} ${purchasePaymentFilter === opt.key ? styles.filterPillActive : ''}`}
                    onClick={() => {
                      onPurchasePaymentFilterChange(opt.key);
                      setPurchasePage(1);
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className={styles.searchWrap}>
                <Search size={15} className={styles.searchIcon} />
                <input
                  type="search"
                  className={styles.searchInput}
                  aria-label="Tìm kiếm hóa đơn nhập"
                  placeholder="Tìm mã HĐ, nhà cung cấp, kho..."
                  value={searchTerm}
                  onChange={(e) => {
                    onSearchChange(e.target.value);
                    setPurchasePage(1);
                  }}
                />
              </div>
            </div>

            <ResponsiveDataTable
              columns={purchaseColumns}
              data={pagedPurchases}
              rowKey={(row, idx) => row.id ?? row.code ?? idx}
              mode="card-on-mobile"
              tableClassName={styles.compactTable}
              emptyState="Chưa có hóa đơn nhập hàng trong kỳ báo cáo."
              pagination={{
                page: safePurchasePage,
                totalPages: purchaseTotalPages,
                totalItems: filteredPurchases.length,
                onPageChange: setPurchasePage,
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
