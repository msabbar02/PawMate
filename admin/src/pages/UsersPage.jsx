import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { Search, Edit2, Trash2, X, AlertCircle, Shield, ShieldCheck, Eye, Dog } from 'lucide-react';
import './UsersPage.css';

export default function UsersPage() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    
    // Modal state
    const [selectedUser, setSelectedUser] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [userPets, setUserPets] = useState([]);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [editForm, setEditForm] = useState({ role: '', verificationStatus: '' });

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data: usersData, error } = await supabase.from('users').select('*');
            if (!error && usersData) {
                setUsers(usersData);
            }
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteUser = async (userId) => {
        if (window.confirm('¿Estás seguro de que deseas eliminar este usuario? Esta acción es irreversible.')) {
            try {
                await supabase.from('users').delete().eq('id', userId);
                setUsers(users.filter(u => u.id !== userId));
            } catch (error) {
                console.error("Error deleting user:", error);
                alert("Hubo un error al eliminar el usuario");
            }
        }
    };

    const openEditModal = (user) => {
        setSelectedUser(user);
        setEditForm({
            role: user.role || 'normal',
            verificationStatus: user.verificationStatus || 'pending'
        });
        setIsEditModalOpen(true);
    };

    const closeEditModal = () => {
        setIsEditModalOpen(false);
        setSelectedUser(null);
    };

    const openViewModal = async (user) => {
        setSelectedUser(user);
        setIsViewModalOpen(true);
        setLoadingDetails(true);
        setUserPets([]);
        try {
            const { data: petsData } = await supabase.from('pets').select('*').eq('ownerId', user.id);
            if (petsData) setUserPets(petsData);
        } catch (e) {
            console.error("Error fetching user details", e);
        }
        setLoadingDetails(false);
    };

    const closeViewModal = () => {
        setIsViewModalOpen(false);
        setSelectedUser(null);
    };

    const handleSaveEdit = async () => {
        try {
            await supabase.from('users').update(editForm).eq('id', selectedUser.id);
            
            // Update local state
            setUsers(users.map(u => 
                u.id === selectedUser.id ? { ...u, ...editForm } : u
            ));
            
            closeEditModal();
        } catch (error) {
            console.error("Error updating user:", error);
            alert("Error al actualizar usuario");
        }
    };

    // Filtering logic
    const filteredUsers = users.filter(user => {
        const matchesSearch = (user.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (user.email || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = roleFilter === 'all' || user.role === roleFilter;
        return matchesSearch && matchesRole;
    });

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">Gestión de Usuarios</h1>
            </div>

            <div className="filters-bar glass-panel">
                <div className="search-box">
                    <Search size={18} className="search-icon" />
                    <input 
                        type="text" 
                        placeholder="Buscar por nombre o email..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                <select 
                    className="filter-select" 
                    value={roleFilter} 
                    onChange={(e) => setRoleFilter(e.target.value)}
                >
                    <option value="all">Todos los roles</option>
                    <option value="normal">Normal</option>
                    <option value="owner">Owner (Dueño)</option>
                    <option value="caregiver">Caregiver (Cuidador)</option>
                    <option value="admin">Admin</option>
                </select>
            </div>

            {loading ? (
                <div className="loading-state"><div className="spinner"></div><p>Cargando usuarios...</p></div>
            ) : (
                <div className="table-container glass-panel">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Usuario</th>
                                <th>Email / Teléfono</th>
                                <th>Rol</th>
                                <th>Verificación</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="empty-cell">No se encontraron usuarios</td>
                                </tr>
                            ) : (
                                filteredUsers.map(user => (
                                    <tr key={user.id}>
                                        <td>
                                            <div className="user-cell">
                                                <div className="user-avatar">
                                                    {user.photoURL ? (
                                                        <img src={user.photoURL} alt="avatar" />
                                                    ) : (
                                                        <span>{user.fullName?.charAt(0) || 'U'}</span>
                                                    )}
                                                </div>
                                                <div className="user-info">
                                                    <span className="user-name">{user.fullName || 'Sin nombre'}</span>
                                                    <span className="user-id">ID: {user.id.substring(0,8)}...</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="contact-info">
                                                <span>{user.email || 'Sin email'}</span>
                                                <span className="text-muted">{user.phone || 'Sin teléfono'}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`role-badge ${user.role || 'normal'}`}>
                                                {user.role === 'admin' && <Shield size={14} />}
                                                {user.role || 'normal'}
                                            </span>
                                        </td>
                                        <td>
                                            {(user.role === 'owner' || user.role === 'caregiver') ? (
                                                <span className={`status-badge ${user.verificationStatus || 'pending'}`}>
                                                    {user.verificationStatus === 'approved' ? (
                                                        <><ShieldCheck size={14} /> Aprobado</>
                                                    ) : user.verificationStatus === 'rejected' ? (
                                                        <><X size={14} /> Rechazado</>
                                                    ) : (
                                                        <><AlertCircle size={14} /> Pendiente</>
                                                    )}
                                                </span>
                                            ) : (
                                                <span className="text-muted">-</span>
                                            )}
                                        </td>
                                        <td>
                                            <div className="action-buttons">
                                                <button className="action-btn view" onClick={() => openViewModal(user)} title="Ver detalles" style={{ color: '#3b82f6' }}>
                                                    <Eye size={18} />
                                                </button>
                                                <button className="action-btn edit" onClick={() => openEditModal(user)} title="Editar usuario">
                                                    <Edit2 size={18} />
                                                </button>
                                                <button className="action-btn delete" onClick={() => handleDeleteUser(user.id)} title="Eliminar usuario">
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Edit Modal */}
            {isEditModalOpen && selectedUser && (
                <div className="modal-overlay" onClick={closeEditModal}>
                    <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Editar Usuario</h2>
                            <button className="close-btn" onClick={closeEditModal}><X size={24} /></button>
                        </div>
                        
                        <div className="modal-body">
                            <div className="user-profile-preview">
                                {selectedUser.photoURL ? (
                                    <img src={selectedUser.photoURL} alt="avatar" className="preview-avatar" />
                                ) : (
                                    <div className="preview-avatar-placeholder">
                                        {selectedUser.fullName?.charAt(0) || 'U'}
                                    </div>
                                )}
                                <div>
                                    <h3>{selectedUser.fullName || 'Sin Nombre'}</h3>
                                    <p className="text-muted">{selectedUser.email}</p>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Rol de Usuario</label>
                                <select 
                                    value={editForm.role}
                                    onChange={(e) => setEditForm({...editForm, role: e.target.value})}
                                    className="form-control"
                                >
                                    <option value="normal">Normal</option>
                                    <option value="owner">Owner (Dueño)</option>
                                    <option value="caregiver">Caregiver (Cuidador)</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>

                            {(editForm.role === 'owner' || editForm.role === 'caregiver') && (
                                <div className="form-group">
                                    <label>Estado de Verificación (DNI)</label>
                                    <select 
                                        value={editForm.verificationStatus}
                                        onChange={(e) => setEditForm({...editForm, verificationStatus: e.target.value})}
                                        className="form-control"
                                    >
                                        <option value="pending">Pendiente de revisión</option>
                                        <option value="approved">Aprobado</option>
                                        <option value="rejected">Rechazado</option>
                                    </select>
                                </div>
                            )}
                            
                            {selectedUser.idDocumentUrl && (
                                <div className="document-preview-container">
                                    <label>Documento de Identidad subido:</label>
                                    <a href={selectedUser.idDocumentUrl} target="_blank" rel="noopener noreferrer" className="view-doc-btn">
                                        Ver Documento
                                    </a>
                                </div>
                            )}

                        </div>

                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={closeEditModal}>Cancelar</button>
                            <button className="btn-primary" onClick={handleSaveEdit}>Guardar Cambios</button>
                        </div>
                    </div>
                </div>
            )}

            {/* View Modal */}
            {isViewModalOpen && selectedUser && (
                <div className="modal-overlay" onClick={closeViewModal}>
                    <div className="modal-content view-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header view-header">
                            <h2>Perfil Detallado de Usuario</h2>
                            <button className="close-btn" onClick={closeViewModal}><X size={24} /></button>
                        </div>
                        <div className="modal-body view-modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                            
                            <div className="premium-profile-header">
                                {selectedUser.photoURL ? (
                                    <img src={selectedUser.photoURL} alt="avatar" className="premium-avatar" />
                                ) : (
                                    <div className="premium-avatar-placeholder">
                                        {selectedUser.fullName?.charAt(0) || 'U'}
                                    </div>
                                )}
                                <div className="premium-profile-info">
                                    <h3 className="premium-profile-name">{selectedUser.fullName || 'Sin Nombre Registrado'}</h3>
                                    <p className="premium-profile-subtitle">{selectedUser.email}</p>
                                </div>
                                <div className="premium-top-right-badge">
                                    <span className={`role-badge ${selectedUser.role || 'normal'}`} style={{fontSize: '14px', padding: '8px 16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}}>
                                        {selectedUser.role === 'admin' && <Shield size={16} />}
                                        {selectedUser.role || 'normal'}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="premium-details-grid">
                                <div className="premium-detail-card">
                                    <span className="premium-detail-label">ID de Usuario</span>
                                    <span className="premium-detail-value" style={{fontFamily: 'monospace', fontSize: '13px'}}>{selectedUser.id}</span>
                                </div>
                                <div className="premium-detail-card">
                                    <span className="premium-detail-label">Teléfono</span>
                                    <span className="premium-detail-value">{selectedUser.phone || 'No proporcionado'}</span>
                                </div>
                                <div className="premium-detail-card">
                                    <span className="premium-detail-label">Fecha de Nacimiento</span>
                                    <span className="premium-detail-value">{selectedUser.birthDate || 'No proporcionado'}</span>
                                </div>
                                <div className="premium-detail-card">
                                    <span className="premium-detail-label">Estado de Verificación</span>
                                    <span className="premium-detail-value" style={{textTransform: 'capitalize'}}>{selectedUser.verificationStatus || 'N/A'}</span>
                                </div>
                                {selectedUser.address && (
                                    <div className="premium-detail-card" style={{ gridColumn: '1 / -1' }}>
                                        <span className="premium-detail-label">Dirección Completa</span>
                                        <span className="premium-detail-value">
                                            {`${selectedUser.address.addressLine1 || ''}, ${selectedUser.address.city || ''}, ${selectedUser.address.state || ''}, ${selectedUser.address.country || ''}`}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div style={{ padding: '16px', backgroundColor: 'rgba(239, 68, 68, 0.08)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.15)', marginBottom: '30px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                <Shield size={20} color="#ef4444" style={{marginTop: '2px', flexShrink: 0}}/>
                                <p style={{margin: 0, fontSize: '13px', color: '#fca5a5', lineHeight: '1.6'}}>
                                    <strong>Privacidad de Seguridad:</strong> Por arquitectura de Firebase Authentication,  
                                    las contraseñas de los usuarios están fuertemente encriptadas (hash) y nunca se exponen en la base de datos de Firestore. Es imposible visualizar la contraseña real.
                                </p>
                            </div>

                            {loadingDetails ? (
                                <div className="loading-state" style={{padding: '30px 0'}}><div className="spinner"></div><p>Cargando información adicional del servidor...</p></div>
                            ) : (
                                <>
                                    <h3 className="premium-section-title">
                                        <Dog size={20} color="#10b981"/> Mascotas Vinculadas ({userPets.length})
                                    </h3>
                                    {userPets.length > 0 ? (
                                        <div className="premium-list">
                                            {userPets.map(p => (
                                                <div className="premium-list-item" key={p.id}>
                                                    <div className="premium-item-icon" style={{background: 'rgba(16, 185, 129, 0.1)', color: '#10b981'}}>
                                                        <Dog size={24} />
                                                    </div>
                                                    <div className="premium-item-content">
                                                        <h4 className="premium-item-title">{p.name}</h4>
                                                        <p className="premium-item-desc">
                                                            Especie: <span style={{textTransform: 'capitalize'}}>{p.species || 'Desconocida'}</span> • Raza: {p.breed || 'Sin raza'} • {p.weight ? p.weight + 'kg' : 'Peso n/a'}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : <p className="text-muted" style={{marginBottom: '30px', fontSize: '15px'}}>Este usuario no ha registrado ninguna mascota.</p>}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
