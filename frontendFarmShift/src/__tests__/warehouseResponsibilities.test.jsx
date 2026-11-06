import React from 'react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { WarehouseResponsibilities } from '../features/farmshift/WarehouseResponsibilities';
import * as service from '../services/warehouseResponsibilityService';

vi.mock('../services/warehouseResponsibilityService', () => ({ getWarehouseResponsibilities: vi.fn(), setWarehouseWorkers: vi.fn() }));
vi.mock('../context/NotificationContext', () => ({ useNotification: () => ({ showToast: vi.fn() }) }));

const workers = [{ id: 1, fullName: 'Công nhân An', email: 'an@farm.test' }, { id: 2, fullName: 'Công nhân Bình', email: 'binh@farm.test' }];

beforeEach(() => {
  vi.resetAllMocks();
  service.getWarehouseResponsibilities.mockResolvedValue({
    workers,
    warehouses: [
      { id: 10, name: 'Kho thật', areaName: 'Khu 1', kind: 'FEED', workers: [workers[0]] },
      { id: 11, name: 'Kho chưa có công nhân', areaName: 'Khu 2', kind: 'MEDICINE', workers: [] }
    ]
  });
});
afterEach(cleanup);

it('loads warehouses and displays automatically linked workers without requiring manual assignment buttons', async () => {
  render(<WarehouseResponsibilities canEdit />);
  expect(await screen.findByText('Kho thật')).toBeInTheDocument();
  expect(screen.getByText('Công nhân An')).toBeInTheDocument();
  expect(screen.getByText(/Tự động kế thừa khi gán công nhân vào Khu nuôi/)).toBeInTheDocument();

  // Bỏ hoàn toàn các nút thêm/sửa phân công công nhân theo kho
  expect(screen.queryByRole('button', { name: /Thêm công nhân phụ trách/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Chỉnh sửa/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('retries failed loads and handles an empty warehouse list', async () => {
  service.getWarehouseResponsibilities.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ workers, warehouses: [] });
  render(<WarehouseResponsibilities canEdit />);
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Thử lại'));
  expect(await screen.findByText(/Chưa có kho hàng/)).toBeInTheDocument();
});

it('does not fetch owner data for other roles', () => {
  render(<WarehouseResponsibilities canEdit={false} />);
  expect(service.getWarehouseResponsibilities).not.toHaveBeenCalled();
  expect(screen.getByText(/Chỉ chủ trang trại/)).toBeInTheDocument();
});
