import React, { useState, useContext, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { supabase } from '../config/supabase';
import { 
    LayoutDashboard, Users, Dog, CalendarDays, 
    MessageSquare, AlertTriangle, 
    LogOut, Menu, X, Activity, Sun, Moon,
    UserCog, ShieldPlus, ShieldCheck, Wifi, WifiOff
} from 'lucide-react';
import './AdminLayout.css';

export default function AdminLayout() {
    const { logout, adminUser } = useContext(AuthContext);
    const { theme, toggleTheme } = useContext(ThemeContext);
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [realtimeConnected, setRealtimeConnected] = useState(false);

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
        { path: '/', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
        { path: '/users', label: 'Usuarios', icon: <Users size={20} /> },
        { path: '/pets', label: 'Mascotas', icon: <Dog size={20} /> },
        { path: '/reservations', label: 'Reservas', icon: <CalendarDays size={20} /> },
        { path: '/messages', label: 'Mensajes', icon: <MessageSquare size={20} /> },
        { path: '/reports', label: 'Reportes y Reseñas', icon: <AlertTriangle size={20} /> },
        { path: '/logs', label: 'Audit Logs', icon: <Activity size={20} /> },
        { path: '/verifications', label: 'Verificaciones', icon: <ShieldCheck size={20} /> },
        { path: '/admins', label: 'Administradores', icon: <ShieldPlus size={20} /> },
    ];

    return (
        <div className="admin-layout">
            {sidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar}></div>}

            <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <h2>PawMate Admin</h2>
                    <button className="mobile-close-btn" onClick={closeSidebar}>
                        <X size={24} />
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
                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                        <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}</span>
                    </button>
                    <button onClick={handleLogout} className="logout-btn">
                        <LogOut size={20} />
                        <span>Cerrar Sesión</span>
                    </button>
                </div>
            </aside>

            <main className="main-content">
                <header className="topbar">
                    <button className="mobile-menu-btn" onClick={toggleSidebar}>
                        <Menu size={24} />
                    </button>
                    <div className="topbar-welcome">
                        <span className="welcome-text">Hola, <strong>{displayName}</strong></span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 12, fontSize: 11, color: realtimeConnected ? '#22c55e' : '#ef4444', fontWeight: 600 }} title={realtimeConnected ? 'Realtime conectado' : 'Realtime desconectado'}>
                            {realtimeConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
                            {realtimeConnected ? 'Live' : 'Offline'}
                        </span>
                    </div>
                    <div className="admin-profile" onClick={() => navigate('/profile')} style={{ cursor: 'pointer' }} title="Mi Perfil">
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
