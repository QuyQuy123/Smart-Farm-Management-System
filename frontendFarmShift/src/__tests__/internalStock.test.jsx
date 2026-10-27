// src/__tests__/internalStock.test.jsx
import React from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { InternalStockView } from '../features/farmshift/InternalStockView';
import { PrintableInternalVoucher } from '../features/farmshift/PrintableInternalVoucher';
import * as stockService from '../services/internalStockService';
import * as warehouseService from '../services/warehouseCategoryService';
import * as inventoryService from '../services/inventoryItemService';
import { api } from '../utils/api';

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  currentUser: { role: 'ROLE_FARM_OWNER' }
}));

vi.mock('../layouts/FarmShiftLayout', () => ({
  FarmShiftLayout: ({ children }) => <div data-testid="layout">{children}</div>
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mocks.currentUser })
}));

vi.mock('../context/NotificationContext', () => ({
  useNotification: () => ({ showToast: mocks.showToast })
}));

vi.mock('../utils/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}));

vi.mock('../services/internalStockService', () => ({
  listInternalStockCategories: vi.fn(),
  createInternalStockCategory: vi.fn(),
  updateInternalStockCategory: vi.fn(),
  deleteInternalStockCategory: vi.fn(),
  listInternalStockVouchers: vi.fn(),
  getInternalStockVoucher: vi.fn(),
  createInternalStockVoucher: vi.fn(),
  cancelInternalStockVoucher: vi.fn(),
  INTERNAL_STOCK_TYPES: { IMPORT: 'Nhập kho', EXPORT: 'Xuất kho', TRANSFER: 'Chuyển kho' },
  INTERNAL_STOCK_STATUS: { COMPLETED: 'Đã hoàn thành', CANCELLED: 'Đã hủy' }
}));

vi.mock('../services/warehouseCategoryService', () => ({
  listWarehouseCategories: vi.fn()
}));

vi.mock('../services/inventoryItemService', () => ({
  listInventoryItems: vi.fn(),
  listAllInventoryItems: vi.fn()
}));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});

