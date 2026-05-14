/**
 * Página de logs del sistema.
 *
 * Suscripción en tiempo real a `system_logs` (canal Realtime de Supabase),
 * carga inicial de los últimos 300 registros, panel de "usuarios activos
 * ahora" calculado a partir de los logins/logouts de los últimos 5 minutos
 * (refresco automático cada 30 s) y filtros por texto y tipo de acción.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faChartLine, faMagnifyingGlass, faRotate, faRightToBracket, faRightFromBracket,
    faUserPlus, faPaw, faCalendarCheck, faTriangleExclamation, faPenToSquare, faTrash,
    faCircle, faCircleInfo
} from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import './UsersPage.css';

const ACTION_META = {
    USER_LOGIN:        { icon: faRightToBracket,    color: '#22c55e', label: 'Inicio sesión' },
    USER_LOGOUT:       { icon: faRightFromBracket,  color: '#94a3b8', label: 'Cierre sesión' },
    USER_SIGNUP:       { icon: faUserPlus,          color: '#3b82f6', label: 'Registro' },
    PET_CREATED:       { icon: faPaw,               color: '#22c55e', label: 'Mascota creada' },
    PET_UPDATED:       { icon: faPenToSquare,       color: '#f59e0b', label: 'Mascota editada' },
    PET_DELETED:       { icon: faTrash,             color: '#ef4444', label: 'Mascota eliminada' },
    RESERVATION_CREATED: { icon: faCalendarCheck,   color: '#22c55e', label: 'Reserva creada' },
    RESERVATION_UPDATED: { icon: faPenToSquare,     color: '#f59e0b', label: 'Reserva actualizada' },
    REPORT_CREATED:    { icon: faTriangleExclamation, color: '#ef4444', label: 'Reporte creado' },
    WALK_COMPLETED:    { icon: faPaw,               color: '#22c55e', label: 'Paseo completado' },
};

const DETAIL_LABELS = {
    event: 'Evento', platform: 'Plataforma', version: 'Versión',
    totalKm: 'Distancia (km)', totalkmm: 'Distancia (km)', totalkm: 'Distancia (km)', distance: 'Distancia (km)',
    calories: 'Calorías', petName: 'Mascota', duration: 'Duración (s)',
    steps: 'Pasos', reason: 'Motivo', type: 'Tipo',
    serviceType: 'Servicio', status: 'Estado', role: 'Rol', amount: 'Importe',
};

/**
 * Convierte el JSON de detalles de un log en una cadena legible
 * traduciendo claves al español con `DETAIL_LABELS`.
 *
 * @param {string|null|undefined} raw
 * @returns {string|null}
 */
function formatDetails(raw) {
    if (!raw) return null;
    try {
        const obj = JSON.parse(raw);
        const entries = Object.entries(obj).filter(([, v]) => v != null && v !== '');
        if (entries.length === 0) return null;
        return entries.map(([k, v]) => `${DETAIL_LABELS[k] || k}: ${v}`).join(' · ');
    } catch {
        return raw;
    }
}

/** Devuelve los metadatos visuales de un tipo de acción (icono/color/etiqueta). */
function actionMeta(actionType) {
    return ACTION_META[actionType] || { icon: faCircleInfo, color: '#94a3b8', label: actionType };
}

/** Devuelve un texto relativo ("hace 5m", "hace 2h"...) a partir de una fecha. */
function timeAgo(date) {
    if (!date) return '';
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `hace ${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `hace ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `hace ${hours}h`;
    const days = Math.floor(hours / 24);
    return `hace ${days}d`;
}

