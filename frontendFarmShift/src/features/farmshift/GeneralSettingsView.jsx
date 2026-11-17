// src/features/farmshift/GeneralSettingsView.jsx
// Thiết lập chung & Phân quyền trang trại chuẩn FarmShift & DESIGN.md
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Sliders, Shield, Building, Save, CheckCircle, Database, Upload,
  RefreshCw, Warehouse, Users, Bell, BellRing, BellOff, Smartphone, Send,
  ExternalLink, Download, Search, Check, Filter
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';
import { INITIAL_FARMSHIFT_DATA, getFarmInfo, saveFarmInfo } from '../../data/farmshiftMockData';
import { FARMSHIFT_SCREENS } from '../../data/screensMatrix';
import { getFarm, updateFarm } from '../../services/farmService';
import {
  getPushStatus,
  isIosSafariNeedingInstall,
  isWebPushSupported,
  sendTestPushNotification,
  subscribeUserToPush,
  unsubscribeUserFromPush,
} from '../../services/webPushClient';
import { BarnResponsibilities } from './BarnResponsibilities';
import { WarehouseResponsibilities } from './WarehouseResponsibilities';

const DEFAULT_NOTIF_SETTINGS = {
  push: true,
  email: false,
  sms: false,
  critical: true,
  tasks: true,
  debt: true,
};

