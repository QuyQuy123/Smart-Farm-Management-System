import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CycleHistoryView } from '../features/farmshift/CycleHistoryView';
import * as cycleService from '../services/cycleService';

const mocks = vi.hoisted(() => ({ role: 'ROLE_FARM_OWNER' }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: mocks.role, email: 'user@farm.test' } }) }));
vi.mock('../layouts/FarmShiftLayout', () => ({ FarmShiftLayout: ({ children }) => <div>{children}</div> }));
vi.mock('../hooks/useRealtimeRefresh', () => ({ useRealtimeRefresh: vi.fn() }));
vi.mock('../hooks/useViewport', () => ({ useViewport: () => ({ isMobile: false }) }));
vi.mock('../services/farmAreaService', () => ({
  listFarmAreas: vi.fn(async () => [{ id: 1, name: 'Khu A', barnCount: 2 }, { id: 2, name: 'Khu B', barnCount: 1 }]),
  listBarns: vi.fn(async () => [{ id: 10, name: 'Chuồng A1', areaId: 1 }, { id: 20, name: 'Chuồng B1', areaId: 2 }]),
}));
vi.mock('../services/farmingProgramService', () => ({
  listPrograms: vi.fn(async () => [{ id: 3, name: 'CT 90 ngày', breed: 'Gà Mía' }]),
}));
vi.mock('../services/cycleService', () => ({
  listClosedCycleHistory: vi.fn(),
}));

const sampleRow = (canFinance = true) => ({
  cycleId: 42,
  cycleCode: 'L000042',
  cycleNumber: 3,
  barnId: 10,
  barnName: 'Chuồng A1',
  areaId: 1,
  areaName: 'Khu A',
  startDate: '2026-08-01',
  endDate: '2026-10-30',
  durationDays: 91,
  programIds: [3],
  programNames: ['CT 90 ngày'],
  breeds: ['Gà Mía'],
  totalIn: 1000,
  harvestedQuantity: 960,
  deaths: 40,
  culls: 0,
  survivalRate: 96.0,
  feedKg: 3500,
  fcr: 1.92,
  harvestedWeightKg: 1920,
  avgHarvestWeightKg: 2.0,
  diseaseCount: 2,
  totalDiseaseMedicineCost: canFinance ? 450000 : null,
  totalCost: canFinance ? 95000000 : null,
  revenue: canFinance ? 134400000 : null,
  profit: canFinance ? 39400000 : null,
  costPerKg: canFinance ? 49479 : null,
});

