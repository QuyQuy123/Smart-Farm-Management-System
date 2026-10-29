import React from 'react';
import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { PurchaseRowActions } from '../features/farmshift/PurchaseRowActions';
import { updatePurchase, deletePurchase } from '../services/purchaseService';
vi.mock('../services/purchaseService', () => ({ updatePurchase: vi.fn(), deletePurchase: vi.fn() }));
vi.mock('../context/NotificationContext', () => ({ useNotification: () => ({ showToast: vi.fn() }) }));
beforeAll(() => {
 HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
 HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
beforeEach(() => { vi.clearAllMocks(); updatePurchase.mockResolvedValue({}); deletePurchase.mockResolvedValue({}); });
const invoice = { id: 1, code: 'NH01', supplierId: 2, date: '2026-10-20', note: 'Old', stockStatus: 'Chưa nhập kho', paidAmount: 0, items: [{ name: 'Item A', qty: 2, unit: 'Kg', price: 1000 }] };
function setup(overrides = {}) {
 const onReload = vi.fn(), onView = vi.fn();
 render(<PurchaseRowActions invoice={{ ...invoice, ...overrides }} canEdit suppliers={[{ id: 2, name: 'Supplier' }]} tags={[]} onReload={onReload} onView={onView} />);
 return { onReload, onView };
}
function openMenu() { fireEvent.click(screen.getByRole('button', { name: 'Thao tác hóa đơn NH01' })); }
it('views, edits metadata, and reloads after saving', async () => {
 const { onReload, onView } = setup(); openMenu();
 fireEvent.click(screen.getByRole('menuitem', { name: 'Xem chi tiết' })); expect(onView).toHaveBeenCalledWith(invoice);
 openMenu(); fireEvent.click(screen.getByRole('menuitem', { name: 'Sửa hóa đơn' }));
 const dialog = screen.getByRole('dialog');
 expect(within(dialog).getByLabelText(/Nhà cung cấp/)).toHaveAttribute('readonly');
 fireEvent.change(within(dialog).getByLabelText('Số lượng 1'), { target: { value: '5' } });
 fireEvent.change(within(dialog).getByLabelText('Ghi chú'), { target: { value: 'New note' } });
 fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu thay đổi' }));
 await waitFor(() => expect(onReload).toHaveBeenCalled());
 expect(updatePurchase).toHaveBeenCalledWith(1, expect.objectContaining({ note: 'New note', supplierId: 2 }));
 expect(updatePurchase.mock.calls[0][1]).not.toHaveProperty('stockStatus');
 expect(updatePurchase.mock.calls[0][1].items).toHaveLength(1);
});
it('requires confirmation before deleting and closes the menu with Escape', async () => {
 const { onReload } = setup(); openMenu(); fireEvent.keyDown(document, { key: 'Escape' }); expect(screen.queryByRole('menu')).not.toBeInTheDocument();
 openMenu(); fireEvent.click(screen.getByRole('menuitem', { name: 'Xóa hóa đơn' }));
 expect(deletePurchase).not.toHaveBeenCalled();
 fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Xóa hóa đơn' }));
 await waitFor(() => expect(onReload).toHaveBeenCalled()); expect(deletePurchase).toHaveBeenCalledWith(1);
});
it('disables deletion of posted invoices', () => {
 setup({ stockStatus: 'Đã nhập kho' }); openMenu(); expect(screen.getByRole('menuitem', { name: 'Xóa hóa đơn' })).toBeDisabled(); expect(screen.getByRole('menuitem', { name: 'Sửa hóa đơn' })).toBeDisabled();
});

it('preserves the selected destination warehouse when editing quantity', async () => {
 setup({ items: [{ productCategoryId: 11, warehouseId: 20, name: 'Shared feed', qty: 2, unit: 'Kg', price: 1000 }] });
 openMenu(); fireEvent.click(screen.getByRole('menuitem', { name: 'Sửa hóa đơn' }));
 const dialog = screen.getByRole('dialog');
 fireEvent.change(within(dialog).getByLabelText('Số lượng 1'), { target: { value: '5' } });
 fireEvent.click(within(dialog).getByRole('button', { name: 'Lưu thay đổi' }));
 await waitFor(() => expect(updatePurchase).toHaveBeenCalledWith(1, expect.objectContaining({
   items: [expect.objectContaining({ productCategoryId: 11, warehouseId: 20, qty: 5 })]
 })));
});
