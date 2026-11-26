import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ResponsiveDataTable } from '../components/common/ResponsiveDataTable';
import { MobileFilterSheet } from '../components/common/MobileFilterSheet';
import { DailyPlanCard } from '../features/farmshift/DailyPlanCard';
import { DashboardCharts } from '../features/farmshift/DashboardCharts';
import { SalesPaymentDonutChart } from '../features/farmshift/reports/ReportCharts';

const setViewportWidth = (width) => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
};

const SAMPLE_COLUMNS = [
  { key: 'name', label: 'Tên hàng', primary: true },
  { key: 'stock', label: 'Tồn kho' },
  { key: 'price', label: 'Giá TB' },
  { key: 'status', label: 'Trạng thái', isBadge: true },
  { key: 'brand', label: 'Nhãn hiệu', hideOnTablet: true },
  { key: 'note', label: 'Ghi chú', hideOnTablet: true },
];

const SAMPLE_ROWS = [
  { id: 1, name: 'Cám CP 510', stock: '20 bao', price: '350.000 đ', status: 'Còn hàng', brand: 'CP', note: 'Kho A', dateLabel: '25/11/2026' },
  { id: 2, name: 'Thuốc Úm', stock: '5 chai', price: '120.000 đ', status: 'Sắp hết', brand: 'Hanvet', note: 'Kho B', dateLabel: '24/11/2026' },
];