const loadNotifSettings = (email) => {
  try {
    const key = `farmshift_notif_prefs:${email || 'default'}`;
    const raw = localStorage.getItem(key);
    if (!raw) return DEFAULT_NOTIF_SETTINGS;
    return { ...DEFAULT_NOTIF_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_NOTIF_SETTINGS;
  }
};

export const GeneralSettingsView = () => {
  const { user } = useAuth();
  const { showToast } = useNotification();
  const location = useLocation();
  const navigate = useNavigate();

  const canEditFarm = user?.role === 'ROLE_FARM_OWNER';
  const isStandaloneNotificationsPage = !canEditFarm && location.pathname.includes('notifications');

  // Detect tab from URL path or search query
  const getInitialTab = () => {
    if (isStandaloneNotificationsPage) return 'notifications';
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam) return tabParam;
    if (location.pathname.includes('screens')) return 'screens';
    if (location.pathname.includes('notifications')) return 'notifications';
    return 'info';
  };

  const [farmInfo, setFarmInfo] = useState(() => getFarmInfo(user));
  const [isLoadingFarm, setIsLoadingFarm] = useState(() => !isStandaloneNotificationsPage);
  const [isSavingFarm, setIsSavingFarm] = useState(false);
  const [farmError, setFarmError] = useState('');

  useEffect(() => {
    if (isStandaloneNotificationsPage) return undefined;
    let cancelled = false;
    getFarm().then((farm) => {
      if (cancelled) return;
      if (farm) {
        setFarmInfo(farm);
        saveFarmInfo(farm);
      }
    }).catch(() => {
      if (!cancelled) setFarmError('Không tải được thông tin trang trại. Vui lòng tải lại trang để thử lại.');
    }).finally(() => {
      if (!cancelled) setIsLoadingFarm(false);
    });
    return () => { cancelled = true; };
  }, [isStandaloneNotificationsPage]);
  const [activeTab, setActiveTab] = useState(getInitialTab);
  const locKey = `${location.pathname}${location.search}`;
  const [prevLocKey, setPrevLocKey] = useState(locKey);
  if (locKey !== prevLocKey) {
    setPrevLocKey(locKey);
    setActiveTab(getInitialTab());
  }

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [notifSaved, setNotifSaved] = useState(false);

  // Web Push device state (quản lý tập trung tại Tab Thông báo cá nhân & Cảnh báo)
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushDeviceCount, setPushDeviceCount] = useState(0);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushFeedback, setPushFeedback] = useState({ text: '', isError: false });
  const pushSupported = isWebPushSupported();
  const showIosInstallHint = isIosSafariNeedingInstall();

  // Notifications preference state (đồng bộ theo user?.email)
  const [prevNotifEmail, setPrevNotifEmail] = useState(user?.email);
  const [notifSettings, setNotifSettings] = useState(() => loadNotifSettings(user?.email));
  if (user?.email !== prevNotifEmail) {
    setPrevNotifEmail(user?.email);
    setNotifSettings(loadNotifSettings(user?.email));
    setNotifSaved(false);
  }

  useEffect(() => {
    if (activeTab !== 'notifications') return undefined;
    let cancelled = false;
    getPushStatus()
      .then((status) => {
        if (cancelled || !status) return;
        setPushSubscribed(Boolean(status.localSubscribed));
        setPushDeviceCount(Number(status.deviceCount || 0));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [activeTab, user?.email]);

  const handleToggleWebPush = async () => {
    setPushBusy(true);
    setPushFeedback({ text: '', isError: false });
    try {
      if (pushSubscribed) {
        await unsubscribeUserFromPush();
        setPushSubscribed(false);
        setPushDeviceCount((c) => Math.max(0, c - 1));
        const msg = 'Đã tắt thông báo đẩy trên thiết bị này.';
        setPushFeedback({ text: msg, isError: false });
        showToast(msg, 'info');
      } else {
        await subscribeUserToPush();
        setPushSubscribed(true);
        setPushDeviceCount((c) => Math.max(1, c + 1));
        const msg = 'Đã bật thông báo đẩy về điện thoại thành công.';
        setPushFeedback({ text: msg, isError: false });
        showToast(msg, 'success');
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Không thể cập nhật cài đặt thông báo đẩy.';
      setPushFeedback({ text: msg, isError: true });
      showToast(msg, 'warning');
    } finally {
      setPushBusy(false);
    }
  };

  const handleSendTestPush = async () => {
    setPushBusy(true);
    setPushFeedback({ text: '', isError: false });
    try {
      const res = await sendTestPushNotification();
      const ok = Number(res?.sentCount || 0) > 0;
      const msg = res?.message || (ok
        ? 'Đã gửi thông báo thử nghiệm tới thiết bị của bạn.'
        : 'Tài khoản chưa đăng ký thiết bị nhận thông báo.');
      setPushFeedback({ text: msg, isError: !ok });
      showToast(msg, ok ? 'success' : 'warning');
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Không thể gửi thông báo thử nghiệm.';
      setPushFeedback({ text: msg, isError: true });
      showToast(msg, 'error');
    } finally {
      setPushBusy(false);
    }
  };

  // Screen matrix search & filter states
  const [screenSearch, setScreenSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');

  const handleSaveFarmInfo = async (e) => {
    e.preventDefault();
    if (!canEditFarm || isLoadingFarm || isSavingFarm || farmError) return;
    if (![farmInfo.name, farmInfo.owner, farmInfo.phone].every(value => value?.trim())) {
      showToast('Vui lòng nhập tên cơ sở, người đại diện và số điện thoại.', 'error');
      return;
    }
    setIsSavingFarm(true);
    setSavedSuccess(false);
    try {
      const saved = await updateFarm(farmInfo);
      setFarmInfo(saved);
      saveFarmInfo(saved);
      setSavedSuccess(true);
      showToast('Đã lưu thông tin cơ sở trang trại thành công!', 'success');
    } catch (error) {
      const details = error.response?.data?.data;
      showToast(details && typeof details === 'object'
        ? Object.values(details).join('. ')
        : error.response?.data?.message || 'Không lưu được thông tin trang trại. Vui lòng thử lại.', 'error');
    } finally {
      setIsSavingFarm(false);
    }
  };

  const handleSaveNotifications = (e) => {
    e.preventDefault();
    try {
      const key = `farmshift_notif_prefs:${user?.email || 'default'}`;
      localStorage.setItem(key, JSON.stringify(notifSettings));
    } catch { /* ignore storage errors */ }
    setNotifSaved(true);
    showToast('Đã lưu cài đặt thông báo trang trại thành công!', 'success');
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
      pageTitle={isStandaloneNotificationsPage ? 'Thông báo cá nhân & Cảnh báo' : 'Thiết lập chung'}
      breadcrumbs={[{ label: isStandaloneNotificationsPage ? 'Thông báo cá nhân & Cảnh báo' : 'Thiết lập chung' }]}
    >
      {/* ── Tabs Navigation (All 7 General Settings Views) ── */}
      {!isStandaloneNotificationsPage && (
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
          Vai trò khu nuôi
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
      )}

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
          <form onSubmit={handleSaveFarmInfo} onChange={() => setSavedSuccess(false)}>
            {isLoadingFarm && <p role="status">Đang tải thông tin trang trại...</p>}
            {farmError && <p role="alert">{farmError}</p>}
            {!canEditFarm && <p>Chỉ chủ trang trại có quyền cập nhật thông tin này.</p>}
            <fieldset disabled={isLoadingFarm || isSavingFarm || !canEditFarm || !!farmError} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <div className="farmshift-card-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Tên cơ sở / Hộ kinh doanh *</label>
                  <input
                    type="text"
                    required
                    className="farmshift-form-control"
                    value={farmInfo.name}
                    maxLength={200}
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
                    maxLength={100}
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
                    maxLength={20}
                    inputMode="tel"
                    onChange={(e) => setFarmInfo({ ...farmInfo, phone: e.target.value })}
                  />
                </div>
                <div className="farmshift-form-group">
                  <label className="farmshift-form-label">Quy mô chăn nuôi</label>
                  <input
                    type="text"
                    className="farmshift-form-control"
                    value={farmInfo.scale}
                    maxLength={100}
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
                  maxLength={500}
                  onChange={(e) => setFarmInfo({ ...farmInfo, address: e.target.value })}
                />
              </div>

              <div className="farmshift-form-group">
                <label className="farmshift-form-label">Mô hình sản xuất chính</label>
                <input
                  type="text"
                  className="farmshift-form-control"
                  value={farmInfo.type}
                  maxLength={200}
                  onChange={(e) => setFarmInfo({ ...farmInfo, type: e.target.value })}
                />
              </div>
            </div>
            <div className="farmshift-card-header" style={{ justifyContent: 'flex-end', backgroundColor: 'var(--color-surface-soft)' }}>
              <button type="submit" className="farmshift-btn farmshift-btn-mint" aria-busy={isSavingFarm}>
                <Save size={15} /> {isSavingFarm ? 'Đang lưu...' : 'Cập nhật thông tin'}
              </button>
            </div>
            </fieldset>
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
                </tr>
                <tr>
                  <td><strong style={{ color: 'var(--color-link)' }}>Kế toán</strong></td>
                  <td><span className="farmshift-badge farmshift-badge-neutral">Xem số lượng</span></td>
                  <td><span className="farmshift-badge farmshift-badge-success">Nhập/Xuất/Tồn</span></td>
                  <td><span className="farmshift-badge farmshift-badge-success">Toàn quyền</span></td>
                  <td><span className="farmshift-badge farmshift-badge-success">Tài chính</span></td>
                </tr>
                <tr>
                  <td><strong style={{ color: 'var(--color-ink)' }}>Kỹ thuật viên / Công nhân</strong></td>
                  <td><span className="farmshift-badge farmshift-badge-success">Ghi nhật ký</span></td>
                  <td><span className="farmshift-badge farmshift-badge-neutral">Xem tồn cám</span></td>
                  <td><span className="farmshift-badge farmshift-badge-danger">Không</span></td>
                  <td><span className="farmshift-badge farmshift-badge-neutral">Xem tăng trọng</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 3: Phân vai trò trong khu nuôi ──────────────── */}
      {activeTab === 'barn_roles' && <BarnResponsibilities canEdit={canEditFarm} />}

      {/* ── Tab 4: Phân vai trò trong kho hàng ──────────────── */}
      {activeTab === 'warehouse_roles' && <WarehouseResponsibilities canEdit={canEditFarm} />}

      {/* ── Tab 5: Thông báo cá nhân & Cảnh báo ─────────────── */}
      {activeTab === 'notifications' && (
        <div className="farmshift-card" style={{ maxWidth: '800px' }}>
          <div className="farmshift-card-header">
            <div>
              <h3 className="farmshift-card-title">Cấu hình kênh & Loại thông báo hệ thống</h3>
              <p style={{ fontSize: '13.5px', color: 'var(--color-muted)', margin: '4px 0 0 0' }}>
                Áp dụng cho tài khoản đang đăng nhập: <strong>{user?.name || 'Chủ trang trại'}</strong>
              </p>
            </div>
            {notifSaved && (
              <span className="farmshift-badge farmshift-badge-success">
                ✓ Đã lưu cài đặt thông báo!
              </span>
            )}
          </div>
          <form onSubmit={handleSaveNotifications} onChange={() => setNotifSaved(false)}>
            <div className="farmshift-card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Khu vực quản lý Thông báo đẩy Web Push (VAPID) cho Điện thoại & Trình duyệt */}
                <div
                  style={{
                    padding: '16px 18px',
                    borderRadius: 'var(--rounded-md)',
                    border: '1px solid #cce6df',
                    backgroundColor: '#f2faf7',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 280px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <Smartphone size={17} style={{ color: '#0f766e' }} />
                        <strong style={{ color: 'var(--color-ink)', fontSize: '15px' }}>
                          Thông báo đẩy về Điện thoại &amp; Trình duyệt (Web Push)
                        </strong>
                        <span className={`farmshift-badge ${pushSubscribed ? 'farmshift-badge-success' : 'farmshift-badge-neutral'}`}>
                          {pushSubscribed
                            ? (pushDeviceCount > 0 ? `Đang bật · ${pushDeviceCount} thiết bị` : 'Đang bật trên thiết bị này')
                            : (pushDeviceCount > 0 ? `Chưa bật trên máy này · ${pushDeviceCount} thiết bị khác` : 'Chưa bật trên thiết bị này')}
                        </span>
                      </div>
                      <p style={{ fontSize: '13.5px', color: 'var(--color-muted)', margin: '4px 0 0 0' }}>
                        Nhận cảnh báo nhiệt độ IoT, nhắc việc và sự cố khẩn cấp ngay cả khi đã đóng trình duyệt hoặc tắt màn hình điện thoại.
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className={`farmshift-btn ${pushSubscribed ? 'farmshift-btn-secondary' : 'farmshift-btn-primary'}`}
                        onClick={handleToggleWebPush}
                        disabled={pushBusy || (!pushSubscribed && !pushSupported)}
                        title={pushSubscribed ? 'Bấm để tắt thông báo đẩy trên thiết bị này' : 'Bật nhận thông báo đẩy khi đóng trình duyệt'}
                      >
                        {pushSubscribed ? <BellOff size={15} /> : <BellRing size={15} />}
                        <span>{pushSubscribed ? 'Đang bật thông báo ĐT' : 'Bật thông báo ĐT'}</span>
                      </button>
                      <button
                        type="button"
                        className="farmshift-btn farmshift-btn-secondary"
                        onClick={handleSendTestPush}
                        disabled={pushBusy}
                        title="Gửi thông báo đẩy thử nghiệm tới các thiết bị đã đăng ký"
                      >
                        <Send size={14} />
                        <span>Gửi thử</span>
                      </button>
                    </div>
                  </div>

                  {showIosInstallHint && (
                    <p style={{ fontSize: '12.5px', color: '#0f5c55', margin: 0 }}>
                      Trên iPhone / iPad: bấm <strong>Chia sẻ → Thêm vào MH chính</strong> để bật nhận thông báo đẩy nền.
                    </p>
                  )}
                  {!pushSupported && !showIosInstallHint && (
                    <p style={{ fontSize: '12.5px', color: 'var(--color-muted)', margin: 0 }}>
                      Trình duyệt hiện tại chưa hỗ trợ Web Push nền (cần HTTPS hoặc Chrome/Edge/Safari PWA).
                    </p>
                  )}
                  {pushFeedback.text && (
                    <p
                      role={pushFeedback.isError ? 'alert' : 'status'}
                      style={{
                        fontSize: '13px',
                        margin: 0,
                        color: pushFeedback.isError ? '#e11d48' : '#0f766e',
                        fontWeight: 500,
                      }}
                    >
                      {pushFeedback.text}
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--color-hairline)' }}>
                  <div>
                    <strong style={{ color: 'var(--color-ink)', fontSize: '15px' }}>Thông báo trong ứng dụng (Chuông &amp; Toast)</strong>
                    <p style={{ fontSize: '13.5px', color: 'var(--color-muted)', margin: '3px 0 0 0' }}>Hiển thị chuông thông báo góc trên màn hình khi có sự kiện mới</p>
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
                    <strong style={{ color: 'var(--color-ink)', fontSize: '15px' }}>Thông báo qua Email</strong>
                    <p style={{ fontSize: '13.5px', color: 'var(--color-muted)', margin: '3px 0 0 0' }}>Gửi thư tổng hợp tình hình kinh doanh và báo cáo tuần</p>
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
                    <strong style={{ color: 'var(--color-ink)', fontSize: '15px' }}>Thông báo tin nhắn SMS</strong>
                    <p style={{ fontSize: '13.5px', color: 'var(--color-muted)', margin: '3px 0 0 0' }}>Chỉ gửi khi có sự cố khẩn cấp (mất điện, đứt quạt gió)</p>
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
                    <strong style={{ color: 'var(--color-signature-coral)', fontSize: '15px' }}>Cảnh báo môi trường / Thiết bị IoT</strong>
                    <p style={{ fontSize: '13.5px', color: 'var(--color-muted)', margin: '3px 0 0 0' }}>Báo động ngay lập tức khi nhiệt độ chuồng vượt ngưỡng &gt; 30°C</p>
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
                    <strong style={{ color: 'var(--color-ink)', fontSize: '15px' }}>Nhắc lịch tiêm phòng vắc-xin & Công việc</strong>
                    <p style={{ fontSize: '13.5px', color: 'var(--color-muted)', margin: '3px 0 0 0' }}>Nhắc nhở ca làm trước 30 phút theo lịch nuôi chuẩn</p>
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
                    <strong style={{ color: 'var(--color-ink)', fontSize: '15px' }}>Nhắc công nợ & Đến hạn thanh toán</strong>
                    <p style={{ fontSize: '13.5px', color: 'var(--color-muted)', margin: '3px 0 0 0' }}>Cảnh báo các khoản nợ tiền cám hoặc tiền bán gà quá hạn 7 ngày</p>
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
                <p style={{ fontSize: '14.5px', color: 'var(--color-body)', lineHeight: 1.5, margin: '0 0 16px' }}>
                  Xuất toàn bộ dữ liệu đàn, chuồng trại, hóa đơn và tồn kho hiện tại thành tệp tin JSON an toàn.
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
                <p style={{ fontSize: '14.5px', color: 'var(--color-body)', lineHeight: 1.5, margin: '0 0 16px' }}>
                  Chọn tệp sao lưu FarmShift (*.json) để khôi phục toàn bộ cấu hình và sổ sách chăn nuôi.
                </p>
                <button
                  className="farmshift-btn farmshift-btn-secondary"
                  onClick={() => showToast('Đã sẵn sàng kết nối và tiếp nhận tệp sao lưu JSON!', 'info')}
                >
                  <Upload size={15} /> Đọc bản sao lưu
                </button>
              </div>

              <div style={{ border: '1px solid var(--color-hairline)', borderRadius: 'var(--rounded-md)', padding: '20px' }}>
                <h4 style={{ margin: '0 0 8px', fontSize: '15px', color: 'var(--color-ink)' }}>Dữ liệu minh họa Miền Bính</h4>
                <p style={{ fontSize: '14.5px', color: 'var(--color-body)', lineHeight: 1.5, margin: '0 0 16px' }}>
                  Đặt lại toàn bộ trạng thái hệ thống về bộ dữ liệu mẫu chuẩn của Trang trại Miền Bính.
                </p>
                <button
                  className="farmshift-btn farmshift-btn-excel"
                  onClick={() => showToast('Đã khôi phục dữ liệu mẫu Trang trại Miền Bính thành công!', 'success')}
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
              <p style={{ fontSize: '13.5px', color: 'var(--color-muted)', margin: '4px 0 0 0' }}>
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
              <span style={{ fontSize: '14.5px', color: 'var(--color-muted)' }}>Nhóm:</span>
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
              <span style={{ fontSize: '14.5px', color: 'var(--color-muted)' }}>Vai trò:</span>
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
                    <td><code style={{ fontSize: '13.5px', color: 'var(--color-primary)' }}>{screen.id}</code></td>
                    <td><strong>{screen.title}</strong></td>
                    <td style={{ fontSize: '13.5px', color: 'var(--color-body)' }}>{screen.notes}</td>
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
                        style={{ padding: '3px 9px', fontSize: '13.5px' }}
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
