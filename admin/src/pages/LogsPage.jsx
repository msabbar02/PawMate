import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartLine, faMagnifyingGlass, faRotate } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import './UsersPage.css'; // Utilizing standard styles

export default function LogsPage() {
    const { t } = useTranslation();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('system_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;
            if (data) setLogs(data);
        } catch (error) {
            console.error("Error fetching logs:", error);
            // Si la tabla no existe aún, data será null/error, evitamos crash
        } finally {
            setLoading(false);
        }
    };

    const filteredLogs = logs.filter(log => {
        const searchMsg = `${log.actionType} ${log.entity} ${log.userEmail} ${log.userId}`.toLowerCase();
        return searchMsg.includes(searchTerm.toLowerCase());
    });

    const getActionColor = (action) => {
        if (action.includes('CREATED') || action.includes('LOGIN')) return 'var(--success-color)';
        if (action.includes('DELETED') || action.includes('LOGOUT')) return 'var(--danger-color)';
        if (action.includes('UPDATED')) return 'var(--primary-color)';
        return 'var(--text-muted)';
    };

    return (
        <div className="page-container">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 className="page-title" style={{ margin: 0 }}>{t('logs.pageTitle')}</h1>
                <button className="btn-secondary" onClick={fetchLogs} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FontAwesomeIcon icon={faRotate} style={{ fontSize: 16 }} /> {t('logs.refresh')}
                </button>
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
                                filteredLogs.map((log, index) => (
                                    <tr key={log.id || `log-${index}`}>
                                        <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                            {log.created_at ? new Date(log.created_at).toLocaleString('es-ES') : '-'}
                                        </td>
                                        <td>
                                            <div className="user-info">
                                                <span className="user-name">{log.userEmail}</span>
                                                <span className="user-id">{log.userId}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span style={{ 
                                                color: getActionColor(log.actionType),
                                                fontWeight: 600,
                                                fontSize: '13px',
                                                backgroundColor: 'rgba(255,255,255,0.05)',
                                                padding: '4px 10px',
                                                borderRadius: '12px'
                                            }}>
                                                {log.actionType}
                                            </span>
                                        </td>
                                        <td><span className="text-muted" style={{ fontWeight: 500 }}>{log.entity}</span></td>
                                        <td style={{ maxWidth: '250px' }}>
                                            <p style={{ 
                                                fontSize: '11px', 
                                                color: 'var(--text-muted)', 
                                                fontFamily: 'monospace',
                                                whiteSpace: 'nowrap', 
                                                overflow: 'hidden', 
                                                textOverflow: 'ellipsis' 
                                            }}>
                                                {log.details || '-'}
                                            </p>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
