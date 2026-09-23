// src/layouts/DashboardLayout.jsx
// FarmShift Dashboard Shell — Sidebar + Header + Content
// Matches the farmgo UI from UI_FarmShift.pdf
import React, { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
  Menu, X, LogOut, Search, Bell, Settings, ChevronRight,
  LayoutDashboard, Beef, Package, ShoppingCart, ClipboardList,
  Warehouse, BarChart3, Users, FileText, TrendingUp
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserProfileModal } from '../features/profile/UserProfileModal';
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
    section: 'QUẢN LÝ',
    items: [
      {
        label: 'Đàn',
        icon: Beef,
        children: [
          { label: 'Danh sách đàn', path: '/owner-dashboard/livestock' },
          { label: 'Thêm đàn mới', path: '/owner-dashboard/livestock/add' },
        ],
      },
      {
        label: 'Hàng hóa',
        icon: Package,
        children: [
          { label: 'Danh sách hàng hóa', path: '/owner-dashboard/inventory' },
          { label: 'Loại hàng hóa', path: '/owner-dashboard/inventory/categories' },
          { label: 'Phân quyền kho', path: '/owner-dashboard/inventory/warehouse' },
        ],
      },
      {
        label: 'Đơn hàng',
        icon: ShoppingCart,
        children: [
          { label: 'Nhà đơn đặt hàng', path: '/owner-dashboard/orders' },
          { label: 'Tồn kho / Phiếu', path: '/owner-dashboard/orders/stock' },
        ],
      },
    ],
  },
  {
    section: 'TÀI CHÍNH',
    items: [
      { label: 'Báo cáo tài chính', path: '/owner-dashboard/finance', icon: BarChart3 },
      { label: 'Nhân công', path: '/owner-dashboard/workers', icon: Users },
    ],
  },
  {
    section: 'HỆ THỐNG',
    items: [
      { label: 'Cài đặt', path: '/owner-dashboard/settings', icon: Settings },
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
        <Link to="/" className={styles.sidebarLogo} onClick={closeSidebar}>
          <div className={styles.logoMark}>🌿</div>
          <span className={styles.logoText}>
            Smart<span> Farm</span>
          </span>
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
            <button className={styles.iconBtn} aria-label="Thông báo">
              <Bell size={16} />
              <span className={styles.notifBadge} />
            </button>
            <button className={styles.iconBtn} aria-label="Cài đặt">
              <Settings size={16} />
            </button>

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
    </div>
  );
};
