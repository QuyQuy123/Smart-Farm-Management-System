// src/features/farmshift/GeneralSettingsView.jsx
// Thiết lập chung & Phân quyền trang trại chuẩn FarmShift & DESIGN.md
import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Save, BellRing, BellOff, Send, CheckCircle,
  ShieldCheck, Users, Calculator, Wrench, ArrowUpRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { FarmShiftLayout } from '../../layouts/FarmShiftLayout';
import { getFarmInfo, saveFarmInfo } from '../../data/farmshiftMockData';
import { getFarm, updateFarm } from '../../services/farmService';
import { getEmployeeSummary } from '../../services/employeeService';
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh';
import {
  DEFAULT_NOTIFICATION_PREFS,
  getNotificationPreferences,
  getPushStatus,
  isIosSafariNeedingInstall,
  isWebPushSupported,
  loadLocalNotificationPrefs,
  sendTestPushNotification,
  subscribeUserToPush,
  unsubscribeUserFromPush,
  updateNotificationPreferences,
} from '../../services/webPushClient';
import { BarnResponsibilities } from './BarnResponsibilities';
import styles from './GeneralSettingsView.module.css';

const VALID_TABS = ['info', 'barn_roles', 'roles', 'notifications'];

const RBAC_DOMAINS = [
  {
    domain: '1. Khu nuôi, Chuồng & Lứa nuôi',
    owner: { label: 'Toàn quyền', variant: 'success' },
    accountant: { label: 'Xem quy mô & đầu con', variant: 'neutral' },
    worker: { label: 'Theo khu/chuồng giao', variant: 'info' },
    guardrail: 'Chặn truy cập chuồng ngoài phạm vi (MSG51)',
  },
  {
    domain: '2. Việc hôm nay & Ghi nhật ký',
    owner: { label: 'Toàn quyền + Hoàn tác', variant: 'success' },
    accountant: { label: 'Xem đối chiếu', variant: 'neutral' },
    worker: { label: 'Ghi cám, cân mẫu, hao hụt', variant: 'success' },
    guardrail: 'Tự động trừ kho nguyên tử (MSG27) & hoàn tác 1:1',
  },
  {
    domain: '3. Kho hàng hóa & Xuất nhập nội bộ',
    owner: { label: 'Toàn quyền (Số lượng + Giá)', variant: 'success' },
    accountant: { label: 'Toàn quyền (Số lượng + Giá)', variant: 'success' },
    worker: { label: 'Chỉ xem số lượng tồn', variant: 'neutral' },
    guardrail: 'Ẩn toàn bộ đơn giá & thành tiền (null) với Công nhân',
  },
  {
    domain: '4. Hóa đơn nhập, Xuất bán & Công nợ',
    owner: { label: 'Toàn quyền', variant: 'success' },
    accountant: { label: 'Toàn quyền (Nháp OCR, Thanh toán)', variant: 'success' },
    worker: { label: 'Không có quyền', variant: 'danger' },
    guardrail: 'Chặn tuyệt đối truy cập tài chính & công nợ (MSG05 / MSG60)',
  },
  {
    domain: '5. Thiết bị IoT & Camera chuồng',
    owner: { label: 'Cấu hình ngưỡng & Điều khiển', variant: 'success' },
    accountant: { label: 'Không truy cập /iot', variant: 'danger' },
    worker: { label: 'Nhận cảnh báo đẩy theo chuồng', variant: 'neutral' },
    guardrail: 'Hysteresis 1°C, chặn sửa ngưỡng (MSG33) & đẩy VAPID',
  },
  {
    domain: '6. Báo cáo & Phân tích (8 Tab)',
    owner: { label: 'Toàn bộ 8 tab + Xuất CSV', variant: 'success' },
    accountant: { label: 'Toàn bộ 8 tab + Xuất CSV', variant: 'success' },
    worker: { label: 'Chỉ xem FCR & Tăng trọng tại chuồng', variant: 'neutral' },
    guardrail: 'Chặn /reports (MSG05); ẩn lãi/lỗ (realizedProfit), doanh thu & chi phí (wipCost)',
  },
  {
    domain: '7. Trợ lý AI, Giọng nói & OCR',
    owner: { label: 'Toàn quyền + Xác nhận 2 bước', variant: 'success' },
    accountant: { label: 'Nghiệp vụ kho/hóa đơn + OCR', variant: 'info' },
    worker: { label: 'Ghi nhật ký giọng nói', variant: 'neutral' },
    guardrail: 'AiRbacPolicy chặn 32 lệnh sửa giá/xóa/tài chính (MSG60)',
  },
];

