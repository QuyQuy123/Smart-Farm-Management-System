// src/__tests__/purchases.test.jsx
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PurchasesView } from '../features/farmshift/PurchasesView';
import * as purchaseService from '../services/purchaseService';
import * as supplierService from '../services/supplierService';
import * as productTypeService from '../services/productTypeService';
import * as productCategoryService from '../services/productCategoryService';

const mockToast = vi.fn();
const mockUser = { role: 'ROLE_FARM_OWNER', fullName: 'Chủ Trại Test' };

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser })
}));

vi.mock('../context/NotificationContext', () => ({
  useNotification: () => ({ showToast: mockToast })
}));

vi.mock('../services/purchaseService', () => ({
  listPurchases: vi.fn(),
  getPurchase: vi.fn(),
  createPurchase: vi.fn(),
  importStock: vi.fn(),
  payPurchase: vi.fn(),
  cancelPurchase: vi.fn(),
  ocrPurchase: vi.fn(),
  listPurchaseTags: vi.fn(),
  createPurchaseTag: vi.fn(),
  updatePurchaseTag: vi.fn(),
  deletePurchaseTag: vi.fn()
}));

vi.mock('../services/supplierService', () => ({
  listSuppliers: vi.fn(),
  createSupplier: vi.fn(),
  updateSupplier: vi.fn(),
  deleteSupplier: vi.fn()
}));

vi.mock('../services/productTypeService', () => ({
  listProductTypes: vi.fn()
}));

vi.mock('../services/measurementUnitService', () => ({ listMeasurementUnits: async () => [{ id: 1, code: 'BAO', name: 'Bao 25kg' }, { id: 2, code: 'KG', name: 'Kg' }] }));

vi.mock('../services/productCategoryService', () => ({
  listProductCategories: vi.fn()
}));

