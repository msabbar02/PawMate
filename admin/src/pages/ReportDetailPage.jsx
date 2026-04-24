import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faTriangleExclamation, faUser, faEye, faCheck, faTrash, faBan } from '@fortawesome/free-solid-svg-icons';
import './DetailPage.css';

function formatDate(d) { return d ? new Date(d).toLocaleString('es-ES') : '-'; }

function Badge({ status }) {
    const map = {
        pending:  { cls: 'amber', label: 'Pendiente' },
        resolved: { cls: 'green', label: 'Resuelto' },
        rejected: { cls: 'red',   label: 'Rechazado' },
    };
    const m = map[status] || { cls: 'gray', label: status || 'pending' };
    return <span className={`detail-badge ${m.cls}`}>{m.label}</span>;
}

export default function ReportDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [report, setReport] = useState(null);
    const [reporter, setReporter] = useState(null);
    const [reported, setReported] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const { data: r } = await supabase.from('reports').select('*').eq('id', id).single();
            setReport(r);
            if (r) {
                const [rep, ed] = await Promise.all([
                    r.reporterUserId ? supabase.from('users').select('id, fullName, email, photoURL').eq('id', r.reporterUserId).single() : Promise.resolve({ data: null }),
                    r.reportedUserId ? supabase.from('users').select('id, fullName, email, photoURL, is_banned').eq('id', r.reportedUserId).single() : Promise.resolve({ data: null }),
                ]);
                setReporter(rep.data); setReported(ed.data);
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [id]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const updateStatus = async (status) => {
        const { error } = await supabase.from('reports').update({ status }).eq('id', id);
        if (error) return alert('Error: ' + error.message);
        setReport({ ...report, status });
    };

    const handleBanReported = async () => {
        if (!reported) return;
        if (!window.confirm(`¿Banear a ${reported.fullName || reported.email}?`)) return;
        const { error } = await supabase.from('users').update({ is_banned: true }).eq('id', reported.id);
        if (error) return alert('Error: ' + error.message);
        setReported({ ...reported, is_banned: true });
    };

    const handleDelete = async () => {
        if (!window.confirm('¿Eliminar este reporte?')) return;
        const { error } = await supabase.from('reports').delete().eq('id', id);
        if (error) return alert('Error: ' + error.message);
        navigate('/reports');
    };

    if (loading) return <div className="detail-loading">Cargando reporte...</div>;
    if (!report) return <div className="detail-loading">Reporte no encontrado.</div>;

    return (
        <div className="detail-page">
            <div className="detail-header">
                <button className="detail-back-btn" onClick={() => navigate(-1)}>
                    <FontAwesomeIcon icon={faArrowLeft} /> Volver
                </button>
                <div>
                    <h1 className="detail-title">Reporte: {report.reason || 'Sin motivo'}</h1>
                    <div className="detail-subtitle">ID: <span style={{ fontFamily: 'monospace' }}>{report.id}</span></div>
                </div>
            </div>

            <div className="detail-grid">
                <div>
                    <div className="detail-card">
                        <h2><FontAwesomeIcon icon={faTriangleExclamation} className="icon" /> Detalle</h2>
                        <div className="detail-row"><span className="label">Estado</span><span className="value"><Badge status={report.status || 'pending'} /></span></div>
                        <div className="detail-row"><span className="label">Motivo</span><span className="value">{report.reason || '-'}</span></div>
                        <div className="detail-row"><span className="label">Categoría</span><span className="value">{report.category || '-'}</span></div>
                        <div className="detail-row"><span className="label">Descripción</span><span className="value">{report.description || '-'}</span></div>
                        <div className="detail-row"><span className="label">Tipo entidad</span><span className="value">{report.entityType || '-'}</span></div>
                        <div className="detail-row"><span className="label">ID entidad</span><span className="value mono" style={{ fontSize: 11 }}>{report.entityId || '-'}</span></div>
                        <div className="detail-row"><span className="label">Creado</span><span className="value">{formatDate(report.created_at)}</span></div>
                    </div>

                    {report.imageUrl && (
                        <div className="detail-card">
                            <h2>Imagen adjunta</h2>
                            <a href={report.imageUrl} target="_blank" rel="noreferrer">
                                <img className="detail-doc-img" src={report.imageUrl} alt="Reporte" />
                            </a>
                        </div>
                    )}
                </div>

                <div>
                    <div className="detail-card">
                        <h2>Acciones</h2>
                        <div className="detail-actions">
                            <button className="detail-action-btn success" onClick={() => updateStatus('resolved')}><FontAwesomeIcon icon={faCheck} /> Marcar resuelto</button>
                            <button className="detail-action-btn warning" onClick={() => updateStatus('pending')}>Marcar pendiente</button>
                            <button className="detail-action-btn danger" onClick={() => updateStatus('rejected')}>Rechazar reporte</button>
                            {reported && !reported.is_banned && (
                                <button className="detail-action-btn danger" onClick={handleBanReported}><FontAwesomeIcon icon={faBan} /> Banear usuario reportado</button>
                            )}
                            <button className="detail-action-btn danger" onClick={handleDelete}><FontAwesomeIcon icon={faTrash} /> Eliminar reporte</button>
                        </div>
                    </div>

                    {reporter && (
                        <div className="detail-card">
                            <h2><FontAwesomeIcon icon={faUser} className="icon" /> Reportante</h2>
                            <div className="detail-list-item" onClick={() => navigate(`/users/${reporter.id}`)}>
                                <div style={{ width: 40, height: 40, borderRadius: 20, background: 'var(--primary-color)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600 }}>
                                    {reporter.photoURL ? <img src={reporter.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (reporter.fullName || '?').charAt(0)}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600 }}>{reporter.fullName}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{reporter.email}</div>
                                </div>
                                <FontAwesomeIcon icon={faEye} style={{ color: 'var(--text-muted)' }} />
                            </div>
                        </div>
                    )}

                    {reported && (
                        <div className="detail-card">
                            <h2><FontAwesomeIcon icon={faUser} className="icon" /> Reportado</h2>
                            <div className="detail-list-item" onClick={() => navigate(`/users/${reported.id}`)}>
                                <div style={{ width: 40, height: 40, borderRadius: 20, background: 'var(--primary-color)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600 }}>
                                    {reported.photoURL ? <img src={reported.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (reported.fullName || '?').charAt(0)}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600 }}>
                                        {reported.fullName}
                                        {reported.is_banned && <span style={{ color: '#ef4444', fontSize: 11, marginLeft: 6 }}>BANEADO</span>}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{reported.email}</div>
                                </div>
                                <FontAwesomeIcon icon={faEye} style={{ color: 'var(--text-muted)' }} />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
