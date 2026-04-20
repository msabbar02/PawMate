import React, { useState, useEffect, useContext } from 'react';
import { supabase } from '../config/supabase';
import { AuthContext } from '../context/AuthContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserPlus, faShield, faTrash, faXmark, faEnvelope, faLock, faUser } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import './AdminsPage.css';

export default function AdminsPage() {
    const { t } = useTranslation();
    const { adminUser } = useContext(AuthContext);
    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [creating, setCreating] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    const [newAdmin, setNewAdmin] = useState({
        email: '',
        password: '',
        fullName: '',
    });

    useEffect(() => {
        fetchAdmins();
    }, []);

    const fetchAdmins = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('role', 'admin')
                .order('created_at', { ascending: false });
            if (!error) setAdmins(data || []);
        } catch (err) {
            console.error('Error fetching admins:', err);
        }
        setLoading(false);
    };

    const handleCreateAdmin = async (e) => {
        e.preventDefault();
        setCreating(true);
        setMessage({ text: '', type: '' });

        try {
            if (!newAdmin.email || !newAdmin.password || !newAdmin.fullName) {
                throw new Error(t('admins.allFieldsRequired'));
            }
            if (newAdmin.password.length < 6) {
                throw new Error(t('admins.passwordMinLength'));
            }

            // Create auth user via Supabase
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: newAdmin.email.trim().toLowerCase(),
                password: newAdmin.password,
            });

            if (authError) throw authError;

            if (authData.user) {
                // Insert into users table with admin role
                const { error: insertError } = await supabase.from('users').upsert({
                    id: authData.user.id,
                    email: newAdmin.email.trim().toLowerCase(),
                    fullName: newAdmin.fullName.trim(),
                    firstName: newAdmin.fullName.trim().split(' ')[0] || '',
                    lastName: newAdmin.fullName.trim().split(' ').slice(1).join(' ') || '',
                    role: 'admin',
                });

                if (insertError) throw insertError;
            }

            setMessage({ text: t('admins.adminCreatedSuccess', { name: newAdmin.fullName }), type: 'success' });
            setNewAdmin({ email: '', password: '', fullName: '' });
            setShowModal(false);
            fetchAdmins();
        } catch (err) {
            setMessage({ text: err.message, type: 'error' });
        }
        setCreating(false);
    };

    const handleRemoveAdmin = async (user) => {
        if (user.id === adminUser?.id) {
            setMessage({ text: t('admins.cannotRemoveSelf'), type: 'error' });
            return;
        }
        if (!window.confirm(t('admins.confirmRemove', { name: user.fullName || user.email }))) return;

        try {
            await supabase.from('users').update({ role: 'normal' }).eq('id', user.id);
            setMessage({ text: t('admins.adminRemoved', { name: user.fullName || user.email }), type: 'success' });
            fetchAdmins();
        } catch (err) {
            setMessage({ text: 'Error: ' + err.message, type: 'error' });
        }
    };

    return (
        <div className="admins-page">
            <div className="page-header">
                <h2 className="page-title">{t('admins.pageTitle')}</h2>
                <button className="btn-primary add-admin-btn" onClick={() => setShowModal(true)}>
                    <FontAwesomeIcon icon={faUserPlus} style={{ fontSize: 18 }} /> {t('admins.createAdmin')}
                </button>
            </div>

            {message.text && (
                <div className={`profile-message ${message.type}`}>{message.text}</div>
            )}

            {loading ? (
                <div className="loading-state"><div className="spinner"></div><p>{t('admins.loading')}</p></div>
            ) : (
                <div className="admins-grid">
                    {admins.map(admin => (
                        <div className="admin-card glass-panel" key={admin.id}>
                            <div className="admin-card-header">
                                {admin.photoURL ? (
                                    <img src={admin.photoURL} alt="avatar" className="admin-card-avatar" />
                                ) : (
                                    <div className="admin-card-avatar-placeholder">
                                        {admin.fullName?.charAt(0) || 'A'}
                                    </div>
                                )}
                                <div className="admin-card-info">
                                    <h3>{admin.fullName || t('admins.noName')}</h3>
                                    <span className="admin-card-email">{admin.email}</span>
                                </div>
                                {admin.id === adminUser?.id && (
                                    <span className="you-badge">{t('admins.youBadge')}</span>
                                )}
                            </div>
                            <div className="admin-card-meta">
                                <span>{t('admins.phoneLabel')} {admin.phone || t('admins.notConfigured')}</span>
                                <span>{t('admins.sinceLabel')} {admin.created_at ? new Date(admin.created_at).toLocaleDateString('es-ES') : 'N/A'}</span>
                            </div>
                            {admin.id !== adminUser?.id && (
                                <button className="remove-admin-btn" onClick={() => handleRemoveAdmin(admin)}>
                                    <FontAwesomeIcon icon={faTrash} style={{ fontSize: 14 }} /> {t('admins.removePermissions')}
                                </button>
                            )}
                        </div>
                    ))}
                    {admins.length === 0 && (
                        <div className="empty-state">
                            <FontAwesomeIcon icon={faShield} style={{ fontSize: 40 }} />
                            <p>{t('admins.noAdmins')}</p>
                        </div>
                    )}
                </div>
            )}

            {/* Create Admin Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2><FontAwesomeIcon icon={faUserPlus} style={{ fontSize: 20 }} /> {t('admins.createModalTitle')}</h2>
                            <button className="close-btn" onClick={() => setShowModal(false)}><FontAwesomeIcon icon={faXmark} style={{ fontSize: 24 }} /></button>
                        </div>
                        <form onSubmit={handleCreateAdmin}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label><FontAwesomeIcon icon={faUser} style={{ fontSize: 14 }} /> {t('admins.fullNameLabel')}</label>
                                    <input 
                                        type="text"
                                        className="form-control"
                                        placeholder={t('admins.fullNamePlaceholder')}
                                        value={newAdmin.fullName}
                                        onChange={e => setNewAdmin({ ...newAdmin, fullName: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label><FontAwesomeIcon icon={faEnvelope} style={{ fontSize: 14 }} /> {t('admins.emailLabel')}</label>
                                    <input 
                                        type="email"
                                        className="form-control"
                                        placeholder={t('admins.emailPlaceholder')}
                                        value={newAdmin.email}
                                        onChange={e => setNewAdmin({ ...newAdmin, email: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label><FontAwesomeIcon icon={faLock} style={{ fontSize: 14 }} /> {t('admins.passwordLabel')}</label>
                                    <input 
                                        type="password"
                                        className="form-control"
                                        placeholder={t('admins.passwordPlaceholder')}
                                        value={newAdmin.password}
                                        onChange={e => setNewAdmin({ ...newAdmin, password: e.target.value })}
                                        required
                                        minLength={6}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>{t('admins.cancel')}</button>
                                <button type="submit" className="btn-primary" disabled={creating}>
                                    {creating ? t('admins.creating') : t('admins.createButton')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
