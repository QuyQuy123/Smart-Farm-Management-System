import React from 'react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AreasView } from '../features/farmshift/AreasView';
import * as service from '../services/farmAreaService';

const mocks = vi.hoisted(() => ({ role: 'ROLE_FARM_OWNER', showToast: vi.fn() }));
vi.mock('../context/NotificationContext', () => ({ useNotification: () => ({ showToast: mocks.showToast }) }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: mocks.role } }) }));
vi.mock('../layouts/FarmShiftLayout', () => ({ FarmShiftLayout: ({ pageTitle, children }) => <main><h1>{pageTitle}</h1>{children}</main> }));
vi.mock('../services/farmAreaService', () => ({
  listFarmAreas: vi.fn(), getFarmArea: vi.fn(), createFarmArea: vi.fn(), updateFarmArea: vi.fn(), deleteFarmArea: vi.fn(),
  listBarns: vi.fn(), createBarn: vi.fn(), updateBarn: vi.fn(), deleteBarn: vi.fn(),
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

let areas;
let barns;
const area = (id, name, extra = {}) => ({
  id, code: `KN00000${id}`, name, environmentMetrics: ['HUMIDITY', 'TEMPERATURE'],
  animalMetrics: ['WEIGHT'], description: '', barnCount: 0, activeBarnCount: 0, animalCount: 0, totalCapacity: 0,
  createdAt: `2026-10-0${id}T08:00:00`, ...extra,
});
const barn = (id, areaId, name, extra = {}) => ({
  id, code: `CH00000${id}`, areaId, areaName: areas.find(item => item.id === areaId).name, name, status: 'ACTIVE',
  capacity: 50000, currentQuantity: 40000, targetWeight: 2.3, description: '', createdAt: `2026-10-0${id}T09:00:00`, ...extra,
});

const renderAt = path => render(<MemoryRouter initialEntries={[path]}><Routes>
  <Route path="/areas" element={<AreasView />} /><Route path="/areas/:id" element={<AreasView />} /><Route path="/barns" element={<AreasView />} />
</Routes></MemoryRouter>);
const openMenu = name => fireEvent.click(screen.getByRole('button', { name: `Thao tác ${name}` }));

describe('Farm area management', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.role = 'ROLE_FARM_OWNER';
    areas = [
      area(1, 'Khu Mía Thịt', { barnCount: 2, activeBarnCount: 2, animalCount: 90000, totalCapacity: 100000 }),
      area(2, 'Khu đông tảo'),
    ];
    barns = [barn(1, 1, 'Nhà A1', { currentQuantity: 50000 }), barn(2, 1, 'Nhà A2')];
    service.listFarmAreas.mockImplementation(async () => [...areas]);
    service.getFarmArea.mockImplementation(async id => areas.find(item => String(item.id) === String(id)));
    service.listBarns.mockImplementation(async areaId => barns.filter(item => !areaId || String(item.areaId) === String(areaId)));
    service.createFarmArea.mockImplementation(async data => { const created = area(3, data.name, data); areas.push(created); return created; });
    service.deleteFarmArea.mockImplementation(async id => { areas = areas.filter(item => item.id !== id); });
    service.createBarn.mockImplementation(async data => { const created = barn(3, data.areaId, data.name, data); barns.push(created); return created; });
  });

  it('lists areas with live barn counts and creates an area with tracked metrics', async () => {
    renderAt('/areas');
    const row = (await screen.findByRole('link', { name: 'Khu Mía Thịt' })).closest('tr');
    expect(within(row).getByText('(2 đang nuôi)')).toBeInTheDocument();
    expect(screen.getByText('1-2/2 khu nuôi')).toBeInTheDocument();
    // Area navigation is a horizontal tab bar on the page, so it works with the sidebar collapsed.
    const tabs = within(screen.getByRole('navigation', { name: 'Điều hướng khu nuôi' }));
    expect(tabs.getByRole('link', { name: 'Danh sách khu nuôi' })).toHaveAttribute('aria-current', 'page');
    expect(tabs.getByRole('link', { name: 'Tất cả chuồng' })).toHaveAttribute('href', '/barns');
    expect(tabs.getByRole('link', { name: /^Khu Mía Thịt/ })).toHaveAttribute('href', '/areas/1');

    fireEvent.click(screen.getByRole('button', { name: 'Tạo khu nuôi' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu và đóng lại' }));
    expect(await within(dialog).findByText('Vui lòng nhập tên khu nuôi.')).toBeInTheDocument();
    expect(service.createFarmArea).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText(/Tên khu nuôi/), { target: { value: '  Khu A  ' } });
    expect(within(dialog).queryByLabelText(/Loại vật nuôi/)).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/Số bữa ăn/)).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Độ ẩm' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ảnh chết loại' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu và đóng lại' }));
    await screen.findByRole('link', { name: 'Khu A' });
    expect(service.createFarmArea).toHaveBeenCalledWith({
      name: 'Khu A', environmentMetrics: ['TEMPERATURE'],
      animalMetrics: ['WEIGHT', 'LOSS', 'DEAD_PHOTO'], description: '',
    });
    expect(mocks.showToast).toHaveBeenCalledWith('Đã thêm khu nuôi Khu A.', 'success');
  });

  it('filters the area list by barn count and name', async () => {
    renderAt('/areas');
    await screen.findByRole('link', { name: 'Khu Mía Thịt' });
    expect(screen.queryByLabelText('Lọc loại vật nuôi')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Lọc số chuồng'), { target: { value: '0' } });
    expect(screen.queryByRole('link', { name: 'Khu Mía Thịt' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Khu đông tảo' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Lọc tên khu nuôi'), { target: { value: 'mía' } });
    expect(screen.getByText('Không có khu nuôi phù hợp với bộ lọc.')).toBeInTheDocument();
  });

  it('blocks deleting an area that still has barns and deletes an empty one', async () => {
    renderAt('/areas');
    await screen.findByRole('link', { name: 'Khu Mía Thịt' });
    openMenu('Khu Mía Thịt');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Xóa khu nuôi' }));
    let dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/đang có 2 chuồng/)).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Xóa khu nuôi' })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Đóng' })[1]);

    openMenu('Khu đông tảo');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Xóa khu nuôi' }));
    dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xóa khu nuôi' }));
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Khu đông tảo' })).not.toBeInTheDocument());
    expect(service.deleteFarmArea).toHaveBeenCalledWith(2);
  });

  it('shows the barns of one area with summary and validates a new barn before saving', async () => {
    renderAt('/areas/1');
    expect(await screen.findByRole('heading', { name: 'Khu Mía Thịt', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('90.000 con')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.getByText('Nhà A1')).toBeInTheDocument();
    expect(screen.getByText('Mục tiêu (kg)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tạo Chuồng' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText(/Khu nuôi/)).toHaveValue('1');
    fireEvent.change(within(dialog).getByLabelText(/Tên chuồng/), { target: { value: 'Nhà A3' } });
    // Animals arrive only through flock imports, so the barn form declares capacity and area instead of a stock count.
    expect(within(dialog).queryByLabelText(/Số con hiện có/)).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/Sức chứa tối đa/), { target: { value: '0' } });
    fireEvent.change(within(dialog).getByLabelText(/Diện tích/), { target: { value: '-5' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu và đóng lại' }));
    expect(await within(dialog).findByText('Sức chứa tối đa phải là số nguyên lớn hơn 0.')).toBeInTheDocument();
    expect(within(dialog).getByText('Diện tích phải lớn hơn 0.')).toBeInTheDocument();
    expect(service.createBarn).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText(/Sức chứa tối đa/), { target: { value: '100' } });
    fireEvent.change(within(dialog).getByLabelText(/Diện tích/), { target: { value: '120' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu và đóng lại' }));
    await screen.findByText('Nhà A3');
    expect(service.createBarn).toHaveBeenCalledWith({
      areaId: 1, name: 'Nhà A3', capacity: 100, areaM2: 120, targetWeight: null, description: '',
    });
  });

  it('suggests barn capacity from the floor area at 8 birds per m²', async () => {
    renderAt('/areas/1');
    fireEvent.click(await screen.findByRole('button', { name: 'Tạo Chuồng' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByLabelText(/Mục đích sử dụng/)).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/Diện tích/), { target: { value: '400' } });
    expect(within(dialog).getByLabelText(/Sức chứa tối đa/)).toHaveValue(3200);
    expect(within(dialog).getByText('3.200 con')).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText(/Sức chứa tối đa/), { target: { value: '4000' } });
    expect(within(dialog).getByText(/Mật độ 10 con\/m² cao hơn mức khuyến nghị/)).toBeInTheDocument();
    // A capacity typed by the owner is kept when the area changes; the suggestion can be applied on demand.
    fireEvent.change(within(dialog).getByLabelText(/Diện tích/), { target: { value: '450' } });
    expect(within(dialog).getByLabelText(/Sức chứa tối đa/)).toHaveValue(4000);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Dùng gợi ý' }));
    expect(within(dialog).getByLabelText(/Sức chứa tối đa/)).toHaveValue(3600);
    fireEvent.change(within(dialog).getByLabelText(/Diện tích/), { target: { value: '600' } });
    expect(within(dialog).getByLabelText(/Sức chứa tối đa/)).toHaveValue(4800);
  });

  it('shows server-side duplicate errors under the field', async () => {
    service.createBarn.mockRejectedValue({ response: { status: 409, data: { message: 'Tên chuồng đã tồn tại trong Khu Mía Thịt.', data: { name: 'Tên chuồng đã tồn tại trong Khu Mía Thịt.' } } } });
    renderAt('/barns');
    await screen.findByText('Nhà A1');
    fireEvent.click(screen.getByRole('button', { name: 'Tạo Chuồng' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Tên chuồng/), { target: { value: 'Nhà A1' } });
    fireEvent.change(within(dialog).getByLabelText(/Sức chứa tối đa/), { target: { value: '10' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu và đóng lại' }));
    expect(await within(dialog).findByText('Tên chuồng đã tồn tại trong Khu Mía Thịt.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nhà A1' })).toHaveAttribute('href', '/barns/1');
    expect(within(dialog).getByLabelText(/Tên chuồng/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('gives non-owners a read-only view', async () => {
    mocks.role = 'ROLE_FARM_WORKER';
    renderAt('/areas');
    await screen.findByRole('link', { name: 'Khu Mía Thịt' });
    expect(screen.getByRole('note')).toHaveTextContent('chế độ chỉ đọc');
    expect(screen.queryByRole('button', { name: 'Tạo khu nuôi' })).not.toBeInTheDocument();
    openMenu('Khu Mía Thịt');
    expect(screen.getAllByRole('menuitem').map(item => item.textContent)).toEqual(['Xem danh sách chuồng']);
  });
});
