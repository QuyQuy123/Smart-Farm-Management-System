// src/layouts/FarmShiftLayout.jsx
// FarmShift Shell Layout aligned with DESIGN.md
import { useState, useEffect, useLayoutEffect, useRef, Fragment } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import {
    Menu, Maximize, Minimize, Bell, User, LogOut,
    LayoutDashboard, Warehouse, ClipboardList, Package,
    ArrowLeftRight, FileText, ShoppingCart,
    Users, BarChart3, Layers, Settings, Sliders, Radio,
    Utensils, HeartPulse, Thermometer, CheckSquare, X,
    CheckCircle, AlertTriangle, AlertCircle, ListChecks,
    ChevronLeft, MoreHorizontal, History
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotification, formatNotificationTime, renderNotificationContent } from '../context/NotificationContext';
import { getNotificationPreferences, registerServiceWorker } from '../services/webPushClient';
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { useViewport } from '../hooks/useViewport';
import { AIChatbot } from '../components/AIChatbot/AIChatbot';
import { GlobalSearch } from '../components/GlobalSearch/GlobalSearch';
import { getFarmInfo, saveFarmInfo } from '../data/farmshiftMockData';
import { getFarm } from '../services/farmService';
import farmLogo from '../assets/logo_Farm.png';
import '../theme/farmshift.css';
import styles from './FarmShiftLayout.module.css';

const BOILERPLATE_NOTIFICATION_STATUSES = new Set([
    'Đã hoàn tất & đồng bộ dữ liệu',
    'Hệ thống đã ghi nhận',
]);

// Pages mount their own layout; retain the menu position between those mounts.
let sidebarScrollTop = 0;

// Floating Real-time Toast Component with Bottom Progress Bar Animation
const ToastNotification = ({ activeToast, setActiveToast, setNotifOpen }) => {
    const isSuccess = activeToast.level === 'Thành công';
    const isError = activeToast.level === 'Lỗi';
    const isWarning = activeToast.level === 'Cảnh báo';

    const borderColor = isError ? '#f43f5e' : isWarning ? '#e59f3c' : '#bfe3db';
    const iconBg = isError
        ? 'linear-gradient(135deg, #ef4444, #b91c1c)'
        : isWarning
        ? 'linear-gradient(135deg, #f59e0b, #b45309)'
        : 'linear-gradient(135deg, #019788 0%, #00695c 100%)';

    const progressBg = isError
        ? 'linear-gradient(90deg, #ef4444, #f43f5e)'
        : isWarning
        ? 'linear-gradient(90deg, #f59e0b, #d97706)'
        : 'linear-gradient(90deg, #58a99a, #019788)';

    // Loại bỏ badge lặp từ "Thành công" khi type đã là "Thao tác thành công"
    const showBadge = !isSuccess && activeToast.level && activeToast.level !== activeToast.type;
    const formattedTime = formatNotificationTime(activeToast.createdAt, activeToast.time);
    const showStatus = activeToast.status && !activeToast.isSystem && !BOILERPLATE_NOTIFICATION_STATUSES.has(activeToast.status);

    return (
        <div
            className="farmshift-floating-toast"
            onClick={() => { if (!activeToast.isSystem) setNotifOpen(true); setActiveToast(null); }}
            style={{ borderColor }}
            role="alert"
        >
            <div className="farmshift-toast-icon" style={{ background: iconBg }}>
                {isError ? <AlertCircle size={18} /> :
                 isWarning ? <AlertTriangle size={18} /> :
                 isSuccess ? <CheckCircle size={18} /> :
                 <Bell size={18} />}
            </div>
            <div className="farmshift-toast-body">
                <div className="farmshift-toast-header">
                    {showBadge && (
                        <span className="farmshift-toast-badge" style={{
                            backgroundColor: isError ? '#ffe4e6' : isWarning ? '#fef3c7' : '#e6f5f3',
                            color: isError ? '#be123c' : isWarning ? '#b45309' : '#00796b'
                        }}>
                            {activeToast.level}
                        </span>
                    )}
                    <span className="farmshift-toast-type">{activeToast.type || activeToast.level || 'Thông báo'}</span>
                    <span className="farmshift-toast-time">{formattedTime}</span>
                </div>
                <div className="farmshift-toast-text">
                    {renderNotificationContent(activeToast.barn, activeToast.value, isSuccess)}
                </div>
                {showStatus && (
                    <div className="farmshift-toast-status">{activeToast.status}</div>
                )}
            </div>
            <button
                type="button"
                className="farmshift-toast-close"
                onClick={(e) => { e.stopPropagation(); setActiveToast(null); }}
                title="Đóng thông báo"
            >
                <X size={15} />
            </button>
            {/* Thanh animation đếm ngược chạy ở dưới cái form thông báo */}
            <div
                className="farmshift-toast-progress-bar"
                style={{ background: progressBg }}
            />
        </div>
    );
};

