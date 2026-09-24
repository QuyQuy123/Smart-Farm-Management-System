// src/layouts/DashboardLayout.jsx
// FarmShift Dashboard Shell — Sidebar + Header + Content
// Matches the farmgo UI from UI_FarmShift.pdf
import React, { useState, useEffect } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
  Menu, X, LogOut, Search, Bell, Settings, ChevronRight, History,
  LayoutDashboard, Beef, Package, ShoppingCart, ClipboardList,
  Warehouse, BarChart3, Users, FileText, TrendingUp,
  ArrowLeftRight, Receipt, DollarSign, Activity,
  Sun, Moon, Monitor
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserProfileModal } from '../features/profile/UserProfileModal';
import { AIChatbot } from '../components/AIChatbot/AIChatbot';
import logoFarm from '../assets/logo_Farm.png';
import styles from './Layout.module.css';

/* ── Navigation structure per role ─────────────────────── */
const OWNER_NAV = [
  {
    section: 'TỔNG QUAN',
    items: [
      { label: 'Tổng quan', path: '/owner-dashboard', icon: LayoutDashboard, exact: true },
    ],
  },
  {
    section: 'CHĂN NUÔI',
    items: [
      {
        label: 'Chuồng trại',
        icon: Warehouse,
        children: [
          { label: 'Danh sách chuồng', path: '/owner-dashboard/barns' },
        ],
      },
      {
        label: 'Lứa gà thịt',
        icon: Beef,
        children: [
          { label: 'Danh sách lứa', path: '/owner-dashboard/batches' },
        ],
      },
      {
        label: 'Kho vật tư',
        icon: Package,
        children: [
          { label: 'Danh sách hàng hóa', path: '/owner-dashboard/inventory' },
          { label: 'Loại hàng hóa', path: '/owner-dashboard/inventory/categories' },
          { label: 'Phân quyền kho', path: '/owner-dashboard/inventory/warehouse' },
        ],
      },
      {
        label: 'Nhập kho / Đơn hàng',
        icon: ShoppingCart,
        children: [
          { label: 'Phiếu đặt hàng', path: '/owner-dashboard/orders' },
          { label: 'Tồn kho / Phiếu', path: '/owner-dashboard/orders/stock' },
        ],
      },
      {
        label: 'Xuất nhập nội bộ',
        icon: ArrowLeftRight,
        children: [
          { label: 'Phiếu xuất kho → Chuồng', path: '/owner-dashboard/internal-transfers' },
        ],
      },
      {
        label: 'Giám sát IoT',
        icon: Activity,
        path: '/owner-dashboard/iot',
      },
    ],
  },
  {
    section: 'NHÀ CUNG CẤP & BÁN HÀNG',
    items: [
      {
        label: 'Nhà cung cấp',
        icon: Users,
        children: [
          { label: 'Danh sách NCC', path: '/owner-dashboard/suppliers' },
          { label: 'Theo dõi công nợ', path: '/owner-dashboard/suppliers/debts' },
        ],
      },
      {
        label: 'Khách hàng & Bán gà',
        icon: TrendingUp,
        children: [
          { label: 'Danh sách khách hàng', path: '/owner-dashboard/customers' },
          { label: 'Quản lý bán gà', path: '/owner-dashboard/sales' },
          { label: 'Công nợ thương lái', path: '/owner-dashboard/customers/debts' },
        ],
      },
    ],
  },
  {
    section: 'TÀI CHÍNH',
    items: [
      { label: 'Sổ quỹ tiền mặt', path: '/owner-dashboard/fund-ledger', icon: Receipt },
      { label: 'Báo cáo Lãi/Lỗ từng lứa', path: '/owner-dashboard/pnl', icon: BarChart3 },
      { label: 'Nhân công', path: '/owner-dashboard/workers', icon: Users },
    ],
  },
  {
    section: 'HỆ THỐNG',
    items: [
      { label: 'Cài đặt', path: '/owner-dashboard/settings', icon: Settings },
      { label: 'Nhật ký đăng nhập', path: '/owner-dashboard/login-logs', icon: History },
    ],
  },
];


const ACCOUNTANT_NAV = [
  {
    section: 'TÀI CHÍNH',
    items: [
      { label: 'Tổng quan tài chính', path: '/accountant-dashboard', icon: LayoutDashboard, exact: true },
      { label: 'Giao dịch', path: '/accountant-dashboard/transactions', icon: TrendingUp },
      { label: 'Báo cáo', path: '/accountant-dashboard/reports', icon: FileText },
    ],
  },
];

