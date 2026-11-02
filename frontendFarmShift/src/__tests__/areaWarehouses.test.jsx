import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { WarehouseCategoriesView } from '../features/farmshift/WarehouseCategoriesView';
import { filterWarehouses, warehouseAreas } from '../features/farmshift/farmAreaOptions';
import * as service from '../services/warehouseCategoryService';

vi.mock('../context/NotificationContext', () => ({ useNotification: () => ({ showToast: vi.fn() }) }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'ROLE_FARM_OWNER' } }) }));
vi.mock('../services/warehouseCategoryService', () => ({ listWarehouseCategories: vi.fn(), createWarehouseCategory: vi.fn(),
  updateWarehouseCategory: vi.fn(), deleteWarehouseCategory: vi.fn() }));

const warehouse = (id, name, areaId, areaName, kind) => ({ id, code: `DM00000${id}`, name, description: '', itemCount: 0,
  createdAt: '2026-11-01T08:00:00', areaId, areaName, kind });
const warehouses = [
  warehouse(1, 'Kho cám Mía Thịt', 10, 'Khu Mía Thịt', 'FEED'),
  warehouse(2, 'Kho thuốc Mía Thịt', 10, 'Khu Mía Thịt', 'MEDICINE'),
  warehouse(3, 'Kho cám Gà Hồ', 20, 'Khu Gà Hồ', 'FEED'),
  warehouse(4, 'Kho thuốc Gà Hồ', 20, 'Khu Gà Hồ', 'MEDICINE'),
];

describe('Kho theo khu', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    service.listWarehouseCategories.mockResolvedValue(warehouses);
  });

  it('filters warehouses by area and by kind', () => {
    expect(warehouseAreas(warehouses).map(([, name]) => name)).toEqual(['Khu Gà Hồ', 'Khu Mía Thịt']);
    expect(filterWarehouses(warehouses, { area: '20', kind: '' }).map(item => item.id)).toEqual([3, 4]);
    expect(filterWarehouses(warehouses, { area: '', kind: 'MEDICINE' }).map(item => item.id)).toEqual([2, 4]);
    expect(filterWarehouses(warehouses, { area: '10', kind: 'FEED' }).map(item => item.id)).toEqual([1]);
  });

  it('shows the area and kind of each warehouse and narrows the list with the filter', async () => {
    render(<WarehouseCategoriesView />);
    const table = await screen.findByRole('table');
    expect(await within(table).findByText('Kho cám Mía Thịt')).toBeInTheDocument();
    expect(within(table).getAllByText('Khu Gà Hồ')).toHaveLength(2);

    fireEvent.change(screen.getByLabelText('Khu'), { target: { value: '20' } });
    expect(within(table).queryByText('Kho cám Mía Thịt')).not.toBeInTheDocument();
    expect(within(table).getByText('Kho cám Gà Hồ')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'Kho thuốc' }));
    expect(within(table).queryByText('Kho cám Gà Hồ')).not.toBeInTheDocument();
    expect(within(table).getByText('Kho thuốc Gà Hồ')).toBeInTheDocument();
    expect(screen.getByText('1 danh mục')).toBeInTheDocument();
  });
});