const NOTIFICATION_TOGGLES = [
  {
    key: 'inAppEnabled',
    id: 'notif-in-app',
    title: 'Thông báo trong ứng dụng (Chuông & Toast)',
    description: 'Hiển thị chuông thông báo góc trên màn hình khi có sự kiện mới',
    highlight: false,
    hideForWorker: false,
  },
  {
    key: 'iotAlertEnabled',
    id: 'notif-iot-alert',
    title: 'Cảnh báo môi trường / Thiết bị IoT',
    description: 'Báo động ngay lập tức khi nhiệt độ chuồng vượt ngưỡng > 30°C',
    highlight: true,
    hideForWorker: false,
  },
  {
    key: 'taskVaccineReminderEnabled',
    id: 'notif-task-vaccine',
    title: 'Nhắc lịch tiêm phòng vắc-xin & Công việc',
    description: 'Nhắc nhở ca làm trước 30 phút theo lịch nuôi chuẩn',
    highlight: false,
    hideForWorker: false,
  },
  {
    key: 'debtReminderEnabled',
    id: 'notif-debt-overdue',
    title: 'Nhắc công nợ & Đến hạn thanh toán',
    description: 'Cảnh báo các khoản nợ tiền cám hoặc tiền bán gà quá hạn 7 ngày',
    highlight: false,
    hideForWorker: true,
  },
];

function badgeClassFor(variant) {
  switch (variant) {
    case 'success':
      return 'farmshift-badge-success';
    case 'danger':
      return 'farmshift-badge-danger';
    case 'info':
      return 'farmshift-badge-info';
    default:
      return 'farmshift-badge-neutral';
  }
}

