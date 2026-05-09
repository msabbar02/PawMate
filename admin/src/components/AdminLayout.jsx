import React, { useState, useContext, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { supabase } from '../config/supabase';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGauge, faUsers, faDog, faCalendarDays, faTriangleExclamation, faRightFromBracket, faBars, faXmark, faChartLine, faSun, faMoon, faShieldHeart, faShieldHalved, faWifi, faComments } from '@fortawesome/free-solid-svg-icons';
import './AdminLayout.css';

export default function AdminLayout() {
    const { logout, adminUser } = useContext(AuthContext);
    const { theme, toggleTheme } = useContext(ThemeContext);
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [realtimeConnected, setRealtimeConnected] = useState(false);

    const toggleLang = () => {
        const newLang = i18n.language === 'es' ? 'en' : 'es';
        i18n.changeLanguage(newLang);
        localStorage.setItem('@pawmate_admin_lang', newLang);
    };

    // ── Realtime connection heartbeat ──
    useEffect(() => {
        const channel = supabase
            .channel('admin:heartbeat')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {})
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    setRealtimeConnected(true);
                } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    setRealtimeConnected(false);
                }
            });

        // Fallback: check connection state periodically
        const interval = setInterval(() => {
            const channels = supabase.getChannels();
            const heartbeat = channels.find(c => c.topic === 'realtime:admin:heartbeat');
            setRealtimeConnected(heartbeat?.state === 'joined');
        }, 10000);

        return () => {
            clearInterval(interval);
            supabase.removeChannel(channel);
        };
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
    const closeSidebar = () => setSidebarOpen(false);

    const displayName = adminUser?.fullName || adminUser?.firstName || adminUser?.email?.split('@')[0] || 'Admin';
    const initials = displayName.charAt(0).toUpperCase();

    const navItems = [
        { path: '/', label: t('sidebar.dashboard'), icon: <FontAwesomeIcon icon={faGauge} style={{ fontSize: 20 }} /> },
        { path: '/users', label: t('sidebar.users'), icon: <FontAwesomeIcon icon={faUsers} style={{ fontSize: 20 }} /> },
        { path: '/pets', label: t('sidebar.pets'), icon: <FontAwesomeIcon icon={faDog} style={{ fontSize: 20 }} /> },
        { path: '/reservations', label: t('sidebar.reservations'), icon: <FontAwesomeIcon icon={faCalendarDays} style={{ fontSize: 20 }} /> },
        { path: '/reports', label: t('sidebar.reports'), icon: <FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 20 }} /> },
        { path: '/logs', label: t('sidebar.logs'), icon: <FontAwesomeIcon icon={faChartLine} style={{ fontSize: 20 }} /> },
        { path: '/verifications', label: t('sidebar.verifications'), icon: <FontAwesomeIcon icon={faShieldHalved} style={{ fontSize: 20 }} /> },
        { path: '/admins', label: t('sidebar.admins'), icon: <FontAwesomeIcon icon={faShieldHeart} style={{ fontSize: 20 }} /> },
        { path: '/community', label: t('sidebar.community'), icon: <FontAwesomeIcon icon={faComments} style={{ fontSize: 20 }} /> },
    ];

    return (
        <div className="admin-layout">
            {sidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar}></div>}

            <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <img src="/logo.svg" alt="PawMate" style={{ height: 40, width: 'auto', objectFit: 'contain' }} />
                    <button className="mobile-close-btn" onClick={closeSidebar}>
                        <FontAwesomeIcon icon={faXmark} style={{ fontSize: 24 }} />
                    </button>
                </div>

                <nav className="sidebar-nav">
                    {navItems.map(item => (
                        <NavLink 
                            key={item.path} 
                            to={item.path} 
                            className={({ isActive }) => `nav-item ${isActive && (item.path === '/' ? window.location.pathname === '/' : window.location.pathname.startsWith(item.path)) ? 'active' : ''}`}
                            onClick={closeSidebar}
                        >
                            {item.icon}
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <button onClick={toggleTheme} className="theme-toggle-btn">
                        {theme === 'dark' ? <FontAwesomeIcon icon={faSun} style={{ fontSize: 18 }} /> : <FontAwesomeIcon icon={faMoon} style={{ fontSize: 18 }} />}
                        <span>{theme === 'dark' ? t('sidebar.lightMode') : t('sidebar.darkMode')}</span>
                    </button>
                    <button onClick={toggleLang} className="theme-toggle-btn">
                        {i18n.language === 'es' ? 'English' : 'Español'}
                    </button>
                    <button onClick={handleLogout} className="logout-btn">
                        <FontAwesomeIcon icon={faRightFromBracket} style={{ fontSize: 20 }} />
                        <span>{t('sidebar.logout')}</span>
                    </button>
                </div>
            </aside>

            <main className="main-content">
                <header className="topbar">
                    <button className="mobile-menu-btn" onClick={toggleSidebar}>
                        <FontAwesomeIcon icon={faBars} style={{ fontSize: 24 }} />
                    </button>
                    <div className="topbar-welcome">
                        <span className="welcome-text">{t('topbar.greeting')} <strong>{displayName}</strong></span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 12, fontSize: 11, color: realtimeConnected ? '#22c55e' : '#ef4444', fontWeight: 600 }} title={realtimeConnected ? t('topbar.realtimeConnected') : t('topbar.realtimeDisconnected')}>
                            {realtimeConnected ? <FontAwesomeIcon icon={faWifi} style={{ fontSize: 12 }} /> : <FontAwesomeIcon icon={faWifi} style={{ fontSize: 12, opacity: 0.4 }} />}
                            {realtimeConnected ? t('topbar.live') : t('topbar.offline')}
                        </span>
                    </div>
                    <div className="admin-profile" onClick={() => navigate('/profile')} style={{ cursor: 'pointer' }} title={t('topbar.myProfile')}>
                        <div className="admin-avatar">
                            {adminUser?.photoURL ? (
                                <img src={adminUser.photoURL} alt="avatar" className="admin-avatar-img" />
                            ) : (
                                initials
                            )}
                        </div>
                        <span className="admin-name">{displayName}</span>
                    </div>
                </header>
                
                <div className="content-container">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