describe('CycleHistoryView (OPS-03)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.role = 'ROLE_FARM_OWNER';
  });

  it('renders farm-wide closed cycles with disease cost, profit, filters and detail link', async () => {
    cycleService.listClosedCycleHistory.mockResolvedValue([sampleRow(true)]);

    render(<MemoryRouter><CycleHistoryView /></MemoryRouter>);

    expect(await screen.findByText('Lứa thứ 3')).toBeInTheDocument();
    expect(screen.getByText('2 đợt bệnh')).toBeInTheDocument();
    expect(screen.getByText('Tiền thuốc: 450.000đ')).toBeInTheDocument();
    expect(screen.getAllByText('39.400.000đ').length).toBeGreaterThanOrEqual(1);

    const detailLink = screen.getByRole('link', { name: /Xem chi tiết/ });
    expect(detailLink).toHaveAttribute('href', '/barns/10?cycle=42');

    // Trigger area filter
    fireEvent.change(screen.getByLabelText('Khu nuôi'), { target: { value: '1' } });
    await waitFor(() => expect(cycleService.listClosedCycleHistory).toHaveBeenLastCalledWith({ areaId: '1' }));
  });

  it('hides financial columns and KPIs for ROLE_FARM_WORKER', async () => {
    mocks.role = 'ROLE_FARM_WORKER';
    cycleService.listClosedCycleHistory.mockResolvedValue([sampleRow(false)]);

    render(<MemoryRouter><CycleHistoryView /></MemoryRouter>);

    expect(await screen.findByText('Lứa thứ 3')).toBeInTheDocument();
    expect(screen.getByText('2 đợt bệnh')).toBeInTheDocument();
    expect(screen.queryByText(/Tiền thuốc/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Lãi \/ Lỗ thực hiện/)).not.toBeInTheDocument();
  });

  it('shows financial metrics and hides AreaTabs for ROLE_ACCOUNTANT while keeping detail link', async () => {
    mocks.role = 'ROLE_ACCOUNTANT';
    cycleService.listClosedCycleHistory.mockResolvedValue([sampleRow(true)]);

    render(<MemoryRouter><CycleHistoryView /></MemoryRouter>);

    expect(await screen.findByText('Lứa thứ 3')).toBeInTheDocument();
    expect(screen.getByText('Tiền thuốc: 450.000đ')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Danh sách khu nuôi' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Xem chi tiết/ })).toHaveAttribute('href', '/barns/10?cycle=42');
  });

  it('groups transferred closed cycles by batchGroupKey with net math, expands children, and toggles flat view', async () => {
    const srcCycle = {
      ...sampleRow(true),
      cycleId: 101,
      cycleCode: 'L000101',
      cycleNumber: 1,
      barnId: 10,
      barnName: 'Nhà A1',
      startDate: '2026-09-01',
      endDate: '2026-11-25',
      totalIn: 10000,
      transferredOut: 5000,
      harvestedQuantity: 4800,
      deaths: 200,
      culls: 0,
      survivalRate: 96.0,
      feedKg: 19200,
      weightGainKg: 9600,
      fcr: 2.0,
      harvestedWeightKg: 9600,
      avgHarvestWeightKg: 2.0,
      diseaseCount: 1,
      totalDiseaseMedicineCost: 500000,
      totalCost: 300000000,
      revenue: 480000000,
      profit: 180000000,
      batchGroupKey: 'G-101',
      transferLinks: [{ direction: 'OUT', cycleId: 102, cycleCode: 'L000102', barnId: 11, barnName: 'Nhà A2', quantity: 5000 }],
    };
    const dstCycle = {
      ...sampleRow(true),
      cycleId: 102,
      cycleCode: 'L000102',
      cycleNumber: 1,
      barnId: 11,
      barnName: 'Nhà A2',
      startDate: '2026-09-25',
      endDate: '2026-11-26',
      totalIn: 5000,
      transferredOut: 0,
      harvestedQuantity: 4700,
      deaths: 300,
      culls: 0,
      survivalRate: 94.0,
      feedKg: 20000,
      weightGainKg: 9400,
      fcr: 2.13,
      harvestedWeightKg: 9400,
      avgHarvestWeightKg: 2.0,
      diseaseCount: 0,
      totalDiseaseMedicineCost: 0,
      totalCost: 310000000,
      revenue: 470000000,
      profit: 160000000,
      batchGroupKey: 'G-101',
      transferLinks: [{ direction: 'IN', cycleId: 101, cycleCode: 'L000101', barnId: 10, barnName: 'Nhà A1', quantity: 5000 }],
    };
    cycleService.listClosedCycleHistory.mockResolvedValue([dstCycle, srcCycle]);

    render(<MemoryRouter><CycleHistoryView /></MemoryRouter>);

    // 1. Default grouped mode combines into 1 batch row without double-counting the 5,000 transferred birds
    expect(await screen.findByText('Lô tách đàn (2 chuồng)')).toBeInTheDocument();
    expect(screen.getByText('Nhà A1 + Nhà A2')).toBeInTheDocument();
    expect(screen.getByText('10.000 / 9.500 con')).toBeInTheDocument();
    // Combined FCR = (19200 + 20000) / (9600 + 9400) = 39200 / 19000 = 2.06
    expect(screen.getAllByText('2,06').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('340.000.000đ').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('↳ Lứa thứ 1')).not.toBeInTheDocument();

    // 2. Expand group -> reveals both child rows with transfer badges and detail links
    fireEvent.click(screen.getByRole('button', { name: /Xem 2 chuồng/ }));
    expect(screen.getAllByText('↳ Lứa thứ 1')).toHaveLength(2);
    expect(screen.getByText('Tách sang Nhà A2 (L000102)')).toBeInTheDocument();
    expect(screen.getByText('Tách từ Nhà A1 (L000101)')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Xem chi tiết/ })).toHaveLength(2);

    // 3. Switch to flat mode -> shows both cycles ungrouped with transfer badges
    fireEvent.click(screen.getByRole('button', { name: 'Xem từng chuồng' }));
    expect(screen.queryByText('Lô tách đàn (2 chuồng)')).not.toBeInTheDocument();
    expect(screen.getByText('Tách sang Nhà A2 (L000102)')).toBeInTheDocument();
    expect(screen.getByText('Tách từ Nhà A1 (L000101)')).toBeInTheDocument();
  });
});
