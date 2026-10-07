// src/features/farmshift/CatalogSettingsView.jsx
// Thiết lập danh mục & Master Data chuẩn FarmShift & DESIGN.md
import React, { useState } from 'react';
import {
  Layers, Plus, Search, FileSpreadsheet, Tag, Box,
  Users, Building, CheckCircle, Package, Scale, X, Phone, MapPin
} from 'lucide-react';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';

export const CatalogSettingsView = () => {
  const [activeTab, setActiveTab] = useState('categories');
  // 'categories' | 'brands' | 'units' | 'specs' | 'warehouses' | 'suppliers' | 'customers'

  const categories = [
    { id: 1, name: 'Con giống gia cầm', code: 'CG', count: 2, note: 'Gà giống J-Dabaco, Mía Dabaco' },
    { id: 2, name: 'Nguyên liệu / Thức ăn chăn nuôi', code: 'TA', count: 3, note: 'Cám úm Higro 01, Cám thịt Higro 02, Cám vỗ béo 03' },
    { id: 3, name: 'Vắc-xin phòng bệnh', code: 'VX', count: 2, note: 'Newcastle Lasota, Gumboro D78 bảo quản lạnh' },
    { id: 4, name: 'Thuốc thú y & Kháng sinh', code: 'TH', count: 2, note: 'Kháng sinh Doxycycline, hạ sốt Paracetamol C' },
    { id: 5, name: 'Hóa chất khử trùng', code: 'HC', count: 2, note: 'BKC 80%, Iodine khử trùng chuồng trại' },
    { id: 6, name: 'Hàng thu hoạch', code: 'THUHOACH', count: 2, note: 'Gà thịt xuất chuồng, trứng gà sạch' },
  ];

  const brands = [
    { id: 1, name: 'Tập đoàn Dabaco', type: 'Con giống & Cám', country: 'Việt Nam', note: 'Gà giống J-Dabaco, Mía Dabaco' },
    { id: 2, name: 'C.P. Group (C.P. Việt Nam)', type: 'Thức ăn chăn nuôi', country: 'Thái Lan / VN', note: 'Dòng cám Higro 01, 02, 03' },
    { id: 3, name: 'Hanvet', type: 'Thuốc thú y & Vắc-xin', country: 'Việt Nam', note: 'Vắc-xin Lasota, Gumboro' },
    { id: 4, name: 'FAVET', type: 'Hóa chất sát trùng', country: 'Việt Nam', note: 'Thuốc sát trùng BKC 80%' },
    { id: 5, name: 'De Heus', type: 'Thức ăn chăn nuôi', country: 'Hà Lan / VN', note: 'Dòng thức ăn gia cầm chuyên biệt' },
  ];

  const units = [
    { id: 1, name: 'Kg', type: 'Khối lượng', note: 'Cân gà xuất chuồng, thức ăn' },
    { id: 2, name: 'Bao (25kg)', type: 'Bao bì', note: 'Đóng gói cám tiêu chuẩn' },
    { id: 3, name: 'Con', type: 'Đơn vị đếm', note: 'Con giống, đàn gà' },
    { id: 4, name: 'Lọ (1000 liều)', type: 'Dược phẩm', note: 'Vắc-xin phòng bệnh' },
    { id: 5, name: 'Chai / Can (1L - 5L)', type: 'Chất lỏng', note: 'Thuốc sát trùng khử khuẩn' },
    { id: 6, name: 'Khay (30 quả)', type: 'Quy cách trứng', note: 'Khay đựng trứng thương phẩm' },
  ];

  const warehouses = [
    { id: 1, name: 'Kho Cám & Thức ăn', location: 'Khu trung tâm trại', capacity: '50 tấn', manager: 'Nguyễn Thị Thu Hà' },
    { id: 2, name: 'Kho Thuốc thú y & Vắc-xin', location: 'Phòng kỹ thuật thú y', capacity: 'Tủ lạnh 2-8°C', manager: 'Trần Văn Mạnh' },
    { id: 3, name: 'Kho Hóa chất & Khử trùng', location: 'Khu cách ly cổng chính', capacity: '10 tấn', manager: 'Lê Văn Tùng' },
    { id: 4, name: 'Kho Con giống & Thành phẩm', location: 'Khu Nhà B (Úm)', capacity: '10,000 con', manager: 'Nguyễn Văn Hải' },
  ];

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
      breadcrumbs={[{ label: 'Thiết lập danh mục' }]}
      actions={
        <button className="farmshift-btn farmshift-btn-excel">
          <FileSpreadsheet size={15} /> Xuất Excel
        </button>
      }
    >
      {/* ── Tabs Navigation (All 7 Master Data Views) ─────── */}
      <div className="farmshift-tabs">
        <button
          className={`farmshift-tab-btn ${activeTab === 'categories' ? 'active' : ''}`}
          onClick={() => setActiveTab('categories')}
        >
          Loại hàng hóa
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'brands' ? 'active' : ''}`}
          onClick={() => setActiveTab('brands')}
        >
          Nhãn hiệu
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'units' ? 'active' : ''}`}
          onClick={() => setActiveTab('units')}
        >
          Đơn vị tính
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'specs' ? 'active' : ''}`}
          onClick={() => setActiveTab('specs')}
        >
          Đơn vị quy cách
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'warehouses' ? 'active' : ''}`}
          onClick={() => setActiveTab('warehouses')}
        >
          Danh mục kho
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'suppliers' ? 'active' : ''}`}
          onClick={() => setActiveTab('suppliers')}
        >
          Nhà cung cấp
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'customers' ? 'active' : ''}`}
          onClick={() => setActiveTab('customers')}
        >
          Khách hàng
        </button>
      </div>

      {/* ── Tab 1: Loại hàng hóa ─────────────────────────── */}
      {activeTab === 'categories' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Phân loại danh mục hàng hóa</h3>
            <button className="farmshift-btn farmshift-btn-primary" style={{ fontSize: '12.5px', padding: '5px 12px' }}>
              + Thêm loại hàng
            </button>
          </div>
          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className="farmshift-table">
              <thead>
                <tr>
                  <th>Mã loại</th>
                  <th>Tên loại hàng hóa</th>
                  <th>Số mặt hàng đang quản lý</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {categories.map(c => (
                  <tr key={c.id}>
                    <td><span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{c.code}</span></td>
                    <td><strong style={{ color: 'var(--color-ink)' }}>{c.name}</strong></td>
                    <td><strong>{c.count}</strong> mặt hàng</td>
                    <td style={{ color: 'var(--color-muted)' }}>{c.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 2: Nhãn hiệu ─────────────────────────────── */}
      {activeTab === 'brands' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Danh sách thương hiệu đối tác</h3>
            <button className="farmshift-btn farmshift-btn-primary" style={{ fontSize: '12.5px', padding: '5px 12px' }}>
              + Thêm nhãn hiệu
            </button>
          </div>
          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className="farmshift-table">
              <thead>
                <tr>
                  <th>Tên thương hiệu</th>
                  <th>Lĩnh vực sản phẩm</th>
                  <th>Xuất xứ</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {brands.map(b => (
                  <tr key={b.id}>
                    <td><strong style={{ color: 'var(--color-ink)' }}>{b.name}</strong></td>
                    <td>{b.type}</td>
                    <td>{b.country}</td>
                    <td style={{ color: 'var(--color-muted)' }}>{b.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 3: Đơn vị tính ──────────────────────────── */}
      {activeTab === 'units' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Đơn vị đo lường cơ bản</h3>
            <button className="farmshift-btn farmshift-btn-primary" style={{ fontSize: '12.5px', padding: '5px 12px' }}>
              + Thêm đơn vị
            </button>
          </div>
          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className="farmshift-table">
              <thead>
                <tr>
                  <th>Tên đơn vị</th>
                  <th>Phân loại</th>
                  <th>Áp dụng cho</th>
                </tr>
              </thead>
              <tbody>
                {units.map(u => (
                  <tr key={u.id}>
                    <td><strong style={{ color: 'var(--color-ink)' }}>{u.name}</strong></td>
                    <td>{u.type}</td>
                    <td style={{ color: 'var(--color-muted)' }}>{u.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 4: Đơn vị quy cách ──────────────────────── */}
      {activeTab === 'specs' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Quy cách đóng gói & tỷ lệ quy đổi</h3>
            <button className="farmshift-btn farmshift-btn-primary" style={{ fontSize: '12.5px', padding: '5px 12px' }}>
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

      {/* ── Tab 5: Danh mục kho hàng ────────────────────── */}
      {activeTab === 'warehouses' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Hệ thống kho hàng vật lý tại trang trại</h3>
            <button className="farmshift-btn farmshift-btn-primary" style={{ fontSize: '12.5px', padding: '5px 12px' }}>
              + Thêm kho mới
            </button>
          </div>
          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className="farmshift-table">
              <thead>
                <tr>
                  <th>Tên kho</th>
                  <th>Vị trí vật lý</th>
                  <th>Sức chứa thiết kế</th>
                  <th>Nhân sự phụ trách</th>
                </tr>
              </thead>
              <tbody>
                {warehouses.map(w => (
                  <tr key={w.id}>
                    <td><strong style={{ color: 'var(--color-ink)' }}>{w.name}</strong></td>
                    <td>{w.location}</td>
                    <td>{w.capacity}</td>
                    <td>{w.manager}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 6: Thiết lập Nhà cung cấp (Thiết lập - Nhà cung cấp.html) ── */}
      {activeTab === 'suppliers' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Danh bạ nhà cung cấp vật tư & thức ăn</h3>
            <button className="farmshift-btn farmshift-btn-primary" style={{ fontSize: '12.5px', padding: '5px 12px' }}>
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
        <div className="farmshift-card">
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Danh bạ thương lái & Đối tác tiêu thụ</h3>
            <button className="farmshift-btn farmshift-btn-primary" style={{ fontSize: '12.5px', padding: '5px 12px' }}>
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
