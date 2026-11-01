import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardView } from '../features/farmshift/DashboardView';
import * as service from '../services/dashboardService';
import * as areas from '../services/farmAreaService';

const mocks = vi.hoisted(() => ({ role: 'ROLE_FARM_OWNER' }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: mocks.role, fullName: 'Miền Bính' } }) }));
vi.mock('../layouts/FarmShiftLayout', () => ({ FarmShiftLayout: ({ pageTitle, children }) => <main><h1>{pageTitle}</h1>{children}</main> }));
vi.mock('../services/dashboardService', () => ({ getDashboard: vi.fn() }));
vi.mock('../services/farmAreaService', () => ({ listBarns: vi.fn() }));

const barn = (id, name, extra = {}) => ({
  barnId: id, cycleId: id * 10, barnName: name, areaName: 'Khu Mía Thịt', ageDays: 29, quantity: 50000, avgWeightKg: 1.62, fcr: 1.58,
  lossRate: 0.4, lossToday: 0, tasksDone: 2, tasksTotal: 6, overdueTasks: 0, workers: ['Nguyễn Văn Ba'], status: 'OK',
  totalIn: 50000, deaths: 200, culls: 0, ...extra,
});
const dashboard = (extra = {}) => ({
  date: '2026-10-30',
  kpis: { liveQuantity: 99996, activeBarns: 2, lossToday: 12, loss7d: 40, loss7dRate: 0.04, tasksDone: 3, tasksTotal: 12, overdueTasks: 2,
    supplierDebt: 1050000000, unpaidInvoices: 2 },
  alerts: [
    { level: 'DANGER', type: 'LOSS', title: 'Nhà A1: hao hụt 12 con hôm nay', detail: 'Tỷ lệ 0.6% số con trong chuồng.', barnId: 1 },
    { level: 'WARN', type: 'OVERDUE', title: 'Nhà A2: 2 việc quá giờ chưa làm', detail: 'Higro 02 ×2', barnId: 2 },
    { level: 'INFO', type: 'UNASSIGNED', title: 'Nhà A2 chưa có người phụ trách', detail: 'Vào Việc hôm nay › Phân công…', barnId: 2 },
    { level: 'INFO', type: 'DEBT', title: '2 hóa đơn còn nợ nhà cung cấp', detail: 'Tổng còn phải trả 1.050.000.000đ.', barnId: null },
  ],
  barns: [barn(1, 'Nhà A1', { lossToday: 12, status: 'DANGER' }), barn(2, 'Nhà A2', { overdueTasks: 2, workers: [], status: 'WARN', deaths: 2500, culls: 500 })],
  upcoming: [
    { date: '2026-11-01', inDays: 2, barnId: 1, barnName: 'Nhà A1', kind: 'VACCINE', title: 'Vắc-xin Gumboro (ngày tuổi 31)' },
    { date: '2026-11-04', inDays: 5, barnId: 2, barnName: 'Nhà A2', kind: 'HARVEST', title: 'Dự kiến xuất chuồng · Gà Mía 35 ngày' },
  ],
  finance: { chickCost: 1100000000, feedCost: 450000000, totalCost: 1600000000, revenue: 0, profit: -1600000000, otherCost: 50000000 },
  taskHistory: ['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30']
    .map((date, index) => ({ date, done: index === 6 ? 3 : 10, total: 12, missed: index === 6 ? 2 : 2 })),
  growth: [
    { barnId: 1, barnName: 'Nhà A1', targetDay: 35, targetWeightKg: 2.2, points: [
      { ageDays: 1, date: '2026-10-02', avgWeightKg: 0.04 }, { ageDays: 21, date: '2026-10-22', avgWeightKg: 0.85 }, { ageDays: 28, date: '2026-10-29', avgWeightKg: 1.4 }] },
    { barnId: 2, barnName: 'Nhà A2', targetDay: 35, targetWeightKg: 2.2, points: [{ ageDays: 1, date: '2026-10-02', avgWeightKg: 0.04 }] },
  ],
  ...extra,
});

