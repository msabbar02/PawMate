import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../config/supabase';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass, faPenToSquare, faTrash, faXmark, faCalendarDays, faEye, faFileLines } from '@fortawesome/free-solid-svg-icons';
import './UsersPage.css'; // Shared table styles

export default function ReservationsPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [reservations, setReservations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    
    // Modal state
    const [selectedRes, setSelectedRes] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [editStatus, setEditStatus] = useState('');

    const fetchReservations = useCallback(async () => {
        try {
            const { data: resData } = await supabase.from('reservations').select('*').order('created_at', { ascending: false }).limit(200);
            if (resData) setReservations(resData);
        } catch (error) {
            console.error("Error fetching reservations:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchReservations();

        // Re-fetch when tab becomes visible again
        window.addEventListener('pawmate:wake', fetchReservations);

        // ── Realtime: auto-refresh reservations ──
        const channel = supabase
            .channel('admin:reservations')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    setReservations(prev => [payload.new, ...prev]);
                } else if (payload.eventType === 'UPDATE') {
                    setReservations(prev => prev.map(r => r.id === payload.new.id ? payload.new : r));
                } else if (payload.eventType === 'DELETE') {
                    setReservations(prev => prev.filter(r => r.id !== payload.old.id));
                }
            })
            .subscribe();

        return () => {
            window.removeEventListener('pawmate:wake', fetchReservations);
            supabase.removeChannel(channel);
        };
    }, [fetchReservations]);

    const handleDelete = async (resId) => {
        if (window.confirm(t('reservations.confirmDelete'))) {
            try {
                const { error } = await supabase.from('reservations').delete().eq('id', resId);
                if (error) throw error;
                setReservations(prev => prev.filter(r => r.id !== resId));
            } catch (error) {
                alert(t('reservations.errorDelete'));
            }
        }
    };

    const openEditModal = (res) => {
        setSelectedRes(res);
        setEditStatus(res.status || 'pendiente');
        setIsEditModalOpen(true);
    };

    const openViewModal = (res) => {
        setSelectedRes(res);
        setIsViewModalOpen(true);
    };

    const handleSaveEdit = async () => {
        try {
            const { error } = await supabase.from('reservations').update({ status: editStatus }).eq('id', selectedRes.id);
            if (error) throw error;
            setReservations(prev => prev.map(r => r.id === selectedRes.id ? { ...r, status: editStatus } : r));
            setIsEditModalOpen(false);
        } catch (error) {
            alert(t('reservations.errorUpdate'));
        }
    };

    const filtered = reservations.filter(res => {
        const matchesSearch = (res.ownerName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (res.caregiverName || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || res.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const getServiceIcon = (type) => {
        return type === 'walking' ? `${t('reservations.walkService')}` : `${t('reservations.hotelService')}`;
    };

    const statusLabel = (s) => {
        const labels = { pendiente: t('reservations.statusPending'), aceptada: t('reservations.statusAccepted'), activa: t('reservations.statusActive'), in_progress: t('reservations.statusInProgress'), completada: t('reservations.statusCompleted'), cancelada: t('reservations.statusCancelled') };
        return labels[s] || s || t('reservations.statusPending');
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">{t('reservations.pageTitle')}</h1>
            </div>

            <div className="filters-bar glass-panel">
                <div className="search-box">
                    <FontAwesomeIcon icon={faMagnifyingGlass} style={{ fontSize: 18 }} className="search-icon" />
                    <input 
                        type="text" 
                        placeholder={t('reservations.searchPlaceholder')} 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                <select 
                    className="filter-select" 
                    value={statusFilter} 
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="all">{t('reservations.allStatuses')}</option>
                    <option value="pendiente">{t('reservations.statusPending')}</option>
                    <option value="aceptada">{t('reservations.statusAccepted')}</option>
                    <option value="activa">{t('reservations.statusActive')}</option>
                    <option value="in_progress">{t('reservations.statusInProgress')}</option>
                    <option value="completada">{t('reservations.statusCompleted')}</option>
                    <option value="cancelada">{t('reservations.statusCancelled')}</option>
                </select>
            </div>

            {loading ? (
                <div className="loading-state"><div className="spinner"></div><p>{t('reservations.loading')}</p></div>
            ) : (
                <div className="table-container glass-panel">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>{t('reservations.colService')}</th>
                                <th>{t('reservations.colInvolved')}</th>
                                <th>{t('reservations.colDatePrice')}</th>
                                <th>{t('reservations.colStatus')}</th>
                                <th>{t('reservations.colActions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="empty-cell">{t('reservations.noReservationsFound')}</td>
                                </tr>
                            ) : (
                                filtered.map(res => {
                                    const created = res.created_at ? new Date(res.created_at).toLocaleDateString('es-ES') : '';
                                    return (
                                        <tr key={res.id}>
                                            <td>
                                                <div className="user-info">
                                                    <span className="user-name">{getServiceIcon(res.serviceType)}</span>
                                                    <span className="user-id">ID: {res.id.substring(0,8)}...</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="contact-info">
                                                    <span><strong>{t('reservations.ownerPrefix')}</strong> {res.ownerName || t('reservations.userFallback')}</span>
                                                    <span><strong>{t('reservations.caregiverPrefix')}</strong> {res.caregiverName || t('reservations.userFallback')}</span>
                                                    {res.petNames && <span className="text-muted">{res.petNames.join(', ')}</span>}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="contact-info">
                                                    <span>{t('reservations.appointmentPrefix')} {res.startDate} {res.endDate && res.endDate !== res.startDate ? ` ${t('reservations.toDatePrefix')} ${res.endDate}` : ''}</span>
                                                    <span className="text-muted" style={{ fontWeight: 600, color: '#10b981' }}>{res.totalPrice}€ {t('reservations.totalSuffix')}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`status-badge ${res.status || 'pendiente'}`}>
                                                    {statusLabel(res.status)}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button className="action-btn view" onClick={() => navigate(`/reservations/${res.id}`)} title={t('reservations.viewDetails')} style={{ color: '#3b82f6' }}>
                                                        <FontAwesomeIcon icon={faEye} style={{ fontSize: 18 }} />
                                                    </button>
                                                    <button className="action-btn edit" onClick={() => openEditModal(res)} title={t('reservations.changeStatus')}>
                                                        <FontAwesomeIcon icon={faPenToSquare} style={{ fontSize: 18 }} />
                                                    </button>
                                                    <button className="action-btn delete" onClick={() => handleDelete(res.id)} title={t('reservations.deleteReservation')}>
                                                        <FontAwesomeIcon icon={faTrash} style={{ fontSize: 18 }} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Edit Modal */}
            {isEditModalOpen && selectedRes && (
                <div className="modal-overlay" onClick={() => setIsEditModalOpen(false)}>
                    <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{t('reservations.editModalTitle')}</h2>
                            <button className="close-btn" onClick={() => setIsEditModalOpen(false)}><FontAwesomeIcon icon={faXmark} style={{ fontSize: 24 }} /></button>
                        </div>
                        
                        <div className="modal-body">
                            <div className="user-profile-preview">
                                <div className="preview-avatar-placeholder" style={{ backgroundColor: '#8b5cf6' }}>
                                    <FontAwesomeIcon icon={faCalendarDays} style={{ fontSize: 24, color: 'white' }} />
                                </div>
                                <div>
                                    <h3>{getServiceIcon(selectedRes.serviceType)} - {selectedRes.totalPrice}€</h3>
                                    <p className="text-muted">{selectedRes.ownerName} → {selectedRes.caregiverName}</p>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>{t('reservations.changeStatusManually')}</label>
                                <select 
                                    className="form-control"
                                    value={editStatus}
                                    onChange={(e) => setEditStatus(e.target.value)}
                                >
                                    <option value="pendiente">{t('reservations.statusPending')}</option>
                                    <option value="aceptada">{t('reservations.statusAccepted')}</option>
                                    <option value="activa">{t('reservations.statusActive')}</option>
                                    <option value="in_progress">{t('reservations.statusInProgress')}</option>
                                    <option value="completada">{t('reservations.statusCompleted')}</option>
                                    <option value="cancelada">{t('reservations.statusCancelled')}</option>
                                </select>
                            </div>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                {t('reservations.editNote')}
                            </p>
                        </div>

                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => setIsEditModalOpen(false)}>{t('reservations.cancel')}</button>
                            <button className="btn-primary" onClick={handleSaveEdit}>{t('reservations.saveStatus')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* View Modal */}
            {isViewModalOpen && selectedRes && (
                <div className="modal-overlay" onClick={() => setIsViewModalOpen(false)}>
                    <div className="modal-content view-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header view-header">
                            <h2>{t('reservations.viewModalTitle')}</h2>
                            <button className="close-btn" onClick={() => setIsViewModalOpen(false)}><FontAwesomeIcon icon={faXmark} style={{ fontSize: 24 }} /></button>
                        </div>
                        <div className="modal-body view-modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                            <div className="premium-profile-header">
                                <div className="premium-avatar-placeholder" style={{background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'}}>
                                    <FontAwesomeIcon icon={faCalendarDays} style={{ fontSize: 36, color: 'white' }} />
                                </div>
                                <div className="premium-profile-info">
                                    <h3 className="premium-profile-name">{getServiceIcon(selectedRes.serviceType)}</h3>
                                    <p className="premium-profile-subtitle" style={{color: 'white', fontWeight: '500'}}>Total: {selectedRes.totalPrice}€</p>
                                </div>
                                <div className="premium-top-right-badge">
                                    <span className={`status-badge ${selectedRes.status || 'pendiente'}`} style={{display: 'inline-block', padding: '8px 16px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold', textTransform: 'capitalize', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}}>
                                        {selectedRes.status || t('reservations.statusPending')}
                                    </span>
                                </div>
                            </div>
                            
                            <h3 className="premium-section-title" style={{marginTop: '10px'}}>
                                <FontAwesomeIcon icon={faFileLines} style={{ fontSize: 20, color: '#8b5cf6' }} /> {t('reservations.generalInfo')}
                            </h3>
                            
                            <div className="premium-details-grid">
                                <div className="premium-detail-card">
                                    <span className="premium-detail-label">{t('reservations.reservationId')}</span>
                                    <span className="premium-detail-value" style={{fontFamily: 'monospace', fontSize: '13px'}}>{selectedRes.id}</span>
                                </div>
                                <div className="premium-detail-card">
                                    <span className="premium-detail-label">{t('reservations.service')}</span>
                                    <span className="premium-detail-value" style={{textTransform: 'capitalize'}}>{selectedRes.serviceType || 'N/A'}</span>
                                </div>
                                <div className="premium-detail-card">
                                    <span className="premium-detail-label">{t('reservations.owner')}</span>
                                    <span className="premium-detail-value">{selectedRes.ownerName || 'N/A'}</span>
                                </div>
                                <div className="premium-detail-card">
                                    <span className="premium-detail-label">{t('reservations.caregiver')}</span>
                                    <span className="premium-detail-value">{selectedRes.caregiverName || 'N/A'}</span>
                                </div>
                                <div className="premium-detail-card">
                                    <span className="premium-detail-label">{t('reservations.involvedPets')}</span>
                                    <span className="premium-detail-value">{selectedRes.petNames ? selectedRes.petNames.join(', ') : t('reservations.noPets')}</span>
                                </div>
                                <div className="premium-detail-card">
                                    <span className="premium-detail-label">{t('reservations.dates')}</span>
                                    <span className="premium-detail-value">{selectedRes.startDate} {selectedRes.endDate && selectedRes.endDate !== selectedRes.startDate ? `- ${selectedRes.endDate}` : ''}</span>
                                </div>
                                {selectedRes.notes && (
                                    <div className="premium-detail-card" style={{ gridColumn: '1 / -1' }}>
                                        <span className="premium-detail-label">{t('reservations.clientNotes')}</span>
                                        <span className="premium-detail-value">{selectedRes.notes}</span>
                                    </div>
                                )}
                                {selectedRes.penaltyAmount > 0 && (
                                    <div className="premium-detail-card">
                                        <span className="premium-detail-label">{t('reservations.penalty')}</span>
                                        <span className="premium-detail-value" style={{ color: '#ef4444', fontWeight: 700 }}>€{selectedRes.penaltyAmount}</span>
                                    </div>
                                )}
                                <div className="premium-detail-card">
                                    <span className="premium-detail-label">{t('reservations.paymentReleased')}</span>
                                    <span className="premium-detail-value" style={{ color: selectedRes.paymentReleased ? '#22c55e' : '#f59e0b' }}>
                                        {selectedRes.paymentReleased ? `${t('reservations.paymentReleasedYes')}` : `⏳ ${t('reservations.paymentReleasedPending')}`}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="modal-footer" style={{ borderTop: 'none', padding: 0 }}>
                                <button className="btn-primary" onClick={() => setIsViewModalOpen(false)}>{t('reservations.close')}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
