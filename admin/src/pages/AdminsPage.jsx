import React, { useState, useEffect, useContext } from 'react';
import { supabase } from '../config/supabase';
import { AuthContext } from '../context/AuthContext';
import { UserPlus, Shield, Trash2, X, Mail, Lock, User } from 'lucide-react';
import './AdminsPage.css';

export default function AdminsPage() {
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
                throw new Error('Todos los campos son obligatorios');
            }
            if (newAdmin.password.length < 6) {
                throw new Error('La contraseña debe tener al menos 6 caracteres');
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

            setMessage({ text: `Admin "${newAdmin.fullName}" creado correctamente. Se enviará un email de confirmación.`, type: 'success' });
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
            setMessage({ text: 'No puedes eliminarte a ti mismo como admin', type: 'error' });
            return;
        }
        if (!window.confirm(`¿Quitar permisos de admin a ${user.fullName || user.email}?`)) return;

        try {
            await supabase.from('users').update({ role: 'normal' }).eq('id', user.id);
            setMessage({ text: `${user.fullName || user.email} ya no es administrador`, type: 'success' });
            fetchAdmins();
        } catch (err) {
            setMessage({ text: 'Error: ' + err.message, type: 'error' });
        }
    };

    return (
        <div className="admins-page">
            <div className="page-header">
                <h2 className="page-title">Gestión de Administradores</h2>
                <button className="btn-primary add-admin-btn" onClick={() => setShowModal(true)}>
                    <UserPlus size={18} /> Crear Admin
                </button>
            </div>

            {message.text && (
                <div className={`profile-message ${message.type}`}>{message.text}</div>
            )}

            {loading ? (
                <div className="loading-state"><div className="spinner"></div><p>Cargando admins...</p></div>
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
                                    <h3>{admin.fullName || 'Sin nombre'}</h3>
                                    <span className="admin-card-email">{admin.email}</span>
                                </div>
                                {admin.id === adminUser?.id && (
                                    <span className="you-badge">Tú</span>
                                )}
                            </div>
                            <div className="admin-card-meta">
                                <span>Teléfono: {admin.phone || 'No configurado'}</span>
                                <span>Desde: {admin.created_at ? new Date(admin.created_at).toLocaleDateString('es-ES') : 'N/A'}</span>
                            </div>
                            {admin.id !== adminUser?.id && (
                                <button className="remove-admin-btn" onClick={() => handleRemoveAdmin(admin)}>
                                    <Trash2 size={14} /> Quitar permisos
                                </button>
                            )}
                        </div>
                    ))}
                    {admins.length === 0 && (
                        <div className="empty-state">
                            <Shield size={40} />
                            <p>No hay administradores registrados</p>
                        </div>
                    )}
                </div>
            )}

            {/* Create Admin Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2><UserPlus size={20} /> Crear Nuevo Admin</h2>
                            <button className="close-btn" onClick={() => setShowModal(false)}><X size={24} /></button>
                        </div>
                        <form onSubmit={handleCreateAdmin}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label><User size={14} /> Nombre completo</label>
                                    <input 
                                        type="text"
                                        className="form-control"
                                        placeholder="Nombre del admin"
                                        value={newAdmin.fullName}
                                        onChange={e => setNewAdmin({ ...newAdmin, fullName: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label><Mail size={14} /> Email</label>
                                    <input 
                                        type="email"
                                        className="form-control"
                                        placeholder="email@ejemplo.com"
                                        value={newAdmin.email}
                                        onChange={e => setNewAdmin({ ...newAdmin, email: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label><Lock size={14} /> Contraseña</label>
                                    <input 
                                        type="password"
                                        className="form-control"
                                        placeholder="Mínimo 6 caracteres"
                                        value={newAdmin.password}
                                        onChange={e => setNewAdmin({ ...newAdmin, password: e.target.value })}
                                        required
                                        minLength={6}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn-primary" disabled={creating}>
                                    {creating ? 'Creando...' : 'Crear Admin'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
