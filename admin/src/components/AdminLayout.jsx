import React, { useState, useContext } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { 
    LayoutDashboard, Users, Dog, CalendarDays, 
    MessageSquare, Globe, AlertTriangle, 
    LogOut, Menu, X 
} from 'lucide-react';
import './AdminLayout.css';

export default function AdminLayout() {
    const { logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
    const closeSidebar = () => setSidebarOpen(false);

    const navItems = [
        { path: '/', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
        { path: '/users', label: 'Usuarios', icon: <Users size={20} /> },
        { path: '/pets', label: 'Mascotas', icon: <Dog size={20} /> },
        { path: '/reservations', label: 'Reservas', icon: <CalendarDays size={20} /> },
        { path: '/messages', label: 'Mensajes', icon: <MessageSquare size={20} /> },
        { path: '/community', label: 'Comunidad', icon: <Globe size={20} /> },
        { path: '/reports', label: 'Reportes y Reseñas', icon: <AlertTriangle size={20} /> },
    ];

    return (
        <div className="admin-layout">
            {/* Mobile overlay */}
            {sidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar}></div>}

            {/* Sidebar */}
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
                    <button onClick={handleLogout} className="logout-btn">
                        <LogOut size={20} />
                        <span>Cerrar Sesión</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content">
                <header className="topbar">
                    <button className="mobile-menu-btn" onClick={toggleSidebar}>
                        <Menu size={24} />
                    </button>
                    <div className="topbar-title">
                        <h1>Panel de Control</h1>
                    </div>
                    <div className="admin-profile">
                        <div className="admin-avatar">A</div>
                        <span className="admin-name">Auth Admin</span>
                    </div>
                </header>
                
                <div className="content-container">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
