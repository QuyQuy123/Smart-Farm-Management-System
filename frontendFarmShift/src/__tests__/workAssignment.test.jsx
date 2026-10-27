import React from 'react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WorkAssignmentView } from '../features/farmshift/WorkAssignmentView';
import * as service from '../services/workAssignmentService';

const mocks = vi.hoisted(() => ({ showToast: vi.fn() }));
vi.mock('../context/NotificationContext', () => ({ useNotification: () => ({ showToast: mocks.showToast }) }));
vi.mock('../layouts/FarmShiftLayout', () => ({ FarmShiftLayout: ({ pageTitle, children }) => <main><h1>{pageTitle}</h1>{children}</main> }));
vi.mock('../services/workAssignmentService', () => ({
  getWorkBoard: vi.fn(), setBarnWorkers: vi.fn(), createWorkTask: vi.fn(), updateWorkTask: vi.fn(), deleteWorkTask: vi.fn(),
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

const today = (() => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
})();
const workerA = { id: 5, fullName: 'Công nhân A', email: 'a@farm.test' };
const workerB = { id: 6, fullName: 'Công nhân B', email: 'b@farm.test' };
const board = () => ({
  date: today,
  workers: [{ ...workerA, barnCount: 1, taskCount: 1, doneCount: 1 }, { ...workerB, barnCount: 0, taskCount: 0, doneCount: 0 }],
  barns: [
    { barnId: 1, barnName: 'Nhà A1', areaId: 1, areaName: 'Khu Mía', activeCycleId: 11, headcount: 5000, workers: [workerA],
      tasks: [{ id: 31, barnId: 1, title: 'Rửa máng uống', note: '', startDate: today, endDate: today, dueTime: '07:30:00', assignee: workerA,
        done: { doneBy: 'a@farm.test', doneAt: `${today}T07:40:00`, note: '' } }] },
    { barnId: 2, barnName: 'Nhà A2', areaId: 1, areaName: 'Khu Mía', activeCycleId: 12, headcount: 4000, workers: [], tasks: [] },
  ],
});
const renderView = () => render(<MemoryRouter><WorkAssignmentView /></MemoryRouter>);

describe('Phân công công việc (chủ trại)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    service.getWorkBoard.mockResolvedValue(board());
    service.setBarnWorkers.mockResolvedValue([workerA, workerB]);
    service.createWorkTask.mockResolvedValue({});
  });

  it('shows each barn with its workers and the tasks given for the day', async () => {
    renderView();
    const a1 = await screen.findByRole('region', { name: 'Phân công Nhà A1' });
    expect(service.getWorkBoard).toHaveBeenCalledWith(today);
    expect(within(a1).getByText('Công nhân A')).toBeInTheDocument();
    expect(within(a1).getByText('Rửa máng uống')).toBeInTheDocument();
    expect(screen.getByText(/1 chuồng đang nuôi chưa có người phụ trách/)).toBeInTheDocument();
    const a2 = screen.getByRole('region', { name: 'Phân công Nhà A2' });
    expect(within(a2).getByText('Chưa có ai')).toBeInTheDocument();

    // Filter by worker: only the barns of that worker.
    fireEvent.click(screen.getByRole('button', { name: /Công nhân A1 chuồng/ }));
    expect(screen.queryByRole('region', { name: 'Phân công Nhà A2' })).not.toBeInTheDocument();
  });

  it('assigns workers to a barn', async () => {
    renderView();
    const a2 = await screen.findByRole('region', { name: 'Phân công Nhà A2' });
    // Giving a task needs a worker in charge first.
    fireEvent.click(within(a2).getByRole('button', { name: 'Giao việc Nhà A2' }));
    expect(mocks.showToast).toHaveBeenCalledWith(expect.stringContaining('chưa có công nhân phụ trách'), 'error');

    fireEvent.click(within(a2).getByRole('button', { name: 'Phân công Nhà A2' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByLabelText(/Công nhân A/));
    fireEvent.click(within(dialog).getByLabelText(/Công nhân B/));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu (2 người)' }));
    await waitFor(() => expect(service.setBarnWorkers).toHaveBeenCalledWith(2, [5, 6]));
    expect(mocks.showToast).toHaveBeenCalledWith('Đã cập nhật công nhân phụ trách Nhà A2.', 'success');
  });

  it('gives a repeating daily task to a worker of the barn', async () => {
    renderView();
    const a1 = await screen.findByRole('region', { name: 'Phân công Nhà A1' });
    fireEvent.click(within(a1).getByRole('button', { name: 'Giao việc Nhà A1' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(within(dialog).getByLabelText(/Công nhân/)).getAllByRole('option').map(option => option.textContent)).toEqual(['Công nhân A']);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu và đóng lại' }));
    expect(await within(dialog).findByText('Vui lòng nhập tên công việc.')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/Tên công việc/), { target: { value: 'Sát trùng lối đi' } });
    fireEvent.change(within(dialog).getByLabelText(/Giờ làm/), { target: { value: '16:00' } });
    fireEvent.change(within(dialog).getByLabelText(/Lặp mỗi ngày đến/), { target: { value: '2099-01-07' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu và đóng lại' }));
    await waitFor(() => expect(service.createWorkTask).toHaveBeenCalledWith({
      barnId: 1, assigneeId: 5, title: 'Sát trùng lối đi', note: '', startDate: today, endDate: '2099-01-07', dueTime: '16:00',
    }));
    expect(mocks.showToast).toHaveBeenCalledWith('Đã giao việc "Sát trùng lối đi" cho Công nhân A.', 'success');
  });
});
