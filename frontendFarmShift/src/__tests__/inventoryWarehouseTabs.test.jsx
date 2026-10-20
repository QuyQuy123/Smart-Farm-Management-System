import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { InventoryView } from '../features/farmshift/InventoryView';
import { listInventoryItems } from '../services/inventoryItemService';
import { listWarehouseCategories, WAREHOUSE_CATEGORIES_CHANGED } from '../services/warehouseCategoryService';

vi.mock('../layouts/FarmShiftLayout', () => ({ FarmShiftLayout: ({ children, actions }) => <div>{actions}{children}</div> }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'ROLE_FARM_OWNER' } }) }));
vi.mock('../context/NotificationContext', () => ({ useNotification: () => ({ showToast: vi.fn() }) }));
vi.mock('../services/inventoryItemService', () => ({ listInventoryItems: vi.fn(), createInventoryItem: vi.fn(), updateInventoryItem: vi.fn(), deleteInventoryItem: vi.fn() }));
vi.mock('../services/warehouseCategoryService', () => ({ listWarehouseCategories: vi.fn(), WAREHOUSE_CATEGORIES_CHANGED: 'warehouse-categories-changed' }));
const category = { id: 5, name: 'Kho mới từ database' };
const renderView = () => render(<MemoryRouter><InventoryView /></MemoryRouter>);

describe('Inventory warehouse category tabs', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    listInventoryItems.mockResolvedValue([]);
    listWarehouseCategories.mockResolvedValue([category]);
  });

  it('uses database categories instead of static tabs and refreshes after changes', async () => {
    renderView();
    const tab = await screen.findByRole('button', { name: category.name });
    expect(tab).toHaveClass('active');
    expect(screen.queryByRole('button', { name: 'Tất cả hàng hóa' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Con giống' })).not.toBeInTheDocument();
    expect(screen.getByText('Chưa có hàng hóa thuộc danh mục kho này.')).toBeInTheDocument();
    listWarehouseCategories.mockResolvedValue([category, { id: 6, name: 'Kho vừa tạo' }]);
    await act(async () => { window.dispatchEvent(new Event(WAREHOUSE_CATEGORIES_CHANGED)); });
    fireEvent.click(await screen.findByRole('button', { name: 'Kho vừa tạo' }));
    expect(screen.getByRole('button', { name: 'Kho vừa tạo' })).toHaveClass('active');
    listWarehouseCategories.mockResolvedValue([{ id: 5, name: 'Kho đã đổi tên' }]);
    await act(async () => { window.dispatchEvent(new Event(WAREHOUSE_CATEGORIES_CHANGED)); });
    expect(await screen.findByRole('button', { name: 'Kho đã đổi tên' })).toHaveClass('active');
    expect(screen.queryByRole('button', { name: 'Kho vừa tạo' })).not.toBeInTheDocument();
  });

  it('keeps items and search intact when returning to the browser tab, but refreshes on real category changes', async () => {
    listInventoryItems.mockResolvedValue([{ id: 1, name: 'Cám gà', stock: 0, price: 1000 }]);
    renderView();
    await screen.findByRole('button', { name: 'Xem Cám gà' });
    const categoryCalls = listWarehouseCategories.mock.calls.length;
    const itemCalls = listInventoryItems.mock.calls.length;
    fireEvent.change(screen.getByRole('textbox', { name: 'Tìm hàng hóa' }), { target: { value: 'Cám' } });
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(listWarehouseCategories).toHaveBeenCalledTimes(categoryCalls);
    expect(listInventoryItems).toHaveBeenCalledTimes(itemCalls);
    expect(screen.getByRole('textbox', { name: 'Tìm hàng hóa' })).toHaveValue('Cám');
    expect(screen.getByRole('button', { name: 'Xem Cám gà' })).toBeInTheDocument();
    await act(async () => { window.dispatchEvent(new StorageEvent('storage', { key: WAREHOUSE_CATEGORIES_CHANGED, newValue: 'changed' })); });
    await waitFor(() => expect(listWarehouseCategories).toHaveBeenCalledTimes(categoryCalls + 1));
    await waitFor(() => expect(listInventoryItems.mock.calls.length).toBeGreaterThan(itemCalls));
  });

  it('disables creating inventory when no categories exist', async () => {
    listWarehouseCategories.mockResolvedValue([]);
    renderView();
    await screen.findByRole('link', { name: 'Thêm danh mục kho trong Thiết lập danh mục' });
    expect(screen.getByRole('button', { name: /Tạo hàng hóa/ })).toBeDisabled();
  });

  it('orders tabs by the full creation time including seconds even if the API returns them in reverse order', async () => {
    listWarehouseCategories.mockResolvedValue([
      { id: 1, name: 'Kho tạo sau', createdAt: '2026-10-18T09:30:25' },
      { id: 3, name: 'Kho tạo trước', createdAt: '2026-10-18T09:30:05' },
      { id: 2, name: 'Kho tạo giữa', createdAt: '2026-10-18T09:30:15' },
    ]);
    renderView();
    await screen.findByRole('button', { name: 'Kho tạo trước' });
    const tabs = screen.getAllByRole('button').filter(button => button.classList.contains('farmshift-tab-btn'));
    expect(tabs.map(tab => tab.textContent)).toEqual(['Kho tạo trước', 'Kho tạo giữa', 'Kho tạo sau']);
    expect(tabs[0]).toHaveClass('active');
  });

  it('shows API errors and lets users retry without falling back to mock tabs', async () => {
    listWarehouseCategories.mockRejectedValueOnce(new Error('Offline')).mockResolvedValue([category]);
    renderView();
    expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được danh mục kho');
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await screen.findByRole('button', { name: category.name });
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
});
