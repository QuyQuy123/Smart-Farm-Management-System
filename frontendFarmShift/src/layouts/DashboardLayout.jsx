// src/layouts/DashboardLayout.jsx
// FarmShift Shell — Rebuilt directly from FarmShift.html prototype UX/UI
import React, { useState, useEffect } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Menu, LogOut, Search, Bell, Settings,
  LayoutDashboard, Beef, Package, ShoppingCart, ClipboardList,
  Warehouse, BarChart3, Users, FileText, TrendingUp,
  Activity, Sparkles, Plus, Mic, Calendar, CheckSquare
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserProfileModal } from '../features/profile/UserProfileModal';
import { AIChatbot } from '../components/AIChatbot/AIChatbot';
import { ROUTES_REGISTRY } from '../features/farmshift/farmshiftData';
import styles from './Layout.module.css';

/* ── Navigation matching FarmShift.html exactly ───────────── */
const OWNER_NAV = [
  { label: 'Tổng quan', path: '/owner-dashboard', icon: LayoutDashboard, exact: true, group: 'dashboard' },
  { label: 'Lứa nuôi & Đàn', path: '/view/batches', icon: Beef, group: 'batches' },
  { label: 'Nhật ký chăn nuôi', path: '/view/journal', icon: FileText, group: 'journal' },
  { label: 'Kế hoạch & Công việc', path: '/view/tasks', icon: ClipboardList, group: 'tasks' },
  { label: 'Chương trình nuôi', path: '/view/programs', icon: ClipboardList, group: 'programs' },
  { label: 'Trang trại & Chuồng', path: '/view/farm', icon: Warehouse, group: 'farm' },
  { label: 'Kho & Vật tư', path: '/view/inventory', icon: Package, group: 'inventory' },
  { label: 'Mua hàng', path: '/view/purchases', icon: ShoppingCart, group: 'purchases' },
  { label: 'Bán hàng', path: '/view/sales', icon: TrendingUp, group: 'sales' },
  { label: 'Tài chính', path: '/view/finance', icon: BarChart3, group: 'finance' },
  { label: 'IoT & Cảnh báo', path: '/view/iot', icon: Activity, group: 'iot' },
  { label: 'Trợ lý AI', path: '/view/ai', icon: Sparkles, group: 'ai' },
  { label: 'Báo cáo', path: '/view/reports', icon: BarChart3, group: 'reports' },
  { label: 'Nhân sự', path: '/view/employees', icon: Users, group: 'employees' },
  { label: 'Cài đặt', path: '/view/settings', icon: Settings, group: 'settings' },
];

const ACCOUNTANT_NAV = [
  { label: 'Tổng quan kế toán', path: '/accountant-dashboard', icon: LayoutDashboard, exact: true, group: 'dashboard' },
  { label: 'Mua hàng & NCC', path: '/view/purchases', icon: ShoppingCart, group: 'purchases' },
  { label: 'Bán hàng & Khách hàng', path: '/view/sales', icon: TrendingUp, group: 'sales' },
  { label: 'Kho & Vật tư', path: '/view/inventory', icon: Package, group: 'inventory' },
  { label: 'Thu chi & Công nợ', path: '/view/finance', icon: BarChart3, group: 'finance' },
  { label: 'Chi phí lứa', path: '/view/costs', icon: FileText, group: 'costs' },
  { label: 'Chứng từ AI OCR', path: '/view/ocr', icon: Sparkles, group: 'ocr' },
  { label: 'Lứa nuôi · Chỉ xem', path: '/view/batches', icon: Beef, group: 'batches' },
  { label: 'Nhật ký · Chỉ xem', path: '/view/journal', icon: FileText, group: 'journal' },
  { label: 'Báo cáo', path: '/view/reports', icon: BarChart3, group: 'reports' },
  { label: 'Trợ lý AI', path: '/view/ai', icon: Sparkles, group: 'ai' },
  { label: 'Tài khoản', path: '/profile', icon: Users, group: 'profile' },
];

