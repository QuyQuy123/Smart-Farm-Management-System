// src/layouts/FarmShiftLayout.jsx
// FarmShift Shell Layout aligned with DESIGN.md
import { useState, useEffect, useRef, Fragment } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import {
    Menu, Maximize, Minimize, Bell, User, LogOut,
    LayoutDashboard, Warehouse, ClipboardList, Package,
    ArrowLeftRight, FileText, ShoppingCart, DollarSign,
    Users, BarChart3, Layers, Settings, Sliders,
    Utensils, HeartPulse, Thermometer, CheckSquare, X,
    CheckCircle, AlertTriangle, AlertCircle, ListChecks
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotification, formatNotificationTime, renderNotificationContent } from '../context/NotificationContext';
import { AIChatbot } from '../components/AIChatbot/AIChatbot';
import { GlobalSearch } from '../components/GlobalSearch/GlobalSearch';
import { getFarmInfo, saveFarmInfo } from '../data/farmshiftMockData';
import { getFarm } from '../services/farmService';
import farmLogo from '../assets/logo_Farm.png';
import '../theme/farmshift.css';

// Floating Real-time Toast Component with Bottom Progress Bar Animation
const ToastNotification = ({ activeToast, setActiveToast, setNotifOpen }) => {
    const isSuccess = activeToast.level === 'Thành công';
    const isError = activeToast.level === 'Lỗi';
    const isWarning = activeToast.level === 'Cảnh báo';

    const borderColor = isError ? '#f43f5e' : isWarning ? '#f59e0b' : '#10b981';
    const iconBg = isError
        ? 'linear-gradient(135deg, #ef4444, #991b1b)'
        : isWarning
        ? 'linear-gradient(135deg, #f59e0b, #b45309)'
        : isSuccess
        ? 'linear-gradient(135deg, #10b981, #047857)'
        : 'linear-gradient(135deg, #019788 0%, #004d40 100%)';

    const progressBg = isError
        ? 'linear-gradient(90deg, #ef4444, #f43f5e)'
        : isWarning
        ? 'linear-gradient(90deg, #f59e0b, #d97706)'
        : isSuccess
        ? 'linear-gradient(90deg, #10b981, #059669)'
        : 'linear-gradient(90deg, #019788, #004d40)';

    // Loại bỏ badge lặp từ "Thành công" khi type đã là "Thao tác thành công"
    const showBadge = !isSuccess && activeToast.level && activeToast.level !== activeToast.type;
    const formattedTime = formatNotificationTime(activeToast.createdAt, activeToast.time);

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
                            backgroundColor: isError ? '#ffe4e6' : isWarning ? '#fef3c7' : '#e0f2f1',
                            color: isError ? '#be123c' : isWarning ? '#b45309' : '#004d40'
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
                {activeToast.status && !activeToast.isSystem && (
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
    actions = null,
}) => {
    const { user, logout } = useAuth();
    const { alerts, unreadCount, markAsRead, markAllAsRead, clearAllAlerts, activeToast, setActiveToast } = useNotification();
    const navigate = useNavigate();
    const location = useLocation();

    // Sidebar state persisted across route changes
    const [collapsed, setCollapsed] = useState(() => {
        try {
            return localStorage.getItem('farmshift_sidebar_collapsed') === 'true';
        } catch {
            return false;
        }
    });

    const [mobileOpen, setMobileOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const notifRef = useRef(null);
    const userMenuRef = useRef(null);

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
            }
        };

        if (notifOpen || userMenuOpen) {
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [notifOpen, userMenuOpen]);

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

    // Area and barn pages keep the "Khu nuôi" item highlighted; their sub-navigation is a tab bar on the page.
    const inAreaPages = location.pathname.startsWith('/areas') || location.pathname.startsWith('/barns');

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
        { id: 'dashboard', label: 'Bảng tin', path: '/dashboard', icon: LayoutDashboard },
        { id: 'areas', label: 'Khu nuôi', path: '/areas', icon: Warehouse },
        { id: 'today-tasks', label: 'Việc hôm nay', path: '/today-tasks', icon: ListChecks },
        { id: 'journal', label: 'Ghi nhật ký', path: '/journal', icon: ClipboardList },
        { id: 'inventory', label: 'Kho hàng hóa', path: '/inventory', icon: Package },
        { id: 'transfers', label: 'Xuất nhập nội bộ', path: '/transfers', icon: ArrowLeftRight },
        { id: 'purchases', label: 'Hóa đơn nhập hàng', path: '/purchases', icon: FileText },
        { id: 'sales', label: 'Quản lý bán hàng', path: '/sales', icon: ShoppingCart },
        { id: 'cashbook', label: 'Sổ quỹ', path: '/cashbook', icon: DollarSign },
        { id: 'account', label: 'Tài khoản & Nhân sự', path: '/account', icon: Users },
        { id: 'reports', label: 'Báo cáo & Thống kê', path: '/reports', icon: BarChart3 },
    ];

    const settingsMenuItems = [
        { id: 'catalog-settings', label: 'Thiết lập danh mục', path: '/catalog-settings', icon: Layers },
        { id: 'breeding-settings', label: 'Thiết lập chăn nuôi', path: '/breeding-settings', icon: Settings },
        { id: 'general-settings', label: 'Thiết lập chung', path: '/general-settings', icon: Sliders },
    ];

    return (
        <div className="farmshift-app">
            {/* ── Top Header (DESIGN.md Editorial Clean Bar) ─────── */}
            <header className="farmshift-header">
                <div className="farmshift-header-left">
                    <button
                        className={`farmshift-toggle-btn ${collapsed ? 'is-collapsed' : ''}`}
                        title={collapsed ? "Mở rộng thanh điều hướng (Sidebar)" : "Thu gọn thanh điều hướng (Sidebar)"}
                        aria-label="Đóng mở thanh điều hướng"
                        onClick={() => {
                            if (window.innerWidth <= 768) {
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
                    <div ref={notifRef} style={{ position: 'relative' }}>
                        <button
                            className="farmshift-header-icon-btn"
                            title="Thông báo hệ thống"
                            onClick={() => { setNotifOpen(!notifOpen); setUserMenuOpen(false); }}
                        >
                            <Bell size={19} />
                            {unreadCount > 0 && (
                                <span className="farmshift-badge-counter farmshift-badge-bounce">{unreadCount}</span>
                            )}
                        </button>

                        {notifOpen && (
                            <div
                                className="farmshift-notif-dropdown"
                                style={{
                                    position: 'absolute',
                                    right: 0,
                                    top: '125%',
                                    width: '350px',
                                    backgroundColor: 'var(--color-canvas)',
                                    borderRadius: 'var(--rounded-lg)',
                                    boxShadow: '0 14px 34px rgba(0,0,0,0.16)',
                                    border: '1px solid var(--color-hairline)',
                                    padding: '16px',
                                    zIndex: 1200
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-hairline)', paddingBottom: '10px', marginBottom: '10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <strong style={{ fontSize: '15px', color: 'var(--color-ink)' }}>Thông báo & Cảnh báo</strong>
                                        {unreadCount > 0 ? (
                                            <span style={{ fontSize: '12.5px', background: 'var(--color-signature-coral)', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontWeight: 600 }}>
                                                {unreadCount} mới
                                            </span>
                                        ) : alerts.length > 0 ? (
                                            <span style={{ fontSize: '12.5px', background: 'var(--color-surface-soft)', color: 'var(--color-muted)', borderRadius: '10px', padding: '1px 6px', fontWeight: 500 }}>
                                                0 mới
                                            </span>
                                        ) : null}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {unreadCount > 0 ? (
                                            <span
                                                style={{ fontSize: '13.5px', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 600 }}
                                                onClick={markAllAsRead}
                                                title="Đánh dấu tất cả đã đọc"
                                            >
                                                Đã đọc
                                            </span>
                                        ) : alerts.length > 0 ? (
                                            <span
                                                style={{ fontSize: '13.5px', color: 'var(--color-muted)', fontWeight: 400 }}
                                                title="Đã đọc tất cả thông báo"
                                            >
                                                Đã đọc tất cả
                                            </span>
                                        ) : null}
                                        {alerts.length > 0 && (
                                            <span
                                                style={{ fontSize: '13.5px', color: 'var(--color-muted)', cursor: 'pointer', fontWeight: 500 }}
                                                onClick={clearAllAlerts}
                                                title="Xóa toàn bộ lịch sử thông báo"
                                            >
                                                Xóa tất cả
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '340px', overflowY: 'auto' }}>
                                    {alerts.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-muted)', fontSize: '14.5px' }}>
                                            Chưa có thông báo nào
                                        </div>
                                    ) : (
                                        alerts.map(al => {
                                            const isSuccess = al.level === 'Thành công' || al.type?.includes('Thành công');
                                            const isWarning = al.level === 'Cảnh báo';
                                            const isRead = !!al.read;
                                            const formattedTime = formatNotificationTime(al.createdAt, al.time);

                                            return (
                                                <div
                                                    key={al.id}
                                                    onClick={() => {
                                                        if (!isRead && markAsRead) {
                                                            markAsRead(al.id);
                                                        }
                                                    }}
                                                    style={{
                                                        padding: '10px 12px',
                                                        borderRadius: 'var(--rounded-md)',
                                                        backgroundColor: isRead
                                                            ? '#f8fafc'
                                                            : isSuccess
                                                            ? '#f0fdf4'
                                                            : 'var(--color-surface-soft)',
                                                        fontSize: '14.5px',
                                                        border: isRead
                                                            ? '1px solid #e2e8f0'
                                                            : isSuccess
                                                            ? '1px solid #bbf7d0'
                                                            : '1px solid var(--color-hairline)',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: '4px',
                                                        cursor: !isRead ? 'pointer' : 'default',
                                                        opacity: isRead ? 0.72 : 1,
                                                        transition: 'all 0.25s ease'
                                                    }}
                                                    title={!isRead ? 'Nhấp để đánh dấu đã đọc' : undefined}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600 }}>
                                                        <span style={{
                                                            color: isRead
                                                                ? '#64748b'
                                                                : isSuccess
                                                                ? '#16a34a'
                                                                : isWarning
                                                                ? 'var(--color-signature-coral)'
                                                                : '#d97706',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '5px'
                                                        }}>
                                                            {isSuccess ? (
                                                                <CheckCircle size={13} color={isRead ? '#94a3b8' : '#16a34a'} />
                                                            ) : isWarning ? (
                                                                <AlertTriangle size={13} color={isRead ? '#94a3b8' : 'var(--color-signature-coral)'} />
                                                            ) : (
                                                                <AlertCircle size={13} color={isRead ? '#94a3b8' : '#d97706'} />
                                                            )}
                                                            {al.type}
                                                        </span>
                                                        <span style={{ fontSize: '12.5px', color: isRead ? '#94a3b8' : 'var(--color-muted)', fontWeight: 400, whiteSpace: 'nowrap', flexShrink: 0 }}>
                                                            {formattedTime}
                                                        </span>
                                                    </div>
                                                    <div style={{ color: isRead ? '#64748b' : 'var(--color-ink)', lineHeight: 1.4 }}>
                                                        {renderNotificationContent(al.barn, al.value, isSuccess, isRead)}
                                                    </div>
                                                    {al.status && (
                                                        <div style={{ fontSize: '13px', color: isRead ? '#94a3b8' : isSuccess ? '#16a34a' : 'var(--color-muted)' }}>
                                                            {al.status}
                                                        </div>
                                                    )}
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
                                    to="/account?tab=profile"
                                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 18px', fontSize: '15px', color: 'var(--color-body)', textDecoration: 'none' }}
                                    onClick={() => setUserMenuOpen(false)}
                                >
                                    <User size={15} /> Hồ sơ cá nhân
                                </Link>
                                <Link
                                    to="/general-settings"
                                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 18px', fontSize: '15px', color: 'var(--color-body)', textDecoration: 'none' }}
                                    onClick={() => setUserMenuOpen(false)}
                                >
                                    <Sliders size={15} /> Thiết lập trang trại
                                </Link>
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
                className={`farmshift-sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}
            >
                <div className="farmshift-sidebar-header">
                    {!collapsed ? (
                        <Link to="/dashboard" className="farmshift-wordmark" aria-label="FarmShift - Bảng tin">
                            farm<span>Shift</span>{farmInitials && <small>{farmInitials}</small>}
                        </Link>
                    ) : (
                        <Link
                            to="/dashboard"
                            style={{ margin: '0 auto', display: 'flex', justifyContent: 'center', textDecoration: 'none' }}
                            title="FarmShift - Bảng tin"
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
                    {navMenuItems.map(item => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path || (item.path === '/dashboard' && location.pathname === '/')
                            || (item.id === 'areas' && inAreaPages);
                        return (
                            <li key={item.id}>
                                <NavLink
                                    to={item.path}
                                    className={`farmshift-menu-item ${isActive ? 'active' : ''}`}
                                    onClick={() => {
                                        if (window.innerWidth <= 768) setMobileOpen(false);
                                    }}
                                >
                                    <span className="farmshift-menu-icon">
                                        <Icon size={19} />
                                    </span>
                                    {!collapsed && <span className="farmshift-menu-label">{item.label}</span>}
                                    {collapsed && (
                                        <span className="farmshift-tooltip">
                                            {item.label}
                                        </span>
                                    )}
                                </NavLink>
                            </li>
                        );
                    })}

                    <li className="farmshift-menu-divider" />

                    {settingsMenuItems.map(item => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;
                        return (
                            <li key={item.id}>
                                <NavLink
                                    to={item.path}
                                    className={`farmshift-menu-item ${isActive ? 'active' : ''}`}
                                    onClick={() => {
                                        if (window.innerWidth <= 768) setMobileOpen(false);
                                    }}
                                >
                                    <span className="farmshift-menu-icon">
                                        <Icon size={19} />
                                    </span>
                                    {!collapsed && <span className="farmshift-menu-label">{item.label}</span>}
                                    {collapsed && (
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
                <div className="farmshift-content-header">
                    <div className="farmshift-header-row">
                        <div>
                            <h1 className="farmshift-page-title">
                                {pageTitle}
                            </h1>
                            <div className="farmshift-breadcrumbs">
                                <Link to="/dashboard">{farmInfo.name}</Link>
                                <span>›</span>
                                {breadcrumbs.map((bc, idx) => (
                                    <Fragment key={idx}>
                                        {bc.path ? <Link to={bc.path}>{bc.label}</Link> : <span>{bc.label}</span>}
                                        {idx < breadcrumbs.length - 1 && <span>›</span>}
                                    </Fragment>
                                ))}
                                <span>›</span>
                                <span style={{ color: 'var(--color-ink)', fontWeight: 500 }}>{breadcrumbTitle}</span>
                            </div>
                        </div>

                        {actions && <div>{actions}</div>}
                    </div>
                </div>

                {/* 4 Quick Shortcut Cards */}
                {showShortcuts && (
                    <div className="farmshift-shortcuts">
                        <Link to="/journal?tab=feed" className="farmshift-shortcut-card">
                            <div className="farmshift-shortcut-icon meal">
                                <Utensils size={20} />
                            </div>
                            <div className="farmshift-shortcut-info">
                                <span className="farmshift-shortcut-title">Ghi cám</span>
                                <span className="farmshift-shortcut-sub">Quản lý khẩu phần</span>
                            </div>
                        </Link>

                        <Link to="/journal?tab=health" className="farmshift-shortcut-card">
                            <div className="farmshift-shortcut-icon health">
                                <HeartPulse size={20} />
                            </div>
                            <div className="farmshift-shortcut-info">
                                <span className="farmshift-shortcut-title">Vật nuôi</span>
                                <span className="farmshift-shortcut-sub">Chỉ số sức khoẻ</span>
                            </div>
                        </Link>

                        <Link to="/journal?tab=env" className="farmshift-shortcut-card">
                            <div className="farmshift-shortcut-icon env">
                                <Thermometer size={20} />
                            </div>
                            <div className="farmshift-shortcut-info">
                                <span className="farmshift-shortcut-title">Môi trường</span>
                                <span className="farmshift-shortcut-sub">Cảm biến nhiệt độ IoT</span>
                            </div>
                        </Link>

                        <Link to="/journal?tab=cull" className="farmshift-shortcut-card">
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
            {activeToast && (
                <ToastNotification
                    activeToast={activeToast}
                    setActiveToast={setActiveToast}
                    setNotifOpen={setNotifOpen}
                />
            )}

            {/* Floating AI Assistant FAB (DESIGN.md Pill CTA) */}
            <AIChatbot />
        </div>
    );
};

// Aliases for compatibility during refactoring
export const FarmgoLayout = FarmShiftLayout;
export default FarmShiftLayout;
