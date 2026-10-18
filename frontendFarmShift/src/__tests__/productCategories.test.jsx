import React from 'react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ProductCategoriesView } from '../features/farmshift/ProductCategoriesView';
import * as service from '../services/productCategoryService';
import { listWarehouseCategories } from '../services/warehouseCategoryService';
import { listBrands } from '../services/brandService';
import { listProductTypes } from '../services/productTypeService';
import { listSpecifications } from '../services/specificationService';

vi.mock('../services/warehouseCategoryService', () => ({ listWarehouseCategories: vi.fn() }));
vi.mock('../services/brandService', () => ({ listBrands: vi.fn() }));
vi.mock('../services/productTypeService', () => ({ listProductTypes: vi.fn() }));
vi.mock('../services/specificationService', () => ({ listSpecifications: vi.fn() }));

const mocks = vi.hoisted(() => ({ role: 'ROLE_FARM_OWNER', showToast: vi.fn() }));
vi.mock('../context/NotificationContext', () => ({ useNotification: () => ({ showToast: mocks.showToast }) }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: mocks.role } }) }));
vi.mock('../services/productCategoryService', () => ({ listProductCategories: vi.fn(), createProductCategory: vi.fn(), updateProductCategory: vi.fn(), deleteProductCategory: vi.fn() }));
let items;
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

describe('Product category CRUD', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.role = 'ROLE_FARM_OWNER';
    listWarehouseCategories.mockResolvedValue([{ id: 10, code: 'DM000010', name: 'Kho kiểm thử' }]);
    listBrands.mockResolvedValue([{ id: 1, name: 'Hanvet' }, { id: 2, name: 'C.P.' }]);
    listProductTypes.mockResolvedValue([{ id: 1, name: 'Thuốc thú y' }, { id: 2, name: 'Thức ăn chăn nuôi' }]);
    listSpecifications.mockResolvedValue([{ id: 1, name: 'Lọ 100ml' }, { id: 2, name: 'Bao 25kg' }]);
    items = [{ id: 1, code: 'HH000001', name: 'Cám gà', description: 'Thức ăn', specification: 'Bao 25kg', brand: 'C.P.', productType: 'Thức ăn chăn nuôi', itemCount: 0, createdAt: '2026-10-18T10:00:00' }];
    service.listProductCategories.mockImplementation(async () => [...items]);
    service.createProductCategory.mockImplementation(async data => { const item = { ...items[0], ...data, id: 2, code: 'HH000002' }; items.push(item); return item; });
    service.updateProductCategory.mockImplementation(async (id, data) => { items = items.map(item => item.id === id ? { ...item, ...data } : item); return items.find(item => item.id === id); });
    service.deleteProductCategory.mockImplementation(async id => { items = items.filter(item => item.id !== id); });
  });

  it('creates, reads, edits, searches and deletes a category through the API', async () => {
    render(<ProductCategoriesView />);
    await screen.findByText('Cám gà');
    fireEvent.click(screen.getByRole('button', { name: 'Thêm tên hàng hóa' }));
    let dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Tên hàng hóa/), { target: { value: 'Thuốc Hanvet' } });
    await waitFor(() => expect(within(dialog).getByLabelText(/Kho lưu trữ/)).toBeEnabled());
    fireEvent.change(within(dialog).getByLabelText(/Kho lưu trữ/), { target: { value: '10' } });
    fireEvent.change(within(dialog).getByLabelText('Quy cách'), { target: { value: 'Lọ 100ml' } });
    fireEvent.change(within(dialog).getByLabelText('Nhãn hiệu'), { target: { value: 'Hanvet' } });
    fireEvent.change(within(dialog).getByLabelText('Loại hàng hóa'), { target: { value: 'Thuốc thú y' } });
    fireEvent.change(within(dialog).getByLabelText('Mô tả'), { target: { value: 'Thuốc kháng sinh' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu tên hàng hóa' }));
    await screen.findByText('Thuốc Hanvet');
    expect(service.createProductCategory).toHaveBeenCalledWith({
      name: 'Thuốc Hanvet', description: 'Thuốc kháng sinh',
      specification: 'Lọ 100ml', brand: 'Hanvet', productType: 'Thuốc thú y', warehouseId: 10
    });
    expect(mocks.showToast).toHaveBeenCalledWith('Đã lưu tên hàng hóa thành công.', 'success');

    fireEvent.click(screen.getByRole('button', { name: 'Xem Thuốc Hanvet' }));
    dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText(/Tên hàng hóa/)).toHaveAttribute('readonly');
    expect(within(dialog).getByLabelText('Quy cách')).toHaveAttribute('readonly');
    expect(within(dialog).getByLabelText('Nhãn hiệu')).toHaveAttribute('readonly');
    expect(within(dialog).getByLabelText('Loại hàng hóa')).toHaveAttribute('readonly');
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Đóng' })[0]);

    fireEvent.click(screen.getByRole('button', { name: 'Sửa Thuốc Hanvet' }));
    dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Tên hàng hóa/), { target: { value: 'Vắc xin Lasota' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu tên hàng hóa' }));
    await screen.findByText('Vắc xin Lasota');

    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm tên hàng hóa' }), { target: { value: 'Lasota' } });
    expect(screen.queryByText('Cám gà')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Xóa Vắc xin Lasota' }));
    expect(service.deleteProductCategory).not.toHaveBeenCalled();
    dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Xóa tên hàng hóa' }));
    await waitFor(() => expect(service.deleteProductCategory).toHaveBeenCalledWith(2));
    await screen.findByText('Không tìm thấy tên hàng hóa phù hợp.');
  });

  it('keeps the form open and shows server errors without claiming success', async () => {
    service.createProductCategory.mockRejectedValue({ response: { data: { message: 'Tên hàng hóa đã tồn tại.' } } });
    render(<ProductCategoriesView />);
    await screen.findByText('Cám gà');
    fireEvent.click(screen.getByRole('button', { name: 'Thêm tên hàng hóa' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Tên hàng hóa/), { target: { value: 'Cám gà' } });
    await waitFor(() => expect(within(dialog).getByLabelText(/Kho lưu trữ/)).toBeEnabled());
    fireEvent.change(within(dialog).getByLabelText(/Kho lưu trữ/), { target: { value: '10' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu tên hàng hóa' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Tên hàng hóa đã tồn tại.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('lets workers view categories while hiding mutations', async () => {
    mocks.role = 'ROLE_FARM_WORKER';
    render(<ProductCategoriesView />);
    await screen.findByText('Cám gà');
    expect(screen.queryByRole('button', { name: 'Thêm tên hàng hóa' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sửa Cám gà' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xem Cám gà' })).toBeInTheDocument();
  });

  it('displays specification, brand and product type columns in the table', async () => {
    render(<ProductCategoriesView />);
    await screen.findByText('Cám gà');
    expect(screen.getByText('Bao 25kg')).toBeInTheDocument();
    expect(screen.getByText('C.P.')).toBeInTheDocument();
    expect(screen.getByText('Thức ăn chăn nuôi')).toBeInTheDocument();
  });
});
