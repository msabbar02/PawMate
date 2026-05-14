/**
 * Página de gestión de administradores.
 *
 * Lista todos los usuarios con `role = 'admin'`, permite crear nuevos
 * (signup en Supabase Auth + upsert en `users` con rol admin) y
 * degradar a otros admins a usuario normal. El admin actual no puede
 * autoeliminarse.
 */
import React, { useState, useEffect, useContext } from 'react';
import { supabase } from '../config/supabase';
import { AuthContext } from '../context/AuthContext';
import { createAdminAccount } from '../config/api';
import { isSuperadmin, SUPERADMIN_EMAIL } from '../config/superadmin';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserPlus, faShield, faTrash, faXmark, faEnvelope, faLock, faUser } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import './AdminsPage.css';

export default function AdminsPage() {
    const { t } = useTranslation();
    const { adminUser } = useContext(AuthContext);
    const callerIsSuperadmin = isSuperadmin(adminUser?.email);
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

    // Refresco automático cada 10 s (sin spinner) como fallback al Realtime.
    useAutoRefresh(() => fetchAdmins({ silent: true }), 10000);

    /**
     * Carga la lista de administradores desde la tabla `users`.
     * Si se pasa `{ silent: true }` no muestra el spinner de carga.
     *
     * @param {{silent?: boolean}} [opts]
     */
    const fetchAdmins = async (opts = {}) => {
        if (!opts.silent) setLoading(true);
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
        if (!opts.silent) setLoading(false);
    };

    /**
     * Crea un nuevo administrador: signup en Supabase Auth y upsert en
     * la tabla `users` con `role = 'admin'`. Valida campos requeridos
     * y longitud mínima de contraseña (6 caracteres).
     *
     * @param {React.FormEvent} e
     */
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
            if (!callerIsSuperadmin) {
                throw new Error('Solo el superadministrador puede crear nuevos admins');
            }

            // Crea el admin a travs del backend (service key) para evitar disparar
            // el Auth Hook de Supabase, que provocaba el error "Hook requires authorization token".
            const result = await createAdminAccount({
                email: newAdmin.email.trim().toLowerCase(),
                password: newAdmin.password,
                fullName: newAdmin.fullName.trim(),
            });
            if (!result.ok) throw new Error(result.error || 'No se pudo crear el admin');

            setMessage({ text: t('admins.adminCreatedSuccess', { name: newAdmin.fullName }), type: 'success' });
            setNewAdmin({ email: '', password: '', fullName: '' });
            setShowModal(false);
            fetchAdmins();
        } catch (err) {
            setMessage({ text: err.message, type: 'error' });
        }
        setCreating(false);
    };

    /**
     * Degrada un administrador a usuario normal. Bloquea la auto-eliminación
     * y pide confirmación antes de aplicar el cambio.
     *
     * @param {{id:string, fullName?:string, email?:string}} user
     */
    const handleRemoveAdmin = async (user) => {
        if (user.id === adminUser?.id) {
            setMessage({ text: t('admins.cannotRemoveSelf'), type: 'error' });
            return;
        }
        if (isSuperadmin(user.email)) {
            setMessage({ text: 'No se puede degradar al superadministrador', type: 'error' });
            return;
        }
        if (!callerIsSuperadmin) {
            setMessage({ text: 'Solo el superadministrador puede degradar a otros admins', type: 'error' });
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
                {callerIsSuperadmin && (
                    <button className="btn-primary add-admin-btn" onClick={() => setShowModal(true)}>
                        <FontAwesomeIcon icon={faUserPlus} style={{ fontSize: 18 }} /> {t('admins.createAdmin')}
                    </button>
                )}
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
                                {isSuperadmin(admin.email) && (
                                    <span className="role-badge superadmin" style={{ marginLeft: 6 }}>Superadmin</span>
                                )}
                            </div>
                            <div className="admin-card-meta">
                                <span>{t('admins.phoneLabel')} {admin.phone || t('admins.notConfigured')}</span>
                                <span>{t('admins.sinceLabel')} {admin.created_at ? new Date(admin.created_at).toLocaleDateString('es-ES') : 'N/A'}</span>
                            </div>
                            {admin.id !== adminUser?.id && callerIsSuperadmin && !isSuperadmin(admin.email) && (
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