const renderView = () => render(<MemoryRouter><DashboardView /></MemoryRouter>);

describe('Bảng tin', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.role = 'ROLE_FARM_OWNER';
    service.getDashboard.mockResolvedValue(dashboard());
    areas.listBarns.mockResolvedValue([
      { id: 1, areaId: 1, areaName: 'Khu Mía Thịt', name: 'Nhà A1', currentQuantity: 50000 },
      { id: 2, areaId: 1, areaName: 'Khu Mía Thịt', name: 'Nhà A2', currentQuantity: 50000 },
      { id: 9, areaId: 2, areaName: 'Khu J Thịt', name: 'Nhà B9', currentQuantity: 0 },
    ]);
  });

  it('draws the charts with real numbers and tooltips on hover', async () => {
    renderView();
    const charts = await screen.findByRole('region', { name: 'Biểu đồ' });
    const loss = within(charts).getByRole('figure', { name: 'Tỷ lệ hao hụt theo chuồng' });
    // Xếp cao → thấp: Nhà A2 (6%, vượt ngưỡng 5%) đứng trước Nhà A1 (0,4%).
    expect(within(loss).getByRole('img')).toHaveAccessibleName('Nhà A2 6%, Nhà A1 0,4%');
    fireEvent.mouseEnter(within(loss).getByRole('img').querySelectorAll('g[tabindex]')[0]);
    expect(within(loss).getByRole('status')).toHaveTextContent('Chết 2.500 · loại thải 500 / nhập 50.000');
    expect(within(loss).getByText('Vượt ngưỡng 5%')).toBeInTheDocument();
    const cost = within(charts).getByRole('figure', { name: 'Cơ cấu chi phí các lứa đang nuôi' });
    expect(within(cost).getByText('68,8%')).toBeInTheDocument();
    expect(within(cost).getByText('Chi khác')).toBeInTheDocument();

    const tasks = within(charts).getByRole('figure', { name: 'Việc 7 ngày gần nhất' });
    expect(within(tasks).getByText('Hôm nay')).toBeInTheDocument();
    fireEvent.mouseEnter(within(tasks).getAllByRole('img')[0].querySelectorAll('g[tabindex]')[6]);
    expect(within(tasks).getByRole('status')).toHaveTextContent('Đã xong 3/12');
    expect(within(tasks).getByRole('status')).toHaveTextContent('Quá giờ 2');

    const growth = within(charts).getByRole('figure', { name: 'Tăng trọng theo ngày tuổi' });
    expect(within(growth).getByRole('img')).toHaveAccessibleName(/Nhà A1: ngày 1 0,04 kg, ngày 21 0,85 kg, ngày 28 1,4 kg/);
    fireEvent.change(within(growth).getByLabelText('Chọn chuồng xem tăng trọng'), { target: { value: '2' } });
    expect(within(growth).getByText(/Chưa có lần cân mẫu/)).toBeInTheDocument();
  });

  it('draws the farm plan: every barn by area, coloured by status, empty barns in grey', async () => {
    renderView();
    const plan = await screen.findByRole('region', { name: 'Sơ đồ trang trại' });
    const mia = await within(plan).findByRole('group', { name: 'Khu Khu Mía Thịt' });
    expect(within(mia).getByText('2 chuồng · 100.000 con')).toBeInTheDocument();
    const a1 = within(mia).getByRole('link', { name: 'Sơ đồ Nhà A1' });
    expect(a1).toHaveAttribute('href', '/barns/1');
    expect(a1).toHaveAttribute('title', 'Nhà A1: Cần xử lý');
    expect(within(mia).getByRole('link', { name: 'Sơ đồ Nhà A2' })).toHaveTextContent('2 quá giờ');
    const empty = within(plan).getByRole('link', { name: 'Sơ đồ Nhà B9' });
    expect(empty).toHaveTextContent('Trống');
    expect(empty).toHaveAttribute('title', 'Nhà B9: chuồng trống');
    expect(within(plan).getByLabelText('Chú thích màu')).toHaveTextContent('Chuồng trống');
  });

  it('shows the owner the key numbers, what needs attention, the next 7 days, barns and money', async () => {
    renderView();
    expect(await screen.findByText('Chào Miền Bính')).toBeInTheDocument();
    expect(screen.getByText('99.996 con')).toBeInTheDocument();
    expect(screen.getByText('3/12')).toBeInTheDocument();
    expect(screen.getByText('2 việc quá giờ')).toBeInTheDocument();
    expect(screen.getByText('1.050.000.000đ')).toBeInTheDocument();

    const todo = screen.getByRole('region', { name: 'Cần xử lý' });
    const links = within(todo).getAllByRole('link');
    expect(links[0]).toHaveTextContent('Nhà A1: hao hụt 12 con hôm nay');
    expect(links[0]).toHaveAttribute('href', '/barns/1');
    expect(within(todo).getByRole('link', { name: /chưa có người phụ trách/ })).toHaveAttribute('href', '/today-tasks?view=assign');
    expect(within(todo).getByRole('link', { name: /hóa đơn còn nợ/ })).toHaveAttribute('href', '/purchases');

    const next = screen.getByRole('region', { name: '7 ngày tới' });
    expect(within(next).getByText('Vắc-xin Gumboro (ngày tuổi 31)')).toBeInTheDocument();
    expect(within(next).getByText('2 ngày nữa')).toBeInTheDocument();

    const barns = screen.getByRole('region', { name: 'Các chuồng đang nuôi' });
    expect(within(barns).getByRole('link', { name: 'Chuồng Nhà A1' })).toHaveAttribute('href', '/barns/1');
    expect(within(barns).getByText('Cần xử lý')).toBeInTheDocument();
    expect(within(barns).getByText('Chưa có người phụ trách')).toBeInTheDocument();

    const money = screen.getByRole('region', { name: 'Tài chính các lứa đang nuôi' });
    expect(within(money).getByText('Lỗ tạm tính')).toBeInTheDocument();
  });

  it('shows workers only their barns, without money', async () => {
    mocks.role = 'ROLE_FARM_WORKER';
    service.getDashboard.mockResolvedValue(dashboard({
      kpis: { ...dashboard().kpis, supplierDebt: null, unpaidInvoices: null }, finance: null,
      alerts: [dashboard().alerts[0]], barns: [barn(1, 'Nhà A1')],
    }));
    renderView();
    expect(await screen.findByRole('region', { name: 'Các chuồng đang nuôi' })).toHaveTextContent('Chuồng bạn phụ trách');
    expect(screen.queryByText(/Công nợ/)).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Tài chính các lứa đang nuôi' })).not.toBeInTheDocument();
    expect(screen.queryByRole('figure', { name: 'Cơ cấu chi phí các lứa đang nuôi' })).not.toBeInTheDocument();
    expect(screen.getByRole('figure', { name: 'Việc 7 ngày gần nhất' })).toBeInTheDocument();
  });

  it('says all is well when nothing needs attention, and retries after an error', async () => {
    service.getDashboard.mockRejectedValueOnce({ response: { data: { message: 'Máy chủ bận.' } } });
    renderView();
    expect(await screen.findByRole('alert')).toHaveTextContent('Máy chủ bận.');
    service.getDashboard.mockResolvedValueOnce(dashboard({ alerts: [], upcoming: [] }));
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText(/Không có việc gì cần xử lý/)).toBeInTheDocument();
    expect(screen.getByText(/Không có mốc vắc-xin/)).toBeInTheDocument();
    await waitFor(() => expect(service.getDashboard).toHaveBeenCalledTimes(2));
  });
});
