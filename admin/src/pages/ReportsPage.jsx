import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, deleteDoc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Search, Trash2, CheckCircle, AlertTriangle, Eye, FileText, X } from 'lucide-react';
import './UsersPage.css';

export default function ReportsPage() {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [tab, setTab] = useState('reports'); // 'reports' or 'reviews'
    const [reviews, setReviews] = useState([]);

    // Modal state
    const [selectedItem, setSelectedItem] = useState(null);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);

    useEffect(() => {
        fetchData();
    }, [tab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (tab === 'reports') {
                const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
                const snap = await getDocs(q);
                setReports(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            } else {
                const q = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'));
                const snap = await getDocs(q);
                setReviews(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            }
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    const openViewModal = (item) => {
        setSelectedItem(item);
        setIsViewModalOpen(true);
    };

    const handleResolveReport = async (reportId) => {
        try {
            await updateDoc(doc(db, 'reports', reportId), { status: 'resolved' });
            setReports(reports.map(r => r.id === reportId ? { ...r, status: 'resolved' } : r));
        } catch (error) {
            alert("Error al resolver el reporte");
        }
    };

    const handleDeleteReport = async (reportId) => {
        if (window.confirm('¿Eliminar reporte?')) {
            try {
                await deleteDoc(doc(db, 'reports', reportId));
                setReports(reports.filter(r => r.id !== reportId));
            } catch (error) {
                alert("Error al eliminar el reporte");
            }
        }
    };

    const handleDeleteReview = async (reviewId) => {
        if (window.confirm('¿Eliminar reseña de la plataforma? Esto afectará la puntuación del cuidador.')) {
            try {
                await deleteDoc(doc(db, 'reviews', reviewId));
                setReviews(reviews.filter(r => r.id !== reviewId));
            } catch (error) {
                alert("Error al eliminar la reseña");
            }
        }
    };

    const filteredReports = reports.filter(r => (r.reporterName || '').toLowerCase().includes(searchTerm.toLowerCase()));
    const filteredReviews = reviews.filter(r => (r.reviewerName || '').toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="page-container">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <h1 className="page-title">Moderación</h1>
                <div style={{ display: 'flex', gap: '8px', backgroundColor: 'var(--surface-color)', padding: '4px', borderRadius: '8px' }}>
                    <button 
                        onClick={() => setTab('reports')} 
                        style={{ padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', backgroundColor: tab === 'reports' ? 'var(--primary-color)' : 'transparent', color: tab === 'reports' ? 'white' : 'var(--text-muted)' }}
                    >
                        Reportes de Contenido
                    </button>
                    <button 
                        onClick={() => setTab('reviews')} 
                        style={{ padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', backgroundColor: tab === 'reviews' ? 'var(--primary-color)' : 'transparent', color: tab === 'reviews' ? 'white' : 'var(--text-muted)' }}
                    >
                        Reseñas de Usuarios
                    </button>
                </div>
            </div>

            <div className="filters-bar glass-panel">
                <div className="search-box">
                    <Search size={18} className="search-icon" />
                    <input 
                        type="text" 
                        placeholder={tab === 'reports' ? "Buscar por reportero..." : "Buscar por nombre..."} 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <div className="loading-state"><div className="spinner"></div><p>Cargando datos...</p></div>
            ) : (
                <div className="table-container glass-panel">
                    <table className="admin-table">
                        {tab === 'reports' ? (
                            <>
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Reportado Por</th>
                                        <th>Motivo / Elemento</th>
                                        <th>Estado</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredReports.length === 0 ? (
                                        <tr><td colSpan="5" className="empty-cell">No hay reportes activos</td></tr>
                                    ) : (
                                        filteredReports.map(report => {
                                            const created = report.createdAt?.toDate ? report.createdAt.toDate().toLocaleDateString('es-ES') : '';
                                            return (
                                                <tr key={report.id}>
                                                    <td>{created}</td>
                                                    <td><strong>{report.reporterName}</strong></td>
                                                    <td>
                                                        <div className="contact-info">
                                                            <span>{report.reason || 'Contenido Inapropiado'}</span>
                                                            <span className="text-muted">ID Post/User: {report.postId || report.reportedUid}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className={`status-badge ${report.status === 'resolved' ? 'activa' : 'pendiente'}`}>
                                                            {report.status === 'resolved' ? 'Resuelto' : 'Pendiente'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className="action-buttons">
                                                            <button className="action-btn view" onClick={() => openViewModal(report)} title="Ver detalles" style={{ color: '#3b82f6' }}>
                                                                <Eye size={18} />
                                                            </button>
                                                            {report.status !== 'resolved' && (
                                                                <button className="btn-secondary" onClick={() => handleResolveReport(report.id)} style={{ padding: '4px 8px', fontSize: '12px', marginRight: '8px' }}>
                                                                    <CheckCircle size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Resolver
                                                                </button>
                                                            )}
                                                            <button className="action-btn delete" onClick={() => handleDeleteReport(report.id)} title="Eliminar reporte">
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </>
                        ) : (
                            <>
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>De → Para</th>
                                        <th>Puntuación / Comentario</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredReviews.length === 0 ? (
                                        <tr><td colSpan="4" className="empty-cell">No hay reseñas</td></tr>
                                    ) : (
                                        filteredReviews.map(review => {
                                            const created = review.createdAt?.toDate ? review.createdAt.toDate().toLocaleDateString('es-ES') : '';
                                            return (
                                                <tr key={review.id}>
                                                    <td>{created}</td>
                                                    <td>
                                                        <div className="contact-info">
                                                            <span><strong>De:</strong> {review.reviewerName}</span>
                                                            <span><strong>A:</strong> {review.revieweeName || review.revieweeId}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="contact-info">
                                                            <span style={{ color: '#f59e0b', fontWeight: 600 }}>{review.rating} / 5 Estrellas</span>
                                                            <span className="text-muted" style={{ maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                {review.comment || 'Sin comentario'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="action-buttons">
                                                            <button className="action-btn view" onClick={() => openViewModal(review)} title="Ver detalles" style={{ color: '#3b82f6' }}>
                                                                <Eye size={18} />
                                                            </button>
                                                            <button className="action-btn delete" onClick={() => handleDeleteReview(review.id)} title="Eliminar reseña">
                                                                <Trash2 size={18} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </>
                        )}
                    </table>
                </div>
            )}

            {/* View Modal */}
            {isViewModalOpen && selectedItem && (
                <div className="modal-overlay" onClick={() => setIsViewModalOpen(false)}>
                    <div className="modal-content view-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header view-header">
                            <h2>{tab === 'reports' ? 'Detalles del Reporte' : 'Detalles de la Reseña'}</h2>
                            <button className="close-btn" onClick={() => setIsViewModalOpen(false)}><X size={24} /></button>
                        </div>
                        
                        <div className="modal-body view-modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                            <div className="premium-profile-header" style={{ marginBottom: '16px' }}>
                                <div className="premium-avatar-placeholder" style={{background: tab === 'reports' ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'}}>
                                    {tab === 'reports' ? <AlertTriangle size={36} color="white" /> : <span style={{fontSize: '36px'}}>★</span>}
                                </div>
                                <div className="premium-profile-info">
                                    <h3 className="premium-profile-name">
                                        {tab === 'reports' ? `Reporte de ${selectedItem.reporterName}` : `Reseña de ${selectedItem.reviewerName}`}
                                    </h3>
                                    <p className="premium-profile-subtitle" style={{color: 'white', fontWeight: '500'}}>
                                        {selectedItem.createdAt?.toDate ? selectedItem.createdAt.toDate().toLocaleString('es-ES') : 'Fecha desconocida'}
                                    </p>
                                </div>
                                <div className="premium-top-right-badge">
                                    {tab === 'reports' && (
                                        <span className={`status-badge ${selectedItem.status === 'resolved' ? 'activa' : 'pendiente'}`} style={{display: 'inline-block', padding: '8px 16px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold', textTransform: 'capitalize', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}}>
                                            {selectedItem.status === 'resolved' ? 'Resuelto' : 'Pendiente'}
                                        </span>
                                    )}
                                    {tab === 'reviews' && (
                                        <span style={{display: 'inline-block', padding: '8px 16px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}}>
                                            {selectedItem.rating} / 5 Estrellas
                                        </span>
                                    )}
                                </div>
                            </div>
                            
                            <h3 className="premium-section-title" style={{marginTop: '10px'}}>
                                <FileText size={20} color="#8b5cf6"/> Detalles Completos
                            </h3>
                            
                            <div className="premium-details-grid">
                                <div className="premium-detail-card">
                                    <span className="premium-detail-label">ID del Registro</span>
                                    <span className="premium-detail-value" style={{fontFamily: 'monospace', fontSize: '13px'}}>{selectedItem.id}</span>
                                </div>
                                
                                {tab === 'reports' ? (
                                    <>
                                        <div className="premium-detail-card">
                                            <span className="premium-detail-label">ID Reportero</span>
                                            <span className="premium-detail-value" style={{fontFamily: 'monospace', fontSize: '13px'}}>{selectedItem.reporterId}</span>
                                        </div>
                                        <div className="premium-detail-card">
                                            <span className="premium-detail-label">ID Reportado (Post/User)</span>
                                            <span className="premium-detail-value" style={{fontFamily: 'monospace', fontSize: '13px'}}>{selectedItem.postId || selectedItem.reportedUid || 'N/A'}</span>
                                        </div>
                                        <div className="premium-detail-card" style={{ gridColumn: '1 / -1' }}>
                                            <span className="premium-detail-label">Motivo del Reporte</span>
                                            <span className="premium-detail-value" style={{color: '#ef4444', fontWeight: 'bold'}}>{selectedItem.reason || 'Contenido Inapropiado'}</span>
                                        </div>
                                        {selectedItem.additionalInfo && (
                                            <div className="premium-detail-card" style={{ gridColumn: '1 / -1' }}>
                                                <span className="premium-detail-label">Información Adicional</span>
                                                <span className="premium-detail-value">{selectedItem.additionalInfo}</span>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <div className="premium-detail-card">
                                            <span className="premium-detail-label">ID Reviewer (Cliente)</span>
                                            <span className="premium-detail-value" style={{fontFamily: 'monospace', fontSize: '13px'}}>{selectedItem.reviewerId}</span>
                                        </div>
                                        <div className="premium-detail-card">
                                            <span className="premium-detail-label">ID Reviewee (Destinatario)</span>
                                            <span className="premium-detail-value" style={{fontFamily: 'monospace', fontSize: '13px'}}>{selectedItem.revieweeId}</span>
                                        </div>
                                        <div className="premium-detail-card" style={{ gridColumn: '1 / -1' }}>
                                            <span className="premium-detail-label">Destinatario Nombre</span>
                                            <span className="premium-detail-value">{selectedItem.revieweeName || 'N/A'}</span>
                                        </div>
                                        <div className="premium-detail-card" style={{ gridColumn: '1 / -1' }}>
                                            <span className="premium-detail-label">Comentario textual</span>
                                            <span className="premium-detail-value" style={{fontStyle: 'italic'}}>"{selectedItem.comment || 'Sin comentario escrito.'}"</span>
                                        </div>
                                    </>
                                )}
                            </div>
                            
                            <div className="modal-footer" style={{ borderTop: 'none', padding: 0, marginTop: '20px' }}>
                                <button className="btn-primary" onClick={() => setIsViewModalOpen(false)}>Cerrar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
