import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { Users, Dog, CalendarDays, Globe, AlertTriangle } from 'lucide-react';
import './DashboardPage.css';

export default function DashboardPage() {
    const [stats, setStats] = useState({
        users: 0,
        pets: 0,
        reservations: 0,
        posts: 0,
        reports: 0
    });
    const [recentActivity, setRecentActivity] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                // Fetch counts - wait for all concurrently
                const [
                    { count: usersCount }, 
                    { count: petsCount }, 
                    { count: resCount }, 
                    { count: postsCount }, 
                    { count: repCount },
                    { data: recent }
                ] = await Promise.all([
                    supabase.from('users').select('*', { count: 'exact', head: true }),
                    supabase.from('pets').select('*', { count: 'exact', head: true }),
                    supabase.from('reservations').select('*', { count: 'exact', head: true }),
                    supabase.from('posts').select('*', { count: 'exact', head: true }),
                    supabase.from('reports').select('*', { count: 'exact', head: true }),
                    supabase.from('reservations').select('*').order('createdAt', { ascending: false }).limit(5)
                ]);

                setStats({
                    users: usersCount || 0,
                    pets: petsCount || 0,
                    reservations: resCount || 0,
                    posts: postsCount || 0,
                    reports: repCount || 0
                });

                setRecentActivity(recent || []);
            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    const statCards = [
        { title: 'Total Usuarios', value: stats.users, icon: <Users size={24} />, color: 'var(--primary-color)', bg: 'rgba(59, 130, 246, 0.2)' },
        { title: 'Mascotas', value: stats.pets, icon: <Dog size={24} />, color: '#10b981', bg: 'rgba(16, 185, 129, 0.2)' },
        { title: 'Reservas Totales', value: stats.reservations, icon: <CalendarDays size={24} />, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.2)' },
        { title: 'Publicaciones', value: stats.posts, icon: <Globe size={24} />, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.2)' },
        { title: 'Reportes', value: stats.reports, icon: <AlertTriangle size={24} />, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.2)' }
    ];

    if (loading) {
        return <div className="loading-state"><div className="spinner"></div><p>Cargando panel...</p></div>;
    }

    return (
        <div className="dashboard-container">
            <h2 className="page-title">Vista General</h2>
            
            <div className="stats-grid">
                {statCards.map((card, idx) => (
                    <div className="stat-card glass-panel" key={idx}>
                        <div className="stat-icon-wrapper" style={{ backgroundColor: card.bg, color: card.color }}>
                            {card.icon}
                        </div>
                        <div className="stat-info">
                            <h3>{card.title}</h3>
                            <p className="stat-value">{card.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="dashboard-sections">
                <div className="recent-activity glass-panel">
                    <div className="section-header">
                        <h3>Actividad Reciente (Reservas)</h3>
                    </div>
                    {recentActivity.length === 0 ? (
                        <div className="empty-state">
                            <CalendarDays size={40} />
                            <p>No hay actividad reciente</p>
                        </div>
                    ) : (
                        <div className="activity-list">
                            {recentActivity.map(activity => {
                                return (
                                    <div className="activity-item" key={activity.id}>
                                        <div className="activity-avatar">
                                            {activity.ownerName?.charAt(0) || '?'}
                                        </div>
                                        <div className="activity-details">
                                            <p className="activity-text">
                                                <strong>{activity.ownerName || 'Usuario'}</strong> ha reservado {activity.serviceType === 'walking' ? 'un paseo' : 'estancia'} con <strong>{activity.caregiverName || 'cuidador'}</strong>
                                            </p>
                                            <span className="activity-meta">Estado: <span className={`status-badge ${activity.status || 'pendiente'}`}>{activity.status || 'pendiente'}</span> · {new Date(activity.createdAt).toLocaleDateString('es-ES')}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
