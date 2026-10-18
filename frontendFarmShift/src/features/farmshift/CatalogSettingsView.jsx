// src/features/farmshift/CatalogSettingsView.jsx
// Thiết lập danh mục & Master Data chuẩn FarmShift & DESIGN.md
import React, { useState } from 'react';
import {
  Layers, Plus, Search, FileSpreadsheet, Tag, Box,
  Users, Building, CheckCircle, Package, Scale, X, Phone, MapPin
} from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';
import { WarehouseCategoriesView } from './WarehouseCategoriesView';
import { ProductCategoriesView } from './ProductCategoriesView';
import { BrandsView } from './BrandsView';
import { ProductTypesView } from './ProductTypesView';
import { MeasurementUnitsView } from './MeasurementUnitsView';

const CATALOG_BREADCRUMBS = [{ label: 'Thiết lập danh mục' }];
const CATALOG_ACTIONS = (
  <button type="button" className="farmshift-btn farmshift-btn-excel">
    <FileSpreadsheet size={15} /> Xuất Excel
  </button>
);

export const CatalogSettingsView = () => {
  const [activeTab, setActiveTab] = useState('warehouses');
  // 'categories' | 'brands' | 'units' | 'specs' | 'warehouses' | 'suppliers' | 'customers'




  const specs = [
    { id: 1, name: 'Thùng 102 con giống', unit: 'Thùng', items: '102 con', note: 'Có 2 con sơ cua bù trừ vận chuyển' },
    { id: 2, name: 'Bao 25kg thức ăn viên', unit: 'Bao', items: '25 kg', note: 'Quy cách chuẩn C.P. và Dabaco' },
    { id: 3, name: 'Hộp 10 lọ vắc-xin', unit: 'Hộp', items: '10 lọ', note: 'Kèm lọ nước pha tiêm/nhỏ mắt' },
  ];

  const suppliers = [
    { code: 'NCC000001', name: 'Công ty Cổ phần Chăn nuôi C.P. Việt Nam', rep: 'Nguyễn Văn Long', phone: '024 3822 0000', bank: 'Vietcombank - 001100223344', group: 'Trả sau' },
    { code: 'NCC000002', name: 'Tập đoàn DABACO Việt Nam', rep: 'Trần Đình Nam', phone: '0222 3826 077', bank: 'BIDV - 1234567890', group: 'Trả theo đơn' },
    { code: 'NCC000003', name: 'Công ty Thuốc Thú Y Hanvet', rep: 'Lê Văn Tuấn', phone: '024 3858 3583', bank: 'Agribank - 220011334455', group: 'Trả sau' },
    { code: 'NCC000004', name: 'Công ty Hóa chất FAVET', rep: 'Vũ Thị Lan', phone: '024 3681 1234', bank: 'MB Bank - 0888999888', group: 'Trả theo đơn' },
  ];

  const customers = [
    { code: 'KH000001', name: 'Thương lái Trần Văn Tuấn', rep: 'Trần Văn Tuấn', phone: '0988 123 456', tax: '0108899881', bank: 'Vietinbank - 10988776655' },
    { code: 'KH000002', name: 'Công ty Thực phẩm Sạch Minh Tâm', rep: 'Phạm Minh Tâm', phone: '0977 654 321', tax: '0107766554', bank: 'Techcombank - 19033445566' },
    { code: 'KH000003', name: 'Hợp tác xã Chăn nuôi & Tiêu thụ An Phát', rep: 'Đỗ Quốc An', phone: '0912 345 678', tax: '0106655443', bank: 'MB Bank - 0912345678' },
  ];

  return (
    <FarmShiftLayout
      pageTitle="Thiết lập danh mục"
      breadcrumbs={CATALOG_BREADCRUMBS}
      actions={CATALOG_ACTIONS}
    >
      {/* ── Tabs Navigation (All 7 Master Data Views) ─────── */}
      <div className="farmshift-tabs">
        <button
          type="button"
          className={`farmshift-tab-btn ${activeTab === 'warehouses' ? 'active' : ''}`}
          onClick={() => setActiveTab('warehouses')}
        >
          Danh mục kho
        </button>
        <button
          type="button"
          className={`farmshift-tab-btn ${activeTab === 'categories' ? 'active' : ''}`}
          onClick={() => setActiveTab('categories')}
        >
          Tên hàng hóa
        </button>
        <button
          type="button"
          className={`farmshift-tab-btn ${activeTab === 'types' ? 'active' : ''}`}
          onClick={() => setActiveTab('types')}
        >
          Loại hàng hóa
        </button>
        <button
          type="button"
          className={`farmshift-tab-btn ${activeTab === 'brands' ? 'active' : ''}`}
          onClick={() => setActiveTab('brands')}
        >
          Nhãn hiệu
        </button>
        <button
          type="button"
          className={`farmshift-tab-btn ${activeTab === 'units' ? 'active' : ''}`}
          onClick={() => setActiveTab('units')}
        >
          Đơn vị tính
        </button>
        <button
          type="button"
          className={`farmshift-tab-btn ${activeTab === 'suppliers' ? 'active' : ''}`}
          onClick={() => setActiveTab('suppliers')}
        >
          Nhà cung cấp
        </button>
        <button
          type="button"
          className={`farmshift-tab-btn ${activeTab === 'customers' ? 'active' : ''}`}
          onClick={() => setActiveTab('customers')}
        >
          Khách hàng
        </button>
      </div>

      {/* ── Tab 1: Danh mục kho ───────────────────────────── */}
      {activeTab === 'warehouses' && <WarehouseCategoriesView />}

      {/* ── Tab Tên hàng hóa ─────────────────────────────── */}
      {activeTab === 'categories' && <ProductCategoriesView />}

      {/* ── Tab Loại hàng hóa ────────────────────────────── */}
      {activeTab === 'types' && <ProductTypesView />}

      {/* ── Tab 2: Nhãn hiệu ─────────────────────────────── */}
      {activeTab === 'brands' && <BrandsView />}

      {activeTab === 'units' && <MeasurementUnitsView />}

      {/* ── Tab 4: Đơn vị quy cách ──────────────────────── */}
      {activeTab === 'specs' && (
        <div className="farmshift-card" style={{ minHeight: '520px' }}>
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Quy cách đóng gói & tỷ lệ quy đổi</h3>
            <button type="button" className="farmshift-btn farmshift-btn-primary" style={{ fontSize: '12.5px', padding: '5px 12px' }}>
              + Thêm quy cách
            </button>
          </div>
          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className="farmshift-table">
              <thead>
                <tr>
                  <th>Tên quy cách đóng gói</th>
                  <th>Đơn vị lớn</th>
                  <th>Giá trị quy đổi</th>
                  <th>Mô tả</th>
                </tr>
              </thead>
              <tbody>
                {specs.map(s => (
                  <tr key={s.id}>
                    <td><strong style={{ color: 'var(--color-ink)' }}>{s.name}</strong></td>
                    <td>{s.unit}</td>
                    <td><span className="farmshift-badge farmshift-badge-neutral">{s.items}</span></td>
                    <td style={{ color: 'var(--color-muted)' }}>{s.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 6: Thiết lập Nhà cung cấp (Thiết lập - Nhà cung cấp.html) ── */}
      {activeTab === 'suppliers' && (
        <div className="farmshift-card" style={{ minHeight: '520px' }}>
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Danh bạ nhà cung cấp vật tư & thức ăn</h3>
            <button type="button" className="farmshift-btn farmshift-btn-primary" style={{ fontSize: '12.5px', padding: '5px 12px' }}>
              + Tạo nhà cung cấp
            </button>
          </div>
          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className="farmshift-table">
              <thead>
                <tr>
                  <th>Mã NCC</th>
                  <th>Đơn vị cung cấp</th>
                  <th>Người đại diện</th>
                  <th>Số điện thoại</th>
                  <th>Tài khoản ngân hàng</th>
                  <th>Nhóm đối tác</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map(s => (
                  <tr key={s.code}>
                    <td><span style={{ fontFamily: 'monospace' }}>{s.code}</span></td>
                    <td><strong style={{ color: 'var(--color-ink)' }}>{s.name}</strong></td>
                    <td>{s.rep}</td>
                    <td>{s.phone}</td>
                    <td style={{ fontSize: '13px', color: 'var(--color-muted)' }}>{s.bank}</td>
                    <td>
                      <span className={`farmshift-badge ${s.group === 'Trả sau' ? 'farmshift-badge-warning' : 'farmshift-badge-neutral'}`}>
                        {s.group}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 7: Thiết lập Khách hàng (Thiết lập - Khách hàng.html) ── */}
      {activeTab === 'customers' && (
        <div className="farmshift-card" style={{ minHeight: '520px' }}>
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Danh bạ thương lái & Đối tác tiêu thụ</h3>
            <button type="button" className="farmshift-btn farmshift-btn-primary" style={{ fontSize: '12.5px', padding: '5px 12px' }}>
              + Tạo khách hàng
            </button>
          </div>
          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className="farmshift-table">
              <thead>
                <tr>
                  <th>Mã KH</th>
                  <th>Đơn vị mua</th>
                  <th>Mã số thuế</th>
                  <th>Người đại diện</th>
                  <th>Số điện thoại</th>
                  <th>Tài khoản ngân hàng</th>
                </tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.code}>
                    <td><span style={{ fontFamily: 'monospace' }}>{c.code}</span></td>
                    <td><strong style={{ color: 'var(--color-ink)' }}>{c.name}</strong></td>
                    <td><span style={{ fontFamily: 'monospace' }}>{c.tax}</span></td>
                    <td>{c.rep}</td>
                    <td>{c.phone}</td>
                    <td style={{ fontSize: '13px', color: 'var(--color-muted)' }}>{c.bank}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </FarmShiftLayout>
  );
};