export default function LogsPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [actionFilter, setActionFilter] = useState('all');
    const [autoTick, setAutoTick] = useState(0);
    const [liveUsers, setLiveUsers] = useState([]);

    useEffect(() => {
        const id = setInterval(() => setAutoTick(prev => prev + 1), 30000);
        return () => clearInterval(id);
    }, []);

    /**
     * Carga los usuarios actualmente activos. Se basa en la presencia real
     * de la tabla `public.users` (`isOnline = true` o `last_seen` en los
     * últimos 5 min), no en los logs, para reflejar la actividad aunque la
     * sesión se haya restaurado sin generar un USER_LOGIN nuevo.
     */
    const fetchLiveUsers = async () => {
        try {
            const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
            const { data, error } = await supabase
                .from('users')
                .select('id, email, "fullName", "isOnline", last_seen')
                .or(`isOnline.eq.true,last_seen.gte.${fiveMinAgo}`)
                .limit(100);
            if (!error && data) {
                setLiveUsers(data.map(u => ({
                    userId:     u.id,
                    email:      u.email,
                    fullName:   u.fullName,
                    isOnline:   u.isOnline,
                    lastSeen:   u.last_seen,
                })));
            }
        } catch (err) {
            console.error('Error fetching live users:', err);
        }
    };
    useEffect(() => {
        fetchLiveUsers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoTick]);

    /** Carga los últimos 300 logs ordenados por fecha descendente. */
    const fetchLogs = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('system_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(300);
            if (error) throw error;
            if (data) setLogs(data);
        } catch (error) {
            console.error('Error fetching logs:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
        window.addEventListener('pawmate:wake', fetchLogs);
        const channel = supabase
            .channel('admin:system_logs')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'system_logs' }, (payload) => {
                setLogs(prev => [payload.new, ...prev].slice(0, 300));
            })
            .subscribe();
        return () => {
            window.removeEventListener('pawmate:wake', fetchLogs);
            supabase.removeChannel(channel);
        };
    }, []);

    const filteredLogs = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return logs.filter(log => {
            if (actionFilter !== 'all' && log.actionType !== actionFilter) return false;
            if (!term) return true;
            const blob = `${log.actionType} ${log.entity} ${log.userEmail} ${log.userId} ${log.details || ''}`.toLowerCase();
            return blob.includes(term);
        });
    }, [logs, searchTerm, actionFilter]);

    const uniqueActions = useMemo(() => {
        const set = new Set(logs.map(l => l.actionType).filter(Boolean));
        return Array.from(set).sort();
    }, [logs]);

    return (
        <div className="page-container">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 className="page-title" style={{ margin: 0 }}>{t('logs.pageTitle')}</h1>
                <button className="btn-secondary" onClick={fetchLogs} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FontAwesomeIcon icon={faRotate} style={{ fontSize: 16 }} /> {t('logs.refresh')}
                </button>
            </div>

            <div className="glass-panel" style={{ padding: 16, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <FontAwesomeIcon icon={faCircle} style={{ fontSize: 10, color: '#22c55e' }} />
                    <h3 style={{ margin: 0, fontSize: 16 }}>Usuarios activos ahora ({liveUsers.length})</h3>
                </div>
                {liveUsers.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 13 }}>Nadie activo en los últimos 5 minutos.</p>
                ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {liveUsers.map(u => (
                            <button
                                key={u.userId}
                                onClick={() => navigate(`/users/${u.userId}`)}
                                style={{
                                    background: 'rgba(34,197,94,0.1)',
                                    border: '1px solid rgba(34,197,94,0.3)',
                                    borderRadius: 20, padding: '6px 14px', cursor: 'pointer',
                                    color: 'inherit', fontSize: 13,
                                    display: 'flex', alignItems: 'center', gap: 6,
                                }}
                                title={u.isOnline ? 'Online ahora' : `Última actividad ${timeAgo(u.lastSeen)}`}
                            >
                                <FontAwesomeIcon icon={faCircle} style={{ fontSize: 8, color: u.isOnline ? '#22c55e' : '#f59e0b' }} />
                                <span style={{ fontWeight: 500 }}>{u.fullName || u.email}</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{u.isOnline ? 'online' : timeAgo(u.lastSeen)}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="filters-bar glass-panel">
                <div className="search-box">
                    <FontAwesomeIcon icon={faMagnifyingGlass} style={{ fontSize: 18 }} className="search-icon" />
                    <input
                        type="text"
                        placeholder={t('logs.searchPlaceholder')}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <select className="filter-select" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
                    <option value="all">Todas las acciones</option>
                    {uniqueActions.map(a => (
                        <option key={a} value={a}>{actionMeta(a).label}</option>
                    ))}
                </select>
            </div>

            {loading ? (
                <div className="loading-state"><div className="spinner"></div><p>{t('logs.loading')}</p></div>
            ) : (
                <div className="table-container glass-panel">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>{t('logs.colDate')}</th>
                                <th>{t('logs.colUser')}</th>
                                <th>{t('logs.colAction')}</th>
                                <th>{t('logs.colEntity')}</th>
                                <th>{t('logs.colTechDetails')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="empty-cell">
                                        <FontAwesomeIcon icon={faChartLine} style={{ fontSize: 40, margin: '0 auto 16px auto', display: 'block', opacity: 0.5 }} />
                                        {t('logs.noLogs')}
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map((log, index) => {
                                    const meta = actionMeta(log.actionType);
                                    const clickable = log.userId && log.userId !== 'Sistema';
                                    return (
                                        <tr key={log.id || `log-${index}`}>
                                            <td style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                                <div>{log.created_at ? new Date(log.created_at).toLocaleString('es-ES') : '-'}</div>
                                                <div style={{ fontSize: 11, opacity: 0.7 }}>{timeAgo(log.created_at)}</div>
                                            </td>
                                            <td>
                                                {clickable ? (
                                                    <button
                                                        onClick={() => navigate(`/users/${log.userId}`)}
                                                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', textAlign: 'left' }}
                                                    >
                                                        <div className="user-info">
                                                            <span className="user-name" style={{ color: 'var(--primary-color)' }}>{log.userEmail}</span>
                                                            <span className="user-id">{(log.userId || '').substring(0, 8)}...</span>
                                                        </div>
                                                    </button>
                                                ) : (
                                                    <div className="user-info">
                                                        <span className="user-name text-muted">{log.userEmail || '-'}</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                <span style={{
                                                    color: meta.color, fontWeight: 600, fontSize: 13,
                                                    backgroundColor: 'rgba(255,255,255,0.05)',
                                                    padding: '4px 10px', borderRadius: 12,
                                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                                }}>
                                                    <FontAwesomeIcon icon={meta.icon} style={{ fontSize: 12 }} />
                                                    {meta.label}
                                                </span>
                                            </td>
                                            <td><span className="text-muted" style={{ fontWeight: 500 }}>{log.entity}</span></td>
                                            <td style={{ maxWidth: 300 }}>
                                                {(() => {
                                                    const text = formatDetails(log.details);
                                                    return text ? (
                                                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }} title={log.details}>
                                                            {text}
                                                        </span>
                                                    ) : <span style={{ color: 'var(--text-muted)', opacity: 0.4 }}>-</span>;
                                                })()}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
