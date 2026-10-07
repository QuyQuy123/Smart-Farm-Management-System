// src/layouts/FarmShiftLayout.jsx
// FarmShift Shell Layout aligned with DESIGN.md
import React, { useState, useEffect } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import {
    Menu, Maximize, Minimize, Bell, User, LogOut,
    LayoutDashboard, Warehouse, ClipboardList, Package,
    ArrowLeftRight, FileText, ShoppingCart, DollarSign,
    Users, BarChart3, Layers, Settings, Sliders, Edit3,
    Utensils, HeartPulse, Thermometer, CheckSquare, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { AIChatbot } from '../components/AIChatbot/AIChatbot';
import { GlobalSearch } from '../components/GlobalSearch/GlobalSearch';
import { INITIAL_FARMSHIFT_DATA, getFarmInfo } from '../data/farmshiftMockData';
import farmLogo from '../assets/logo_Farm.png';
import '../theme/farmshift.css';

export const FarmShiftLayout = ({
    children,
    pageTitle,
    breadcrumbs = [],
    showShortcuts = false,
    actions = null,
}) => {
    const { user, logout } = useAuth();
    const { alerts, unreadCount, markAllAsRead, activeToast, setActiveToast } = useNotification();
    const navigate = useNavigate();
    const location = useLocation();

    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [farmInfo, setFarmInfo] = useState(() => getFarmInfo(user));

    useEffect(() => {
        setFarmInfo(getFarmInfo(user));
        const handleFarmUpdate = () => {
            setFarmInfo(getFarmInfo(user));
        };
        window.addEventListener('farmshift_info_updated', handleFarmUpdate);
        return () => window.removeEventListener('farmshift_info_updated', handleFarmUpdate);
    }, [user]);

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
        { id: 'areas', label: 'Khu nuôi & Chuồng', path: '/areas', icon: Warehouse },
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
                        className="farmshift-toggle-btn"
                        title="Đóng / Mở menu"
                        onClick={() => {
                            if (window.innerWidth <= 768) {
                                setMobileOpen(!mobileOpen);
                            } else {
                                setCollapsed(!collapsed);
                            }
                        }}
                    >
                        <Menu size={18} />
                    </button>

                    <div className="farmshift-header-brand-tag">
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#019788' }}></span>
                        <span>Trang trại Miến Bình</span>
                    </div>
                </div>

                {/* ── Center: Quick Feature Search (Omnibar) ────────── */}
                <div className="farmshift-header-center">
                    <GlobalSearch />
                </div>

                <div className="farmshift-header-right">
                    <button
                        className="farmshift-header-icon-btn"
                        title="Toàn màn hình"
                        onClick={toggleFullscreen}
                    >
                        {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
                    </button>

                    {/* Notifications Dropdown */}
                    <div style={{ position: 'relative' }}>
                        <button
                            className="farmshift-header-icon-btn"
                            title="Thông báo hệ thống"
                            onClick={() => { setNotifOpen(!notifOpen); setUserMenuOpen(false); }}
                        >
                            <Bell size={16} />
                            {unreadCount > 0 && (
                                <span className="farmshift-badge-counter farmshift-badge-bounce">{unreadCount}</span>
                            )}
                        </button>

                        {notifOpen && (
                            <div
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
                                        <strong style={{ fontSize: '14px', color: 'var(--color-ink)' }}>Cảnh báo chuồng trại (IoT)</strong>
                                        {unreadCount > 0 && (
                                            <span style={{ fontSize: '11px', background: 'var(--color-signature-coral)', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontWeight: 600 }}>
                                                {unreadCount} mới
                                            </span>
                                        )}
                                    </div>
                                    <span
                                        style={{ fontSize: '12px', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 500 }}
                                        onClick={markAllAsRead}
                                    >
                                        Đã đọc tất cả
                                    </span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
                                    {alerts.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--color-muted)', fontSize: '13px' }}>
                                            Chưa có thông báo nào
                                        </div>
                                    ) : (
                                        alerts.map(al => (
                                            <div key={al.id} style={{ padding: '10px', borderRadius: 'var(--rounded-md)', backgroundColor: 'var(--color-surface-soft)', fontSize: '13px', border: '1px solid var(--color-hairline)' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 500 }}>
                                                    <span style={{ color: al.level === 'Cảnh báo' ? 'var(--color-signature-coral)' : al.level === 'Thành công' ? 'var(--color-success)' : '#f59e0b' }}>
                                                        {al.type}
                                                    </span>
                                                    <span style={{ fontSize: '11px', color: 'var(--color-muted)' }}>{al.time}</span>
                                                </div>
                                                <div style={{ color: 'var(--color-body)', marginTop: '3px' }}>
                                                    <strong>{al.barn}</strong>: {al.value}
                                                </div>
                                                <div style={{ fontSize: '11.5px', color: 'var(--color-muted)', marginTop: '2px' }}>{al.status}</div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* User Profile Menu */}
                    <div style={{ position: 'relative' }}>
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
                            <span style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--color-ink)' }}>
                                {user?.name || farmInfo.owner}
                            </span>
                        </div>

                        {userMenuOpen && (
                            <div
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
                                        <div style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--color-ink)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                            {user?.name || farmInfo.owner}
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'var(--color-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                            {user?.email || 'admin@farmshift.local'}
                                        </div>
                                    </div>
                                </div>
                                <Link
                                    to="/account"
                                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 18px', fontSize: '13.5px', color: 'var(--color-body)', textDecoration: 'none' }}
                                    onClick={() => setUserMenuOpen(false)}
                                >
                                    <User size={15} /> Hồ sơ cá nhân
                                </Link>
                                <Link
                                    to="/general-settings"
                                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 18px', fontSize: '13.5px', color: 'var(--color-body)', textDecoration: 'none' }}
                                    onClick={() => setUserMenuOpen(false)}
                                >
                                    <Sliders size={15} /> Thiết lập trang trại
                                </Link>
                                <div style={{ height: '1px', backgroundColor: 'var(--color-hairline)', margin: '4px 0' }} />
                                <button
                                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 18px', fontSize: '13.5px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
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

            {/* ── Secondary Sidebar ─────────────────────────────── */}
            <aside
                className={`farmshift-sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}
            >
                <div className="farmshift-sidebar-header">
                    {!collapsed ? (
                        <Link to="/dashboard" className="farmshift-brand-box" style={{ textDecoration: 'none' }}>
                            <img
                                src={farmLogo}
                                alt="FarmShift"
                                style={{
                                    width: '36px',
                                    height: '36px',
                                    objectFit: 'contain',
                                    flexShrink: 0
                                }}
                            />
                            <span className="farmshift-brand-title" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-ink)', letterSpacing: '-0.02em' }}>
                                FarmShift
                            </span>
                        </Link>
                    ) : (
                        <div style={{ margin: '0 auto', display: 'flex', justifyContent: 'center' }}>
                            <img
                                src={farmLogo}
                                alt="FarmShift"
                                style={{
                                    width: '32px',
                                    height: '32px',
                                    objectFit: 'contain'
                                }}
                            />
                        </div>
                    )}
                </div>

                <ul className="farmshift-menu">
                    {navMenuItems.map(item => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path || (item.path === '/dashboard' && location.pathname === '/');
                        return (
                            <li key={item.id}>
                                <NavLink
                                    to={item.path}
                                    className={`farmshift-menu-item ${isActive ? 'active' : ''}`}
                                    title={collapsed ? item.label : undefined}
                                >
                                    <span className="farmshift-menu-icon">
                                        <Icon size={18} />
                                    </span>
                                    {!collapsed && <span>{item.label}</span>}
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
                                    title={collapsed ? item.label : undefined}
                                >
                                    <span className="farmshift-menu-icon">
                                        <Icon size={18} />
                                    </span>
                                    {!collapsed && <span>{item.label}</span>}
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
                                    <React.Fragment key={idx}>
                                        {bc.path ? <Link to={bc.path}>{bc.label}</Link> : <span>{bc.label}</span>}
                                        {idx < breadcrumbs.length - 1 && <span>›</span>}
                                    </React.Fragment>
                                ))}
                                <span>›</span>
                                <span style={{ color: 'var(--color-ink)', fontWeight: 500 }}>{pageTitle}</span>
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

            {/* Floating Real-time Notification Banner */}
            {activeToast && (
                <div
                    className="farmshift-floating-toast"
                    onClick={() => { setNotifOpen(true); setActiveToast(null); }}
                >
                    <div className="farmshift-toast-icon">
                        <Bell size={18} />
                    </div>
                    <div className="farmshift-toast-body">
                        <div className="farmshift-toast-header">
                            <span className="farmshift-toast-badge">{activeToast.level || 'Cảnh báo'}</span>
                            <span className="farmshift-toast-type">{activeToast.type}</span>
                            <span className="farmshift-toast-time">{activeToast.time}</span>
                        </div>
                        <div className="farmshift-toast-text">
                            <strong>{activeToast.barn}</strong>: {activeToast.value}
                        </div>
                        <div className="farmshift-toast-status">{activeToast.status}</div>
                    </div>
                    <button
                        type="button"
                        className="farmshift-toast-close"
                        onClick={(e) => { e.stopPropagation(); setActiveToast(null); }}
                    >
                        <X size={15} />
                    </button>
                </div>
            )}

            {/* Floating AI Assistant FAB (DESIGN.md Pill CTA) */}
            <AIChatbot />
        </div>
    );
};

// Aliases for compatibility during refactoring
export const FarmgoLayout = FarmShiftLayout;
export default FarmShiftLayout;
