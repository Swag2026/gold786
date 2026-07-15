import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import { apiGet } from '../lib/api';
import ProfileModal from './ProfileModal.jsx';
import ShortcutsModal from './ShortcutsModal.jsx';
import WelcomeTour from './WelcomeTour.jsx';
import ForcePasswordModal from './ForcePasswordModal.jsx';

// data-role from the original nav-item elements — kept as an array so a page
// can be shown to multiple roles ('supervisor', 'admin') or just one.
const NAV_ITEMS = [
  { section: 'nav.main', items: [
    { to: '/', key: 'nav.dashboard', end: true },
    { to: '/entry', key: 'nav.entry' },
    { to: '/history', key: 'nav.history', badge: 'history' },
  ]},
  { section: 'nav.reports_label', items: [
    { to: '/activity', key: 'nav.activity', badge: 'activity' },
    { to: '/analytics', key: 'nav.analytics', roles: ['supervisor', 'admin'] },
    { to: '/reports', key: 'nav.reports', roles: ['supervisor', 'admin'] },
  ]},
  { section: 'nav.tools', items: [
    { to: '/contacts', key: 'nav.contacts', badge: 'contacts' },
    { to: '/profit', key: 'nav.profit', roles: ['supervisor', 'admin'] },
  ]},
  { section: 'nav.system', items: [
    { to: '/settings', key: 'nav.settings', roles: ['admin'] },
    { to: '/users', key: 'nav.users', roles: ['admin'] },
  ]},
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, setTheme, toggleTheme } = useTheme();
  const { lang, toggleLang, t } = useLanguage();
  const [showProfile, setShowProfile] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showTour, setShowTour] = useState(() => !localStorage.getItem('sg_tour_seen'));
  const [counts, setCounts] = useState({ history: 0, activity: 0, contacts: 0 });
  const navigate = useNavigate();

  useEffect(() => {
    function onKeyDown(e) {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Escape') { setShowProfile(false); setShowShortcuts(false); return; }
      if (e.key === '?') { setShowShortcuts(true); return; }
      if (e.key === 'n' || e.key === 'N') { navigate('/entry'); return; }
      if (e.key === 'd' || e.key === 'D') { navigate('/'); return; }
      if (e.key === 'a' || e.key === 'A') { navigate('/activity'); return; }
      if (e.key === '/') { e.preventDefault(); navigate('/history'); return; }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate]);

  useEffect(() => {
    Promise.all([
      apiGet('/invoices/count').catch(() => ({ total: 0 })),
      apiGet('/activity-logs').catch(() => []),
      apiGet('/contacts').catch(() => []),
    ]).then(([invCount, logs, contacts]) => {
      setCounts({
        history: invCount?.total || 0,
        activity: Array.isArray(logs) ? logs.length : 0,
        contacts: Array.isArray(contacts) ? contacts.length : 0,
      });
    });
  }, []);

  const canSee = (item) => !item.roles || item.roles.includes(user?.role);

  return (
    <div id="app">
      <div className="shell">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-gem">
              <img src="/logo.png" alt="Swag Gold" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 5 }} onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.textContent = '◆'; }} />
            </div>
            <div className="brand-mark">{t('brand.name')}</div>
            <div className="brand-sub">{t('brand.sub')}</div>
          </div>

          <nav className="nav">
            {NAV_ITEMS.map(group => (
              <div key={group.section}>
                <div className="nav-label">{t(group.section)}</div>
                {group.items.filter(canSee).map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
                  >
                    <span className="nav-left">
                      <span>{t(item.key)}</span>
                    </span>
                    {item.badge && <span className="nav-badge">{counts[item.badge]}</span>}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>

          <div className="sidebar-foot">
            <div className="user-row" onClick={() => setShowProfile(true)} style={{ cursor: 'pointer' }} title="Edit profile">
              <div className="user-avatar">
                {user?.avatar
                  ? <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  : (user?.name || user?.username || '?')[0]?.toUpperCase()}
              </div>
              <div className="user-info">
                <div className="user-name">{user?.name || user?.username}</div>
                <div className="user-role">{user?.role}</div>
              </div>
            </div>
            <div className="sidebar-actions">
              <button className="sidebar-btn" onClick={() => setShowProfile(true)}>{t('sidebar.profile')}</button>
              <button className="sidebar-btn" onClick={logout}>{t('sidebar.signout')}</button>
            </div>
            <div className="sidebar-actions" style={{ marginTop: 8 }}>
              <button className="sidebar-btn" onClick={() => setShowShortcuts(true)} style={{ flex: 1 }}>{t('sidebar.shortcuts')}</button>
            </div>
            <div className="app-dock" role="group" aria-label="Quick actions">
              <button
                className={'app-dock-btn' + (theme === 'light' ? ' active' : '')}
                onClick={() => setTheme('light')}
                aria-label="Light mode" title="Light"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                </svg>
                <span>{t('dock.light')}</span>
              </button>
              <button
                className={'app-dock-btn' + (theme === 'dark' ? ' active' : '')}
                onClick={() => setTheme('dark')}
                aria-label="Dark mode" title="Dark"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
                <span>{t('dock.dark')}</span>
              </button>
              <button className="app-dock-btn" onClick={() => navigate('/settings')} aria-label="Open Settings" title="Settings">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                <span>{t('dock.settings')}</span>
              </button>
            </div>
            <div className="theme-toggle" style={{ marginTop: 10 }}>
              <span style={{ fontSize: 12.5, color: 'var(--cream-faint)' }}>Language / اللغة</span>
              <button
                onClick={toggleLang}
                style={{
                  background: 'var(--surface-2)', border: '1.5px solid var(--gold-21)', color: 'var(--gold-24)',
                  padding: '3px 12px', borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  fontFamily: "'IBM Plex Mono',monospace", letterSpacing: '.04em',
                }}
              >
                {lang === 'en' ? 'عربي' : 'English'}
              </button>
            </div>
          </div>
        </aside>

        <main className="main">
          <Outlet />
        </main>
      </div>
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
      {!user?.mustChangePassword && showTour && <WelcomeTour onClose={() => setShowTour(false)} />}
      {user?.mustChangePassword && <ForcePasswordModal />}
    </div>
  );
}
