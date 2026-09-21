import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  Menu, X, LogOut, LayoutDashboard, Calculator, 
  ClipboardList, Tractor, Settings 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserProfileModal } from '../features/profile/UserProfileModal';
import styles from './Layout.module.css';

const ROLE_NAV_ITEMS = {
  'ROLE_FARM_OWNER': [
    { label: 'Overview', path: '/owner-dashboard', icon: LayoutDashboard },
    { label: 'Finances', path: '/owner-dashboard/finance', icon: Calculator },
    { label: 'Operations', path: '/owner-dashboard/operations', icon: Tractor },
    { label: 'Settings', path: '/owner-dashboard/settings', icon: Settings },
  ],
  'ROLE_ACCOUNTANT': [
    { label: 'Financial Overview', path: '/accountant-dashboard', icon: Calculator },
    { label: 'Transactions', path: '/accountant-dashboard/transactions', icon: ClipboardList },
  ],
  'ROLE_FARM_WORKER': [
    { label: 'My Tasks', path: '/worker-dashboard', icon: ClipboardList },
    { label: 'Daily Log', path: '/worker-dashboard/log', icon: Tractor },
  ]
};

export const DashboardLayout = ({ children, title = 'Dashboard' }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = user?.role ? ROLE_NAV_ITEMS[user.role] : [];
  const initial = user?.email ? user.email.charAt(0).toUpperCase() : 'U';

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className={styles.layout}>
      {/* Mobile Overlay */}
      <div 
        className={`${styles.overlay} ${isMobileMenuOpen ? styles.overlayOpen : ''}`} 
        onClick={closeMobileMenu}
      />

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${isMobileMenuOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logo}>
            <div className={styles.logoIcon}>🚜</div>
            <span>FarmShift</span>
          </div>
        </div>

        <nav className={styles.navGroup}>
          <div className={styles.navTitle}>Menu</div>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => 
                `${styles.navItem} ${isActive || location.pathname === item.path ? styles.navItemActive : ''}`
              }
              onClick={closeMobileMenu}
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <button onClick={handleLogout} className={styles.logoutBtn}>
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={styles.main}>
        {/* Top Navbar */}
        <header className={styles.topNav}>
          <div className={styles.navLeft}>
            <button 
              className={styles.menuBtn} 
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={24} />
            </button>
            <h1 className={styles.pageTitle}>{title}</h1>
          </div>

          <div className={styles.navRight}>
            <div 
              className={styles.userProfile} 
              onClick={() => setIsProfileModalOpen(true)}
              style={{ cursor: 'pointer' }}
            >
              <span style={{ color: 'var(--color-muted)' }}>{user?.name || user?.email}</span>
              <div className={styles.avatar} style={user?.avatarUrl ? { padding: 0, overflow: 'hidden' } : {}}>
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  initial
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className={styles.content}>
          <div className={styles.contentInner}>
            {children}
          </div>
        </div>
      </main>

      {/* Profile Modal */}
      <UserProfileModal 
        isOpen={isProfileModalOpen} 
        onClose={() => setIsProfileModalOpen(false)} 
      />
    </div>
  );
};