const WORKER_NAV = [
  { label: 'Trang chủ', path: '/worker-dashboard', icon: LayoutDashboard, exact: true, group: 'dashboard' },
  { label: 'Công việc của tôi', path: '/view/tasks', icon: ClipboardList, group: 'tasks' },
  { label: 'Ghi nhanh', path: '/view/quick', icon: Plus, group: 'quick' },
  { label: 'Chuồng phụ trách', path: '/view/coops', icon: Warehouse, group: 'farm' },
  { label: 'Nhật ký chăn nuôi', path: '/view/journal', icon: FileText, group: 'journal' },
  { label: 'Lịch chăm sóc', path: '/view/calendar', icon: Calendar, group: 'tasks' },
  { label: 'Môi trường', path: '/view/iot', icon: Activity, group: 'iot' },
  { label: 'Cảnh báo', path: '/view/alerts', icon: Bell, group: 'alerts' },
  { label: 'Tra cứu vật tư', path: '/view/stock-lookup', icon: Package, group: 'inventory' },
  { label: 'Trợ lý AI', path: '/view/ai', icon: Sparkles, group: 'ai' },
  { label: 'Hỗ trợ sức khỏe', path: '/view/ai-health', icon: Beef, group: 'ai' },
  { label: 'Cá nhân', path: '/profile', icon: Users, group: 'profile' },
];

const ROLE_NAV = {
  'ROLE_FARM_OWNER': OWNER_NAV,
  'ROLE_ACCOUNTANT': ACCOUNTANT_NAV,
  'ROLE_FARM_WORKER': WORKER_NAV,
};

