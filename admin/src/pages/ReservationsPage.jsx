import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { Search, Edit2, Trash2, X, CalendarDays, Eye, FileText } from 'lucide-react';
import './UsersPage.css'; // Shared table styles

export default function ReservationsPage() {
    const [reservations, setReservations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    
    // Modal state
    const [selectedRes, setSelectedRes] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [editStatus, setEditStatus] = useState('');

    useEffect(() => {
        fetchReservations();
    }, []);

    const fetchReservations = async () => {
        setLoading(true);
        try {
            const { data: resData } = await supabase.from('reservations').select('*').order('createdAt', { ascending: false });
            if (resData) setReservations(resData);
        } catch (error) {
            console.error("Error fetching reservations:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (resId) => {
        if (window.confirm('¿Seguro que deseas eliminar esta reserva?')) {
            try {
                await supabase.from('reservations').delete().eq('id', resId);
                setReservations(reservations.filter(r => r.id !== resId));
            } catch (error) {
                alert("Error al eliminar la reserva");
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
            await supabase.from('reservations').update({ status: editStatus }).eq('id', selectedRes.id);
            setReservations(reservations.map(r => r.id === selectedRes.id ? { ...r, status: editStatus } : r));
            setIsEditModalOpen(false);
        } catch (error) {
            alert("Error al actualizar la reserva");
        }
    };

    const filtered = reservations.filter(res => {
        const matchesSearch = (res.ownerName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (res.caregiverName || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || res.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const getServiceIcon = (type) => {
        return type === 'walking' ? '🚶 Paseo' : type === 'daycare' ? '☀️ Guardería' : '🏨 Hotel';
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">Gestión de Reservas</h1>
            </div>

            <div className="filters-bar glass-panel">
                <div className="search-box">
                    <Search size={18} className="search-icon" />
                    <input 
                        type="text" 
                        placeholder="Buscar por dueño o cuidador..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                <select 
                    className="filter-select" 
                    value={statusFilter} 
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="all">Todos los estados</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="aceptada">Aceptada</option>
                    <option value="activa">Activa</option>
                    <option value="completada">Completada</option>
                    <option value="cancelada">Cancelada</option>
                </select>
            </div>

            {loading ? (
                <div className="loading-state"><div className="spinner"></div><p>Cargando reservas...</p></div>
            ) : (
                <div className="table-container glass-panel">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Servicio</th>
                                <th>Involucrados</th>
                                <th>Fechas / Precio</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="empty-cell">No se encontraron reservas</td>
                                </tr>
                            ) : (
                                filtered.map(res => {
                                    const created = res.createdAt ? new Date(res.createdAt).toLocaleDateString('es-ES') : '';
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
                                                    <span><strong>D:</strong> {res.ownerName || 'Usuario'}</span>
                                                    <span><strong>C:</strong> {res.caregiverName || 'Usuario'}</span>
                                                    {res.petNames && <span className="text-muted">🐾 {res.petNames.join(', ')}</span>}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="contact-info">
                                                    <span>Cita: {res.startDate} {res.endDate && res.endDate !== res.startDate ? ` al ${res.endDate}` : ''}</span>
                                                    <span className="text-muted" style={{ fontWeight: 600, color: '#10b981' }}>{res.totalPrice}€ total</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`status-badge ${res.status || 'pendiente'}`}>
                                                    {res.status || 'pendiente'}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button className="action-btn view" onClick={() => openViewModal(res)} title="Ver detalles" style={{ color: '#3b82f6' }}>
                                                        <Eye size={18} />
                                                    </button>
                                                    <button className="action-btn edit" onClick={() => openEditModal(res)} title="Cambiar Estado">
                                                        <Edit2 size={18} />
                                                    </button>
                                                    <button className="action-btn delete" onClick={() => handleDelete(res.id)} title="Eliminar reserva">
                                                        <Trash2 size={18} />
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
                            <h2>Editar Estado de Reserva</h2>
                            <button className="close-btn" onClick={() => setIsEditModalOpen(false)}><X size={24} /></button>
                        </div>
                        
                        <div className="modal-body">
                            <div className="user-profile-preview">
                                <div className="preview-avatar-placeholder" style={{ backgroundColor: '#8b5cf6' }}>
                                    <CalendarDays size={24} color="white" />
                                </div>
                                <div>
                                    <h3>{getServiceIcon(selectedRes.serviceType)} - {selectedRes.totalPrice}€</h3>
                                    <p className="text-muted">{selectedRes.ownerName} → {selectedRes.caregiverName}</p>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Cambiar Estado Manulamente</label>
                                <select 
                                    className="form-control"
                                    value={editStatus}
                                    onChange={(e) => setEditStatus(e.target.value)}
                                >
                                    <option value="pendiente">Pendiente</option>
                                    <option value="aceptada">Aceptada</option>
                                    <option value="activa">Activa</option>
                                    <option value="completada">Completada</option>
                                    <option value="cancelada">Cancelada</option>
                                </select>
                            </div>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                Nota: Cambiar el estado aquí no disparará las notificaciones Push automáticas ni transferirá fondos, es solo una modificación a nivel de base de datos para el administrador.
                            </p>
                        </div>

                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => setIsEditModalOpen(false)}>Cancelar</button>
                            <button className="btn-primary" onClick={handleSaveEdit}>Guardar Estado</button>
                        </div>
                    </div>
                </div>
            )}

            {/* View Modal */}
            {isViewModalOpen && selectedRes && (
                <div className="modal-overlay" onClick={() => setIsViewModalOpen(false)}>
                    <div className="modal-content view-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header view-header">
                            <h2>Detalles de la Reserva</h2>
                            <button className="close-btn" onClick={() => setIsViewModalOpen(false)}><X size={24} /></button>
                        </div>
                        <div className="modal-body view-modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                            <div className="premium-profile-header">
                                <div className="premium-avatar-placeholder" style={{background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'}}>
                                    <CalendarDays size={36} color="white" />
                                </div>
                                <div className="premium-profile-info">
                                    <h3 className="premium-profile-name">{getServiceIcon(selectedRes.serviceType)}</h3>
                                    <p className="premium-profile-subtitle" style={{color: 'white', fontWeight: '500'}}>Total: {selectedRes.totalPrice}€</p>
                                </div>
                                <div className="premium-top-right-badge">
                                    <span className={`status-badge ${selectedRes.status || 'pendiente'}`} style={{display: 'inline-block', padding: '8px 16px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold', textTransform: 'capitalize', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}}>
                                        {selectedRes.status || 'Pendiente'}
                                    </span>
                                </div>
                            </div>
                            
                            <h3 className="premium-section-title" style={{marginTop: '10px'}}>
                                <FileText size={20} color="#8b5cf6"/> Información General
                            </h3>
                            
                            <div className="premium-details-grid">
                                <div className="premium-detail-card">
                                    <span className="premium-detail-label">ID Reserva</span>
                                    <span className="premium-detail-value" style={{fontFamily: 'monospace', fontSize: '13px'}}>{selectedRes.id}</span>
                                </div>
                                <div className="premium-detail-card">
                                    <span className="premium-detail-label">Servicio</span>
                                    <span className="premium-detail-value" style={{textTransform: 'capitalize'}}>{selectedRes.serviceType || 'N/A'}</span>
                                </div>
                                <div className="premium-detail-card">
                                    <span className="premium-detail-label">Dueño</span>
                                    <span className="premium-detail-value">{selectedRes.ownerName || 'N/A'}</span>
                                </div>
                                <div className="premium-detail-card">
                                    <span className="premium-detail-label">Cuidador</span>
                                    <span className="premium-detail-value">{selectedRes.caregiverName || 'N/A'}</span>
                                </div>
                                <div className="premium-detail-card">
                                    <span className="premium-detail-label">Mascotas Involucradas</span>
                                    <span className="premium-detail-value">{selectedRes.petNames ? selectedRes.petNames.join(', ') : 'Ninguna'}</span>
                                </div>
                                <div className="premium-detail-card">
                                    <span className="premium-detail-label">Fechas</span>
                                    <span className="premium-detail-value">{selectedRes.startDate} {selectedRes.endDate && selectedRes.endDate !== selectedRes.startDate ? `- ${selectedRes.endDate}` : ''}</span>
                                </div>
                                {selectedRes.notes && (
                                    <div className="premium-detail-card" style={{ gridColumn: '1 / -1' }}>
                                        <span className="premium-detail-label">Notas del Cliente</span>
                                        <span className="premium-detail-value">{selectedRes.notes}</span>
                                    </div>
                                )}
                            </div>
                            
                            <div className="modal-footer" style={{ borderTop: 'none', padding: 0 }}>
                                <button className="btn-primary" onClick={() => setIsViewModalOpen(false)}>Cerrar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
