import React from 'react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { DiseaseLogPanel } from '../features/farmshift/DiseaseLogPanel';
import * as service from '../services/cycleDiseaseService';

vi.mock('../services/cycleDiseaseService', () => ({
  listCycleDiseases: vi.fn(),
  listDiseaseMedicineSources: vi.fn(),
  createCycleDisease: vi.fn(),
  updateCycleDisease: vi.fn(),
  deleteCycleDisease: vi.fn(),
  addDiseaseTreatment: vi.fn(),
  deleteDiseaseTreatment: vi.fn(),
}));

const originalShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal');
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close');
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open'); } });
});
afterAll(() => {
  if (originalShow) Object.defineProperty(HTMLDialogElement.prototype, 'showModal', originalShow);
  else delete HTMLDialogElement.prototype.showModal;
  if (originalClose) Object.defineProperty(HTMLDialogElement.prototype, 'close', originalClose);
  else delete HTMLDialogElement.prototype.close;
});

const sampleDisease = (canFinance = true) => ({
  id: 101,
  cycleId: 5,
  diseaseName: 'Cầu trùng',
  symptoms: 'Phân sáp, xù lông',
  startDate: '2026-11-20',
  endDate: null,
  status: 'ACTIVE',
  affectedQuantity: 45,
  treatmentDays: 3,
  totalMedicineCost: canFinance ? 380000 : null,
  treatments: [
    {
      id: 201,
      treatmentDate: '2026-11-20',
      medicineName: 'Baycox',
      method: 'AUTO_DRINKER',
      dosageText: '1 ml/lít nước',
      warehouseName: 'Kho thuốc Khu A',
      unitName: 'Chai 1L',
      stockQuantity: 2.5,
      unitPrice: canFinance ? 104000 : null,
      cost: canFinance ? 260000 : null,
      createdBy: 'owner@farm.test',
    },
  ],
});

describe('DiseaseLogPanel (OPS-02)', () => {
  const cycle = { id: 5, status: 'ACTIVE', startDate: '2026-11-01' };
  const showToast = vi.fn();
  const onChanged = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    service.listDiseaseMedicineSources.mockResolvedValue([
      { itemId: 11, warehouseName: 'Kho thuốc Khu A', productName: 'Baycox', unitName: 'Chai 1L', availableStock: 5 },
    ]);
  });

  it('renders diseases with total medicine cost for owner and supports creating disease and logging treatment', async () => {
    service.listCycleDiseases.mockResolvedValue([sampleDisease(true)]);
    service.createCycleDisease.mockResolvedValue({ id: 102, diseaseName: 'CRD' });
    service.addDiseaseTreatment.mockResolvedValue(sampleDisease(true));

    render(
      <DiseaseLogPanel
        cycle={cycle}
        flocks={[{ id: 1, code: 'D01', name: 'Đàn 1' }]}
        canDaily
        canFinance
        isOwner
        userEmail="owner@farm.test"
        onChanged={onChanged}
        showToast={showToast}
      />,
    );

    expect(await screen.findByText('Cầu trùng')).toBeInTheDocument();
    expect(screen.getByText('Tiền thuốc: 380.000đ')).toBeInTheDocument();
    expect(screen.getByText('260.000đ')).toBeInTheDocument();

    // Open create disease dialog
    fireEvent.click(screen.getByRole('button', { name: 'Khai báo đợt bệnh' }));
    const createDialog = await screen.findByRole('dialog');
    fireEvent.change(within(createDialog).getByLabelText(/Tên bệnh/), { target: { value: 'CRD hô hấp' } });
    fireEvent.click(within(createDialog).getByRole('button', { name: 'Lưu đợt bệnh' }));

    await waitFor(() => expect(service.createCycleDisease).toHaveBeenCalledWith(5, expect.objectContaining({ diseaseName: 'CRD hô hấp' })));
    expect(onChanged).toHaveBeenCalled();

    // Open log treatment dialog
    fireEvent.click(screen.getByRole('button', { name: 'Ghi dùng thuốc' }));
    const treatDialog = await screen.findByRole('dialog');
    fireEvent.change(within(treatDialog).getByLabelText(/Số lượng xuất kho/), { target: { value: '1.5' } });
    fireEvent.click(within(treatDialog).getByRole('button', { name: 'Ghi nhận dùng thuốc' }));

    await waitFor(() => expect(service.addDiseaseTreatment).toHaveBeenCalledWith(5, 101, expect.objectContaining({
      inventoryItemId: 11,
      stockQuantity: 1.5,
    })));
  });

  it('hides all financial columns and total medicine cost for farm workers (canFinance = false)', async () => {
    service.listCycleDiseases.mockResolvedValue([sampleDisease(false)]);

    render(
      <DiseaseLogPanel
        cycle={cycle}
        flocks={[]}
        canDaily
        canFinance={false}
        isOwner={false}
        userEmail="worker@farm.test"
        onChanged={onChanged}
        showToast={showToast}
      />,
    );

    expect(await screen.findByText('Cầu trùng')).toBeInTheDocument();
    expect(screen.queryByText(/Tiền thuốc/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tổng tiền thuốc/)).not.toBeInTheDocument();
    expect(screen.queryByText('Thành tiền')).not.toBeInTheDocument();
  });

  it('hides log treatment button for RECOVERED disease, allows reopening, and lets worker undo same-day created treatment case-insensitively', async () => {
    const todayIso = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const recoveredDisease = {
      ...sampleDisease(false),
      status: 'RECOVERED',
      endDate: todayIso,
      treatments: [
        {
          ...sampleDisease(false).treatments[0],
          treatmentDate: '2026-11-18',
          createdBy: 'Worker@Farm.Test',
          createdAt: `${todayIso}T09:15:00`,
        },
      ],
    };
    service.listCycleDiseases.mockResolvedValue([recoveredDisease]);
    service.updateCycleDisease.mockResolvedValue({ ...recoveredDisease, status: 'ACTIVE', endDate: null });

    const { rerender } = render(
      <DiseaseLogPanel
        cycle={cycle}
        flocks={[]}
        canDaily
        canFinance={false}
        isOwner={false}
        userEmail="worker@farm.test"
        refreshKey={0}
        onChanged={onChanged}
        showToast={showToast}
      />,
    );

    expect(await screen.findByText('Đã khỏi')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ghi dùng thuốc' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hoàn tác thuốc Baycox' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mở lại điều trị' }));
    await waitFor(() => expect(service.updateCycleDisease).toHaveBeenCalledWith(5, 101, { status: 'ACTIVE', endDate: null }));

    const callsBefore = service.listCycleDiseases.mock.calls.length;
    rerender(
      <DiseaseLogPanel
        cycle={cycle}
        flocks={[]}
        canDaily
        canFinance={false}
        isOwner={false}
        userEmail="worker@farm.test"
        refreshKey={1}
        onChanged={onChanged}
        showToast={showToast}
      />,
    );
    await waitFor(() => expect(service.listCycleDiseases.mock.calls.length).toBeGreaterThan(callsBefore));
  });
});
