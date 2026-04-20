import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../config/supabase';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faDog, faCalendarDays, faTriangleExclamation, faWifi } from '@fortawesome/free-solid-svg-icons';
import './DashboardPage.css';

export default function DashboardPage() {
    const { t } = useTranslation();
    const [stats, setStats] = useState({
        users: 0,
        pets: 0,
        reservations: 0,
        reports: 0,
        onlineCaregivers: 0
    });
    const [recentActivity, setRecentActivity] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchDashboardData = useCallback(async () => {
        try {
            const [
                { count: usersCount }, 
                { count: petsCount }, 
                { count: resCount }, 
                { count: repCount },
                { count: onlineCount },
                { data: recent }
            ] = await Promise.all([
                supabase.from('users').select('*', { count: 'exact', head: true }),
                supabase.from('pets').select('*', { count: 'exact', head: true }),
                supabase.from('reservations').select('*', { count: 'exact', head: true }),
                supabase.from('reports').select('*', { count: 'exact', head: true }),
                supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'caregiver').eq('isOnline', true),
                supabase.from('reservations').select('*').order('created_at', { ascending: false }).limit(5)
            ]);

            setStats({
                users: usersCount || 0,
                pets: petsCount || 0,
                reservations: resCount || 0,
                reports: repCount || 0,
                onlineCaregivers: onlineCount || 0
            });
            setRecentActivity(recent || []);
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDashboardData();

        // ── Realtime: auto-refresh on any DB change (debounced) ──
        let debounceTimer = null;
        const debouncedFetch = () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(fetchDashboardData, 1000);
        };
        const channels = [];

        const usersChannel = supabase
            .channel('admin:dash:users')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, debouncedFetch)
            .subscribe();
        channels.push(usersChannel);

        const petsChannel = supabase
            .channel('admin:dash:pets')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pets' }, debouncedFetch)
            .subscribe();
        channels.push(petsChannel);

        const resChannel = supabase
            .channel('admin:dash:reservations')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, debouncedFetch)
            .subscribe();
        channels.push(resChannel);

        const repChannel = supabase
            .channel('admin:dash:reports')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, debouncedFetch)
            .subscribe();
        channels.push(repChannel);

        return () => {
            clearTimeout(debounceTimer);
            channels.forEach(ch => supabase.removeChannel(ch));
        };
    }, [fetchDashboardData]);

    const statCards = [
        { title: t('dashboard.totalUsers'), value: stats.users, icon: <FontAwesomeIcon icon={faUsers} style={{ fontSize: 24 }} />, color: 'var(--primary-color)', bg: 'rgba(59, 130, 246, 0.2)' },
        { title: t('dashboard.pets'), value: stats.pets, icon: <FontAwesomeIcon icon={faDog} style={{ fontSize: 24 }} />, color: '#10b981', bg: 'rgba(16, 185, 129, 0.2)' },
        { title: t('dashboard.totalReservations'), value: stats.reservations, icon: <FontAwesomeIcon icon={faCalendarDays} style={{ fontSize: 24 }} />, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.2)' },
        { title: t('dashboard.reports'), value: stats.reports, icon: <FontAwesomeIcon icon={faTriangleExclamation} style={{ fontSize: 24 }} />, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.2)' },
        { title: t('dashboard.onlineCaregivers'), value: stats.onlineCaregivers, icon: <FontAwesomeIcon icon={faWifi} style={{ fontSize: 24 }} />, color: '#22c55e', bg: 'rgba(34, 197, 94, 0.2)' }
    ];

    if (loading) {
        return <div className="loading-state"><div className="spinner"></div><p>{t('dashboard.loading')}</p></div>;
    }

    return (
        <div className="dashboard-container">
            <h2 className="page-title">{t('dashboard.pageTitle')}</h2>
            
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
                        <h3>{t('dashboard.recentActivity')}</h3>
                    </div>
                    {recentActivity.length === 0 ? (
                        <div className="empty-state">
                            <FontAwesomeIcon icon={faCalendarDays} style={{ fontSize: 40 }} />
                            <p>{t('dashboard.noRecentActivity')}</p>
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
                                                <strong>{activity.ownerName || t('dashboard.userFallback')}</strong> {t('dashboard.hasBooked')} {activity.serviceType === 'walking' ? t('dashboard.walkService') : t('dashboard.stayService')} con <strong>{activity.caregiverName || t('dashboard.caregiverFallback')}</strong>
                                            </p>
                                            <span className="activity-meta">{t('dashboard.statusLabel')} <span className={`status-badge ${activity.status || 'pendiente'}`}>{activity.status || t('dashboard.pendingStatus')}</span> · {new Date(activity.created_at).toLocaleDateString()}</span>
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