describe('InternalStockView workspace', () => {
  const sampleCategories = [
    { id: 1, movementType: 'EXPORT', name: 'Xuất hủy', isSystem: true, voucherCount: 2, createdAt: '2026-10-19T08:00:00' },
    { id: 2, movementType: 'IMPORT', name: 'Nhập đầu kì', isSystem: true, voucherCount: 0, createdAt: '2026-10-19T08:00:00' },
    { id: 3, movementType: 'TRANSFER', name: 'Chuyển kho nội bộ', isSystem: true, voucherCount: 1, createdAt: '2026-10-19T08:00:00' }
  ];

  const sampleWarehouses = [
    { id: 10, name: 'Kho Cám & Thức ăn' },
    { id: 20, name: 'Kho Thuốc & Vắc-xin' }
  ];

  const sampleInventory = [
    { id: 101, productName: 'Cám gà thịt De Heus 2012', unitName: 'Bao 25kg', stock: 50, price: 342000 },
    { id: 102, productName: 'Ngô hạt nghiền', unitName: 'Kg', stock: 1000, price: 7800 }
  ];

  const sampleVouchers = [
    {
      id: 501,
      code: 'XK000001',
      movementType: 'EXPORT',
      categoryName: 'Xuất hủy',
      sourceWarehouseName: 'Kho Cám & Thức ăn',
      targetWarehouseName: null,
      cycleName: 'Lứa 1',
      totalAmount: 342000,
      createdBy: 'Trần Kế Toán',
      date: '2026-10-27',
      status: 'COMPLETED',
      items: [
        { id: 1, inventoryItemId: 101, productName: 'Cám gà thịt De Heus 2012', unitName: 'Bao 25kg', quantity: 1, unitPrice: 342000, amount: 342000, note: 'Hỏng do ẩm' }
      ]
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentUser = { role: 'ROLE_FARM_OWNER' };
    stockService.listInternalStockCategories.mockResolvedValue(sampleCategories);
    warehouseService.listWarehouseCategories.mockResolvedValue(sampleWarehouses);
    inventoryService.listInventoryItems.mockResolvedValue(sampleInventory);
    inventoryService.listAllInventoryItems.mockResolvedValue(sampleInventory);
    api.get.mockResolvedValue({ data: { data: [{ id: 1, name: 'Chuồng A1', activeCycleId: 1 }] } });
    stockService.listInternalStockVouchers.mockResolvedValue({
      content: sampleVouchers,
      totalElements: 1,
      totalPages: 1
    });
  });

  it('renders the 3 main tabs and displays the vouchers list by default', async () => {
    render(<InternalStockView />);

    expect(screen.getByRole('button', { name: /^Tạo phiếu$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Danh sách phiếu/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Danh mục/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('XK000001')).toBeInTheDocument();
      expect(screen.getAllByText('Kho Cám & Thức ăn').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/342\.000 đ/)).toBeInTheDocument();
    });
  });

  it('masks financial fields for ROLE_FARM_WORKER in the voucher list', async () => {
    mocks.currentUser = { role: 'ROLE_FARM_WORKER' };
    render(<InternalStockView />);

    await waitFor(() => {
      expect(screen.getByText('XK000001')).toBeInTheDocument();
    });

    // The financial amount should be masked to '—'
    const rows = screen.getAllByRole('row');
    const voucherRow = rows.find(r => within(r).queryByText('XK000001'));
    expect(within(voucherRow).getAllByText('—').length).toBeGreaterThanOrEqual(1);
    expect(within(voucherRow).queryByText(/342\.000 đ/)).not.toBeInTheDocument();
  });

  it('performs inline stock validation MSG27 when quantity exceeds available stock', async () => {
    render(<InternalStockView />);

    // Switch to Tab 1: Tạo phiếu
    fireEvent.click(screen.getByRole('button', { name: /^Tạo phiếu$/i }));

    // Select source warehouse
    await waitFor(() => {
      expect(screen.getByLabelText(/Kho xuất/i)).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText(/Kho xuất/i), { target: { value: '10' } });

    // Select product item
    await waitFor(() => {
      expect(inventoryService.listInventoryItems).toHaveBeenCalledWith('10');
    });

    const productSelect = screen.getByLabelText(/Chọn hàng hóa dòng 1/i);
    fireEvent.change(productSelect, { target: { value: '101' } });

    // Stock for item 101 is 50. Input quantity = 999 to trigger MSG27
    const qtyInput = screen.getByLabelText(/Số lượng dòng 1/i);
    fireEvent.change(qtyInput, { target: { value: '999' } });

    // Assert MSG27 appears inline
    await waitFor(() => {
      const errorMsg = screen.getByRole('alert');
      expect(errorMsg).toHaveTextContent('Số lượng xuất kho vượt quá số lượng tồn kho khả dụng hiện tại.');
    });

    // Verify submit button is disabled
    const submitBtn = screen.getByRole('button', { name: /Lưu & Tạo phiếu/i });
    expect(submitBtn).toBeDisabled();

    // Fix quantity to 10 (<= 50)
    fireEvent.change(qtyInput, { target: { value: '10' } });

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('navigates to Tab 3 (Danh mục) and displays categories with system badge', async () => {
    render(<InternalStockView />);

    fireEvent.click(screen.getByRole('button', { name: /Danh mục/i }));

    await waitFor(() => {
      expect(screen.getByText('Xuất hủy')).toBeInTheDocument();
      expect(screen.getByText('Nhập đầu kì')).toBeInTheDocument();
      expect(screen.getByText('Chuyển kho nội bộ')).toBeInTheDocument();
    });

    // System badge should be visible for system categories
    const systemBadges = screen.getAllByText('Hệ thống');
    expect(systemBadges.length).toBeGreaterThanOrEqual(1);

    // Delete button for system category should be disabled
    const deleteBtn = screen.getByRole('button', { name: /Xóa Xuất hủy/i });
    expect(deleteBtn).toBeDisabled();
  });

  it('renders PrintableInternalVoucher with standard A4 header and items', () => {
    const voucher = sampleVouchers[0];
    const { container } = render(
      <PrintableInternalVoucher voucher={voucher} onScreenPreview={true} />
    );

    expect(container).toHaveTextContent('TRANG TRẠI MIỀN BÍNH');
    expect(container).toHaveTextContent('PHIẾU XUẤT KHO NỘI BỘ');
    expect(container).toHaveTextContent('XK000001');
    expect(container).toHaveTextContent('Cám gà thịt De Heus 2012');
    expect(container).toHaveTextContent('Người lập phiếu');
    expect(container).toHaveTextContent('Thủ kho');
  });
});
