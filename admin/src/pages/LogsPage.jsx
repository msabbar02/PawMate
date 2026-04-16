import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { Activity, Search, RefreshCw } from 'lucide-react';
import './UsersPage.css'; // Utilizing standard styles

export default function LogsPage() {
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
                <h1 className="page-title" style={{ margin: 0 }}>System Logs</h1>
                <button className="btn-secondary" onClick={fetchLogs} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <RefreshCw size={16} /> Refrescar
                </button>
            </div>

            <div className="filters-bar glass-panel">
                <div className="search-box">
                    <Search size={18} className="search-icon" />
                    <input 
                        type="text" 
                        placeholder="Buscar log por acción, email, id o entidad..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <div className="loading-state"><div className="spinner"></div><p>Cargando auditoría...</p></div>
            ) : (
                <div className="table-container glass-panel">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Fecha Reali.</th>
                                <th>Usuario</th>
                                <th>Acción</th>
                                <th>Entidad</th>
                                <th>Detalles Téc.</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="empty-cell">
                                        <Activity size={40} style={{ margin: '0 auto 16px auto', display: 'block', opacity: 0.5 }} />
                                        No hay registros o no se ha creado la tabla aún
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map(log => (
                                    <tr key={log.id || Math.random()}>
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