const WORKER_NAV = [
  {
    section: 'CÔNG VIỆC',
    items: [
      { label: 'Nhiệm vụ hôm nay', path: '/worker-dashboard', icon: ClipboardList, exact: true },
      { label: 'Nhật ký hoạt động', path: '/worker-dashboard/log', icon: FileText },
    ],
  },
];

const ROLE_NAV = {
  'ROLE_FARM_OWNER': OWNER_NAV,
  'ROLE_ACCOUNTANT': ACCOUNTANT_NAV,
  'ROLE_FARM_WORKER': WORKER_NAV,
};

/* ── Collapsible Nav Group ──────────────────────────────── */
function NavGroupItem({ item, onLinkClick }) {
  const [open, setOpen] = useState(false);

  if (item.children) {
    return (
      <div>
        {/* Parent toggle */}
        <button
          className={styles.navItem}
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
        >
          <span className={styles.navItemIcon}>
            <item.icon size={16} />
          </span>
          {item.label}
          <ChevronRight
            size={14}
            className={`${styles.navChevron} ${open ? styles.navChevronOpen : ''}`}
          />
        </button>
        {/* Sub-items */}
        {open && (
          <div className={styles.navSubList}>
            {item.children.map(child => (
              <NavLink
                key={child.path}
                to={child.path}
                className={({ isActive }) =>
                  `${styles.navSubItem} ${isActive ? styles.navSubItemActive : ''}`
                }
                onClick={onLinkClick}
              >
                {child.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Leaf item
  return (
    <NavLink
      to={item.path}
      end={item.exact}
      className={({ isActive }) =>
        `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
      }
      onClick={onLinkClick}
    >
      <span className={styles.navItemIcon}>
        <item.icon size={16} />
      </span>
      {item.label}
    </NavLink>
  );
}

/* ── DashboardLayout ─────────────────────────────────────── */
export const DashboardLayout = ({
  children,
  breadcrumbs = [], // [{ label, path? }, ...]
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'system');

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.setAttribute('data-theme', systemTheme);
    } else {
      root.setAttribute('data-theme', theme);
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (breadcrumbs && breadcrumbs.length > 0) {
      const currentPage = breadcrumbs[breadcrumbs.length - 1].label;
      document.title = `${currentPage} - FarmShift`;
    } else {
      document.title = 'FarmShift';
    }
  }, [breadcrumbs]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navSections = user?.role ? ROLE_NAV[user.role] || [] : [];
  const initial = user?.name
    ? user.name.charAt(0).toUpperCase()
    : user?.email
      ? user.email.charAt(0).toUpperCase()
      : 'U';

  const closeSidebar = () => setIsMobileOpen(false);

  /* Derive friendly role label */
  const roleLabel = {
    'ROLE_FARM_OWNER': 'Farm Owner',
    'ROLE_ACCOUNTANT': 'Kế Toán',
    'ROLE_FARM_WORKER': 'Nhân Công',
  }[user?.role] || '';

  return (
    <div className={styles.layout}>
      {/* ── Mobile Overlay ─────────────────────────────────── */}
      <div
        className={`${styles.overlay} ${isMobileOpen ? styles.overlayVisible : ''}`}
        onClick={closeSidebar}
        aria-hidden="true"
      />

      {/* ── Sidebar ────────────────────────────────────────── */}
      <aside className={`${styles.sidebar} ${isMobileOpen ? styles.sidebarOpen : ''}`}>
        {/* Logo */}
        <Link to="/" className={styles.sidebarLogo} onClick={closeSidebar} style={{ height: '80px', justifyContent: 'center' }}>
          <img src={logoFarm} alt="FarmShift Logo" style={{ height: '64px', objectFit: 'contain' }} />
        </Link>

        {/* Navigation */}
        <nav className={styles.navScroll}>
          {navSections.map(section => (
            <div className={styles.navSection} key={section.section}>
              <div className={styles.navSectionLabel}>{section.section}</div>
              {section.items.map(item => (
                <NavGroupItem
                  key={item.label}
                  item={item}
                  onLinkClick={closeSidebar}
                />
              ))}
            </div>
          ))}
        </nav>

        {/* Logout */}
        <div className={styles.sidebarFooter}>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            <LogOut size={16} />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* ── Main ───────────────────────────────────────────── */}
      <main className={styles.main}>
        {/* Top Header */}
        <header className={styles.topHeader}>
          {/* Left: hamburger + breadcrumb */}
          <div className={styles.headerLeft}>
            <button
              className={styles.menuBtn}
              onClick={() => setIsMobileOpen(true)}
              aria-label="Mở menu"
            >
              <Menu size={20} />
            </button>

            {breadcrumbs.length > 0 && (
              <nav className={styles.breadcrumb} aria-label="Breadcrumb">
                {breadcrumbs.map((crumb, idx) => (
                  <React.Fragment key={idx}>
                    {idx > 0 && <span className={styles.breadcrumbSep}>/</span>}
                    {crumb.path && idx < breadcrumbs.length - 1 ? (
                      <Link to={crumb.path} className={styles.breadcrumbCrumb}>
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className={styles.breadcrumbActive}>{crumb.label}</span>
                    )}
                  </React.Fragment>
                ))}
              </nav>
            )}
          </div>

          {/* Center: Search */}
          <div className={styles.headerCenter}>
            <div className={styles.searchWrap}>
              <Search size={14} className={styles.searchIcon} />
              <input
                type="search"
                placeholder="Tìm kiếm..."
                className={styles.searchInput}
                aria-label="Tìm kiếm"
              />
            </div>
          </div>

          {/* Right: icons + user */}
          <div className={styles.headerRight}>
            <div style={{ position: 'relative' }}>
              <button 
                className={styles.iconBtn} 
                aria-label="Thông báo"
                onClick={() => setIsNotifOpen(!isNotifOpen)}
              >
                <Bell size={16} />
                <span className={styles.notifBadge} />
              </button>
              
              {isNotifOpen && (
                <div className={styles.notifDropdown}>
                  <div className={styles.notifHeader}>
                    <span>Thông báo mới</span>
                    <button className={styles.notifClear} onClick={() => setIsNotifOpen(false)}>Đóng</button>
                  </div>
                  <div className={styles.notifList}>
                    <div className={`${styles.notifItem} ${styles.unread}`}>
                      <span className={styles.notifTitle}>Cảnh báo nhiệt độ!</span>
                      <span className={styles.notifTime}>Chuồng 1 - 32°C vượt ngưỡng (Vừa xong)</span>
                    </div>
                    <div className={`${styles.notifItem} ${styles.unread}`}>
                      <span className={styles.notifTitle}>Nhập kho thành công</span>
                      <span className={styles.notifTime}>Phiếu PN-001 (5 phút trước)</span>
                    </div>
                    <div className={styles.notifItem}>
                      <span className={styles.notifTitle}>Nhắc nhở công việc</span>
                      <span className={styles.notifTime}>Vui lòng ghi nhật ký lứa GÀ-2024 (1 giờ trước)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ position: 'relative' }}>
              <button 
                className={styles.iconBtn} 
                aria-label="Cài đặt"
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              >
                <Settings size={16} />
              </button>
              
              {isSettingsOpen && (
                <div className={styles.settingsDropdown}>
                  <div className={styles.notifHeader} style={{ padding: '8px 16px' }}>
                    <span>Giao diện</span>
                  </div>
                  
                  <button 
                    className={styles.settingsItem}
                    onClick={() => { setTheme('light'); setIsSettingsOpen(false); }}
                    style={{ color: theme === 'light' ? 'var(--color-farm-green)' : '' }}
                  >
                    <Sun size={16} /> Sáng
                  </button>
                  <button 
                    className={styles.settingsItem}
                    onClick={() => { setTheme('dark'); setIsSettingsOpen(false); }}
                    style={{ color: theme === 'dark' ? 'var(--color-farm-green)' : '' }}
                  >
                    <Moon size={16} /> Tối
                  </button>
                  <button 
                    className={styles.settingsItem}
                    onClick={() => { setTheme('system'); setIsSettingsOpen(false); }}
                    style={{ color: theme === 'system' ? 'var(--color-farm-green)' : '' }}
                  >
                    <Monitor size={16} /> Theo hệ thống
                  </button>

                  <div className={styles.settingsDivider}></div>

                  <button 
                    className={styles.settingsItem}
                    onClick={() => { setIsSettingsOpen(false); navigate('/owner-dashboard/settings'); }}
                  >
                    <Settings size={16} /> Đi tới Cài đặt
                  </button>
                </div>
              )}
            </div>

            <div
              className={styles.userProfile}
              onClick={() => setIsProfileOpen(true)}
              role="button"
              tabIndex={0}
              aria-label="Hồ sơ người dùng"
              onKeyDown={e => e.key === 'Enter' && setIsProfileOpen(true)}
            >
              <div className={styles.userMeta}>
                <span className={styles.userName}>{user?.name || user?.email}</span>
                <span className={styles.userRole}>{roleLabel}</span>
              </div>
              <div className={styles.avatar}>
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="Avatar" />
                ) : (
                  initial
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className={styles.content}>
          <div className={styles.contentInner}>
            {children}
          </div>
        </div>
      </main>

      {/* Profile Modal */}
      <UserProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />

      {/* Feature 12: AI Chatbot thả nổi góc màn hình */}
      <AIChatbot />
    </div>
  );
};
