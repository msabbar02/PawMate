/**
 * Página de gestión de usuarios.
 *
 * Lista hasta 500 usuarios, se sincroniza por Realtime y al volver al
 * foco (`pawmate:wake`), permite filtrar por rol y buscar por nombre/
 * email. Permite banear/desbanear (con email automático de aviso),
 * borrar vía RPC `admin_delete_user` (necesaria en Supabase para
 * eliminar de Auth + tabla en cascada) y editar rol/estado de
 * verificación desde modales.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../config/supabase';
import { sendBanEmail } from '../config/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass, faPenToSquare, faTrash, faXmark, faCircleExclamation, faShield, faShieldHalved, faEye, faDog, faBan } from '@fortawesome/free-solid-svg-icons';
import './UsersPage.css';

export default function UsersPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    
    // Estado del modal.
    const [selectedUser, setSelectedUser] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [userPets, setUserPets] = useState([]);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [editForm, setEditForm] = useState({ role: '', verificationStatus: '' });

    /** Carga la lista completa de usuarios. */
    const fetchUsers = useCallback(async () => {
        try {
            const { data: usersData, error } = await supabase.from('users').select('*').limit(500);
            if (!error && usersData) {
                setUsers(usersData);
            }
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers();

        // Recarga al volver al foco (evita carga bloqueada si el navegador ralentizó el tab en segundo plano).
        window.addEventListener('pawmate:wake', fetchUsers);

        // Actualización automática de usuarios en tiempo real.
        const channel = supabase
            .channel('admin:users')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, (payload) => {
                if (payload.eventType === 'INSERT') {
                    setUsers(prev => [...prev, payload.new]);
                } else if (payload.eventType === 'UPDATE') {
                    setUsers(prev => prev.map(u => u.id === payload.new.id ? payload.new : u));
                } else if (payload.eventType === 'DELETE') {
                    setUsers(prev => prev.filter(u => u.id !== payload.old.id));
                }
            })
            .subscribe();

        return () => {
            window.removeEventListener('pawmate:wake', fetchUsers);
            supabase.removeChannel(channel);
        };
    }, [fetchUsers]);

    /**
     * Banea o desbanea a un usuario. Al banear lanza un email de aviso
     * a través del endpoint privado del backend.
     *
     * @param {string}  userId
     * @param {boolean} currentlyBanned
     */
    const handleBanUser = async (userId, currentlyBanned) => {
        const action = currentlyBanned ? t('users.confirmBanActionUnban') : t('users.confirmBanActionBan');
        if (!window.confirm(t('users.confirmBan', { action }))) return;
        try {
            const { error } = await supabase.from('users').update({ is_banned: !currentlyBanned }).eq('id', userId);
            if (error) throw error;
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_banned: !currentlyBanned } : u));
            if (!currentlyBanned) {
                const bannedUser = users.find(u => u.id === userId);
                if (bannedUser?.email) sendBanEmail(bannedUser.email, bannedUser.fullName);
            }
        } catch (error) {
            console.error("Error banning user:", error);
            alert(t('users.errorUpdateStatus'));
        }
    };

    /**
     * Borra a un usuario llamando a la RPC `admin_delete_user` que
     * elimina del esquema público y de Supabase Auth en cascada. Si
     * falla, muestra un mensaje claro indicando que el script SQL
     * aún no se ha ejecutado.
     */
    const handleDeleteUser = async (userId) => {
        if (!window.confirm(t('users.confirmDelete'))) return;
        try {
            const { error: rpcError } = await supabase.rpc('admin_delete_user', { target_uid: userId });
            if (rpcError) {
                console.error('admin_delete_user RPC error:', rpcError);
                alert(
                    'No se pudo borrar el usuario.\n\n' +
                    'Causa: ' + (rpcError.message || rpcError.details || 'desconocida') + '\n\n' +
                    'SOLUCIÓN: Ejecuta el script SQL completo (supabase_schema.sql) en el SQL Editor de Supabase para crear la función admin_delete_user.'
                );
                return;
            }
            setUsers(prev => prev.filter(u => u.id !== userId));
        } catch (error) {
            console.error('Error deleting user:', error);
            alert(t('users.errorDelete') + (error?.message ? `\n\n${error.message}` : ''));
        }
    };

    /** Abre el modal de edición con los valores actuales. */
    const openEditModal = (user) => {
        setSelectedUser(user);
        setEditForm({
            role: user.role || 'normal',
            verificationStatus: user.verificationStatus || 'pending'
        });
        setIsEditModalOpen(true);
    };

    /** Cierra el modal de edición. */
    const closeEditModal = () => {
        setIsEditModalOpen(false);
        setSelectedUser(null);
    };

    /** Abre el modal de visualización cargando las mascotas del usuario. */
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

    /** Cierra el modal de visualización. */
    const closeViewModal = () => {
        setIsViewModalOpen(false);
        setSelectedUser(null);
    };

    /** Persiste los cambios del modal de edición. */
    const handleSaveEdit = async () => {
        try {
            const { error } = await supabase.from('users').update(editForm).eq('id', selectedUser.id);
            if (error) throw error;
            
            // Actualiza el estado local.
            setUsers(prev => prev.map(u => 
                u.id === selectedUser.id ? { ...u, ...editForm } : u
            ));
            
            closeEditModal();
        } catch (error) {
            console.error("Error updating user:", error);
            alert(t('users.errorUpdate'));
        }
    };

    // Lógica de filtrado.
    const filteredUsers = users.filter(user => {
        const matchesSearch = (user.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (user.email || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = roleFilter === 'all' || user.role === roleFilter;
        return matchesSearch && matchesRole;
    });

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">{t('users.pageTitle')}</h1>
            </div>

            <div className="filters-bar glass-panel">
                <div className="search-box">
                    <FontAwesomeIcon icon={faMagnifyingGlass} style={{ fontSize: 18 }} className="search-icon" />
                    <input 
                        type="text" 
                        placeholder={t('users.searchPlaceholder')} 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                
                <select 
                    className="filter-select" 
                    value={roleFilter} 
                    onChange={(e) => setRoleFilter(e.target.value)}
                >
                    <option value="all">{t('users.allRoles')}</option>
                    <option value="normal">{t('users.roleNormal')}</option>
                    <option value="owner">{t('users.roleOwner')}</option>
                    <option value="caregiver">{t('users.roleCaregiver')}</option>
                    <option value="admin">{t('users.roleAdmin')}</option>
                </select>
            </div>

            {loading ? (
                <div className="loading-state"><div className="spinner"></div><p>{t('users.loading')}</p></div>
            ) : (
                <div className="table-container glass-panel">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>{t('users.colUser')}</th>
                                <th>{t('users.colEmailPhone')}</th>
                                <th>{t('users.colRole')}</th>
                                <th>{t('users.colVerification')}</th>
                                <th>{t('users.colActions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="empty-cell">{t('users.noUsersFound')}</td>
                                </tr>
                            ) : (
                                filteredUsers.map(user => (
                                    <tr key={user.id} style={user.is_banned ? { opacity: 0.5, background: 'rgba(239,68,68,0.05)' } : {}}>
                                        <td>
                                            <div className="user-cell">
                                                <div className="user-avatar" style={{ position: 'relative' }}>
                                                    {user.photoURL ? (
                                                        <img src={user.photoURL} alt="avatar" />
                                                    ) : (
                                                        <span>{user.fullName?.charAt(0) || 'U'}</span>
                                                    )}
                                                    {user.isOnline && (
                                                        <span style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: '#22c55e', border: '2px solid var(--bg-color, #0B0E14)' }} title={t('users.online')} />
                                                    )}
                                                </div>
                                                <div className="user-info">
                                                    <span className="user-name">
                                                        {user.fullName || t('users.noName')}
                                                        {user.is_banned && <span style={{ color: '#ef4444', fontSize: 11, marginLeft: 6 }}>{t('users.banned')}</span>}
                                                    </span>
                                                    <span className="user-id">ID: {user.id.substring(0,8)}...</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="contact-info">
                                                <span>{user.email || t('users.noEmail')}</span>
                                                <span className="text-muted">{user.phone || t('users.noPhone')}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`role-badge ${user.role || 'normal'}`}>
                                                {user.role === 'admin' && <FontAwesomeIcon icon={faShield} style={{ fontSize: 14 }} />}
                                                {user.role || 'normal'}
                                            </span>
                                        </td>
                                        <td>
                                            {(user.role === 'owner' || user.role === 'caregiver') ? (
                                                <span className={`status-badge ${user.verificationStatus || 'pending'}`}>
                                                    {user.verificationStatus === 'approved' ? (
                                                        <><FontAwesomeIcon icon={faShieldHalved} style={{ fontSize: 14 }} /> {t('users.statusApproved')}</>
                                                    ) : user.verificationStatus === 'rejected' ? (
                                                        <><FontAwesomeIcon icon={faXmark} style={{ fontSize: 14 }} /> {t('users.statusRejected')}</>
                                                    ) : (
                                                    <><FontAwesomeIcon icon={faCircleExclamation} style={{ fontSize: 14 }} /> {t('users.statusPending')}</>
                                                    )}
                                                </span>
                                            ) : (
                                                <span className="text-muted">-</span>
                                            )}
                                        </td>
                                        <td>
                                            <div className="action-buttons">
                                                <button className="action-btn view" onClick={() => navigate(`/users/${user.id}`)} title={t('users.viewDetails')} style={{ color: '#3b82f6' }}>
                                                    <FontAwesomeIcon icon={faEye} style={{ fontSize: 18 }} />
                                                </button>
                                                <button className="action-btn edit" onClick={() => openEditModal(user)} title={t('users.editUser')}>
                                                    <FontAwesomeIcon icon={faPenToSquare} style={{ fontSize: 18 }} />
                                                </button>
                                                <button className="action-btn delete" onClick={() => handleDeleteUser(user.id)} title={t('users.deleteUser')}>
                                                    <FontAwesomeIcon icon={faTrash} style={{ fontSize: 18 }} />
                                                </button>
                                                {user.role !== 'admin' && (
                                                    <button 
                                                        className="action-btn" 
                                                        onClick={() => handleBanUser(user.id, user.is_banned)} 
                                                        title={user.is_banned ? t('users.unban') : t('users.ban')}
                                                        style={{ color: user.is_banned ? '#22c55e' : '#ef4444' }}
                                                    >
                                                        <FontAwesomeIcon icon={faBan} style={{ fontSize: 18 }} />
                                                    </button>
                                                )}
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
                            <h2>{t('users.editModalTitle')}</h2>
                            <button className="close-btn" onClick={closeEditModal}><FontAwesomeIcon icon={faXmark} style={{ fontSize: 24 }} /></button>
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
                                    <h3>{selectedUser.fullName || t('users.noNameFallback')}</h3>
                                    <p className="text-muted">{selectedUser.email}</p>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>{t('users.userRoleLabel')}</label>
                                <select 
                                    value={editForm.role}
                                    onChange={(e) => setEditForm({...editForm, role: e.target.value})}
                                    className="form-control"
                                >
                                    <option value="normal">{t('users.roleNormal')}</option>
                                    <option value="owner">{t('users.roleOwner')}</option>
                                    <option value="caregiver">{t('users.roleCaregiver')}</option>
                                    <option value="admin">{t('users.roleAdmin')}</option>
                                </select>
                            </div>

                            {(editForm.role === 'owner' || editForm.role === 'caregiver') && (
                                <div className="form-group">
                                    <label>{t('users.verificationStatusLabel')}</label>
                                    <select 
                                        value={editForm.verificationStatus}
                                        onChange={(e) => setEditForm({...editForm, verificationStatus: e.target.value})}
                                        className="form-control"
                                    >
                                        <option value="pending">{t('users.pendingReview')}</option>
                                        <option value="approved">{t('users.approved')}</option>
                                        <option value="rejected">{t('users.rejected')}</option>
                                    </select>
                                </div>
                            )}
                            
                            {selectedUser.idDocumentUrl && (
                                <div className="document-preview-container">
                                    <label>{t('users.identityDocLabel')}</label>
                                    <a href={selectedUser.idDocumentUrl} target="_blank" rel="noopener noreferrer" className="view-doc-btn">
                                        {t('users.viewDocument')}
                                    </a>
                                </div>
                            )}

                        </div>

                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={closeEditModal}>{t('users.cancel')}</button>
                            <button className="btn-primary" onClick={handleSaveEdit}>{t('users.saveChanges')}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* View Modal */}
            {isViewModalOpen && selectedUser && (
                <div className="modal-overlay" onClick={closeViewModal}>
                    <div className="modal-content view-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header view-header">
                            <h2>{t('users.viewModalTitle')}</h2>
                            <button className="close-btn" onClick={closeViewModal}><FontAwesomeIcon icon={faXmark} style={{ fontSize: 24 }} /></button>
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
                                    <h3 className="premium-profile-name">{selectedUser.fullName || t('users.noNameRegistered')}</h3>
                                    <p className="premium-profile-subtitle">{selectedUser.email}</p>
                                </div>
                                <div className="premium-top-right-badge">
                                    <span className={`role-badge ${selectedUser.role || 'normal'}`} style={{fontSize: '14px', padding: '8px 16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}}>
                                        {selectedUser.role === 'admin' && <FontAwesomeIcon icon={faShield} style={{ fontSize: 16 }} />}
                                        {selectedUser.role || 'normal'}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="premium-details-grid">
                                <div className="premium-detail-card">
                                    <span className="premium-detail-label">{t('users.userId')}</span>
                                    <span className="premium-detail-value" style={{fontFamily: 'monospace', fontSize: '13px'}}>{selectedUser.id}</span>
                                </div>
                                <div className="premium-detail-card">
                                    <span className="premium-detail-label">{t('users.phone')}</span>
                                    <span className="premium-detail-value">{selectedUser.phone || t('users.notProvided')}</span>
                                </div>
                                <div className="premium-detail-card">
                                    <span className="premium-detail-label">{t('users.birthDate')}</span>
                                    <span className="premium-detail-value">{selectedUser.birthDate || t('users.notProvided')}</span>
                                </div>
                                <div className="premium-detail-card">
                                    <span className="premium-detail-label">{t('users.verificationStatus')}</span>
                                    <span className="premium-detail-value" style={{textTransform: 'capitalize'}}>{selectedUser.verificationStatus || 'N/A'}</span>
                                </div>
                                {selectedUser.address && (
                                    <div className="premium-detail-card" style={{ gridColumn: '1 / -1' }}>
                                        <span className="premium-detail-label">{t('users.fullAddress')}</span>
                                        <span className="premium-detail-value">
                                            {`${selectedUser.address.addressLine1 || ''}, ${selectedUser.address.city || ''}, ${selectedUser.address.state || ''}, ${selectedUser.address.country || ''}`}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div style={{ padding: '16px', backgroundColor: 'rgba(239, 68, 68, 0.08)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.15)', marginBottom: '30px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                <FontAwesomeIcon icon={faShield} style={{ fontSize: 20, color: '#ef4444', marginTop: '2px', flexShrink: 0 }} />
                                <p style={{margin: 0, fontSize: '13px', color: '#fca5a5', lineHeight: '1.6'}}>
                                    <strong>{t('users.securityPrivacy')}</strong> {t('users.securityPrivacyText')}
                                </p>
                            </div>

                            {loadingDetails ? (
                                <div className="loading-state" style={{padding: '30px 0'}}><div className="spinner"></div><p>{t('users.loadingAdditionalInfo')}</p></div>
                            ) : (
                                <>
                                    <h3 className="premium-section-title">
                                        <FontAwesomeIcon icon={faDog} style={{ fontSize: 20, color: '#10b981' }} /> {t('users.linkedPets')} ({userPets.length})
                                    </h3>
                                    {userPets.length > 0 ? (
                                        <div className="premium-list">
                                            {userPets.map(p => (
                                                <div className="premium-list-item" key={p.id}>
                                                    <div className="premium-item-icon" style={{background: 'rgba(16, 185, 129, 0.1)', color: '#10b981'}}>
                                                        <FontAwesomeIcon icon={faDog} style={{ fontSize: 24 }} />
                                                    </div>
                                                    <div className="premium-item-content">
                                                        <h4 className="premium-item-title">{p.name}</h4>
                                                        <p className="premium-item-desc">
                                                            {t('users.speciesLabel')} <span style={{textTransform: 'capitalize'}}>{p.species || t('users.unknownSpecies')}</span> • {t('users.breedLabel')} {p.breed || t('users.noBreed')} • {p.weight ? p.weight + 'kg' : t('users.weightNA')}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : <p className="text-muted" style={{marginBottom: '30px', fontSize: '15px'}}>{t('users.noPetsRegistered')}</p>}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