export const DashboardLayout = ({
  children,
  breadcrumbs = [],
  pageTitle,
  pageSub,
  pageActions,
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const roleKey = user?.role || 'ROLE_FARM_OWNER';
  const navList = ROLE_NAV[roleKey] || OWNER_NAV;

  const roleTitleMap = {
    'ROLE_FARM_OWNER': 'Chủ trang trại',
    'ROLE_ACCOUNTANT': 'Kế toán',
    'ROLE_FARM_WORKER': 'Công nhân',
  };
  const roleTitle = roleTitleMap[roleKey] || 'Chủ trang trại';

  const roleCharMap = {
    'ROLE_FARM_OWNER': 'o',
    'ROLE_ACCOUNTANT': 'a',
    'ROLE_FARM_WORKER': 'w',
  };
  const roleChar = roleCharMap[roleKey] || 'o';

  // Search filter
  const searchResults = searchQuery.trim()
    ? Object.values(ROUTES_REGISTRY)
        .filter(r => r.allowed.includes(roleChar) && (
          r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (r.group && r.group.toLowerCase().includes(searchQuery.toLowerCase()))
        ))
        .slice(0, 10)
    : [];

  const avatarInitial = {
    'ROLE_FARM_OWNER': 'CT',
    'ROLE_ACCOUNTANT': 'KT',
    'ROLE_FARM_WORKER': 'TB',
  }[roleKey] || (user?.name?.charAt(0) || 'U');

  const defaultTitle = breadcrumbs.length > 0
    ? breadcrumbs[breadcrumbs.length - 1].label
    : 'Tổng quan';

  const currentTitle = pageTitle || defaultTitle;
  const currentSub = pageSub || (roleKey === 'ROLE_FARM_WORKER'
    ? 'Chuồng B6 · Lứa MB-2026-08 · Công việc được phân công'
    : 'Trang trại Miền Bính · Quản lý chăn nuôi gà');

  useEffect(() => {
    document.title = `FarmShift · ${currentTitle} · ${roleTitle}`;
  }, [currentTitle, roleTitle]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeSidebar = () => setIsMobileOpen(false);

  // Current screen ID resolution for group active state
  const currentScreenId = location.pathname.startsWith('/view/')
    ? location.pathname.replace('/view/', '').split('?')[0].split('/')[0]
    : null;
  const currentRouteMeta = currentScreenId ? ROUTES_REGISTRY[currentScreenId] : null;

  return (
    <div className={roleKey === 'ROLE_FARM_WORKER' ? 'worker' : ''}>
      {/* ── Sidebar (Exact FarmShift.html) ────────────────── */}
      <aside className={`sidebar ${isMobileOpen ? 'open' : ''}`}>
        <Link to="/" className="brand" onClick={closeSidebar}>
          <span className="leaf">◒</span>FarmShift
          <small>Trang trại Miền Bính</small>
        </Link>

        <nav className="nav">
          {navList.map(item => {
            const Icon = item.icon;
            const isActive = item.exact
              ? location.pathname === item.path
              : location.pathname === item.path ||
                (currentRouteMeta && item.group && currentRouteMeta.group === item.group);

            return (
              <Link
                key={item.label}
                to={item.path}
                className={isActive ? 'active' : ''}
                onClick={closeSidebar}
              >
                <Icon className="icon" size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="identity">
          <strong>{roleTitle}</strong>
          <br />
          <small>{roleKey === 'ROLE_FARM_WORKER' ? 'Trần Văn Bình · Chuồng B6' : (user?.name || 'Tài khoản nội bộ trang trại')}</small>
          <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <Link
              to="/profile"
              style={{ color: '#bed3c5', fontSize: 11, textDecoration: 'underline' }}
              onClick={closeSidebar}
            >
              Hồ sơ
            </Link>
            <span style={{ color: '#42624e' }}>·</span>
            <Link
              to="/catalog"
              style={{ color: '#bed3c5', fontSize: 11, textDecoration: 'underline' }}
              onClick={closeSidebar}
            >
              Danh mục màn hình
            </Link>
            <span style={{ color: '#42624e' }}>·</span>
            <button
              onClick={handleLogout}
              style={{ background: 'none', border: 'none', color: '#ffb3a7', padding: 0, font: 'inherit', fontSize: 11, cursor: 'pointer' }}
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Area ─────────────────────────────────────── */}
      <main className="main">
        {/* Topbar (Exact FarmShift.html) */}
        <header className="topbar">
          <button
            className="btn menu-toggle"
            onClick={() => setIsMobileOpen(open => !open)}
            aria-label="Mở menu"
            style={{ display: 'none' }}
          >
            ☰
          </button>

          <div style={{ position: 'relative', width: 'min(440px, 45vw)' }}>
            <input
              className="search"
              type="search"
              placeholder="Tìm màn hình, chức năng…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              aria-label="Tìm màn hình"
              style={{ width: '100%' }}
            />
            {searchQuery.trim() && (
              <div
                className="card search-results"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  zIndex: 50,
                  maxHeight: 400,
                  overflowY: 'auto',
                  width: '100%',
                  padding: '6px 0',
                  background: 'white',
                  boxShadow: '0 10px 30px rgba(21,62,48,0.18)',
                  borderRadius: 8,
                }}
              >
                {searchResults.length > 0 ? (
                  searchResults.map(item => (
                    <Link
                      key={item.id}
                      to={`/view/${item.id}`}
                      onClick={() => setSearchQuery('')}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '10px 16px',
                        borderBottom: '1px solid var(--line)',
                        color: 'var(--ink)',
                        fontSize: 13,
                        textDecoration: 'none',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f2f7f4'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <strong style={{ color: 'var(--green)' }}>{item.title}</strong>
                      <small style={{ color: 'var(--muted)', fontSize: 11, marginTop: 2 }}>
                        {item.group ? `Phân hệ: ${item.group}` : 'Hệ thống'} · Mã: {item.id}
                      </small>
                    </Link>
                  ))
                ) : (
                  <div style={{ padding: '14px 16px', color: 'var(--muted)', fontSize: 13, textAlign: 'center' }}>
                    Không tìm thấy màn hình phù hợp với "{searchQuery}"
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="topright">
            <button
              className="btn small"
              onClick={() => {
                const chatToggle = document.getElementById('ai-chat-toggle-btn');
                if (chatToggle) chatToggle.click();
              }}
              title="Trợ lý FarmShift AI"
              style={{ border: 'none', background: 'transparent' }}
            >
              <Sparkles size={18} color="var(--green)" />
            </button>

            <div style={{ position: 'relative' }}>
              <button
                className="btn small"
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                title="Thông báo"
                style={{ border: 'none', background: 'transparent' }}
              >
                <Bell size={18} color="var(--muted)" />
              </button>
              {isNotifOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  width: 300,
                  background: 'white',
                  border: '1px solid var(--line)',
                  borderRadius: 8,
                  boxShadow: '0 8px 30px rgba(0,0,0,0.1)',
                  padding: 15,
                  zIndex: 50,
                  marginTop: 8
                }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                    <span>Thông báo</span>
                    <span className="badge warn">2 mới</span>
                  </div>
                  <div style={{ fontSize: 12, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                    <b>Vitamin bổ sung sắp hết hạn</b>
                    <p style={{ margin: '2px 0 0', color: 'var(--muted)', fontSize: 11 }}>Lô BS-0926 · HSD 05/11/2026</p>
                  </div>
                  <div style={{ fontSize: 12, padding: '8px 0' }}>
                    <b>Tồn dung dịch vệ sinh thấp</b>
                    <p style={{ margin: '2px 0 0', color: 'var(--muted)', fontSize: 11 }}>20 lít / mức tối thiểu 30 lít</p>
                  </div>
                </div>
              )}
            </div>

            <div
              className="avatar"
              onClick={() => navigate('/profile')}
              style={{ cursor: 'pointer', overflow: 'hidden', padding: 0, width: 34, height: 34, flexShrink: 0 }}
              title={user?.name || user?.email}
            >
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt="Avatar"
                  style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                avatarInitial
              )}
            </div>

            <span
              className="role-label"
              onClick={() => navigate('/profile')}
              style={{ cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}
            >
              {roleTitle}
            </span>
          </div>
        </header>

        {/* Content Container (Exact FarmShift.html) */}
        <div className="content">
          <div className="crumb">
            FarmShift / {roleTitle} / {currentTitle}
          </div>

          <div className="pagehead">
            <div>
              <h1>{currentTitle}</h1>
              <div className="sub">{currentSub}</div>
            </div>
            <div className="actions">
              {pageActions || (
                currentTitle !== 'Tổng quan' && currentTitle !== 'Trang chủ' ? (
                  <Link to="/" className="btn">
                    ← Tổng quan
                  </Link>
                ) : (
                  <span className="badge gray">Bản HTML tương tác</span>
                )
              )}
            </div>
          </div>

          {children}

          <div className="demo">
            {roleTitle.toUpperCase()} · Dữ liệu minh họa, lưu trên trình duyệt
          </div>
        </div>
      </main>

      {/* ── Mobile Worker Bottom Bar ──────────────────────── */}
      {roleKey === 'ROLE_FARM_WORKER' && (
        <nav className="bottom">
          <Link to="/worker-dashboard" className={location.pathname === '/worker-dashboard' ? 'active' : ''}>
            <LayoutDashboard size={18} />
            <span>Trang chủ</span>
          </Link>
          <Link to="/view/tasks" className={location.pathname === '/view/tasks' ? 'active' : ''}>
            <ClipboardList size={18} />
            <span>Công việc</span>
          </Link>
          <Link to="/view/quick" className="plus">
            <Plus size={20} />
            <span>Ghi nhanh</span>
          </Link>
          <Link to="/view/coops" className={location.pathname === '/view/coops' ? 'active' : ''}>
            <Warehouse size={18} />
            <span>Chuồng</span>
          </Link>
          <Link to="/profile" className={location.pathname === '/profile' ? 'active' : ''}>
            <Users size={18} />
            <span>Cá nhân</span>
          </Link>
        </nav>
      )}

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />

      {/* Floating AI Chatbot */}
      <AIChatbot />
    </div>
  );
};