export const GeneralSettingsView = () => {
  const { user } = useAuth();
  const { showToast } = useNotification();
  const location = useLocation();
  const navigate = useNavigate();

  const canEditFarm = user?.role === 'ROLE_FARM_OWNER';
  const isWorker = user?.role === 'ROLE_FARM_WORKER';
  const isStandaloneNotificationsPage = !canEditFarm && location.pathname.includes('notifications');

  // Detect tab from URL path or search query
  const getInitialTab = () => {
    if (isStandaloneNotificationsPage) return 'notifications';
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam && VALID_TABS.includes(tabParam)) return tabParam;
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
  const [savingNotif, setSavingNotif] = useState(false);
  const [notifError, setNotifError] = useState('');

  // Role summary counts (Tab 3)
  const [roleSummary, setRoleSummary] = useState(null);
  const [roleRevision, setRoleRevision] = useState(0);

  const reloadRoleSummary = useCallback(() => {
    setRoleRevision((prev) => prev + 1);
  }, []);

  useRealtimeRefresh(
    ['/employees', '/users', '/accounts'],
    reloadRoleSummary,
    { enabled: canEditFarm && !isStandaloneNotificationsPage }
  );

  useEffect(() => {
    if (!canEditFarm || isStandaloneNotificationsPage || activeTab !== 'roles') return undefined;
    let cancelled = false;
    getEmployeeSummary()
      .then((summary) => {
        if (!cancelled && summary && typeof summary === 'object' && 'ownerCount' in summary) {
          setRoleSummary(summary);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [canEditFarm, isStandaloneNotificationsPage, activeTab, roleRevision]);

  // Web Push device state (quản lý tập trung tại Tab Thông báo cá nhân & Cảnh báo)
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushDeviceCount, setPushDeviceCount] = useState(0);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushFeedback, setPushFeedback] = useState({ text: '', isError: false });
  const pushSupported = isWebPushSupported();
  const showIosInstallHint = isIosSafariNeedingInstall();

  // Notifications preference state (đồng bộ DB + cache theo user?.email)
  const [prevNotifEmail, setPrevNotifEmail] = useState(user?.email);
  const [notifSettings, setNotifSettings] = useState(() => loadLocalNotificationPrefs(user?.email));
  if (user?.email !== prevNotifEmail) {
    setPrevNotifEmail(user?.email);
    setNotifSettings(loadLocalNotificationPrefs(user?.email));
    setNotifSaved(false);
    setNotifError('');
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

    getNotificationPreferences(user?.email)
      .then((prefs) => {
        if (!cancelled && prefs) {
          setNotifSettings(prefs);
        }
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

  const handleSaveNotifications = async (e) => {
    e.preventDefault();
    if (savingNotif) return;
    setSavingNotif(true);
    setNotifSaved(false);
    setNotifError('');
    try {
      const payload = {
        ...DEFAULT_NOTIFICATION_PREFS,
        ...notifSettings,
        debtReminderEnabled: isWorker ? false : Boolean(notifSettings.debtReminderEnabled),
      };
      const saved = await updateNotificationPreferences(payload, user?.email);
      setNotifSettings(saved);
      setNotifSaved(true);
      showToast('MSG20', 'success');
    } catch (err) {
      const msg = err?.response?.data?.message || 'Không thể lưu tùy chọn thông báo. Vui lòng thử lại.';
      setNotifError(msg);
      showToast(msg, 'error');
    } finally {
      setSavingNotif(false);
    }
  };

  const roleCards = [
    {
      roleCode: 'ROLE_FARM_OWNER',
      title: 'Chủ trang trại',
      icon: ShieldCheck,
      count: roleSummary?.ownerCount,
      description: 'Quản trị toàn diện trang trại, thiết lập danh mục, chương trình nuôi, nhân sự, IoT và tài chính.',
    },
    {
      roleCode: 'ROLE_ACCOUNTANT',
      title: 'Kế toán',
      icon: Calculator,
      count: roleSummary?.accountantCount,
      description: 'Quản lý hóa đơn nhập hàng OCR, đơn xuất bán, công nợ đối tác, tồn kho và báo cáo 8 tab.',
    },
    {
      roleCode: 'ROLE_FARM_WORKER',
      title: 'Kỹ thuật viên / Công nhân',
      icon: Wrench,
      count: roleSummary?.workerCount,
      description: 'Thực hiện việc hằng ngày, ghi cám, cân mẫu và hao hụt trong các khu nuôi & chuồng được giao.',
    },
  ];

  const visibleToggles = NOTIFICATION_TOGGLES.filter((item) => !item.hideForWorker || !isWorker);

  return (
    <FarmShiftLayout
      pageTitle={isStandaloneNotificationsPage ? 'Thông báo cá nhân & Cảnh báo' : 'Thiết lập chung'}
      breadcrumbs={[{ label: isStandaloneNotificationsPage ? 'Thông báo cá nhân & Cảnh báo' : 'Thiết lập chung' }]}
    >
      {/* ── Tabs Navigation (4 General Settings Tabs) ── */}
      {!isStandaloneNotificationsPage && (
        <div className="farmshift-tabs">
          <button
            className={`farmshift-tab-btn ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            Thông tin cơ sở &amp; Trang trại
          </button>
          <button
            className={`farmshift-tab-btn ${activeTab === 'barn_roles' ? 'active' : ''}`}
            onClick={() => setActiveTab('barn_roles')}
          >
            Vai trò khu nuôi
          </button>
          <button
            className={`farmshift-tab-btn ${activeTab === 'roles' ? 'active' : ''}`}
            onClick={() => setActiveTab('roles')}
          >
            Phân vai trò chung
          </button>
          <button
            className={`farmshift-tab-btn ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveTab('notifications')}
          >
            Thông báo cá nhân &amp; Cảnh báo
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
                <CheckCircle size={14} aria-hidden="true" /> Đã lưu thành công!
              </span>
            )}
          </div>
          <form onSubmit={handleSaveFarmInfo} onChange={() => setSavedSuccess(false)}>
            {isLoadingFarm && <p role="status" style={{ margin: '12px 20px 0' }}>Đang tải thông tin trang trại...</p>}
            {farmError && <p role="alert" style={{ margin: '12px 20px 0', color: '#be123c' }}>{farmError}</p>}
            {!canEditFarm && (
              <p className={styles.rbacNotice}>
                <ShieldCheck size={16} aria-hidden="true" />
                Chỉ Chủ trang trại mới có quyền thay đổi thông tin pháp lý của cơ sở.
              </p>
            )}
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

      {/* ── Tab 2: Phân vai trò trong khu nuôi ──────────────── */}
      {activeTab === 'barn_roles' && <BarnResponsibilities canEdit={canEditFarm} />}

      {/* ── Tab 3: Phân vai trò chung ─────────────────────── */}
      {activeTab === 'roles' && (
        <div className={`farmshift-card ${styles.roleSection}`}>
          <div className="farmshift-card-header">
            <div>
              <h3 className="farmshift-card-title">Phân quyền chức năng theo vị trí công việc (RBAC)</h3>
              <p style={{ fontSize: '13.5px', color: 'var(--color-muted)', margin: '4px 0 0 0' }}>
                Ma trận kiểm soát truy cập 7 phân hệ nghiệp vụ áp dụng đồng bộ trên API, giao diện và Trợ lý AI.
              </p>
            </div>
            {canEditFarm && (
              <div className={styles.roleHeaderActions}>
                <button
                  type="button"
                  className="farmshift-btn farmshift-btn-primary"
                  onClick={() => navigate('/account')}
                >
                  <Users size={15} aria-hidden="true" />
                  <span>Quản lý Tài khoản &amp; Nhân sự</span>
                  <ArrowUpRight size={14} aria-hidden="true" />
                </button>
              </div>
            )}
          </div>

          <div className={styles.roleSummaryGrid}>
            {roleCards.map((card) => {
              const Icon = card.icon;
              return (
                <article key={card.roleCode} className={styles.roleCard}>
                  <div className={styles.roleCardTop}>
                    <span className={styles.roleCardTitleWrap}>
                      <span className={styles.roleIconBadge}>
                        <Icon size={16} aria-hidden="true" />
                      </span>
                      <span>{card.title}</span>
                    </span>
                    <span className={styles.roleCountPill}>
                      {typeof card.count === 'number' ? `${card.count} tài khoản` : '— tài khoản'}
                    </span>
                  </div>
                  <code className={styles.roleCode}>{card.roleCode}</code>
                  <p className={styles.roleDesc}>{card.description}</p>
                </article>
              );
            })}
          </div>

          <div className="farmshift-table-container" style={{ border: 'none' }}>
            <table className={`farmshift-table ${styles.permissionTable}`}>
              <thead>
                <tr>
                  <th>Phân hệ nghiệp vụ</th>
                  <th>Chủ trang trại (OWNER)</th>
                  <th>Kế toán (ACCOUNTANT)</th>
                  <th>Công nhân (WORKER)</th>
                  <th>Quy tắc bảo mật thực thi (Guardrail)</th>
                </tr>
              </thead>
              <tbody>
                {RBAC_DOMAINS.map((row) => (
                  <tr key={row.domain}>
                    <td data-label="Phân hệ nghiệp vụ"><strong>{row.domain}</strong></td>
                    <td data-label="Chủ trang trại (OWNER)">
                      <span className={`farmshift-badge ${badgeClassFor(row.owner.variant)}`}>
                        {row.owner.label}
                      </span>
                    </td>
                    <td data-label="Kế toán (ACCOUNTANT)">
                      <span className={`farmshift-badge ${badgeClassFor(row.accountant.variant)}`}>
                        {row.accountant.label}
                      </span>
                    </td>
                    <td data-label="Công nhân (WORKER)">
                      <span className={`farmshift-badge ${badgeClassFor(row.worker.variant)}`}>
                        {row.worker.label}
                      </span>
                    </td>
                    <td data-label="Quy tắc bảo mật thực thi" className={styles.guardrailText}>{row.guardrail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab 4: Thông báo cá nhân & Cảnh báo ─────────────── */}
      {activeTab === 'notifications' && (
        <div className="farmshift-card" style={{ maxWidth: '800px' }}>
          <div className="farmshift-card-header">
            <div>
              <h3 className="farmshift-card-title">Cấu hình kênh &amp; Loại thông báo hệ thống</h3>
              <p style={{ fontSize: '13.5px', color: 'var(--color-muted)', margin: '4px 0 0 0' }}>
                Áp dụng cho tài khoản đang đăng nhập: <strong>{user?.name || 'Chủ trang trại'}</strong>
              </p>
            </div>
            {notifSaved && (
              <span className="farmshift-badge farmshift-badge-success">
                <CheckCircle size={14} aria-hidden="true" /> Đã lưu cài đặt thông báo!
              </span>
            )}
          </div>
          <form onSubmit={handleSaveNotifications} onChange={() => { setNotifSaved(false); setNotifError(''); }}>
            <div className="farmshift-card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Khu vực quản lý Thông báo đẩy Web Push (VAPID) cho Điện thoại & Trình duyệt */}
                <div className={styles.webPushCard}>
                  <div className={styles.webPushTop}>
                    <div className={styles.webPushInfo}>
                      <div className={styles.webPushHeading}>
                        <span className={styles.webPushIcon}>
                          <BellRing size={18} aria-hidden="true" />
                        </span>
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
                    <div className={styles.webPushActions}>
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
                      Trên iPhone / iPad: bấm <strong>Chia sẻ &rarr; Thêm vào MH chính</strong> để bật nhận thông báo đẩy nền.
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

                {notifError && <p role="alert" className={styles.notifErrorAlert}>{notifError}</p>}

                {visibleToggles.map((toggle, idx) => {
                  const isLast = idx === visibleToggles.length - 1;
                  return (
                    <div
                      key={toggle.key}
                      className={`${styles.toggleRow} ${isLast ? styles.toggleRowLast : ''}`}
                    >
                      <label htmlFor={toggle.id} className={styles.toggleLabel}>
                        <strong
                          style={{
                            color: toggle.highlight ? 'var(--color-signature-coral)' : 'var(--color-ink)',
                            fontSize: '15px',
                          }}
                        >
                          {toggle.title}
                        </strong>
                        <p style={{ fontSize: '13.5px', color: 'var(--color-muted)', margin: '3px 0 0 0' }}>
                          {toggle.description}
                        </p>
                      </label>
                      <input
                        id={toggle.id}
                        type="checkbox"
                        checked={Boolean(notifSettings[toggle.key])}
                        disabled={savingNotif}
                        onChange={(e) => setNotifSettings((prev) => ({
                          ...prev,
                          [toggle.key]: e.target.checked,
                        }))}
                        className={styles.toggleCheckbox}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="farmshift-card-header" style={{ justifyContent: 'flex-end', backgroundColor: 'var(--color-surface-soft)' }}>
              <button type="submit" className="farmshift-btn farmshift-btn-primary" disabled={savingNotif} aria-busy={savingNotif}>
                <Save size={15} /> {savingNotif ? 'Đang lưu...' : 'Lưu thiết lập thông báo'}
              </button>
            </div>
          </form>
        </div>
      )}
    </FarmShiftLayout>
  );
};
