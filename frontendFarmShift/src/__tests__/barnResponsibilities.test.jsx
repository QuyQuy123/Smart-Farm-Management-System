import React from 'react';
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BarnResponsibilities } from '../features/farmshift/BarnResponsibilities';
import * as service from '../services/workAssignmentService';

vi.mock('../services/workAssignmentService', () => ({
  getBarnResponsibilities: vi.fn(), setBarnWorkers: vi.fn(), saveAreaWorkerAssignments: vi.fn(), inheritAreaWorkers: vi.fn(),
}));
vi.mock('../context/NotificationContext', () => ({ useNotification: () => ({ showToast: vi.fn() }) }));

const workers = [{ id: 1, fullName: 'Nguyễn An', email: 'an@farm.test' }, { id: 2, fullName: 'Trần Bình', email: 'binh@farm.test' }];
const board = () => ({ workers, areas: [{ id: 10, name: 'Khu thật', workers: [], barns: [
  { id: 11, name: 'Chuồng thật', workers: [], inherited: true },
] }] });

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
beforeEach(() => { vi.resetAllMocks(); service.getBarnResponsibilities.mockResolvedValue(board()); });
afterEach(cleanup);

describe('barn responsibility settings', () => {
  it('loads real areas and barns, and assigns multiple workers to an area', async () => {
    render(<BarnResponsibilities canEdit />);
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm công nhân phụ trách · Khu thật' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByLabelText(/Nguyễn An/));
    fireEvent.click(within(dialog).getByLabelText(/Trần Bình/));
    fireEvent.click(within(dialog).getByText('Lưu phân công'));
    await waitFor(() => expect(service.saveAreaWorkerAssignments).toHaveBeenCalledWith(10, { workerIds: [1, 2], applyToAll: true, barns: [] }));
    await waitFor(() => expect(service.getBarnResponsibilities).toHaveBeenCalledTimes(2));
  });

  it('allows a barn to override inheritance and select its own workers', async () => {
    render(<BarnResponsibilities canEdit />);
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm công nhân phụ trách · Chuồng thật' }));
    fireEvent.click(screen.getByLabelText('Phân công riêng cho chuồng'));
    fireEvent.click(screen.getByLabelText(/Trần Bình/));
    fireEvent.click(screen.getByText('Lưu phân công'));
    await waitFor(() => expect(service.setBarnWorkers).toHaveBeenCalledWith(11, [2]));
  });

  it('can return a barn to area inheritance', async () => {
    const data = board();
    data.areas[0].workers = [workers[0]];
    data.areas[0].barns[0] = { id: 11, name: 'Chuồng thật', inherited: false, workers: [workers[1]] };
    service.getBarnResponsibilities.mockResolvedValue(data);
    render(<BarnResponsibilities canEdit />);
    fireEvent.click(await screen.findByRole('button', { name: 'Chỉnh sửa công nhân · Chuồng thật' }));
    fireEvent.click(screen.getByLabelText('Kế thừa từ khu nuôi'));
    expect(within(screen.getByRole('dialog')).getByText('Nguyễn An')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Lưu phân công'));
    await waitFor(() => expect(service.inheritAreaWorkers).toHaveBeenCalledWith(11));
  });

  it('keeps the dialog and selections open after a save failure', async () => {
    service.saveAreaWorkerAssignments.mockRejectedValue({ response: { data: { message: 'Công nhân còn việc được giao.' } } });
    render(<BarnResponsibilities canEdit />);
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm công nhân phụ trách · Khu thật' }));
    fireEvent.click(screen.getByLabelText(/Nguyễn An/));
    fireEvent.click(screen.getByText('Lưu phân công'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Công nhân còn việc được giao.');
    expect(screen.getByLabelText(/Nguyễn An/)).toBeChecked();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('allows multiple selections and cancels without saving', async () => {
    render(<BarnResponsibilities canEdit />);
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm công nhân phụ trách · Khu thật' }));
    fireEvent.click(screen.getByLabelText(/Nguyễn An/));
    expect(screen.queryByLabelText('Tìm công nhân')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Trần Bình/));
    expect(screen.getByText(/Đã chọn 2 công nhân/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Hủy'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(service.saveAreaWorkerAssignments).not.toHaveBeenCalled();
  });

  it('reports load failures and retries', async () => {
    service.getBarnResponsibilities.mockRejectedValueOnce(new Error('offline'));
    render(<BarnResponsibilities canEdit />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Thử lại'));
    expect(await screen.findByText('Chuồng thật')).toBeInTheDocument();
  });

  it('does not fetch owner-only data for other roles', () => {
    render(<BarnResponsibilities canEdit={false} />);
    expect(service.getBarnResponsibilities).not.toHaveBeenCalled();
    expect(screen.getByText(/Chỉ chủ trang trại/)).toBeInTheDocument();
  });
  it('saves per-barn selections together without opening another dialog', async () => {
    render(<BarnResponsibilities canEdit />);
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm công nhân phụ trách · Khu thật' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByLabelText(/Nguyễn An/));
    fireEvent.click(within(dialog).getByRole('switch'));
    const barn = within(dialog).getByRole('group', { name: /Chuồng thật/ });
    fireEvent.click(within(barn).getByLabelText('Trần Bình'));
    fireEvent.click(within(dialog).getByText('Lưu phân công'));
    await waitFor(() => expect(service.saveAreaWorkerAssignments).toHaveBeenCalledWith(10, {
      workerIds: [1], applyToAll: false, barns: [{ barnId: 11, workerIds: [2] }],
    }));
  });

  it('preserves custom drafts when toggling apply-to-all on and off', async () => {
    const data = board();
    data.areas[0].barns[0].inherited = false;
    data.areas[0].barns[0].workers = [workers[1]];
    service.getBarnResponsibilities.mockResolvedValue(data);
    render(<BarnResponsibilities canEdit />);
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm công nhân phụ trách · Khu thật' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('switch')).not.toBeChecked();
    fireEvent.click(within(dialog).getByRole('switch'));
    expect(within(dialog).queryByRole('group', { name: /Chuồng thật/ })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('switch'));
    expect(within(within(dialog).getByRole('group', { name: /Chuồng thật/ })).getByLabelText('Trần Bình')).toBeChecked();
  });

});
