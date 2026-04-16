import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { Search, Trash2, CheckCircle, Eye, FileText, X, Image as ImageIcon, Flag } from 'lucide-react';
import './UsersPage.css';

export default function ReportsPage() {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [tab, setTab] = useState('reports');
    const [reviews, setReviews] = useState([]);

    const [selectedItem, setSelectedItem] = useState(null);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);

    useEffect(() => { fetchData(); }, [tab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (tab === 'reports') {
                const { data } = await supabase.from('reports').select('*').order('created_at', { ascending: false });
                if (data) setReports(data);
            } else {
                const { data } = await supabase.from('reviews').select('*').order('created_at', { ascending: false });
                if (data) setReviews(data);
            }
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally { setLoading(false); }
    };

    const openViewModal = (item) => { setSelectedItem(item); setIsViewModalOpen(true); };

    const handleResolveReport = async (reportId) => {
        try {
            await supabase.from('reports').update({ status: 'resolved' }).eq('id', reportId);
            setReports(reports.map(r => r.id === reportId ? { ...r, status: 'resolved' } : r));
        } catch { alert("Error al resolver el reporte"); }
    };

    const handleDeleteReport = async (reportId) => {
        if (!window.confirm('¿Eliminar reporte?')) return;
        try {
            await supabase.from('reports').delete().eq('id', reportId);
            setReports(reports.filter(r => r.id !== reportId));
        } catch { alert("Error al eliminar el reporte"); }
    };

    const handleDeleteReview = async (reviewId) => {
        if (!window.confirm('¿Eliminar reseña?')) return;
        try {
            await supabase.from('reviews').delete().eq('id', reviewId);
            setReviews(reviews.filter(r => r.id !== reviewId));
        } catch { alert("Error al eliminar la reseña"); }
    };

    const filteredReports = reports.filter(r => {
        const matchesSearch = (r.reporterName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.message || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (r.reason || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
        return matchesSearch && matchesStatus;
    });
    const filteredReviews = reviews.filter(r => (r.reviewerName || '').toLowerCase().includes(searchTerm.toLowerCase()));
    const pendingCount = reports.filter(r => r.status !== 'resolved').length;
    const resolvedCount = reports.filter(r => r.status === 'resolved').length;

    return (
        <div className="page-container">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <h1 className="page-title">Moderación</h1>
                <div style={{ display: 'flex', gap: '8px', backgroundColor: 'var(--surface-color)', padding: '4px', borderRadius: '8px' }}>
                    <button onClick={() => setTab('reports')} style={{ padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', backgroundColor: tab === 'reports' ? 'var(--primary-color)' : 'transparent', color: tab === 'reports' ? 'white' : 'var(--text-muted)' }}>
                        Reportes ({reports.length})
                    </button>
                    <button onClick={() => setTab('reviews')} style={{ padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', backgroundColor: tab === 'reviews' ? 'var(--primary-color)' : 'transparent', color: tab === 'reviews' ? 'white' : 'var(--text-muted)' }}>
                        Reseñas de Usuarios
                    </button>
                </div>
            </div>

            {tab === 'reports' && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    {[
                        { key: 'all', label: 'Todos', count: reports.length },
                        { key: 'pending', label: 'Pendientes', count: pendingCount },
                        { key: 'resolved', label: 'Resueltos', count: resolvedCount },
                    ].map(f => (
                        <button key={f.key} onClick={() => setStatusFilter(f.key)} style={{
                            padding: '6px 16px', border: '1px solid', borderRadius: '20px', cursor: 'pointer',
                            backgroundColor: statusFilter === f.key ? 'var(--primary-color)' : 'transparent',
                            color: statusFilter === f.key ? 'white' : 'var(--text-muted)',
                            borderColor: statusFilter === f.key ? 'var(--primary-color)' : 'var(--border-color)',
                            fontSize: '13px', fontWeight: '600',
                        }}>
                            {f.label} ({f.count})
                        </button>
                    ))}
                </div>
            )}

            <div className="filters-bar glass-panel">
                <div className="search-box">
                    <Search size={18} className="search-icon" />
                    <input type="text" placeholder={tab === 'reports' ? "Buscar por nombre, motivo o mensaje..." : "Buscar por nombre..."} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
            </div>

            {loading ? (
                <div className="loading-state"><div className="spinner"></div><p>Cargando datos...</p></div>
            ) : (
                <div className="table-container glass-panel">
                    <table className="admin-table">
                        {tab === 'reports' ? (
                            <>
                                <thead><tr><th>Fecha</th><th>Reportado Por</th><th>Motivo</th><th>Mensaje</th><th>Fotos</th><th>Estado</th><th>Acciones</th></tr></thead>
                                <tbody>
                                    {filteredReports.length === 0 ? (
                                        <tr><td colSpan="7" className="empty-cell">No hay reportes</td></tr>
                                    ) : filteredReports.map(report => {
                                        const created = report.created_at ? new Date(report.created_at).toLocaleDateString('es-ES') : '';
                                        const imgCount = report.imageUrls?.length || 0;
                                        return (
                                            <tr key={report.id}>
                                                <td>{created}</td>
                                                <td>
                                                    <div className="contact-info">
                                                        <strong>{report.reporterName || 'Anónimo'}</strong>
                                                        <span className="text-muted" style={{ fontSize: '12px' }}>{report.reporterEmail}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span style={{
                                                        display: 'inline-block', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600',
                                                        backgroundColor: report.reason === 'Bug / Error' ? '#fef3c7' : report.reason === 'Contenido inapropiado' ? '#fee2e2' : report.reason === 'Problema con usuario' ? '#ede9fe' : '#e0f2fe',
                                                        color: report.reason === 'Bug / Error' ? '#92400e' : report.reason === 'Contenido inapropiado' ? '#991b1b' : report.reason === 'Problema con usuario' ? '#5b21b6' : '#075985',
                                                    }}>
                                                        {report.reason || 'General'}
                                                    </span>
                                                </td>
                                                <td><span style={{ maxWidth: '200px', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{report.message || '—'}</span></td>
                                                <td>
                                                    {imgCount > 0 ? (
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#3b82f6', fontWeight: '600', fontSize: '13px' }}><ImageIcon size={14} /> {imgCount}</span>
                                                    ) : <span className="text-muted">—</span>}
                                                </td>
                                                <td><span className={`status-badge ${report.status === 'resolved' ? 'activa' : 'pendiente'}`}>{report.status === 'resolved' ? 'Resuelto' : 'Pendiente'}</span></td>
                                                <td>
                                                    <div className="action-buttons">
                                                        <button className="action-btn view" onClick={() => openViewModal(report)} title="Ver detalles" style={{ color: '#3b82f6' }}><Eye size={18} /></button>
                                                        {report.status !== 'resolved' && (
                                                            <button className="btn-secondary" onClick={() => handleResolveReport(report.id)} style={{ padding: '4px 8px', fontSize: '12px', marginRight: '8px' }}>
                                                                <CheckCircle size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Resolver
                                                            </button>
                                                        )}
                                                        <button className="action-btn delete" onClick={() => handleDeleteReport(report.id)} title="Eliminar"><Trash2 size={18} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </>
                        ) : (
                            <>
                                <thead><tr><th>Fecha</th><th>De → Para</th><th>Puntuación / Comentario</th><th>Acciones</th></tr></thead>
                                <tbody>
                                    {filteredReviews.length === 0 ? (
                                        <tr><td colSpan="4" className="empty-cell">No hay reseñas</td></tr>
                                    ) : filteredReviews.map(review => {
                                        const created = review.created_at ? new Date(review.created_at).toLocaleDateString('es-ES') : '';
                                        return (
                                            <tr key={review.id}>
                                                <td>{created}</td>
                                                <td><div className="contact-info"><span><strong>De:</strong> {review.reviewerName}</span><span><strong>A:</strong> {review.revieweeName || review.revieweeId}</span></div></td>
                                                <td>
                                                    <div className="contact-info">
                                                        <span style={{ color: '#f59e0b', fontWeight: 600 }}>{review.rating} / 5 Estrellas</span>
                                                        <span className="text-muted" style={{ maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{review.comment || 'Sin comentario'}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="action-buttons">
                                                        <button className="action-btn view" onClick={() => openViewModal(review)} title="Ver detalles" style={{ color: '#3b82f6' }}><Eye size={18} /></button>
                                                        <button className="action-btn delete" onClick={() => handleDeleteReview(review.id)} title="Eliminar"><Trash2 size={18} /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </>
                        )}
                    </table>
                </div>
            )}

            {/* View Modal */}
            {isViewModalOpen && selectedItem && (
                <div className="modal-overlay" onClick={() => setIsViewModalOpen(false)}>
                    <div className="modal-content view-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
                        <div className="modal-header view-header">
                            <h2>{tab === 'reports' ? 'Detalles del Reporte' : 'Detalles de la Reseña'}</h2>
                            <button className="close-btn" onClick={() => setIsViewModalOpen(false)}><X size={24} /></button>
                        </div>
                        <div className="modal-body view-modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                            <div className="premium-profile-header" style={{ marginBottom: '16px' }}>
                                <div className="premium-avatar-placeholder" style={{background: tab === 'reports' ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'}}>
                                    {tab === 'reports' ? <Flag size={36} color="white" /> : <span style={{fontSize: '36px'}}>★</span>}
                                </div>
                                <div className="premium-profile-info">
                                    <h3 className="premium-profile-name">{tab === 'reports' ? `Reporte de ${selectedItem.reporterName || 'Anónimo'}` : `Reseña de ${selectedItem.reviewerName}`}</h3>
                                    <p className="premium-profile-subtitle" style={{color: 'white', fontWeight: '500'}}>{selectedItem.created_at ? new Date(selectedItem.created_at).toLocaleString('es-ES') : 'Fecha desconocida'}</p>
                                </div>
                                <div className="premium-top-right-badge">
                                    {tab === 'reports' && <span className={`status-badge ${selectedItem.status === 'resolved' ? 'activa' : 'pendiente'}`} style={{display: 'inline-block', padding: '8px 16px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold'}}>{selectedItem.status === 'resolved' ? 'Resuelto' : 'Pendiente'}</span>}
                                    {tab === 'reviews' && <span style={{display: 'inline-block', padding: '8px 16px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)'}}>{selectedItem.rating} / 5 Estrellas</span>}
                                </div>
                            </div>

                            <h3 className="premium-section-title" style={{marginTop: '10px'}}><FileText size={20} color="#8b5cf6"/> Detalles Completos</h3>

                            <div className="premium-details-grid">
                                <div className="premium-detail-card">
                                    <span className="premium-detail-label">ID del Registro</span>
                                    <span className="premium-detail-value" style={{fontFamily: 'monospace', fontSize: '13px'}}>{selectedItem.id}</span>
                                </div>
                                {tab === 'reports' ? (
                                    <>
                                        <div className="premium-detail-card">
                                            <span className="premium-detail-label">ID Usuario</span>
                                            <span className="premium-detail-value" style={{fontFamily: 'monospace', fontSize: '13px'}}>{selectedItem.userId || 'N/A'}</span>
                                        </div>
                                        <div className="premium-detail-card">
                                            <span className="premium-detail-label">Email</span>
                                            <span className="premium-detail-value">{selectedItem.reporterEmail || 'N/A'}</span>
                                        </div>
                                        <div className="premium-detail-card">
                                            <span className="premium-detail-label">Motivo</span>
                                            <span className="premium-detail-value" style={{
                                                display: 'inline-block', padding: '4px 12px', borderRadius: '12px', fontSize: '13px', fontWeight: '600',
                                                backgroundColor: selectedItem.reason === 'Bug / Error' ? '#fef3c7' : selectedItem.reason === 'Contenido inapropiado' ? '#fee2e2' : '#e0f2fe',
                                                color: selectedItem.reason === 'Bug / Error' ? '#92400e' : selectedItem.reason === 'Contenido inapropiado' ? '#991b1b' : '#075985',
                                            }}>{selectedItem.reason || 'General'}</span>
                                        </div>
                                        <div className="premium-detail-card" style={{ gridColumn: '1 / -1' }}>
                                            <span className="premium-detail-label">Mensaje del Usuario</span>
                                            <span className="premium-detail-value" style={{whiteSpace: 'pre-wrap', lineHeight: '1.6'}}>{selectedItem.message || '—'}</span>
                                        </div>
                                        {selectedItem.imageUrls && selectedItem.imageUrls.length > 0 && (
                                            <div className="premium-detail-card" style={{ gridColumn: '1 / -1' }}>
                                                <span className="premium-detail-label" style={{ marginBottom: '12px', display: 'block' }}>
                                                    <ImageIcon size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                                                    Fotos adjuntas ({selectedItem.imageUrls.length})
                                                </span>
                                                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                                    {selectedItem.imageUrls.map((url, i) => (
                                                        <img key={i} src={url} alt={`Adjunto ${i + 1}`}
                                                            style={{ width: '140px', height: '140px', objectFit: 'cover', borderRadius: '12px', cursor: 'pointer', border: '2px solid var(--border-color)', transition: 'transform 0.2s' }}
                                                            onClick={() => setPreviewImage(url)}
                                                            onMouseOver={e => { e.target.style.transform = 'scale(1.05)'; }}
                                                            onMouseOut={e => { e.target.style.transform = 'scale(1)'; }}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <div className="premium-detail-card">
                                            <span className="premium-detail-label">ID Reviewer</span>
                                            <span className="premium-detail-value" style={{fontFamily: 'monospace', fontSize: '13px'}}>{selectedItem.reviewerId}</span>
                                        </div>
                                        <div className="premium-detail-card">
                                            <span className="premium-detail-label">ID Reviewee</span>
                                            <span className="premium-detail-value" style={{fontFamily: 'monospace', fontSize: '13px'}}>{selectedItem.revieweeId}</span>
                                        </div>
                                        <div className="premium-detail-card" style={{ gridColumn: '1 / -1' }}>
                                            <span className="premium-detail-label">Destinatario</span>
                                            <span className="premium-detail-value">{selectedItem.revieweeName || 'N/A'}</span>
                                        </div>
                                        <div className="premium-detail-card" style={{ gridColumn: '1 / -1' }}>
                                            <span className="premium-detail-label">Comentario</span>
                                            <span className="premium-detail-value" style={{fontStyle: 'italic'}}>"{selectedItem.comment || 'Sin comentario.'}"</span>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="modal-footer" style={{ borderTop: 'none', padding: 0, marginTop: '20px', display: 'flex', gap: '8px' }}>
                                {tab === 'reports' && selectedItem.status !== 'resolved' && (
                                    <button className="btn-primary" style={{ backgroundColor: '#22c55e' }} onClick={() => { handleResolveReport(selectedItem.id); setSelectedItem({...selectedItem, status: 'resolved'}); }}>
                                        <CheckCircle size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Marcar Resuelto
                                    </button>
                                )}
                                <button className="btn-primary" onClick={() => setIsViewModalOpen(false)}>Cerrar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Image Preview Modal */}
            {previewImage && (
                <div className="modal-overlay" onClick={() => setPreviewImage(null)} style={{ zIndex: 10001 }}>
                    <div onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
                        <button onClick={() => setPreviewImage(null)} style={{ position: 'absolute', top: '-12px', right: '-12px', background: '#ef4444', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 1 }}>
                            <X size={18} color="white" />
                        </button>
                        <img src={previewImage} alt="Preview" style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: '16px', objectFit: 'contain' }} />
                    </div>
                </div>
            )}
        </div>
    );
}