describe('ResponsiveDataTable, MobileFilterSheet, Quick Chips & Touch Charts (Bước 2 & 3)', () => {
  afterEach(() => {
    setViewportWidth(1280);
  });

  it('renders full table on Desktop and hides hideOnTablet columns on Tablet', () => {
    setViewportWidth(1280);
    const { rerender } = render(
      <ResponsiveDataTable columns={SAMPLE_COLUMNS} data={SAMPLE_ROWS} mode="card-on-mobile" />
    );

    expect(screen.getByTestId('responsive-table')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Nhãn hiệu' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Ghi chú' })).toBeInTheDocument();

    setViewportWidth(768);
    rerender(<ResponsiveDataTable columns={SAMPLE_COLUMNS} data={SAMPLE_ROWS} mode="card-on-mobile" />);
    expect(screen.getByTestId('responsive-table')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Nhãn hiệu' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Ghi chú' })).not.toBeInTheDocument();
  });

  it('renders 3-tier Mobile Cards with accordion, summary strip, and touch pagination on Mobile', () => {
    setViewportWidth(390);
    const onPageChange = vi.fn();

    render(
      <ResponsiveDataTable
        columns={SAMPLE_COLUMNS}
        data={SAMPLE_ROWS}
        mode="card-on-mobile"
        summaryItems={[
          { label: 'Mặt hàng', value: '2' },
          { label: 'Tổng giá trị', value: '7.600.000 đ', tone: 'teal' },
        ]}
        pagination={{ page: 1, totalPages: 3, totalItems: 45, onPageChange }}
      />
    );

    expect(screen.getByTestId('responsive-summary-strip')).toHaveTextContent('7.600.000 đ');
    expect(screen.getByTestId('responsive-card-list')).toBeInTheDocument();
    expect(screen.getAllByTestId('responsive-mobile-card')).toHaveLength(2);

    // Pagination buttons
    const nextBtn = screen.getByRole('button', { name: 'Trang sau' });
    fireEvent.click(nextBtn);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('keeps sticky-table on Mobile and supports timeline mode with Load More', () => {
    setViewportWidth(375);
    const { rerender } = render(
      <ResponsiveDataTable columns={SAMPLE_COLUMNS} data={SAMPLE_ROWS} mode="sticky-table" />
    );
    expect(screen.getByTestId('responsive-sticky-table')).toBeInTheDocument();

    const manyRows = Array.from({ length: 55 }, (_, i) => ({
      id: i + 1,
      name: `Sự kiện #${i + 1}`,
      dateLabel: i < 20 ? '25/11/2026' : '24/11/2026',
    }));

    rerender(
      <ResponsiveDataTable
        columns={[{ key: 'name', label: 'Nội dung' }]}
        data={manyRows}
        mode="timeline"
        initialVisibleCount={30}
        loadMoreStep={30}
        getTimelineDate={(row) => row.dateLabel}
      />
    );

    expect(screen.getByTestId('responsive-timeline')).toBeInTheDocument();
    expect(screen.getAllByTestId('timeline-date-header')).toHaveLength(2);
    const loadMoreBtn = screen.getByTestId('responsive-load-more-btn');
    expect(loadMoreBtn).toHaveTextContent('25 dòng còn lại');
    fireEvent.click(loadMoreBtn);
    expect(screen.queryByTestId('responsive-load-more-btn')).not.toBeInTheDocument();
  });

  it('handles empty state cleanly in ResponsiveDataTable', () => {
    setViewportWidth(390);
    render(<ResponsiveDataTable columns={SAMPLE_COLUMNS} data={[]} emptyState="Không có dòng nào" />);
    expect(screen.getByTestId('responsive-empty-state')).toHaveTextContent('Không có dòng nào');
  });

  it('collapses filters into MobileFilterSheet on Mobile and renders inline on Desktop', () => {
    setViewportWidth(1280);
    const onReset = vi.fn();
    const { rerender } = render(
      <MobileFilterSheet activeCount={2} onReset={onReset}>
        <select aria-label="Bộ lọc thử"><option>Tất cả</option></select>
      </MobileFilterSheet>
    );
    expect(screen.queryByTestId('mobile-filter-trigger')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Bộ lọc thử')).toBeInTheDocument();

    setViewportWidth(390);
    rerender(
      <MobileFilterSheet activeCount={2} onReset={onReset}>
        <select aria-label="Bộ lọc thử"><option>Tất cả</option></select>
      </MobileFilterSheet>
    );
    const trigger = screen.getByTestId('mobile-filter-trigger');
    expect(trigger).toHaveTextContent('Bộ lọc (2)');
    fireEvent.click(trigger);
    expect(screen.getByTestId('mobile-filter-sheet')).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.click(screen.getByRole('button', { name: 'Đặt lại' }));
    expect(onReset).toHaveBeenCalledTimes(1);

    // Rotating from Mobile -> Tablet while open must restore body scroll lock
    setViewportWidth(768);
    rerender(
      <MobileFilterSheet activeCount={2} onReset={onReset}>
        <select aria-label="Bộ lọc thử"><option>Tất cả</option></select>
      </MobileFilterSheet>
    );
    expect(screen.queryByTestId('mobile-filter-sheet')).not.toBeInTheDocument();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('shows Quick Chips for feed quantity in DailyPlanCard and updates actual quantity', () => {
    const plan = {
      cycleId: 10,
      barnName: 'Nhà A1',
      areaName: 'Khu Mía',
      date: '2026-11-25',
      headcount: 2000,
      flocks: [{ ageDays: 14 }],
      doneCount: 0,
      warnings: [],
      tasks: [{
        key: 'feed-1',
        category: 'FEED',
        meal: 1,
        mealsPerDay: 3,
        time: '06:00',
        name: 'Cám CP 510',
        plannedQuantity: 50,
        unit: 'kg',
        plannedStock: 2,
        stockUnit: 'Bao 25kg',
      }],
      assignedTasks: [],
    };

    render(
      <DailyPlanCard
        plan={plan}
        userEmail="worker@farm.local"
        role="ROLE_FARM_WORKER"
        onConfirm={vi.fn()}
        onUndo={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Khác kế hoạch/i }));
    const qtyInput = screen.getByLabelText(/Lượng thực tế/i);
    expect(qtyInput).toHaveValue(50);

    fireEvent.click(screen.getByRole('button', { name: '+0.5 bao' }));
    expect(qtyInput).toHaveValue(62.5);

    fireEvent.click(screen.getByRole('button', { name: '+1 bao' }));
    expect(qtyInput).toHaveValue(87.5);

    fireEvent.click(screen.getByRole('button', { name: 'Đúng kế hoạch' }));
    expect(qtyInput).toHaveValue(50);
  });

  it('opens SVG chart tooltip on touch/click in DashboardCharts', () => {
    const data = {
      barns: [{ barnId: 1, barnName: 'Nhà A1', totalIn: 1000, deaths: 20, culls: 5 }],
      finance: { chickCost: 10000000, feedCost: 20000000, otherCost: 5000000 },
      growth: [],
    };
    const { container } = render(<DashboardCharts data={data} />);
    const firstBar = container.querySelector('svg g[tabindex="0"]');
    expect(firstBar).toBeTruthy();
    fireEvent.click(firstBar);
    expect(screen.getByRole('status')).toHaveTextContent('Nhà A1');
  });

  it('keeps donut chart slice active when touchStart is followed by click on mobile', () => {
    const { container } = render(
      <MemoryRouter>
        <SalesPaymentDonutChart
          paidAmount={6000000}
          debtAmount={4000000}
          orders={[
            { id: 1, paymentStatus: 'PAID', totalAmount: 6000000 },
            { id: 2, paymentStatus: 'UNPAID', totalAmount: 4000000 },
          ]}
        />
      </MemoryRouter>
    );
    const circles = container.querySelectorAll('svg circle[style*="cursor: pointer"]');
    expect(circles.length).toBeGreaterThanOrEqual(2);
    fireEvent.touchStart(circles[0]);
    fireEvent.click(circles[0]);
    expect(circles[0]).toHaveAttribute('stroke-width', '26');
  });
});
