import React from 'react';
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { InventoryView } from '../features/farmshift/InventoryView';
import * as service from '../services/inventoryItemService';
import { fileService } from '../services/fileService';

const mocks = vi.hoisted(() => ({ role: 'ROLE_FARM_OWNER', showToast: vi.fn() }));
vi.mock('../layouts/FarmShiftLayout', () => ({ FarmShiftLayout: ({ children, actions }) => <div>{actions}{children}</div> }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: mocks.role } }) }));
vi.mock('../context/NotificationContext', () => ({ useNotification: () => ({ showToast: mocks.showToast }) }));
vi.mock('../services/warehouseCategoryService', () => ({ WAREHOUSE_CATEGORIES_CHANGED: 'warehouse-categories-changed', listWarehouseCategories: async () => [{ id: 1, name: 'Kho cám', createdAt: '2026-10-18T12:00:00' }] }));
vi.mock('../services/productCategoryService', () => ({ listProductCategories: async () => [{ id: 11, name: 'Cám gà', warehouseId: 1 }, { id: 12, name: 'Thuốc kho khác', warehouseId: 2 }] }));
vi.mock('../services/measurementUnitService', () => ({ listMeasurementUnits: async () => [{ id: 7, name: 'Kg', code: 'KG' }] }));
vi.mock('../services/brandService', () => ({ listBrands: async () => [{ id: 9, name: 'Nhãn hiệu A' }] }));
vi.mock('../services/inventoryItemService', () => ({ listInventoryItems: vi.fn(), createInventoryItem: vi.fn(), updateInventoryItem: vi.fn(), deleteInventoryItem: vi.fn() }));
vi.mock('../services/fileService', () => ({ fileService: { uploadFile: vi.fn() } }));
const originals = {
  showModal: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'showModal'),
  close: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close'),
  createObjectURL: Object.getOwnPropertyDescriptor(URL, 'createObjectURL'),
  revokeObjectURL: Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL'),
};
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open'); } });
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => 'blob:preview' });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => {} });
});
afterAll(() => {
  for (const [key, descriptor] of Object.entries(originals)) {
    const target = key.includes('ObjectURL') ? URL : HTMLDialogElement.prototype;
    if (descriptor) Object.defineProperty(target, key, descriptor); else delete target[key];
  }
});
let items;
const renderView = () => render(<MemoryRouter><InventoryView /></MemoryRouter>);
async function openCreate() {
  renderView();
  const create = screen.getByRole('button', { name: 'Tạo hàng hóa' });
  await waitFor(() => expect(create).toBeEnabled());
  fireEvent.click(create);
  const dialog = await screen.findByRole('dialog');
  await within(dialog).findByRole('option', { name: 'Kg (KG)' });
  return dialog;
}
describe('Persistent inventory CRUD', () => {
  beforeEach(() => {
    vi.resetAllMocks(); mocks.role = 'ROLE_FARM_OWNER'; items = [];
    service.listInventoryItems.mockImplementation(async () => [...items]);
    service.createInventoryItem.mockImplementation(async data => { items.push({ ...data, id: 1, name: 'Cám gà', stock: 0, unitName: 'Kg', unitCode: 'KG', brandName: 'Nhãn hiệu A', code: 'SP_HIDDEN' }); });
    service.updateInventoryItem.mockImplementation(async (id, data) => { items = items.map(item => item.id === id ? { ...item, ...data } : item); });
    service.deleteInventoryItem.mockImplementation(async id => { items = items.filter(item => item.id !== id); });
    fileService.uploadFile.mockResolvedValue('/img/products/upload.png');
  });
  it('uploads an image, creates with no stock input in payload, views, edits and deletes', async () => {
    let dialog = await openCreate();
    expect(within(dialog).queryByRole('option', { name: 'Thuốc kho khác' })).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText('Tồn kho')).toHaveValue('0');
    expect(within(dialog).getByLabelText('Tồn kho')).toHaveAttribute('readonly');
    fireEvent.change(within(dialog).getByLabelText(/Tên hàng hóa/), { target: { value: 'Cám gà' } });
    fireEvent.change(within(dialog).getByLabelText(/Đơn vị/), { target: { value: '7' } });
    fireEvent.change(within(dialog).getByLabelText(/Giá tiền/), { target: { value: '125000.50' } });
    fireEvent.change(within(dialog).getByLabelText('Nhãn hiệu'), { target: { value: '9' } });
    fireEvent.change(within(dialog).getByLabelText('Chọn ảnh'), { target: { files: [new File(['image'], 'product.png', { type: 'image/png' })] } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu hàng hóa' }));
    await screen.findByRole('button', { name: 'Xem Cám gà' });
    expect(fileService.uploadFile).toHaveBeenCalledWith(expect.any(File), 'products');
    expect(service.createInventoryItem).toHaveBeenCalledWith({ warehouseId: 1, name: 'Cám gà', unitId: 7, brandId: 9, price: '125000.50', imageUrl: '/img/products/upload.png' });
    expect(screen.queryByText('SP_HIDDEN')).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Mã hàng/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xem Cám gà' }));
    dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Tên hàng hóa')).toHaveAttribute('readonly');
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Đóng' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Sửa Cám gà' }));
    dialog = await screen.findByRole('dialog');
    await within(dialog).findByRole('option', { name: 'Kg (KG)' });
    fireEvent.change(within(dialog).getByLabelText(/Đơn vị/), { target: { value: '7' } });
    fireEvent.change(within(dialog).getByLabelText(/Giá tiền/), { target: { value: '250000' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu hàng hóa' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(service.updateInventoryItem).toHaveBeenCalledWith(1, expect.objectContaining({ price: '250000' }));
    expect(service.updateInventoryItem.mock.calls[0][1]).not.toHaveProperty('stock');
    fireEvent.click(await screen.findByRole('button', { name: 'Xóa Cám gà' }));
    expect(service.deleteInventoryItem).not.toHaveBeenCalled();
    dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xóa hàng hóa' }));
    await screen.findByText('Chưa có hàng hóa thuộc danh mục kho này.');
    expect(mocks.showToast).toHaveBeenCalledWith('Đã xóa hàng hóa.', 'success');
  });
  it('keeps form open and does not create an item if uploading fails', async () => {
    fileService.uploadFile.mockRejectedValue(new Error('Upload thất bại'));
    const dialog = await openCreate();
    fireEvent.change(within(dialog).getByLabelText(/Tên hàng hóa/), { target: { value: 'Cám gà' } });
    fireEvent.change(within(dialog).getByLabelText(/Đơn vị/), { target: { value: '7' } });
    fireEvent.change(within(dialog).getByLabelText(/Giá tiền/), { target: { value: '0' } });
    fireEvent.change(within(dialog).getByLabelText('Chọn ảnh'), { target: { files: [new File(['image'], 'product.png', { type: 'image/png' })] } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu hàng hóa' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Upload thất bại');
    expect(service.createInventoryItem).not.toHaveBeenCalled();
  });
  it('does not expose mutation buttons to workers', async () => {
    mocks.role = 'ROLE_FARM_WORKER'; renderView();
    await screen.findByRole('button', { name: 'Kho cám' });
    expect(screen.queryByRole('button', { name: 'Tạo hàng hóa' })).not.toBeInTheDocument();
  });
});
