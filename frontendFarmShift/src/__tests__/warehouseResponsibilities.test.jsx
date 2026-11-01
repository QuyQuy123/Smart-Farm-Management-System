import React from 'react';
import { beforeAll, beforeEach, afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { WarehouseResponsibilities } from '../features/farmshift/WarehouseResponsibilities';
import * as service from '../services/warehouseResponsibilityService';

vi.mock('../services/warehouseResponsibilityService', () => ({ getWarehouseResponsibilities: vi.fn(), setWarehouseWorkers: vi.fn() }));
vi.mock('../context/NotificationContext', () => ({ useNotification: () => ({ showToast: vi.fn() }) }));
const workers = [{ id: 1, fullName: 'Công nhân An', email: 'an@farm.test' }, { id: 2, fullName: 'Công nhân Bình', email: 'binh@farm.test' }];
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
beforeEach(() => {
  vi.resetAllMocks();
  service.getWarehouseResponsibilities.mockResolvedValue({ workers, warehouses: [{ id: 10, name: 'Kho thật', workers: [] }] });
});
afterEach(cleanup);

it('loads real warehouses and saves multiple workers, then displays the saved list', async () => {
  service.setWarehouseWorkers.mockResolvedValue(workers);
  render(<WarehouseResponsibilities canEdit />);
  fireEvent.click(await screen.findByRole('button', { name: 'Thêm công nhân phụ trách · Kho thật' }));
  const dialog = within(screen.getByRole('dialog'));
  expect(dialog.queryByRole('searchbox')).not.toBeInTheDocument();
  fireEvent.click(dialog.getByLabelText(/Công nhân An/));
  fireEvent.click(dialog.getByLabelText(/Công nhân Bình/));
  fireEvent.click(dialog.getByText('Lưu phân công'));
  await waitFor(() => expect(service.setWarehouseWorkers).toHaveBeenCalledWith(10, [1, 2]));
  expect(await screen.findByRole('button', { name: 'Chỉnh sửa công nhân · Kho thật' })).toBeInTheDocument();
  expect(screen.queryByText('Thủ kho chính')).not.toBeInTheDocument();
});

it('can clear a warehouse assignment', async () => {
  service.getWarehouseResponsibilities.mockResolvedValue({ workers, warehouses: [{ id: 10, name: 'Kho thật', workers: [workers[0]] }] });
  service.setWarehouseWorkers.mockResolvedValue([]);
  render(<WarehouseResponsibilities canEdit />);
  fireEvent.click(await screen.findByRole('button', { name: 'Chỉnh sửa công nhân · Kho thật' }));
  const dialog = within(screen.getByRole('dialog'));
  expect(dialog.getByLabelText(/Công nhân An/)).toBeChecked();
  fireEvent.click(dialog.getByLabelText(/Công nhân An/));
  fireEvent.click(dialog.getByText('Lưu phân công'));
  await waitFor(() => expect(service.setWarehouseWorkers).toHaveBeenCalledWith(10, []));
  expect(await screen.findByRole('button', { name: 'Thêm công nhân phụ trách · Kho thật' })).toBeInTheDocument();
});

it('keeps selections after a save error and allows cancel without saving again', async () => {
  service.setWarehouseWorkers.mockRejectedValue({ response: { data: { message: 'Không lưu được phân công.' } } });
  render(<WarehouseResponsibilities canEdit />);
  fireEvent.click(await screen.findByRole('button', { name: 'Thêm công nhân phụ trách · Kho thật' }));
  fireEvent.click(screen.getByLabelText(/Công nhân An/));
  fireEvent.click(screen.getByText('Lưu phân công'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Không lưu được phân công.');
  expect(screen.getByLabelText(/Công nhân An/)).toBeChecked();
  fireEvent.click(screen.getByText('Hủy'));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(service.setWarehouseWorkers).toHaveBeenCalledTimes(1);
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
