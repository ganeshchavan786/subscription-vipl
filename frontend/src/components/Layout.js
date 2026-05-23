import React from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';

const NAV = [
  { to: '/dashboard',     icon: '◎', label: 'Dashboard' },
  { to: '/subscriptions', icon: '♻', label: 'Subscriptions' },
  { to: '/customers',     icon: '👥', label: 'Customers' },
  { to: '/products',      icon: '📦', label: 'Products' },
];

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) || '?';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-brand-text">SubTrack <span>pro</span></span>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section">Menu</div>
          {NAV.map(n => (
            <Link key={n.to} to={n.to} className={`nav-item${pathname.startsWith(n.to) ? ' active' : ''}`}>
              <span className="nav-icon">{n.icon}</span> {n.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-avatar">{initials}</div>
            <div className="user-info">
              <div className="user-name">{user?.name}</div>
              <div className="user-role">Admin</div>
            </div>
          </div>
          <button className="btn-signout" onClick={() => { logout(); navigate('/login'); }}>
            <span>↩</span> Sign Out
          </button>
        </div>
      </aside>
      <div className="page-content">{children}</div>
    </div>
  );
};

export default Layout;
