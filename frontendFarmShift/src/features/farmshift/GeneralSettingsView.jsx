// src/features/farmshift/GeneralSettingsView.jsx
// Thiết lập chung & Phân quyền trang trại chuẩn FarmShift & DESIGN.md
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Sliders, Shield, Building, Save, CheckCircle, Database, Upload,
  RefreshCw, Warehouse, Users, Bell, ExternalLink, Download, Search, Check, Filter
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';
import { INITIAL_FARMSHIFT_DATA, getFarmInfo, saveFarmInfo } from '../../data/farmshiftMockData';
import { FARMSHIFT_SCREENS } from '../../data/screensMatrix';

export const GeneralSettingsView = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Detect tab from URL path or search query
  const getInitialTab = () => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam) return tabParam;
    if (location.pathname.includes('screens')) return 'screens';
    if (location.pathname.includes('notifications')) return 'notifications';
    return 'info';
  };

  const [farmInfo, setFarmInfo] = useState(() => getFarmInfo(user));
  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [notifSaved, setNotifSaved] = useState(false);

  // Notifications preference state
  const [notifSettings, setNotifSettings] = useState({
    push: true,
    email: false,
    sms: false,
    critical: true,
    tasks: true,
    debt: true
  });

  // Screen matrix search & filter states
  const [screenSearch, setScreenSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam) setActiveTab(tabParam);
    else if (location.pathname.includes('screens')) setActiveTab('screens');
    else if (location.pathname.includes('notifications')) setActiveTab('notifications');
  }, [location.pathname, location.search]);

  const handleSaveFarmInfo = (e) => {
    e.preventDefault();
    saveFarmInfo(farmInfo);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleSaveNotifications = (e) => {
    e.preventDefault();
    setNotifSaved(true);
    setTimeout(() => setNotifSaved(false), 3000);
  };

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(INITIAL_FARMSHIFT_DATA, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `farmshift_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Filtered screens for Tab 7
  const filteredScreens = FARMSHIFT_SCREENS.filter(scr => {
    const matchesSearch = !screenSearch ||
      scr.title.toLowerCase().includes(screenSearch.toLowerCase()) ||
      scr.id.toLowerCase().includes(screenSearch.toLowerCase()) ||
      scr.group.toLowerCase().includes(screenSearch.toLowerCase()) ||
      scr.notes.toLowerCase().includes(screenSearch.toLowerCase());

    const matchesGroup = groupFilter === 'ALL' || scr.group === groupFilter;
    const matchesRole = roleFilter === 'ALL' || scr.roles.includes(roleFilter);

    return matchesSearch && matchesGroup && matchesRole;
  });

  const allGroups = Array.from(new Set(FARMSHIFT_SCREENS.map(s => s.group)));

  return (
    <FarmShiftLayout
      pageTitle="Thiết lập chung"
      breadcrumbs={[{ label: 'Thiết lập chung' }]}
    >
      {/* ── Tabs Navigation (All 7 General Settings Views) ── */}
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
          className={`farmshift-tab-btn ${activeTab === 'notifications' ? 'active' : ''}`}
          onClick={() => setActiveTab('notifications')}
        >
          Thông báo cá nhân & Cảnh báo
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'data_settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('data_settings')}
        >
          Dữ liệu & Sao lưu JSON / Excel
        </button>
        <button
          className={`farmshift-tab-btn ${activeTab === 'screens' ? 'active' : ''}`}
          onClick={() => setActiveTab('screens')}
        >
          Danh mục 73 màn hình hệ thống
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
          <form onSubmit={handleSaveFarmInfo}>
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
            <h3 className="farmshift-card-title">Phân quyền chức năng theo vị trí công việc (RBAC)</h3>
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

      {/* ── Tab 3: Phân vai trò trong khu nuôi ──────────────── */}
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
                  <td>Trần Văn Bình</td>
                  <td>Nguyễn Hiệp (Chủ trại)</td>
                  <td><span className="farmshift-badge farmshift-badge-success">Được phép</span></td>
                </tr>
                <tr>
                  <td><strong>Nhà A2</strong></td>
                  <td>Khu Mía Thịt</td>
                  <td>Trần Văn Bình</td>
                  <td>Nguyễn Hiệp (Chủ trại)</td>
                  <td><span className="farmshift-badge farmshift-badge-success">Được phép</span></td>
                </tr>
                <tr>
                  <td><strong>Nhà B1</strong></td>
                  <td>Khu J Thịt</td>
                  <td>Trần Thị Mai</td>
                  <td>Nguyễn Hiệp (Chủ trại)</td>
                  <td><span className="farmshift-badge farmshift-badge-success">Được phép</span></td>
                </tr>
                <tr>
                  <td><strong>Nhà B2</strong></td>
                  <td>Khu J Thịt</td>
                  <td>Lê Văn Cường</td>
                  <td>Nguyễn Hiệp (Chủ trại)</td>
                  <td><span className="farmshift-badge farmshift-badge-success">Được phép</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 4: Phân vai trò trong kho hàng ──────────────── */}
      {activeTab === 'warehouse_roles' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Phân quyền thủ kho & Quản lý kho hàng</h3>
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
                  <td>Nguyễn Thị Thu Hà</td>
                  <td><span className="farmshift-badge farmshift-badge-success">Có</span></td>
                  <td><span className="farmshift-badge farmshift-badge-success">Có</span></td>
                  <td><span className="farmshift-badge farmshift-badge-success">Có</span></td>
                </tr>
                <tr>
                  <td><strong>Kho Thuốc thú y & Vắc-xin</strong></td>
                  <td>Nguyễn Hiệp (Kỹ thuật)</td>
                  <td><span className="farmshift-badge farmshift-badge-success">Có</span></td>
                  <td><span className="farmshift-badge farmshift-badge-success">Có</span></td>
                  <td><span className="farmshift-badge farmshift-badge-success">Có</span></td>
                </tr>
                <tr>
                  <td><strong>Kho Hóa chất sát trùng</strong></td>
                  <td>Trần Văn Bình</td>
                  <td><span className="farmshift-badge farmshift-badge-neutral">Theo lệnh</span></td>
                  <td><span className="farmshift-badge farmshift-badge-success">Có</span></td>
                  <td><span className="farmshift-badge farmshift-badge-neutral">Chỉ xem</span></td>
                </tr>
                <tr>
                  <td><strong>Kho Con giống & Thành phẩm</strong></td>
                  <td>Nguyễn Hiệp</td>
                  <td><span className="farmshift-badge farmshift-badge-success">Có</span></td>
                  <td><span className="farmshift-badge farmshift-badge-success">Có</span></td>
                  <td><span className="farmshift-badge farmshift-badge-success">Có</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 5: Thông báo cá nhân & Cảnh báo ─────────────── */}
      {activeTab === 'notifications' && (
        <div className="farmshift-card" style={{ maxWidth: '800px' }}>
          <div className="farmshift-card-header">
            <div>
              <h3 className="farmshift-card-title">Cấu hình kênh & Loại thông báo hệ thống</h3>
              <p style={{ fontSize: '12px', color: 'var(--color-muted)', margin: '4px 0 0 0' }}>
                Áp dụng cho tài khoản đang đăng nhập: <strong>{user?.name || 'Chủ trang trại'}</strong>
              </p>
            </div>
            {notifSaved && (
              <span className="farmshift-badge farmshift-badge-success">
                ✓ Đã lưu cài đặt thông báo!
              </span>
            )}
          </div>
          <form onSubmit={handleSaveNotifications}>
            <div className="farmshift-card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--color-hairline)' }}>
                  <div>
                    <strong style={{ color: 'var(--color-ink)', fontSize: '14px' }}>Thông báo trong ứng dụng (Push notification)</strong>
                    <p style={{ fontSize: '12px', color: 'var(--color-muted)', margin: '3px 0 0 0' }}>Hiển thị chuông thông báo góc trên màn hình khi có sự kiện mới</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifSettings.push}
                    onChange={(e) => setNotifSettings({ ...notifSettings, push: e.target.checked })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--color-hairline)' }}>
                  <div>
                    <strong style={{ color: 'var(--color-ink)', fontSize: '14px' }}>Thông báo qua Email</strong>
                    <p style={{ fontSize: '12px', color: 'var(--color-muted)', margin: '3px 0 0 0' }}>Gửi thư tổng hợp tình hình kinh doanh và báo cáo tuần</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifSettings.email}
                    onChange={(e) => setNotifSettings({ ...notifSettings, email: e.target.checked })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--color-hairline)' }}>
                  <div>
                    <strong style={{ color: 'var(--color-ink)', fontSize: '14px' }}>Thông báo tin nhắn SMS</strong>
                    <p style={{ fontSize: '12px', color: 'var(--color-muted)', margin: '3px 0 0 0' }}>Chỉ gửi khi có sự cố khẩn cấp (mất điện, đứt quạt gió)</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifSettings.sms}
                    onChange={(e) => setNotifSettings({ ...notifSettings, sms: e.target.checked })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--color-hairline)' }}>
                  <div>
                    <strong style={{ color: 'var(--color-signature-coral)', fontSize: '14px' }}>Cảnh báo môi trường / Thiết bị IoT</strong>
                    <p style={{ fontSize: '12px', color: 'var(--color-muted)', margin: '3px 0 0 0' }}>Báo động ngay lập tức khi nhiệt độ chuồng vượt ngưỡng &gt; 30°C</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifSettings.critical}
                    onChange={(e) => setNotifSettings({ ...notifSettings, critical: e.target.checked })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--color-hairline)' }}>
                  <div>
                    <strong style={{ color: 'var(--color-ink)', fontSize: '14px' }}>Nhắc lịch tiêm phòng vắc-xin & Công việc</strong>
                    <p style={{ fontSize: '12px', color: 'var(--color-muted)', margin: '3px 0 0 0' }}>Nhắc nhở ca làm trước 30 phút theo lịch nuôi chuẩn</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifSettings.tasks}
                    onChange={(e) => setNotifSettings({ ...notifSettings, tasks: e.target.checked })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
                  <div>
                    <strong style={{ color: 'var(--color-ink)', fontSize: '14px' }}>Nhắc công nợ & Đến hạn thanh toán</strong>
                    <p style={{ fontSize: '12px', color: 'var(--color-muted)', margin: '3px 0 0 0' }}>Cảnh báo các khoản nợ tiền cám hoặc tiền bán gà quá hạn 7 ngày</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifSettings.debt}
                    onChange={(e) => setNotifSettings({ ...notifSettings, debt: e.target.checked })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                  />
                </div>
              </div>
            </div>
            <div className="farmshift-card-header" style={{ justifyContent: 'flex-end', backgroundColor: 'var(--color-surface-soft)' }}>
              <button type="submit" className="farmshift-btn farmshift-btn-primary">
                <Save size={15} /> Lưu thiết lập thông báo
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Tab 6: Cài đặt dữ liệu & Sao lưu ───────────────── */}
      {activeTab === 'data_settings' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header">
            <h3 className="farmshift-card-title">Sao lưu dữ liệu & Đồng bộ tệp tin hệ thống</h3>
          </div>
          <div className="farmshift-card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              <div style={{ border: '1px solid var(--color-hairline)', borderRadius: 'var(--rounded-md)', padding: '20px' }}>
                <h4 style={{ margin: '0 0 8px', fontSize: '15px', color: 'var(--color-ink)' }}>Sao lưu dữ liệu JSON</h4>
                <p style={{ fontSize: '13px', color: 'var(--color-body)', lineHeight: 1.5, margin: '0 0 16px' }}>
                  Xuất toàn bộ dữ liệu đàn, chuồng trại, hóa đơn, tồn kho và sổ quỹ hiện tại thành tệp tin JSON an toàn.
                </p>
                <button
                  className="farmshift-btn farmshift-btn-primary"
                  onClick={handleExportJSON}
                >
                  <Download size={15} /> Tải bản sao lưu JSON
                </button>
              </div>

              <div style={{ border: '1px solid var(--color-hairline)', borderRadius: 'var(--rounded-md)', padding: '20px' }}>
                <h4 style={{ margin: '0 0 8px', fontSize: '15px', color: 'var(--color-ink)' }}>Khôi phục từ tệp tin</h4>
                <p style={{ fontSize: '13px', color: 'var(--color-body)', lineHeight: 1.5, margin: '0 0 16px' }}>
                  Chọn tệp sao lưu FarmShift (*.json) để khôi phục toàn bộ cấu hình và sổ sách chăn nuôi.
                </p>
                <button
                  className="farmshift-btn farmshift-btn-secondary"
                  onClick={() => alert('Chọn tệp sao lưu JSON từ máy tính của bạn')}
                >
                  <Upload size={15} /> Đọc bản sao lưu
                </button>
              </div>

              <div style={{ border: '1px solid var(--color-hairline)', borderRadius: 'var(--rounded-md)', padding: '20px' }}>
                <h4 style={{ margin: '0 0 8px', fontSize: '15px', color: 'var(--color-ink)' }}>Dữ liệu minh họa Miền Bính</h4>
                <p style={{ fontSize: '13px', color: 'var(--color-body)', lineHeight: 1.5, margin: '0 0 16px' }}>
                  Đặt lại toàn bộ trạng thái hệ thống về bộ dữ liệu mẫu chuẩn của Trang trại Miến Bình.
                </p>
                <button
                  className="farmshift-btn farmshift-btn-excel"
                  onClick={() => alert('Đã khôi phục dữ liệu mẫu Trang trại Miến Bình thành công!')}
                >
                  <RefreshCw size={15} /> Đặt lại dữ liệu mẫu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 7: Danh mục toàn bộ 73 màn hình hệ thống ───── */}
      {activeTab === 'screens' && (
        <div className="farmshift-card">
          <div className="farmshift-card-header">
            <div>
              <h3 className="farmshift-card-title">
                Ma trận 73 màn hình chức năng hệ thống FarmShift
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--color-muted)', margin: '4px 0 0 0' }}>
                Đầy đủ 14 nhóm chức năng theo nguyên bản thiết kế prototype FarmShift_MienBinh_Full.html
              </p>
            </div>
            <span className="farmshift-badge farmshift-badge-neutral">
              Hiển thị {filteredScreens.length} / {FARMSHIFT_SCREENS.length} màn hình
            </span>
          </div>

          {/* Filters Bar */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-hairline)', backgroundColor: 'var(--color-surface-soft)', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--color-muted)' }} />
              <input
                type="text"
                placeholder="Tìm màn hình theo tên, nhóm, từ khóa..."
                className="farmshift-form-control"
                style={{ paddingLeft: '32px' }}
                value={screenSearch}
                onChange={(e) => setScreenSearch(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: 'var(--color-muted)' }}>Nhóm:</span>
              <select
                className="farmshift-form-control"
                style={{ width: '180px' }}
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
              >
                <option value="ALL">Tất cả 14 nhóm</option>
                {allGroups.map(grp => (
                  <option key={grp} value={grp}>{grp}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: 'var(--color-muted)' }}>Vai trò:</span>
              <select
                className="farmshift-form-control"
                style={{ width: '150px' }}
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="ALL">Tất cả vai trò</option>
                <option value="owner">Chủ trại</option>
                <option value="accountant">Kế toán</option>
                <option value="worker">Công nhân</option>
              </select>
            </div>
          </div>

          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className="farmshift-table">
              <thead>
                <tr>
                  <th>STT</th>
                  <th>Nhóm chức năng</th>
                  <th>Mã ID</th>
                  <th>Tên màn hình</th>
                  <th>Ghi chú & Nhiệm vụ nghiệp vụ</th>
                  <th style={{ textAlign: 'center' }}>Chủ trại</th>
                  <th style={{ textAlign: 'center' }}>Kế toán</th>
                  <th style={{ textAlign: 'center' }}>Công nhân</th>
                  <th style={{ textAlign: 'center' }}>Mở màn</th>
                </tr>
              </thead>
              <tbody>
                {filteredScreens.map((screen, idx) => (
                  <tr key={screen.id}>
                    <td style={{ color: 'var(--color-muted)', width: '40px' }}>{idx + 1}</td>
                    <td>
                      <span className="farmshift-badge farmshift-badge-neutral">{screen.group}</span>
                    </td>
                    <td><code style={{ fontSize: '12px', color: 'var(--color-primary)' }}>{screen.id}</code></td>
                    <td><strong>{screen.title}</strong></td>
                    <td style={{ fontSize: '12px', color: 'var(--color-body)' }}>{screen.notes}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`farmshift-badge ${screen.roles.includes('owner') ? 'farmshift-badge-success' : 'farmshift-badge-neutral'}`}>
                        {screen.roles.includes('owner') ? 'Có' : '—'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`farmshift-badge ${screen.roles.includes('accountant') ? 'farmshift-badge-success' : 'farmshift-badge-neutral'}`}>
                        {screen.roles.includes('accountant') ? 'Có' : '—'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`farmshift-badge ${screen.roles.includes('worker') ? 'farmshift-badge-success' : 'farmshift-badge-neutral'}`}>
                        {screen.roles.includes('worker') ? 'Có' : '—'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="farmshift-btn farmshift-btn-primary"
                        style={{ padding: '3px 9px', fontSize: '12px' }}
                        onClick={() => navigate(screen.route)}
                        title={`Mở màn hình ${screen.title}`}
                      >
                        <ExternalLink size={12} /> Mở
                      </button>
                    </td>
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