describe('PurchasesView Component - Full 3-Tab Suite', () => {
  const mockPurchases = [
    {
      id: 1,
      code: 'NH000000',
      importedDate: '2026-10-20',
      date: '2026-09-15',
      supplier: 'Công ty CP Chăn nuôi C.P. Việt Nam',
      supplierId: 1,
      totalAmount: 112500000,
      paidAmount: 112500000,
      debtAmount: 0,
      paymentStatus: 'Thanh toán hoàn tất',
      stockStatus: 'Đã nhập kho',
      note: 'Nhập cám gà giai đoạn 1',
      tags: ['Cám gà thịt', 'Thức ăn chăn nuôi'],
      items: [
        { name: 'Cám Giai đoạn 1 (Úm)', qty: 200, unit: 'Bao 25kg', price: 320000, amount: 64000000 },
        { name: 'Cám Giai đoạn 2 (Vỗ béo)', qty: 150, unit: 'Bao 25kg', price: 310000, amount: 46500000 }
      ]
    },
    {
      id: 2,
      code: 'NH000001',
      date: '2026-09-18',
      supplier: 'Tập đoàn Dabaco Việt Nam',
      supplierId: 2,
      totalAmount: 92500000,
      paidAmount: 92500000,
      debtAmount: 0,
      paymentStatus: 'Thanh toán hoàn tất',
      stockStatus: 'Đã nhập kho',
      note: 'Nhập 5,000 con gà giống',
      tags: ['Con giống'],
      items: [
        { name: 'Gà giống J-Dabaco 01 ngày tuổi', qty: 5000, unit: 'Con', price: 18500, amount: 92500000 }
      ]
    },
    {
      id: 3,
      code: 'NH000002',
      date: '2026-09-25',
      supplier: 'Công ty Thuốc Thú y Hanvet',
      supplierId: 3,
      totalAmount: 8560000,
      paidAmount: 8560000,
      debtAmount: 0,
      paymentStatus: 'Thanh toán hoàn tất',
      stockStatus: 'Đã nhập kho',
      note: 'Vắc-xin phòng bệnh',
      tags: ['Thuốc & Vắc-xin'],
      items: [
        { name: 'Vắc-xin Newcastle Lasota', qty: 50, unit: 'Lọ 1000 liều', price: 65000, amount: 3250000 }
      ]
    },
    {
      id: 4,
      code: 'NH000003',
      date: '2026-10-02',
      supplier: 'Công ty CP Chăn nuôi C.P. Việt Nam',
      supplierId: 1,
      totalAmount: 68250000,
      paidAmount: 20000000,
      debtAmount: 48250000,
      paymentStatus: 'Trả sau',
      stockStatus: 'Chưa nhập kho',
      note: 'Nhập đợt bổ sung cám',
      tags: ['Cám gà thịt'],
      items: [
        { name: 'Cám Giai đoạn 2 (Vỗ béo)', qty: 220, unit: 'Bao 25kg', price: 310000, amount: 68200000 }
      ]
    }
  ];

  const mockSuppliers = [
    {
      id: 1,
      name: 'Công ty CP Chăn nuôi C.P. Việt Nam',
      representative: 'Nguyễn Văn C.P.',
      phone: '0283836789',
      address: 'KCN Biên Hòa 2, Đồng Nai',
      totalPurchased: 180750000,
      debt: 48250000,
      tagNames: ['Cám gà thịt', 'Thức ăn chăn nuôi'],
      tagIds: [1, 2],
      note: 'Đối tác chiến lược'
    },
    {
      id: 2,
      name: 'Tập đoàn Dabaco Việt Nam',
      representative: 'Nguyễn Như So',
      phone: '0222383600',
      address: 'Bắc Ninh',
      totalPurchased: 92500000,
      debt: 0,
      tagNames: ['Con giống'],
      tagIds: [3],
      note: 'Cung ứng giống chuẩn'
    }
  ];

  const mockTags = [
    { id: 1, name: 'Cám gà thịt', color: '#019788', description: 'Thức ăn hỗn hợp', usageCount: 2 },
    { id: 2, name: 'Thức ăn chăn nuôi', color: '#387be8', description: 'Tổng hợp thức ăn', usageCount: 1 },
    { id: 3, name: 'Con giống', color: '#f59e0b', description: 'Gà giống 1 ngày tuổi', usageCount: 1 }
  ];

  const mockProductTypes = [
    { id: 1, name: 'Thức ăn chăn nuôi' },
    { id: 2, name: 'Con giống' }
  ];

  const mockProductCategories = [
    { id: 1, name: 'Cám Giai đoạn 1 (Úm)', warehouseId: 1, warehouseName: 'Kho A', specification: 'Bao 25kg' },
    { id: 2, name: 'Cám Giai đoạn 2 (Vỗ béo)', warehouseId: 2, warehouseName: 'Kho B', specification: 'Bao 25kg' },
    { id: 3, name: 'Gà giống J-Dabaco 01 ngày tuổi' }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);

    purchaseService.listPurchases.mockResolvedValue([...mockPurchases]);
    purchaseService.getPurchase.mockImplementation(async (id) => mockPurchases.find(p => p.id === Number(id)));
    purchaseService.createPurchase.mockResolvedValue({ id: 5, code: 'NH000004' });
    purchaseService.importStock.mockResolvedValue({ success: true });
    purchaseService.payPurchase.mockResolvedValue({ success: true });
    purchaseService.cancelPurchase.mockResolvedValue({ success: true });
    purchaseService.ocrPurchase.mockResolvedValue({
      supplierName: 'Công ty CP Chăn nuôi C.P. Việt Nam',
      invoiceDate: '2026-10-18',
      referenceCode: 'HD-OCR-001',
      totalAmount: 64000000,
      items: [{ name: 'Cám Giai đoạn 1 (Úm)', qty: 200, unit: 'Bao 25kg', price: 320000, amount: 64000000 }]
    });

    purchaseService.listPurchaseTags.mockResolvedValue([...mockTags]);
    purchaseService.createPurchaseTag.mockResolvedValue({ id: 4, name: 'Vắc-xin mới' });
    purchaseService.updatePurchaseTag.mockResolvedValue({ id: 1, name: 'Cám gà cập nhật' });
    purchaseService.deletePurchaseTag.mockResolvedValue({ success: true });

    supplierService.listSuppliers.mockResolvedValue([...mockSuppliers]);
    supplierService.createSupplier.mockResolvedValue({ id: 3, name: 'NCC Mới' });
    supplierService.updateSupplier.mockResolvedValue({ id: 1, name: 'C.P. Cập nhật' });
    supplierService.deleteSupplier.mockResolvedValue({ success: true });

    productTypeService.listProductTypes.mockResolvedValue([...mockProductTypes]);
    productCategoryService.listProductCategories.mockResolvedValue([...mockProductCategories]);
  });

  afterEach(() => {
    cleanup();
  });

  const renderComponent = () => {
    return render(
      <MemoryRouter>
        <PurchasesView />
      </MemoryRouter>
    );
  };

  /* ===============================================================
     TAB 1: HÓA ĐƠN NHẬP HÀNG TESTS
     =============================================================== */
  describe('Tab 1: Hóa đơn nhập hàng', () => {
    it('renders purchase invoices list with codes NH000000 through NH000003 and tags', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('NH000000')).toBeInTheDocument();
        expect(screen.getByText('NH000001')).toBeInTheDocument();
        expect(screen.getByText('NH000002')).toBeInTheDocument();
        expect(screen.getByText('NH000003')).toBeInTheDocument();
      });

      expect(screen.getByText('20/10/2026')).toBeInTheDocument();
      expect(screen.getByText('Tập đoàn Dabaco Việt Nam')).toBeInTheDocument();
      expect(screen.getByText('Công ty Thuốc Thú y Hanvet')).toBeInTheDocument();
      expect(screen.getAllByText('Cám gà thịt').length).toBeGreaterThan(0);
    });

    it('filters by search input and payment status select', async () => {
      renderComponent();
      await screen.findByText('NH000000');

      const searchInput = screen.getByPlaceholderText(/^Tìm kiếm$/i);
      fireEvent.change(searchInput, { target: { value: 'Dabaco' } });

      await waitFor(() => {
        expect(purchaseService.listPurchases).toHaveBeenCalledWith('Dabaco', 'ALL');
      });

      const select = screen.getByDisplayValue('Tất cả thanh toán');
      fireEvent.change(select, { target: { value: 'Trả sau' } });

      await waitFor(() => {
        expect(purchaseService.listPurchases).toHaveBeenCalledWith('Dabaco', 'Trả sau');
      });
    });

    it('opens invoice detail modal and verifies contents', async () => {
      renderComponent();
      await screen.findByText('NH000000');

      const detailButtons = screen.getAllByRole('button', { name: /Xem hóa đơn/i });
      fireEvent.click(detailButtons[0]);

      expect(await screen.findByText('Chi tiết hóa đơn NH000000')).toBeInTheDocument();
      expect(screen.getAllByText(/112\.500\.000/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText('Cám Giai đoạn 1 (Úm)').length).toBeGreaterThan(0);
      expect(screen.getAllByText('64.000.000 đ').length).toBeGreaterThan(0);

      // Verify A4 voucher tab
      const voucherTabBtn = screen.getByRole('button', { name: /^Mẫu in A4$/i });
      fireEvent.click(voucherTabBtn);
      expect(screen.getAllByText(/PHIẾU NHẬP KHO/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Mẫu số 01 - VT/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Thủ kho nhận hàng/i).length).toBeGreaterThan(0);

      // Verify clicking "In phiếu" triggers window.print
      const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
      const printBtn = screen.getByRole('button', { name: /In phiếu/i });
      fireEvent.click(printBtn);
      await waitFor(() => {
        expect(printSpy).toHaveBeenCalled();
      });
      printSpy.mockRestore();

      // Close modal
      fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
      await waitFor(() => {
        expect(screen.queryByText('Chi tiết hóa đơn NH000000')).not.toBeInTheDocument();
      });
    });

    it('allows stock import on an unimported invoice', async () => {
      renderComponent();
      await screen.findByText('NH000003');

      // Click detail on 4th invoice (NH000003 - Chưa nhập kho)
      const detailButtons = screen.getAllByRole('button', { name: /Xem hóa đơn/i });
      fireEvent.click(detailButtons[3]);

      const importBtn = await screen.findByRole('button', { name: /Xác nhận nhập kho/i });
      fireEvent.click(importBtn);

      await waitFor(() => {
        expect(purchaseService.importStock).toHaveBeenCalledWith(4);
        expect(mockToast).toHaveBeenCalledWith('Đã xác nhận nhập kho và cập nhật số dư tồn kho.', 'success');
      });
    });

    it('allows recording payment for invoices with remaining debt', async () => {
      renderComponent();
      await screen.findByText('NH000003');

      const detailButtons = screen.getAllByRole('button', { name: /Xem hóa đơn/i });
      fireEvent.click(detailButtons[3]);

      const payBtn = await screen.findByRole('button', { name: /Thanh toán nợ/i });
      fireEvent.click(payBtn);

      expect(await screen.findByText(/Ghi nhận thanh toán đơn NH000003/i)).toBeInTheDocument();

      const submitPayBtn = screen.getByRole('button', { name: 'Xác nhận thanh toán' });
      fireEvent.click(submitPayBtn);

      await waitFor(() => {
        expect(purchaseService.payPurchase).toHaveBeenCalledWith(4, {
          amount: 48250000,
          note: ''
        });
        expect(mockToast).toHaveBeenCalledWith('Đã ghi nhận thanh toán thành công.', 'success');
      });
    });

    it('allows cancelling an invoice that is not yet imported and unpaid', async () => {
      const unpaidInvoice = {
        id: 99,
        code: 'NH000099',
        date: '2026-10-10',
        supplier: 'Công ty C.P.',
        totalAmount: 1000000,
        paidAmount: 0,
        debtAmount: 1000000,
        paymentStatus: 'Chưa thanh toán',
        stockStatus: 'Chưa nhập kho',
        items: []
      };
      purchaseService.listPurchases.mockResolvedValue([unpaidInvoice]);

      renderComponent();
      await screen.findByText('NH000099');

      fireEvent.click(screen.getByRole('button', { name: /Xem hóa đơn/i }));
      const cancelBtn = await screen.findByRole('button', { name: /Hủy đơn/i });
      fireEvent.click(cancelBtn);

      await waitFor(() => {
        expect(purchaseService.cancelPurchase).toHaveBeenCalledWith(99);
        expect(mockToast).toHaveBeenCalledWith('Đã hủy đơn nhập hàng thành công.', 'success');
      });
    });

    it('opens create purchase invoice modal and creates an invoice', async () => {
      renderComponent();
      await screen.findByText('NH000000');

      fireEvent.click(screen.getByRole('button', { name: /Tạo đơn nhập hàng/i }));
      expect(await screen.findByText('Tạo mới đơn nhập hàng')).toBeInTheDocument();

      // Select supplier
      const supplierSelect = screen.getByLabelText(/Nhà cung cấp \*/i);
      fireEvent.change(supplierSelect, { target: { value: '1' } });

      // Add item row and fill name
      const addRowBtn = screen.getByRole('button', { name: /\+ Thêm dòng hàng/i });
      fireEvent.click(addRowBtn);
      const itemNames = screen.getAllByRole('combobox', { name: /Tên hàng hóa/ });
      fireEvent.change(itemNames[0], { target: { value: '1' } });
      fireEvent.change(itemNames[itemNames.length - 1], { target: { value: '2' } });
      const unitSelect = screen.getByRole('combobox', { name: 'Đơn vị 1' });
      await waitFor(() => expect(unitSelect).toBeEnabled());
      fireEvent.change(unitSelect, { target: { value: 'Kg' } });

      // Submit form
      await waitFor(() => expect(screen.getAllByRole('combobox', { name: /Tên hàng hóa/ })[0]).toBeEnabled());
      screen.getAllByRole('combobox', { name: /Tên hàng hóa/ }).forEach(select => { if (!select.value) fireEvent.change(select, { target: { value: '1' } }); });
      fireEvent.click(screen.getByRole('button', { name: 'Lưu hóa đơn nhập' }));

      await waitFor(() => {
        expect(purchaseService.createPurchase).toHaveBeenCalled();
        expect(purchaseService.createPurchase.mock.calls[0][0].items[0].unit).toBe('Kg');
        expect(mockToast).toHaveBeenCalledWith('Đã lưu các thay đổi thành công.', 'success');
      });
    });

    it('creates a purchase invoice with partial payment (Thanh toán một phần)', async () => {
      renderComponent();
      await screen.findByText('NH000000');

      fireEvent.click(screen.getByRole('button', { name: /Tạo đơn nhập hàng/i }));
      expect(await screen.findByText('Tạo mới đơn nhập hàng')).toBeInTheDocument();

      // Select supplier
      const supplierSelect = screen.getByLabelText(/Nhà cung cấp \*/i);
      fireEvent.change(supplierSelect, { target: { value: '1' } });

      fireEvent.change(screen.getByPlaceholderText('Số lượng'), { target: { value: '50' } });
      fireEvent.change(screen.getByPlaceholderText('Đơn giá (VNĐ)'), { target: { value: '335000' } });
      // Change payment status to 'Thanh toán một phần'
      const paymentStatusSelect = screen.getByLabelText(/Trạng thái thanh toán \*/i);
      fireEvent.change(paymentStatusSelect, { target: { value: 'Thanh toán một phần' } });

      // Partial paid amount input should appear
      const partialInput = await screen.findByLabelText(/Số tiền trả trước \(VNĐ\) \*/i);
      expect(partialInput).toBeInTheDocument();
      fireEvent.change(partialInput, { target: { value: '10000000' } });

      // Submit form
      await waitFor(() => expect(screen.getAllByRole('combobox', { name: /Tên hàng hóa/ })[0]).toBeEnabled());
      screen.getAllByRole('combobox', { name: /Tên hàng hóa/ }).forEach(select => { if (!select.value) fireEvent.change(select, { target: { value: '1' } }); });
      fireEvent.click(screen.getByRole('button', { name: 'Lưu hóa đơn nhập' }));

      await waitFor(() => {
        expect(purchaseService.createPurchase).toHaveBeenCalledWith(
          expect.objectContaining({
            paymentStatus: 'Thanh toán một phần',
            paidAmount: 10000000
          })
        );
        expect(mockToast).toHaveBeenCalledWith('Đã lưu các thay đổi thành công.', 'success');
      });
    });

    it('opens RapidOCR modal, triggers extraction and fills data with MSG30 warning banner', async () => {
      renderComponent();
      await screen.findByText('NH000000');

      fireEvent.click(screen.getByRole('button', { name: /^Bóc tách hóa đơn$/i }));
      expect(await screen.findByText(/Bóc tách phiếu nhập \/ Hóa đơn A4/i)).toBeInTheDocument();

      const fileInput = document.querySelector('input[type="file"][accept*="image"]');
      const file = new File(['dummy invoice'], 'hoa-don-a4.jpg', { type: 'image/jpeg' });
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(purchaseService.ocrPurchase).toHaveBeenCalled();
        expect(mockToast).toHaveBeenCalledWith(
          expect.stringContaining('MSG30: Dữ liệu trích xuất từ OCR chỉ là bản nháp'),
          'info'
        );
      });

      // Creation modal should now be visible with MSG30 banner and Side-by-side split view
      expect(await screen.findByText(/MSG30:/i)).toBeInTheDocument();
      expect(screen.getByText(/Đối chiếu chứng từ & Tạo đơn nhập hàng/i)).toBeInTheDocument();
      expect(screen.getByAltText(/Chứng từ gốc hóa đơn A4/i)).toBeInTheDocument();
      expect(screen.getByTitle(/Phóng to/i)).toBeInTheDocument();
      expect(screen.getByTitle(/Thu nhỏ/i)).toBeInTheDocument();
      expect(screen.getByTitle(/Xoay ảnh 90°/i)).toBeInTheDocument();
    });

    it('uploads a file in RapidOCR modal and extracts purchase data', async () => {
      renderComponent();
      await screen.findByText('NH000000');

      fireEvent.click(screen.getByRole('button', { name: /^Bóc tách hóa đơn$/i }));
      expect(await screen.findByText(/Bóc tách phiếu nhập \/ Hóa đơn A4/i)).toBeInTheDocument();

      const fileInput = document.querySelector('input[type="file"][accept*="image"]');
      expect(fileInput).toBeInTheDocument();

      const file = new File(['dummy invoice'], 'hoa-don-a4.jpg', { type: 'image/jpeg' });
      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(purchaseService.ocrPurchase).toHaveBeenCalledWith(file);
        expect(mockToast).toHaveBeenCalledWith(
          expect.stringContaining('MSG30: Dữ liệu trích xuất từ OCR chỉ là bản nháp'),
          'info'
        );
      });
      expect(await screen.findByText(/MSG30:/i)).toBeInTheDocument();
      expect(screen.getByAltText(/Chứng từ gốc hóa đơn A4/i)).toBeInTheDocument();
    });

    it('triggers Excel export without errors', async () => {
      renderComponent();
      await screen.findByText('NH000000');

      const createObjectUrlMock = vi.fn(() => 'blob:mock');
      window.URL.createObjectURL = createObjectUrlMock;

      fireEvent.click(screen.getByRole('button', { name: /Xuất Excel/i }));

      expect(mockToast).toHaveBeenCalledWith('Xuất báo cáo thành công.', 'success');
    });

    it('closes create PO modal when clicking outside backdrop or pressing Escape', async () => {
      renderComponent();
      await screen.findByText('NH000000');

      fireEvent.click(screen.getByRole('button', { name: /Tạo đơn nhập hàng/i }));
      expect(await screen.findByText('Tạo mới đơn nhập hàng')).toBeInTheDocument();

      // Click outside (backdrop)
      const backdrop = document.querySelector('.farmshift-modal-backdrop');
      expect(backdrop).toBeInTheDocument();
      fireEvent.click(backdrop);

      await waitFor(() => {
        expect(screen.queryByText('Tạo mới đơn nhập hàng')).not.toBeInTheDocument();
      });

      // Re-open and test Escape key
      fireEvent.click(screen.getByRole('button', { name: /Tạo đơn nhập hàng/i }));
      expect(await screen.findByText('Tạo mới đơn nhập hàng')).toBeInTheDocument();

      fireEvent.keyDown(window, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByText('Tạo mới đơn nhập hàng')).not.toBeInTheDocument();
      });
    });

    it('closes invoice detail modal when clicking outside backdrop', async () => {
      renderComponent();
      await screen.findByText('NH000000');

      const detailButtons = screen.getAllByRole('button', { name: /Xem hóa đơn/i });
      fireEvent.click(detailButtons[0]);

      expect(await screen.findByText('Chi tiết hóa đơn NH000000')).toBeInTheDocument();

      const backdrop = document.querySelector('.farmshift-modal-backdrop');
      fireEvent.click(backdrop);

      await waitFor(() => {
        expect(screen.queryByText('Chi tiết hóa đơn NH000000')).not.toBeInTheDocument();
      });
    });
  });

  /* ===============================================================
     TAB 2: NHÀ CUNG CẤP TESTS
     =============================================================== */
  describe('Tab 2: Nhà cung cấp', () => {
    it('switches to suppliers tab and displays supplier data', async () => {
      renderComponent();
      await screen.findByText('NH000000');

      const supplierTab = screen.getByRole('button', { name: /^Nhà cung cấp$/i });
      fireEvent.click(supplierTab);
      expect(document.querySelector('.farmshift-breadcrumbs').lastElementChild).toHaveTextContent('Nhà cung cấp');
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hóa đơn nhập hàng');

      expect(await screen.findByText('Danh sách Nhà cung cấp vật tư & con giống')).toBeInTheDocument();
      expect(screen.getByText('Công ty CP Chăn nuôi C.P. Việt Nam')).toBeInTheDocument();
      expect(screen.getByText('0283836789')).toBeInTheDocument();
      expect(screen.getByText('180.750.000 đ')).toBeInTheDocument();
      expect(screen.getByText(/Nợ: 48.250.000 đ/i)).toBeInTheDocument();
      expect(screen.getByText('Hết nợ')).toBeInTheDocument();
    });

    it('creates a new supplier from modal', async () => {
      renderComponent();
      await screen.findByText('NH000000');

      fireEvent.click(screen.getByRole('button', { name: /^Nhà cung cấp$/i }));
      await screen.findByText('Danh sách Nhà cung cấp vật tư & con giống');

      fireEvent.click(screen.getByRole('button', { name: /Thêm nhà cung cấp/i }));
      expect(await screen.findByText('Thêm mới Nhà cung cấp')).toBeInTheDocument();

      const nameInput = screen.getByLabelText(/Tên nhà cung cấp \*/i);
      const repInput = screen.getByLabelText(/Người đại diện \*/i);
      const phoneInput = screen.getByLabelText(/Số điện thoại \*/i);

      fireEvent.change(nameInput, { target: { value: 'Công ty Thức ăn De Heus' } });
      fireEvent.change(repInput, { target: { value: 'Gabor Fluit' } });
      fireEvent.change(phoneInput, { target: { value: '02838221133' } });

      // Click a tag badge
      const tagBadge = screen.getByRole('button', { name: /Cám gà thịt/i });
      fireEvent.click(tagBadge);

      fireEvent.click(screen.getByRole('button', { name: 'Lưu thông tin' }));

      await waitFor(() => {
        expect(supplierService.createSupplier).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Công ty Thức ăn De Heus',
            representative: 'Gabor Fluit',
            phone: '02838221133',
            tagIds: expect.arrayContaining([1])
          })
        );
        expect(mockToast).toHaveBeenCalledWith('Đã thêm nhà cung cấp thành công.', 'success');
      });
    });

    it('edits and deletes a supplier', async () => {
      renderComponent();
      await screen.findByText('NH000000');

      fireEvent.click(screen.getByRole('button', { name: /^Nhà cung cấp$/i }));
      await screen.findByText('Danh sách Nhà cung cấp vật tư & con giống');

      // Edit supplier 1
      const editButtons = screen.getAllByTitle('Sửa');
      fireEvent.click(editButtons[0]);

      expect(await screen.findByText('Chỉnh sửa Nhà cung cấp')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Lưu thông tin' }));

      await waitFor(() => {
        expect(supplierService.updateSupplier).toHaveBeenCalled();
        expect(mockToast).toHaveBeenCalledWith('Đã cập nhật nhà cung cấp.', 'success');
      });

      // Delete supplier 1
      const deleteButtons = screen.getAllByTitle('Xóa');
      fireEvent.click(deleteButtons[0]);

      expect(await screen.findByText(/Bạn có chắc chắn muốn xóa nhà cung cấp/i)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xóa' }));

      await waitFor(() => {
        expect(supplierService.deleteSupplier).toHaveBeenCalledWith(1);
        expect(mockToast).toHaveBeenCalledWith('Đã xóa nhà cung cấp.', 'success');
      });
    });
  });

  /* ===============================================================
     TAB 3: THẺ TAGS PHÂN LOẠI TESTS
     =============================================================== */
  describe('Tab 3: Thẻ Tags phân loại', () => {
    it('switches to tags tab and displays tags list with usage counts', async () => {
      renderComponent();
      await screen.findByText('NH000000');

      const tagsTab = screen.getByRole('button', { name: /^Thẻ tag$/i });
      fireEvent.click(tagsTab);
      expect(document.querySelector('.farmshift-breadcrumbs').lastElementChild).toHaveTextContent('Thẻ tag');

      expect(await screen.findByText('Thẻ Tags phân loại hóa đơn chứng từ & nhà cung cấp')).toBeInTheDocument();
      expect(screen.getByText('Cám gà thịt')).toBeInTheDocument();
      expect(screen.getByText('Thức ăn chăn nuôi')).toBeInTheDocument();
      expect(screen.getByText('Con giống')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // usageCount: 2
    });

    it('creates a new purchase tag', async () => {
      renderComponent();
      await screen.findByText('NH000000');

      fireEvent.click(screen.getByRole('button', { name: /^Thẻ tag$/i }));
      await screen.findByText('Thẻ Tags phân loại hóa đơn chứng từ & nhà cung cấp');

      fireEvent.click(screen.getByRole('button', { name: /Thêm thẻ Tag/i }));
      expect(await screen.findByText('Thêm mới Thẻ Tag')).toBeInTheDocument();

      const tagNameInput = screen.getByPlaceholderText(/Cám Giai đoạn 1/i);
      fireEvent.change(tagNameInput, { target: { value: 'Chế phẩm sinh học' } });

      fireEvent.click(screen.getByRole('button', { name: 'Lưu thẻ Tag' }));

      await waitFor(() => {
        expect(purchaseService.createPurchaseTag).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Chế phẩm sinh học'
          })
        );
        expect(mockToast).toHaveBeenCalledWith('Đã thêm thẻ phân loại thành công.', 'success');
      });
    });

    it('edits and deletes a tag', async () => {
      renderComponent();
      await screen.findByText('NH000000');

      fireEvent.click(screen.getByRole('button', { name: /^Thẻ tag$/i }));
      await screen.findByText('Thẻ Tags phân loại hóa đơn chứng từ & nhà cung cấp');

      // Edit tag
      const editButtons = screen.getAllByTitle('Sửa');
      fireEvent.click(editButtons[0]);

      expect(await screen.findByText('Chỉnh sửa Thẻ Tag')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Lưu thẻ Tag' }));

      await waitFor(() => {
        expect(purchaseService.updatePurchaseTag).toHaveBeenCalledWith(1, expect.any(Object));
        expect(mockToast).toHaveBeenCalledWith('Đã cập nhật thẻ phân loại.', 'success');
      });

      // Delete tag
      const deleteButtons = screen.getAllByTitle('Xóa');
      fireEvent.click(deleteButtons[0]);

      expect(await screen.findByText(/Bạn có chắc chắn muốn xóa thẻ tag/i)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xóa' }));

      await waitFor(() => {
        expect(purchaseService.deletePurchaseTag).toHaveBeenCalledWith(1);
        expect(mockToast).toHaveBeenCalledWith('Đã xóa thẻ phân loại.', 'success');
      });
    });
  });

  /* ===============================================================
     FRONTEND CLIENT-SIDE VALIDATIONS
     =============================================================== */
  describe('Frontend Client-side Validations', () => {
    it('blocks PO creation when supplier is missing and shows inline error', async () => {
      renderComponent();
      await screen.findByText('NH000000');

      fireEvent.click(screen.getByRole('button', { name: /Tạo đơn nhập hàng/i }));
      expect(await screen.findByText('Tạo mới đơn nhập hàng')).toBeInTheDocument();

      // Submit without selecting supplier
      await waitFor(() => expect(screen.getAllByRole('combobox', { name: /Tên hàng hóa/ })[0]).toBeEnabled());
      screen.getAllByRole('combobox', { name: /Tên hàng hóa/ }).forEach(select => { if (!select.value) fireEvent.change(select, { target: { value: '1' } }); });
      fireEvent.click(screen.getByRole('button', { name: 'Lưu hóa đơn nhập' }));

      expect(await screen.findByText(/Vui lòng chọn nhà cung cấp/i)).toBeInTheDocument();
      expect(mockToast).toHaveBeenCalledWith('Vui lòng kiểm tra và hoàn thiện các trường thông tin bắt buộc.', 'warning');
      expect(purchaseService.createPurchase).not.toHaveBeenCalled();
    });

    it('blocks supplier creation when phone format is invalid', async () => {
      renderComponent();
      await screen.findByText('NH000000');

      fireEvent.click(screen.getByRole('button', { name: /^Nhà cung cấp$/i }));
      await screen.findByText('Danh sách Nhà cung cấp vật tư & con giống');

      fireEvent.click(screen.getByRole('button', { name: /Thêm nhà cung cấp/i }));
      expect(await screen.findByText('Thêm mới Nhà cung cấp')).toBeInTheDocument();

      const nameInput = screen.getByLabelText(/Tên nhà cung cấp \*/i);
      const repInput = screen.getByLabelText(/Người đại diện \*/i);
      const phoneInput = screen.getByLabelText(/Số điện thoại \*/i);

      fireEvent.change(nameInput, { target: { value: 'Công ty Test' } });
      fireEvent.change(repInput, { target: { value: 'Nguyễn Văn Test' } });
      fireEvent.change(phoneInput, { target: { value: '12345' } }); // invalid phone

      fireEvent.click(screen.getByRole('button', { name: 'Lưu thông tin' }));

      expect(await screen.findByText(/Số điện thoại không hợp lệ/i)).toBeInTheDocument();
      expect(mockToast).toHaveBeenCalledWith('Vui lòng kiểm tra lại thông tin nhà cung cấp.', 'warning');
      expect(supplierService.createSupplier).not.toHaveBeenCalled();
    });

    it('blocks tag creation when tag name is duplicated', async () => {
      renderComponent();
      await screen.findByText('NH000000');

      fireEvent.click(screen.getByRole('button', { name: /^Thẻ tag$/i }));
      await screen.findByText('Thẻ Tags phân loại hóa đơn chứng từ & nhà cung cấp');

      fireEvent.click(screen.getByRole('button', { name: /Thêm thẻ Tag/i }));
      expect(await screen.findByText('Thêm mới Thẻ Tag')).toBeInTheDocument();

      const tagNameInput = screen.getByPlaceholderText(/Cám Giai đoạn 1/i);
      // 'Cám gà thịt' already exists in mockTags
      fireEvent.change(tagNameInput, { target: { value: 'Cám gà thịt' } });

      fireEvent.click(screen.getByRole('button', { name: 'Lưu thẻ Tag' }));

      expect(await screen.findByText(/Tên thẻ Tag này đã tồn tại/i)).toBeInTheDocument();
      expect(mockToast).toHaveBeenCalledWith('Vui lòng kiểm tra lại thông tin thẻ Tag.', 'warning');
      expect(purchaseService.createPurchaseTag).not.toHaveBeenCalled();
    });

    it('blocks payment when amount exceeds remaining debt', async () => {
      renderComponent();
      await screen.findByText('NH000003');

      const detailButtons = screen.getAllByRole('button', { name: /Xem hóa đơn/i });
      fireEvent.click(detailButtons[3]);

      const payBtn = await screen.findByRole('button', { name: /Thanh toán nợ/i });
      fireEvent.click(payBtn);

      expect(await screen.findByText(/Ghi nhận thanh toán đơn NH000003/i)).toBeInTheDocument();

      const amountInput = screen.getByLabelText(/Số tiền thanh toán lần này/i);
      fireEvent.change(amountInput, { target: { value: '999999999' } });

      const submitPayBtn = screen.getByRole('button', { name: 'Xác nhận thanh toán' });
      fireEvent.click(submitPayBtn);

      expect(await screen.findByText(/không được vượt quá số nợ còn lại/i)).toBeInTheDocument();
      expect(purchaseService.payPurchase).not.toHaveBeenCalled();
    });

    it('auto-selects newly detected supplier from OCR and shows quick-add banner when supplier is not in database', async () => {
      // Mock OCR response returning an unknown supplier (e.g. Navetco)
      purchaseService.ocrPurchase.mockResolvedValueOnce({
        supplierId: null,
        supplierName: 'Công ty Thuốc Thú Y Navetco Mới',
        supplierTaxCode: '0300456789',
        invoiceDate: '2026-10-18',
        referenceCode: 'HD-NVT-2026',
        totalAmount: 5600000,
        items: [{ name: 'Vắc-xin Newcastle', qty: 20, unit: 'Lọ', price: 125000, amount: 2500000 }]
      });

      renderComponent();
      await screen.findByText('NH000000');

      fireEvent.click(screen.getByRole('button', { name: /^Bóc tách hóa đơn$/i }));
      const fileInput = document.querySelector('input[type="file"][accept*="image"]');
      const file = new File(['dummy invoice'], 'hoa-don-navetco.jpg', { type: 'image/jpeg' });
      fireEvent.change(fileInput, { target: { files: [file] } });

      // Verify that the new supplier option is rendered and auto-selected
      expect(await screen.findByText(/\[Mới từ chứng từ\] Công ty Thuốc Thú Y Navetco Mới/i)).toBeInTheDocument();
      const select = document.getElementById('po-supplier-select');
      expect(select.value).toBe('__NEW__');

      // Submit PO: should succeed and send supplierName without error
      const saveBtn = screen.getByRole('button', { name: 'Lưu hóa đơn nhập' });
      await waitFor(() => expect(screen.getByRole('combobox', { name: 'Tên hàng hóa 1' })).toBeEnabled());
      fireEvent.change(screen.getByRole('combobox', { name: 'Tên hàng hóa 1' }), { target: { value: '1' } });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(purchaseService.createPurchase).toHaveBeenCalledWith(expect.objectContaining({
          supplierId: null,
          supplierName: 'Công ty Thuốc Thú Y Navetco Mới'
        }));
      });
    });

    it('allows quick-adding a supplier from PO modal and auto-selects it', async () => {
      renderComponent();
      await screen.findByText('NH000000');

      fireEvent.click(screen.getByRole('button', { name: /Tạo đơn nhập hàng/i }));
      expect(await screen.findByText(/Tạo mới đơn nhập hàng/i)).toBeInTheDocument();

      // Click the in-place "+ Thêm mới NCC" button
      const quickAddBtn = screen.getByRole('button', { name: /Thêm mới NCC/i });
      fireEvent.click(quickAddBtn);

      // Supplier modal opens
      expect(await screen.findByText(/Thêm mới Nhà cung cấp/i)).toBeInTheDocument();

      const nameInput = screen.getByLabelText(/Tên nhà cung cấp \*/i);
      const repInput = screen.getByLabelText(/Người đại diện \*/i);
      const phoneInput = screen.getByLabelText(/Số điện thoại \*/i);

      fireEvent.change(nameInput, { target: { value: 'Công ty Vắc-xin Xanh' } });
      fireEvent.change(repInput, { target: { value: 'Nguyễn Văn Đại Diện' } });
      fireEvent.change(phoneInput, { target: { value: '0912345678' } });

      supplierService.createSupplier.mockResolvedValueOnce({
        id: 99,
        name: 'Công ty Vắc-xin Xanh',
        tagIds: []
      });
      supplierService.listSuppliers.mockResolvedValueOnce([
        ...mockSuppliers,
        { id: 99, name: 'Công ty Vắc-xin Xanh', tagIds: [] }
      ]);

      const saveSupplierBtn = screen.getByRole('button', { name: 'Lưu thông tin' });
      fireEvent.click(saveSupplierBtn);

      await waitFor(() => {
        expect(supplierService.createSupplier).toHaveBeenCalled();
        expect(mockToast).toHaveBeenCalledWith('Đã thêm nhà cung cấp thành công.', 'success');
      });

      // PO modal is still open and the supplier select now has the newly created supplier selected
      const supplierSelect = screen.getByLabelText(/Nhà cung cấp \*/i);
      expect(supplierSelect.value).toBe('99');
    });
  });
});

