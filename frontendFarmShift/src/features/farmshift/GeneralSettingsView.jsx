// src/features/farmshift/GeneralSettingsView.jsx
// Thiết lập chung & Phân quyền trang trại chuẩn FarmShift & DESIGN.md
import React, { useState } from 'react';
import { Sliders, Shield, Building, Save, CheckCircle, Database, Upload, RefreshCw, Warehouse, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';
import { INITIAL_FARMSHIFT_DATA, getFarmInfo, saveFarmInfo } from '../../data/farmshiftMockData';

export const GeneralSettingsView = () => {
  const { user } = useAuth();
  const [farmInfo, setFarmInfo] = useState(() => getFarmInfo(user));
  const [activeTab, setActiveTab] = useState('info');
  // 'info' | 'roles' | 'barn_roles' | 'warehouse_roles' | 'data_settings' | 'permissions'
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    saveFarmInfo(farmInfo);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <FarmShiftLayout
      pageTitle="Thiết lập chung"
      breadcrumbs={[{ label: 'Thiết lập chung' }]}
    >
      {/* ── Tabs Navigation (All 6 General Settings Views) ── */}
      <div className="farmshift-tabs">
        <button
          className={`farmshift-tab-btn ${activeTab === 'info' ? 'active' : ''}`}
          onClick={() => setActiveTab('info')}
        >
          Thông tin cơ sở & Trang trại
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'roles' ? 'active' : ''}`}
          onClick={() => setActiveTab('roles')}
        >
          Phân vai trò chung
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'barn_roles' ? 'active' : ''}`}
          onClick={() => setActiveTab('barn_roles')}
        >
          Phân vai trò theo Chuồng
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'warehouse_roles' ? 'active' : ''}`}
          onClick={() => setActiveTab('warehouse_roles')}
        >
          Phân vai trò theo Kho
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'data_settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('data_settings')}
        >
          Cài đặt dữ liệu & Excel
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'permissions' ? 'active' : ''}`}
          onClick={() => setActiveTab('permissions')}
        >
          Danh sách quyền hạn
        </button>
      </div>

      {/* ── Tab 1: Thông tin cơ sở ────────────────────────── */}
      {activeTab === 'info' && (
        <div className="farmshift-card" style={{ maxWidth: '800px' }}>
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Cài đặt thông tin Hộ kinh doanh / Trang trại</h3>
            {savedSuccess && (
              <span className="farmshift-badge farmshift-badge-success">
                ✓ Đã lưu thành công!
              </span>
            )}
          </div>
          <form onSubmit={handleSave}>
            <div className="farmshift-card-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Tên cơ sở / Hộ kinh doanh *</label>
                  <input
                    type="text"
                    required
                    className="farmshift-form-control"
                    value={farmInfo.name}
                    onChange={(e) => setFarmInfo({ ...farmInfo, name: e.target.value })}
                  />
                </div>
                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Chủ hộ / Người đại diện *</label>
                  <input
                    type="text"
                    required
                    className="farmshift-form-control"
                    value={farmInfo.owner}
                    onChange={(e) => setFarmInfo({ ...farmInfo, owner: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Số điện thoại *</label>
                  <input
                    type="text"
                    required
                    className="farmshift-form-control"
                    value={farmInfo.phone}
                    onChange={(e) => setFarmInfo({ ...farmInfo, phone: e.target.value })}
                  />
                </div>
                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Quy mô chăn nuôi</label>
                  <input
                    type="text"
                    className="farmshift-form-control"
                    value={farmInfo.scale}
                    onChange={(e) => setFarmInfo({ ...farmInfo, scale: e.target.value })}
                  />
                </div>
              </div>

              <div className="farmshift-form-group">
                <label className="farmshift-form-label">Địa chỉ trang trại</label>
                <input
                  type="text"
                  className="farmshift-form-control"
                  value={farmInfo.address}
                  onChange={(e) => setFarmInfo({ ...farmInfo, address: e.target.value })}
                />
              </div>

              <div className="farmshift-form-group">
                <label className="farmshift-form-label">Mô hình sản xuất chính</label>
                <input
                  type="text"
                  className="farmshift-form-control"
                  value={farmInfo.type}
                  onChange={(e) => setFarmInfo({ ...farmInfo, type: e.target.value })}
                />
              </div>
            </div>
            <div className="farmshift-card-header" style={{ justifyContent: 'flex-end', backgroundColor: 'var(--color-surface-soft)' }}>
              <button type="submit" className="farmshift-btn farmshift-btn-primary">
                <Save size={15} /> Cập nhật thông tin
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Tab 2: Phân vai trò chung ─────────────────────── */}
      {activeTab === 'roles' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Phân quyền chức năng theo vị trí công việc</h3>
          </div>
          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className="farmshift-table">
              <thead>
                <tr>
                  <th>Vai trò</th>
                  <th>Khu nuôi & Chuồng</th>
                  <th>Kho hàng</th>
                  <th>Hóa đơn & Bán hàng</th>
                  <th>Sổ quỹ</th>
                  <th>Báo cáo</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong style={{ color: 'var(--color-primary)' }}>Chủ trang trại (Admin)</strong></td>
                  <td><span className="farmshift-badge farmshift-badge-success">Toàn quyền</span></td>
                  <td><span className="farmshift-badge farmshift-badge-success">Toàn quyền</span></td>
                  <td><span className="farmshift-badge farmshift-badge-success">Toàn quyền</span></td>
                  <td><span className="farmshift-badge farmshift-badge-success">Toàn quyền</span></td>
                  <td><span className="farmshift-badge farmshift-badge-success">Toàn quyền</span></td>
                </tr>
                <tr>
                  <td><strong style={{ color: 'var(--color-link)' }}>Kế toán</strong></td>
                  <td><span className="farmshift-badge farmshift-badge-neutral">Xem số lượng</span></td>
                  <td><span className="farmshift-badge farmshift-badge-success">Nhập/Xuất/Tồn</span></td>
                  <td><span className="farmshift-badge farmshift-badge-success">Toàn quyền</span></td>
                  <td><span className="farmshift-badge farmshift-badge-success">Thu / Chi</span></td>
                  <td><span className="farmshift-badge farmshift-badge-success">Tài chính</span></td>
                </tr>
                <tr>
                  <td><strong style={{ color: 'var(--color-ink)' }}>Kỹ thuật viên / Công nhân</strong></td>
                  <td><span className="farmshift-badge farmshift-badge-success">Ghi nhật ký</span></td>
                  <td><span className="farmshift-badge farmshift-badge-neutral">Xem tồn cám</span></td>
                  <td><span className="farmshift-badge farmshift-badge-danger">Không</span></td>
                  <td><span className="farmshift-badge farmshift-badge-danger">Không</span></td>
                  <td><span className="farmshift-badge farmshift-badge-neutral">Xem tăng trọng</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 3: Phân vai trò trong khu nuôi (Phân vai trò trong khu nuôi.html) ── */}
      {activeTab === 'barn_roles' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Phân quyền quản lý lứa nuôi theo từng Chuồng</h3>
          </div>
          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className="farmshift-table">
              <thead>
                <tr>
                  <th>Chuồng nuôi</th>
                  <th>Khu nuôi</th>
                  <th>Công nhân phụ trách chính</th>
                  <th>Kỹ thuật viên giám sát</th>
                  <th>Quyền ghi nhật ký</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Nhà A1</strong></td>
                  <td>Khu Mía Thịt</td>
                  <td>Tran Van Nam</td>
                  <td>Nguyen Hiep (Admin)</td>
                  <td><span className="farmshift-badge farmshift-badge-success">Được phép</span></td>
                </tr>
                <tr>
                  <td><strong>Nhà A2</strong></td>
                  <td>Khu Mía Thịt</td>
                  <td>Tran Van Nam</td>
                  <td>Nguyen Hiep (Admin)</td>
                  <td><span className="farmshift-badge farmshift-badge-success">Được phép</span></td>
                </tr>
                <tr>
                  <td><strong>Nhà A3</strong></td>
                  <td>Khu Mía Thịt</td>
                  <td>Tran Van Nam</td>
                  <td>Nguyen Hiep (Admin)</td>
                  <td><span className="farmshift-badge farmshift-badge-success">Được phép</span></td>
                </tr>
                <tr>
                  <td><strong>Nhà B1</strong></td>
                  <td>Khu J Thịt</td>
                  <td>Nguyen Thi Thu Ha</td>
                  <td>Nguyen Hiep (Admin)</td>
                  <td><span className="farmshift-badge farmshift-badge-success">Được phép</span></td>
                </tr>
                <tr>
                  <td><strong>Nhà B2</strong></td>
                  <td>Khu J Thịt</td>
                  <td>Nguyen Thi Thu Ha</td>
                  <td>Nguyen Hiep (Admin)</td>
                  <td><span className="farmshift-badge farmshift-badge-success">Được phép</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 4: Phân vai trò trong kho hàng (Phân vai trò trong kho hàng.html) ── */}
      {activeTab === 'warehouse_roles' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Phân quyền thủ kho & nhân sự quản lý kho hàng</h3>
          </div>
          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className="farmshift-table">
              <thead>
                <tr>
                  <th>Tên kho hàng</th>
                  <th>Thủ kho chính</th>
                  <th>Quyền nhập kho</th>
                  <th>Quyền xuất kho</th>
                  <th>Quyền kiểm kê điều chỉnh</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Kho Cám & Thức ăn</strong></td>
                  <td>Nguyen Thi Thu Ha</td>
                  <td><span className="farmshift-badge farmshift-badge-success">Có</span></td>
                  <td><span className="farmshift-badge farmshift-badge-success">Có</span></td>
                  <td><span className="farmshift-badge farmshift-badge-success">Có</span></td>
                </tr>
                <tr>
                  <td><strong>Kho Thuốc thú y & Vắc-xin</strong></td>
                  <td>Nguyen Hiep (Kỹ thuật)</td>
                  <td><span className="farmshift-badge farmshift-badge-success">Có</span></td>
                  <td><span className="farmshift-badge farmshift-badge-success">Có</span></td>
                  <td><span className="farmshift-badge farmshift-badge-success">Có</span></td>
                </tr>
                <tr>
                  <td><strong>Kho Hóa chất sát trùng</strong></td>
                  <td>Tran Van Nam</td>
                  <td><span className="farmshift-badge farmshift-badge-neutral">Theo lệnh</span></td>
                  <td><span className="farmshift-badge farmshift-badge-success">Có</span></td>
                  <td><span className="farmshift-badge farmshift-badge-neutral">Chỉ xem</span></td>
                </tr>
                <tr>
                  <td><strong>Kho Con giống & Thành phẩm</strong></td>
                  <td>Nguyen Hiep</td>
                  <td><span className="farmshift-badge farmshift-badge-success">Có</span></td>
                  <td><span className="farmshift-badge farmshift-badge-success">Có</span></td>
                  <td><span className="farmshift-badge farmshift-badge-success">Có</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 5: Cài đặt dữ liệu (Cài đặt dữ liệu.html) ──── */}
      {activeTab === 'data_settings' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Khởi tạo dữ liệu & Cài đặt từ tệp tin</h3>
          </div>
          <div className="farmshift-card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              <div style={{ border: '1px solid var(--color-hairline)', borderRadius: 'var(--rounded-md)', padding: '20px' }}>
                <h4 style={{ margin: '0 0 8px', fontSize: '15px', color: 'var(--color-ink)' }}>Cài đặt dữ liệu demo</h4>
                <p style={{ fontSize: '13px', color: 'var(--color-body)', lineHeight: 1.5, margin: '0 0 16px' }}>
                  Hệ thống sẽ nạp dữ liệu mẫu bao gồm Trang trại Miến Bình, 2 khu nuôi (Khu Mía, Khu J), các danh mục cám Higro và hóa đơn nhập mẫu.
                </p>
                <button
                  className="farmshift-btn farmshift-btn-primary"
                  onClick={() => alert('Đã khởi tạo và làm mới dữ liệu demo FarmShift thành công!')}
                >
                  <RefreshCw size={15} /> Cài đặt dữ liệu demo
                </button>
              </div>

              <div style={{ border: '1px solid var(--color-hairline)', borderRadius: 'var(--rounded-md)', padding: '20px' }}>
                <h4 style={{ margin: '0 0 8px', fontSize: '15px', color: 'var(--color-ink)' }}>Cài đặt từ file Excel</h4>
                <p style={{ fontSize: '13px', color: 'var(--color-body)', lineHeight: 1.5, margin: '0 0 16px' }}>
                  Tải lên tệp Excel chứa danh mục hàng hóa, nhà cung cấp, khách hàng hoặc số dư tồn kho ban đầu theo biểu mẫu chuẩn FarmShift.
                </p>
                <button
                  className="farmshift-btn farmshift-btn-secondary"
                  onClick={() => alert('Vui lòng chọn file Excel mẫu FarmShift (*.xlsx)')}
                >
                  <Upload size={15} /> Cài đặt từ file Excel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 6: Danh sách quyền hạn (Danh sách quyền hạn.html) ── */}
      {activeTab === 'permissions' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Danh sách quyền hạn chi tiết (RBAC)</h3>
          </div>
          <div className="farmshift-card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
              <div style={{ padding: '16px', borderRadius: 'var(--rounded-md)', backgroundColor: 'var(--color-surface-soft)', border: '1px solid var(--color-hairline)' }}>
                <strong style={{ color: 'var(--color-ink)' }}>Nhóm Quản lý Lứa & Chuồng</strong>
                <ul style={{ margin: '8px 0 0 16px', padding: 0, fontSize: '13px', color: 'var(--color-body)', lineHeight: 1.6 }}>
                  <li>Tạo mới khu nuôi & chuồng</li>
                  <li>Nhập đàn / Vào giống</li>
                  <li>Tách chuồng, sang đàn</li>
                  <li>Kết thúc lứa nuôi</li>
                </ul>
              </div>
              <div style={{ padding: '16px', borderRadius: 'var(--rounded-md)', backgroundColor: 'var(--color-surface-soft)', border: '1px solid var(--color-hairline)' }}>
                <strong style={{ color: 'var(--color-ink)' }}>Nhóm Nhật ký & IoT</strong>
                <ul style={{ margin: '8px 0 0 16px', padding: 0, fontSize: '13px', color: 'var(--color-body)', lineHeight: 1.6 }}>
                  <li>Ghi định mức cám ăn</li>
                  <li>Ghi biểu hiện bệnh & thuốc</li>
                  <li>Ghi nhận hao hụt / loại thải</li>
                  <li>Cài đặt ngưỡng cảnh báo IoT</li>
                </ul>
              </div>
              <div style={{ padding: '16px', borderRadius: 'var(--rounded-md)', backgroundColor: 'var(--color-surface-soft)', border: '1px solid var(--color-hairline)' }}>
                <strong style={{ color: 'var(--color-ink)' }}>Nhóm Tài chính & Bán hàng</strong>
                <ul style={{ margin: '8px 0 0 16px', padding: 0, fontSize: '13px', color: 'var(--color-body)', lineHeight: 1.6 }}>
                  <li>Tạo hóa đơn nhập hàng</li>
                  <li>Tạo đơn xuất bán gà</li>
                  <li>Lập phiếu thu / phiếu chi</li>
                  <li>Xem báo cáo lãi lỗ (P&L)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </FarmShiftLayout>
  );
};