export const FarmShiftLayout = ({
    children,
    pageTitle,
    breadcrumbTitle = pageTitle,
    breadcrumbs = [],
    showShortcuts = false,
    environmentHref = '/journal?tab=env',
    feedHref = '/today-tasks',
    weightHref = '/journal?tab=weight',
    lossHref = '/journal?tab=loss',
    actions = null,
}) => {
    const { user, logout } = useAuth();
    const { alerts, unreadCount, markAsRead, markAllAsRead, clearAllAlerts, activeToast, setActiveToast, notifPrefs } = useNotification();
    const inAppEnabled = notifPrefs?.inAppEnabled !== false;
    const navigate = useNavigate();
    const location = useLocation();
    const sidebarRef = useRef(null);

    useLayoutEffect(() => {
        sidebarRef.current.scrollTop = sidebarScrollTop;
    }, []);

    useEffect(() => {
        const sidebar = sidebarRef.current;
        const activeItem = sidebar.querySelector('.farmshift-menu-item.active');
        if (!activeItem || window.innerWidth <= 768) return;

        const bounds = sidebar.getBoundingClientRect();
        const itemBounds = activeItem.getBoundingClientRect();
        const rowHeight = activeItem.closest('li').getBoundingClientRect().height;
        if (!rowHeight) return;

        // Keep three rows of context toward either edge of the visible menu.
        const targetTop = bounds.top + rowHeight * 3;
        const targetBottom = bounds.bottom - rowHeight * 3;
        let offset;
        if (itemBounds.top < targetTop) offset = itemBounds.top - targetTop;
        else if (itemBounds.bottom > targetBottom) offset = itemBounds.bottom - targetBottom;
        else return;
        const top = Math.max(0, Math.min(
            sidebar.scrollHeight - sidebar.clientHeight,
            sidebar.scrollTop + offset,
        ));
        if (top === sidebar.scrollTop) return;
        sidebar.scrollTo({
            top,
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
        });
    }, [location.key]);

    // Sidebar state persisted across route changes
    const [collapsed, setCollapsed] = useState(() => {
        try {
            return localStorage.getItem('farmshift_sidebar_collapsed') === 'true';
        } catch {
            return false;
        }
    });

    const [mobileOpenState, setMobileOpen] = useState(false);
    const [moreDrawerOpenState, setMoreDrawerOpen] = useState(false);
    const [prevPathname, setPrevPathname] = useState(location.pathname);
    const { isMobile, isTablet, isDesktop } = useViewport();
    const isDrawerViewport = !isDesktop;
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    if (prevPathname !== location.pathname) {
        setPrevPathname(location.pathname);
        if (mobileOpenState) setMobileOpen(false);
        if (moreDrawerOpenState) setMoreDrawerOpen(false);
    }

    const mobileOpen = mobileOpenState && !isDesktop;
    const moreDrawerOpen = moreDrawerOpenState && isMobile;

    useEffect(() => {
        if (!user?.email) return;
        getNotificationPreferences(user.email).catch(() => {});
        if (typeof window !== 'undefined' && window.Notification?.permission === 'granted') {
            registerServiceWorker().catch(() => {});
        }
    }, [user?.email]);

    const notifRef = useRef(null);
    const userMenuRef = useRef(null);

    useEffect(() => {
        if (!mobileOpen && !moreDrawerOpen) return undefined;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = previousOverflow; };
    }, [mobileOpen, moreDrawerOpen]);

    // Xử lý nhấp chuột ra ngoài (click outside) để tự động đóng dropdown thông báo & user menu
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (notifRef.current && !notifRef.current.contains(event.target)) {
                setNotifOpen(false);
            }
            if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
                setUserMenuOpen(false);
            }
        };

        if (notifOpen || userMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [notifOpen, userMenuOpen]);

    // Hỗ trợ phím Escape để đóng nhanh
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setNotifOpen(false);
                setUserMenuOpen(false);
                setMobileOpen(false);
                setMoreDrawerOpen(false);
            }
        };

        if (notifOpen || userMenuOpen || mobileOpen || moreDrawerOpen) {
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [notifOpen, userMenuOpen, mobileOpen, moreDrawerOpen]);

    // Cập nhật thời gian tương đối ("Vừa xong", "X phút trước") động theo thời gian thực mỗi 15s
    const [, setTick] = useState(0);
    useEffect(() => {
        if (!notifOpen && !activeToast) return;
        const interval = setInterval(() => {
            setTick(t => t + 1);
        }, 15000);
        return () => clearInterval(interval);
    }, [notifOpen, activeToast]);

    // Synchronize collapsed state across different page instances
    useEffect(() => {
        const handleSync = (e) => {
            if (typeof e.detail === 'boolean') {
                setCollapsed(e.detail);
            }
        };
        window.addEventListener('farmshift_sidebar_sync', handleSync);
        return () => window.removeEventListener('farmshift_sidebar_sync', handleSync);
    }, []);

    const toggleCollapsed = () => {
        setCollapsed((prev) => {
            const next = !prev;
            try {
                localStorage.setItem('farmshift_sidebar_collapsed', String(next));
            } catch { /* ignore storage error */ }
            window.dispatchEvent(new CustomEvent('farmshift_sidebar_sync', { detail: next }));
            return next;
        });
    };

    const [prevUser, setPrevUser] = useState(user);
    const [farmInfo, setFarmInfo] = useState(() => getFarmInfo(user));

    useEffect(() => {
        let cancelled = false;
        if (user?.email) {
            getFarm().then((farm) => {
                if (!cancelled && farm) {
                    saveFarmInfo(farm);
                    setFarmInfo(farm);
                }
            }).catch(() => { /* Keep the display fallback when the API is unavailable. */ });
        }
        return () => { cancelled = true; };
    }, [user?.email]);

    if (user !== prevUser) {
        setPrevUser(user);
        setFarmInfo(getFarmInfo(user));
    }

    useEffect(() => {
        const handleFarmUpdate = () => {
            setFarmInfo(getFarmInfo(user));
        };
        window.addEventListener('farmshift_info_updated', handleFarmUpdate);
        return () => window.removeEventListener('farmshift_info_updated', handleFarmUpdate);
    }, [user]);

    useRealtimeRefresh(
        ['/farm', '/settings'],
        () => {
            if (!user?.email) return;
            getFarm().then((farm) => {
                if (farm) {
                    saveFarmInfo(farm);
                    setFarmInfo(farm);
                }
            }).catch(() => {});
        },
        { enabled: Boolean(user?.email) }
    );

    // Area and barn pages keep the "Khu nuôi" item highlighted; their sub-navigation is a tab bar on the page.
    const inAreaPages = location.pathname.startsWith('/areas')
        || location.pathname.startsWith('/barns')
        || location.pathname.startsWith('/cycles/history');

    // "Trang trại Miền Bình" -> "MB": the last two words of the farm name, shown beside the wordmark.
    const farmInitials = (farmInfo?.name || '').trim().split(/\s+/).slice(-2)
        .map(word => word.charAt(0).toLocaleUpperCase('vi')).join('');

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => { });
            setIsFullscreen(true);
        } else {
            document.exitFullscreen().catch(() => { });
            setIsFullscreen(false);
        }
    };

    const navMenuItems = [
        { id: 'dashboard', label: 'Bảng tin', path: '/dashboard', icon: LayoutDashboard, roles: ['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT'] },
        { id: 'areas', label: 'Khu nuôi', path: '/areas', icon: Warehouse, roles: ['ROLE_FARM_OWNER', 'ROLE_FARM_WORKER'] },
        { id: 'cycle-history', label: 'Lịch sử lứa nuôi', path: '/cycles/history', icon: History, roles: ['ROLE_ACCOUNTANT'] },
        { id: 'today-tasks', label: 'Việc hôm nay', path: '/today-tasks', icon: ListChecks, roles: ['ROLE_FARM_OWNER', 'ROLE_FARM_WORKER'] },
        { id: 'journal', label: 'Ghi nhật ký', path: '/journal', icon: ClipboardList, roles: ['ROLE_FARM_OWNER', 'ROLE_FARM_WORKER'] },
        { id: 'inventory', label: 'Kho hàng hóa', path: '/inventory', icon: Package, roles: ['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT'] },
        { id: 'transfers', label: 'Xuất nhập nội bộ', path: '/transfers', icon: ArrowLeftRight, roles: ['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT', 'ROLE_FARM_WORKER'] },
        { id: 'purchases', label: 'Hóa đơn nhập hàng', path: '/purchases', icon: FileText, roles: ['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT'] },
        { id: 'sales', label: 'Quản lý bán hàng', path: '/sales', icon: ShoppingCart, roles: ['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT'] },
        { id: 'account', label: 'Tài khoản & Nhân sự', path: '/account', icon: Users, roles: ['ROLE_FARM_OWNER'] },
        { id: 'iot', label: 'Thiết bị IoT', path: '/iot', icon: Radio, roles: ['ROLE_FARM_OWNER'] },
        { id: 'reports', label: 'Báo cáo & Thống kê', path: '/reports', icon: BarChart3, roles: ['ROLE_FARM_OWNER', 'ROLE_ACCOUNTANT'] },
    ];

    const settingsMenuItems = [
        { id: 'catalog-settings', label: 'Thiết lập danh mục', path: '/catalog-settings', icon: Layers, roles: ['ROLE_FARM_OWNER'] },
        { id: 'breeding-settings', label: 'Thiết lập chăn nuôi', path: '/breeding-settings', icon: Settings, roles: ['ROLE_FARM_OWNER'] },
        { id: 'general-settings', label: 'Thiết lập chung', path: '/general-settings', icon: Sliders, roles: ['ROLE_FARM_OWNER'] },
    ];

    const userRole = user?.role || 'ROLE_FARM_OWNER';
    const visibleNavItems = navMenuItems.filter(item => !item.roles || item.roles.includes(userRole));
    const visibleSettingsItems = settingsMenuItems.filter(item => !item.roles || item.roles.includes(userRole));
    const defaultHomeRoute = userRole === 'ROLE_FARM_WORKER' ? '/today-tasks' : '/dashboard';
    // Desktop: honors user collapsed toggle; Tablet: 64px Mini Icon Rail unless overlay drawer is open
    const sidebarCollapsed = isDesktop ? collapsed : (isTablet && !mobileOpen);

    // Fix duplicate trailing breadcrumb (e.g., "Mien Binh > Kho hàng hóa > Kho hàng hóa")
    const normalizedTitle = String(breadcrumbTitle || '').trim().toLowerCase();
    const effectiveBreadcrumbs = (breadcrumbs || []).filter((bc, idx, arr) => {
        if (idx === arr.length - 1 && normalizedTitle && String(bc?.label || '').trim().toLowerCase() === normalizedTitle) {
            return false;
        }
        return true;
    });
    const mobileBackCrumb = [...effectiveBreadcrumbs].reverse().find(bc => bc?.path);

    // Strictly RBAC-filtered Mobile Bottom Nav (max 5 slots: 4 primary + "Thêm")
    const MOBILE_PRIMARY_SPEC = {
        ROLE_FARM_OWNER: [
            { id: 'dashboard', shortLabel: 'Bảng tin' },
            { id: 'areas', shortLabel: 'Khu nuôi' },
            { id: 'today-tasks', shortLabel: 'Việc hôm nay' },
            { id: 'inventory', shortLabel: 'Kho' },
        ],
        ROLE_ACCOUNTANT: [
            { id: 'dashboard', shortLabel: 'Bảng tin' },
            { id: 'inventory', shortLabel: 'Kho' },
            { id: 'purchases', shortLabel: 'Nhập hàng' },
            { id: 'sales', shortLabel: 'Bán hàng' },
        ],
        ROLE_FARM_WORKER: [
            { id: 'today-tasks', shortLabel: 'Việc hôm nay' },
            { id: 'journal', shortLabel: 'Nhật ký' },
            { id: 'areas', shortLabel: 'Khu nuôi' },
            { id: 'transfers', shortLabel: 'Nội bộ' },
        ],
    };

    const primarySpec = MOBILE_PRIMARY_SPEC[userRole] || MOBILE_PRIMARY_SPEC.ROLE_FARM_WORKER;
    const mobilePrimaryItems = primarySpec
        .map(spec => {
            const matched = visibleNavItems.find(item => item.id === spec.id);
            return matched ? { ...matched, shortLabel: spec.shortLabel } : null;
        })
        .filter(Boolean);
    const mobilePrimaryIds = new Set(mobilePrimaryItems.map(item => item.id));
    const mobileMoreItems = [
        ...visibleNavItems.filter(item => !mobilePrimaryIds.has(item.id)),
        ...visibleSettingsItems,
        {
            id: 'profile',
            label: 'Hồ sơ cá nhân',
            path: userRole === 'ROLE_FARM_OWNER' ? '/account?tab=profile' : '/profile',
            icon: User,
        },
        ...(userRole !== 'ROLE_FARM_OWNER' ? [{
            id: 'notifications',
            label: 'Thông báo & ĐT',
            path: '/notifications',
            icon: Bell,
        }] : []),
    ];

    const isItemActive = (item) => {
        const itemPathOnly = String(item.path || '').split('?')[0];
        if (item.path?.includes('?')) {
            return `${location.pathname}${location.search}` === item.path;
        }
        return (
            location.pathname === itemPathOnly
            || (itemPathOnly === '/dashboard' && location.pathname === '/')
            || (item.id === 'areas' && inAreaPages)
            || (item.id === 'transfers' && location.pathname === '/internal-stock')
        );
    };
    const isMoreActive = mobileMoreItems.some(item => isItemActive(item));

    return (
        <div className="farmshift-app">
            {/* ── Top Header (DESIGN.md Editorial Clean Bar) ─────── */}
            <header className="farmshift-header">
                <div className="farmshift-header-left">
                    {!isMobile ? (
                        <>
                            <button
                                className={`farmshift-toggle-btn ${collapsed ? 'is-collapsed' : ''}`}
                                aria-controls="farmshift-primary-navigation"
                                aria-expanded={isDrawerViewport ? mobileOpen : !collapsed}
                                title={isDrawerViewport ? (mobileOpen ? "Đóng menu điều hướng" : "Mở menu điều hướng") : collapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"}
                                aria-label={isDrawerViewport ? (mobileOpen ? "Đóng menu điều hướng" : "Mở menu điều hướng") : collapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"}
                                onClick={() => {
                                    if (isDrawerViewport) {
                                        setMobileOpen(!mobileOpen);
                                    } else {
                                        toggleCollapsed();
                                    }
                                }}
                            >
                                <Menu size={20} />
                            </button>

                            <div className="farmshift-header-brand-tag">
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#019788' }}></span>
                                <span>{farmInfo.name}</span>
                            </div>
                        </>
                    ) : (
                        <div className={styles.mobileHeaderTitleWrap}>
                            {mobileBackCrumb && (
                                <Link
                                    to={mobileBackCrumb.path}
                                    className={styles.mobileBackBtn}
                                    aria-label={`Quay lại ${mobileBackCrumb.label}`}
                                    title={`Quay lại ${mobileBackCrumb.label}`}
                                >
                                    <ChevronLeft size={20} />
                                </Link>
                            )}
                            <h1 className={styles.mobileHeaderTitle} data-testid="mobile-header-title">
                                {pageTitle || farmInfo.name}
                            </h1>
                        </div>
                    )}
                </div>

                {/* ── Center: Quick Feature Search (Omnibar) ────────── */}
                <div className="farmshift-header-center">
                    <GlobalSearch />
                </div>

                <div className="farmshift-header-right">
                    <button
                        className="farmshift-header-icon-btn farmshift-header-fullscreen-btn"
                        title="Toàn màn hình"
                        onClick={toggleFullscreen}
                    >
                        {isFullscreen ? <Minimize size={19} /> : <Maximize size={19} />}
                    </button>

                    {/* Notifications Dropdown */}
                    <div ref={notifRef} className={styles.notifWrapper}>
                        <button
                            type="button"
                            className="farmshift-header-icon-btn"
                            title="Thông báo hệ thống"
                            aria-expanded={notifOpen}
                            onClick={() => { setNotifOpen(!notifOpen); setUserMenuOpen(false); }}
                        >
                            <Bell size={19} />
                            {unreadCount > 0 && inAppEnabled && (
                                <span className="farmshift-badge-counter farmshift-badge-bounce">{unreadCount}</span>
                            )}
                        </button>

                        {notifOpen && (
                            <div className={`farmshift-notif-dropdown ${styles.notifDropdown}`}>
                                <div className={styles.notifHeader}>
                                    <div className={styles.notifTitleGroup}>
                                        <strong className={styles.notifTitle}>Thông báo & Cảnh báo</strong>
                                        {unreadCount > 0 ? (
                                            <span className={`${styles.notifCountPill} ${styles.notifCountUnread}`}>
                                                {unreadCount} mới
                                            </span>
                                        ) : alerts.length > 0 ? (
                                            <span className={`${styles.notifCountPill} ${styles.notifCountRead}`}>
                                                0 mới
                                            </span>
                                        ) : null}
                                    </div>
                                    <div className={styles.notifHeaderActions}>
                                        {unreadCount > 0 ? (
                                            <button
                                                type="button"
                                                className={styles.notifActionBtn}
                                                onClick={markAllAsRead}
                                                title="Đánh dấu tất cả đã đọc"
                                            >
                                                Đã đọc
                                            </button>
                                        ) : alerts.length > 0 ? (
                                            <span
                                                className={styles.notifActionMuted}
                                                title="Đã đọc tất cả thông báo"
                                            >
                                                Đã đọc tất cả
                                            </span>
                                        ) : null}
                                        {alerts.length > 0 && (
                                            <>
                                                <span className={styles.notifActionDivider} aria-hidden="true" />
                                                <button
                                                    type="button"
                                                    className={styles.notifActionClear}
                                                    onClick={clearAllAlerts}
                                                    title="Xóa toàn bộ lịch sử thông báo"
                                                >
                                                    Xóa tất cả
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className={styles.notifList}>
                                    {alerts.length === 0 ? (
                                        <div className={styles.notifEmpty}>
                                            <div className={styles.notifEmptyIcon}>
                                                <Bell size={18} />
                                            </div>
                                            <span>Chưa có thông báo nào</span>
                                        </div>
                                    ) : (
                                        alerts.map(al => {
                                            const isSuccess = al.level === 'Thành công' || al.type?.includes('Thành công');
                                            const isWarning = al.level === 'Cảnh báo' || al.level === 'Lỗi';
                                            const isRead = !!al.read;
                                            const formattedTime = formatNotificationTime(al.createdAt, al.time);
                                            const showDetailStatus = al.status && !BOILERPLATE_NOTIFICATION_STATUSES.has(al.status);

                                            return (
                                                <div
                                                    key={al.id}
                                                    onClick={() => {
                                                        if (!isRead && markAsRead) {
                                                            markAsRead(al.id);
                                                        }
                                                    }}
                                                    className={[
                                                        styles.notifCard,
                                                        isRead ? styles.notifCardRead : styles.notifCardUnread,
                                                        !isRead && isWarning ? styles.notifCardWarning : '',
                                                    ].filter(Boolean).join(' ')}
                                                    title={!isRead ? 'Nhấp để đánh dấu đã đọc' : undefined}
                                                >
                                                    <div
                                                        className={[
                                                            styles.notifIconWrap,
                                                            isRead ? styles.notifIconRead : isWarning ? styles.notifIconWarn : styles.notifIconMint,
                                                        ].join(' ')}
                                                    >
                                                        {isSuccess ? (
                                                            <CheckCircle size={15} />
                                                        ) : isWarning ? (
                                                            <AlertTriangle size={15} />
                                                        ) : (
                                                            <AlertCircle size={15} />
                                                        )}
                                                    </div>
                                                    <div className={styles.notifContent}>
                                                        <div className={styles.notifMetaRow}>
                                                            <span className={styles.notifTypeRow}>
                                                                {!isRead && (
                                                                    <span
                                                                        className={`${styles.notifUnreadDot} ${isWarning ? styles.notifUnreadDotWarn : ''}`}
                                                                        aria-hidden="true"
                                                                    />
                                                                )}
                                                                <span
                                                                    className={[
                                                                        styles.notifTypeText,
                                                                        isRead ? styles.notifTypeRead : isWarning ? styles.notifTypeWarn : '',
                                                                    ].filter(Boolean).join(' ')}
                                                                >
                                                                    {al.type}
                                                                </span>
                                                            </span>
                                                            <span className={styles.notifTime}>
                                                                {formattedTime}
                                                            </span>
                                                        </div>
                                                        <div className={`${styles.notifMessage} ${isRead ? styles.notifMessageRead : ''}`}>
                                                            {renderNotificationContent(al.barn, al.value, isSuccess, isRead)}
                                                        </div>
                                                        {showDetailStatus && (
                                                            <div className={`${styles.notifStatusNote} ${isRead ? styles.notifStatusNoteRead : ''}`}>
                                                                {al.status}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* User Profile Menu */}
                    <div ref={userMenuRef} style={{ position: 'relative' }}>
                        <div
                            className="farmshift-user-menu"
                            onClick={() => { setUserMenuOpen(!userMenuOpen); setNotifOpen(false); }}
                        >
                            <div className="farmshift-user-avatar" style={{ overflow: 'hidden' }}>
                                {user?.avatarUrl ? (
                                    <img
                                        src={user.avatarUrl}
                                        alt={user?.name || 'User'}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                ) : (
                                    user?.name ? user.name.charAt(0).toUpperCase() : 'A'
                                )}
                            </div>
                            <span className="farmshift-user-name" style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-ink)' }}>
                                {user?.name || farmInfo.owner}
                            </span>
                        </div>

                        {userMenuOpen && (
                            <div
                                className="farmshift-user-dropdown"
                                style={{
                                    position: 'absolute',
                                    right: 0,
                                    top: '125%',
                                    width: '240px',
                                    backgroundColor: 'var(--color-canvas)',
                                    borderRadius: 'var(--rounded-lg)',
                                    boxShadow: '0 12px 30px rgba(0,0,0,0.12)',
                                    border: '1px solid var(--color-hairline)',
                                    padding: '8px 0',
                                    zIndex: 1200
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 18px', borderBottom: '1px solid var(--color-hairline)' }}>
                                    <div className="farmshift-user-avatar" style={{ width: '38px', height: '38px', flexShrink: 0, overflow: 'hidden' }}>
                                        {user?.avatarUrl ? (
                                            <img
                                                src={user.avatarUrl}
                                                alt={user?.name || 'User'}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                        ) : (
                                            user?.name ? user.name.charAt(0).toUpperCase() : 'A'
                                        )}
                                    </div>
                                    <div style={{ overflow: 'hidden' }}>
                                        <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--color-ink)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                            {user?.name || farmInfo.owner}
                                        </div>
                                        <div style={{ fontSize: '13.5px', color: 'var(--color-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                            {user?.email || 'admin@farmshift.local'}
                                        </div>
                                    </div>
                                </div>
                                <Link
                                    to={userRole === 'ROLE_FARM_OWNER' ? '/account?tab=profile' : '/profile'}
                                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 18px', fontSize: '15px', color: 'var(--color-body)', textDecoration: 'none' }}
                                    onClick={() => setUserMenuOpen(false)}
                                >
                                    <User size={15} /> Hồ sơ cá nhân
                                </Link>
                                <Link
                                    to={userRole === 'ROLE_FARM_OWNER' ? '/general-settings?tab=notifications' : '/notifications'}
                                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 18px', fontSize: '15px', color: 'var(--color-body)', textDecoration: 'none' }}
                                    onClick={() => setUserMenuOpen(false)}
                                >
                                    <Bell size={15} /> Thông báo cá nhân &amp; ĐT
                                </Link>
                                {userRole === 'ROLE_FARM_OWNER' && (
                                    <Link
                                        to="/general-settings"
                                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 18px', fontSize: '15px', color: 'var(--color-body)', textDecoration: 'none' }}
                                        onClick={() => setUserMenuOpen(false)}
                                    >
                                        <Sliders size={15} /> Thiết lập trang trại
                                    </Link>
                                )}
                                <div style={{ height: '1px', backgroundColor: 'var(--color-hairline)', margin: '4px 0' }} />
                                <button
                                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 18px', fontSize: '15px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                                    onClick={() => {
                                        logout();
                                        navigate('/login');
                                    }}
                                >
                                    <LogOut size={15} /> Đăng xuất
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* ── Mobile Sidebar Overlay Backdrop ─────────────── */}
            {mobileOpen && (
                <div
                    className="farmshift-sidebar-backdrop"
                    onClick={() => setMobileOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* ── Secondary Sidebar ─────────────────────────────── */}
            <aside
                ref={sidebarRef}
                id="farmshift-primary-navigation"
                aria-label="Điều hướng chính"
                aria-hidden={isMobile && !mobileOpen}
                inert={isMobile && !mobileOpen}
                onScroll={event => { sidebarScrollTop = event.currentTarget.scrollTop; }}
                className={`farmshift-sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${isTablet && !mobileOpen ? 'tablet-rail' : ''} ${mobileOpen ? 'mobile-open' : ''}`}
            >
                <div className="farmshift-sidebar-header">
                    {!sidebarCollapsed ? (
                        <Link to={defaultHomeRoute} className="farmshift-wordmark" aria-label={`FarmShift - ${farmInfo.name}`}>
                            farm<span>Shift</span>{farmInitials && <small>{farmInitials}</small>}
                        </Link>
                    ) : (
                        <Link
                            to={defaultHomeRoute}
                            style={{ margin: '0 auto', display: 'flex', justifyContent: 'center', textDecoration: 'none' }}
                            title={`FarmShift - ${farmInfo.name}`}
                        >
                            <img
                                src={farmLogo}
                                alt="FarmShift"
                                style={{
                                    width: '32px',
                                    height: '32px',
                                    objectFit: 'contain'
                                }}
                            />
                        </Link>
                    )}

                    <button
                        className="farmshift-sidebar-mobile-close"
                        onClick={() => setMobileOpen(false)}
                        title="Đóng thanh điều hướng"
                        aria-label="Đóng thanh điều hướng"
                    >
                        <X size={18} />
                    </button>
                </div>

                <ul className="farmshift-menu">
                    {visibleNavItems.map(item => {
                        const Icon = item.icon;
                        const isActive = isItemActive(item);
                        return (
                            <li key={item.id}>
                                <NavLink
                                    to={item.path}
                                    className={`farmshift-menu-item ${isActive ? 'active' : ''}`}
                                    onClick={() => {
                                        if (isDrawerViewport) setMobileOpen(false);
                                    }}
                                >
                                    <span className="farmshift-menu-icon">
                                        <Icon size={19} />
                                    </span>
                                    {!sidebarCollapsed && <span className="farmshift-menu-label">{item.label}</span>}
                                    {sidebarCollapsed && (
                                        <span className="farmshift-tooltip">
                                            {item.label}
                                        </span>
                                    )}
                                </NavLink>
                            </li>
                        );
                    })}

                    {visibleSettingsItems.length > 0 && <li className="farmshift-menu-divider" />}

                    {visibleSettingsItems.map(item => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;
                        return (
                            <li key={item.id}>
                                <NavLink
                                    to={item.path}
                                    className={`farmshift-menu-item ${isActive ? 'active' : ''}`}
                                    onClick={() => {
                                        if (isDrawerViewport) setMobileOpen(false);
                                    }}
                                >
                                    <span className="farmshift-menu-icon">
                                        <Icon size={19} />
                                    </span>
                                    {!sidebarCollapsed && <span className="farmshift-menu-label">{item.label}</span>}
                                    {sidebarCollapsed && (
                                        <span className="farmshift-tooltip">
                                            {item.label}
                                        </span>
                                    )}
                                </NavLink>
                            </li>
                        );
                    })}
                </ul>
            </aside>

            {/* ── Main Content Area ─────────────────────────────── */}
            <main className={`farmshift-main ${collapsed ? 'collapsed' : ''}`}>
                {(!isMobile || actions) && (
                    <div className={`farmshift-content-header ${isMobile ? styles.mobileActionsOnlyHeader : ''}`}>
                        <div className="farmshift-header-row">
                            {!isMobile && (
                                <div>
                                    <h1 className="farmshift-page-title">
                                        {pageTitle}
                                    </h1>
                                    <div className="farmshift-breadcrumbs">
                                        <Link to={defaultHomeRoute}>{farmInfo.name}</Link>
                                        <span>›</span>
                                        {effectiveBreadcrumbs.map((bc, idx) => (
                                            <Fragment key={idx}>
                                                {bc.path ? <Link to={bc.path}>{bc.label}</Link> : <span>{bc.label}</span>}
                                                <span>›</span>
                                            </Fragment>
                                        ))}
                                        <span style={{ color: 'var(--color-ink)', fontWeight: 500 }}>{breadcrumbTitle}</span>
                                    </div>
                                </div>
                            )}

                            {actions && <div>{actions}</div>}
                        </div>
                    </div>
                )}

                {/* 4 Quick Shortcut Cards */}
                {showShortcuts && (
                    <div className="farmshift-shortcuts">
                        <Link to={feedHref} className="farmshift-shortcut-card">
                            <div className="farmshift-shortcut-icon meal">
                                <Utensils size={20} />
                            </div>
                            <div className="farmshift-shortcut-info">
                                <span className="farmshift-shortcut-title">Ghi cám</span>
                                <span className="farmshift-shortcut-sub">Quản lý khẩu phần</span>
                            </div>
                        </Link>

                        <Link to={weightHref} className="farmshift-shortcut-card">
                            <div className="farmshift-shortcut-icon health">
                                <HeartPulse size={20} />
                            </div>
                            <div className="farmshift-shortcut-info">
                                <span className="farmshift-shortcut-title">Vật nuôi</span>
                                <span className="farmshift-shortcut-sub">Cân mẫu, cân nặng TB</span>
                            </div>
                        </Link>

                        <Link to={environmentHref} className="farmshift-shortcut-card">
                            <div className="farmshift-shortcut-icon env">
                                <Thermometer size={20} />
                            </div>
                            <div className="farmshift-shortcut-info">
                                <span className="farmshift-shortcut-title">Môi trường</span>
                                <span className="farmshift-shortcut-sub">Cảm biến nhiệt độ IoT</span>
                            </div>
                        </Link>

                        <Link to={lossHref} className="farmshift-shortcut-card">
                            <div className="farmshift-shortcut-icon todo">
                                <CheckSquare size={20} />
                            </div>
                            <div className="farmshift-shortcut-info">
                                <span className="farmshift-shortcut-title">Hao hụt & Thải loại</span>
                                <span className="farmshift-shortcut-sub">Ghi nhận tỷ lệ sống</span>
                            </div>
                        </Link>
                    </div>
                )}

                {children}
            </main>

            {/* Floating Real-time Notification Banner with Countdown Animation */}
            {activeToast && inAppEnabled && (
                <ToastNotification
                    activeToast={activeToast}
                    setActiveToast={setActiveToast}
                    setNotifOpen={setNotifOpen}
                />
            )}

            {/* Mobile "Thêm" Bottom Sheet Drawer (< 768px) */}
            {isMobile && moreDrawerOpen && (
                <>
                    <div
                        className={styles.moreBackdrop}
                        onClick={() => setMoreDrawerOpen(false)}
                        aria-hidden="true"
                    />
                    <div
                        id="mobile-more-drawer"
                        className={styles.moreSheet}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Chức năng khác"
                        data-testid="mobile-more-drawer"
                    >
                        <div className={styles.moreSheetHandle} aria-hidden="true" />
                        <div className={styles.moreSheetHeader}>
                            <span className={styles.moreSheetTitle}>Chức năng khác</span>
                            <button
                                type="button"
                                className={styles.moreSheetClose}
                                onClick={() => setMoreDrawerOpen(false)}
                                aria-label="Đóng menu thêm"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className={styles.moreGrid}>
                            {mobileMoreItems.map(item => {
                                const Icon = item.icon;
                                const active = isItemActive(item);
                                return (
                                    <Link
                                        key={item.id}
                                        to={item.path}
                                        className={`${styles.moreTile} ${active ? styles.moreTileActive : ''}`}
                                        onClick={() => setMoreDrawerOpen(false)}
                                    >
                                        <span className={styles.moreTileIcon}>
                                            <Icon size={20} />
                                        </span>
                                        <span className={styles.moreTileLabel}>{item.label}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}

            {/* Mobile Bottom Navigation Bar (< 768px) */}
            {isMobile && (
                <nav
                    className={styles.bottomNav}
                    aria-label="Điều hướng di động"
                    data-testid="mobile-bottom-nav"
                >
                    {mobilePrimaryItems.map(item => {
                        const Icon = item.icon;
                        const active = isItemActive(item) && !moreDrawerOpen;
                        return (
                            <Link
                                key={item.id}
                                to={item.path}
                                className={`${styles.bottomNavItem} ${active ? styles.bottomNavItemActive : ''}`}
                                onClick={() => setMoreDrawerOpen(false)}
                            >
                                <Icon size={20} className={styles.bottomNavIcon} />
                                <span className={styles.bottomNavLabel}>{item.shortLabel || item.label}</span>
                            </Link>
                        );
                    })}
                    <button
                        type="button"
                        className={`${styles.bottomNavItem} ${moreDrawerOpen || isMoreActive ? styles.bottomNavItemActive : ''}`}
                        aria-expanded={moreDrawerOpen}
                        aria-controls="mobile-more-drawer"
                        data-testid="mobile-more-btn"
                        onClick={() => setMoreDrawerOpen(prev => !prev)}
                    >
                        <MoreHorizontal size={20} className={styles.bottomNavIcon} />
                        <span className={styles.bottomNavLabel}>Thêm</span>
                    </button>
                </nav>
            )}

            {/* Floating AI Assistant FAB (DESIGN.md Pill CTA) */}
            <AIChatbot key={user?.email || user?.role || 'anonymous'} userRole={user?.role} userScope={user?.email} />
        </div>
    );
};

// Aliases for compatibility during refactoring
export const FarmgoLayout = FarmShiftLayout;
export default FarmShiftLayout;
