import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { supabase } from '../config/supabase';
import { Camera, Save, Trash2, User, Mail, Phone, MapPin, FileText } from 'lucide-react';
import './ProfilePage.css';

export default function ProfilePage() {
    const { adminUser, refreshProfile } = useContext(AuthContext);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });
    const [uploading, setUploading] = useState(false);

    const [form, setForm] = useState({
        fullName: adminUser?.fullName || '',
        firstName: adminUser?.firstName || '',
        lastName: adminUser?.lastName || '',
        email: adminUser?.email || '',
        phone: adminUser?.phone || '',
        bio: adminUser?.bio || '',
        city: adminUser?.city || '',
        province: adminUser?.province || '',
        country: adminUser?.country || '',
    });

    const handleChange = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handlePhotoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const maxSize = 2 * 1024 * 1024;
        if (file.size > maxSize) {
            setMessage({ text: 'La imagen no puede superar 2MB', type: 'error' });
            return;
        }

        setUploading(true);
        try {
            const ext = file.name.split('.').pop();
            const path = `avatars/${adminUser.id}.${ext}`;
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(path, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(path);

            await supabase.from('users').update({ photoURL: publicUrl }).eq('id', adminUser.id);
            await refreshProfile();
            setMessage({ text: 'Foto actualizada correctamente', type: 'success' });
        } catch (err) {
            setMessage({ text: 'Error al subir foto: ' + err.message, type: 'error' });
        }
        setUploading(false);
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage({ text: '', type: '' });
        try {
            const updates = {
                fullName: `${form.firstName} ${form.lastName}`.trim() || form.fullName,
                firstName: form.firstName,
                lastName: form.lastName,
                phone: form.phone,
                bio: form.bio,
                city: form.city,
                province: form.province,
                country: form.country,
            };

            const { error } = await supabase.from('users').update(updates).eq('id', adminUser.id);
            if (error) throw error;
            await refreshProfile();
            setEditing(false);
            setMessage({ text: 'Perfil actualizado correctamente', type: 'success' });
        } catch (err) {
            setMessage({ text: 'Error al guardar: ' + err.message, type: 'error' });
        }
        setSaving(false);
    };

    const handleDeleteField = async (field) => {
        if (!window.confirm(`¿Seguro que quieres borrar tu ${field}?`)) return;
        try {
            await supabase.from('users').update({ [field]: null }).eq('id', adminUser.id);
            setForm(prev => ({ ...prev, [field]: '' }));
            await refreshProfile();
            setMessage({ text: `${field} eliminado`, type: 'success' });
        } catch (err) {
            setMessage({ text: 'Error: ' + err.message, type: 'error' });
        }
    };

    return (
        <div className="profile-page">
            <h2 className="page-title">Mi Perfil</h2>

            {message.text && (
                <div className={`profile-message ${message.type}`}>{message.text}</div>
            )}

            <div className="profile-card glass-panel">
                <div className="profile-photo-section">
                    <div className="profile-photo-wrapper">
                        {adminUser?.photoURL ? (
                            <img src={adminUser.photoURL} alt="Foto de perfil" className="profile-photo" />
                        ) : (
                            <div className="profile-photo-placeholder">
                                {adminUser?.fullName?.charAt(0) || 'A'}
                            </div>
                        )}
                        <label className="photo-upload-btn" title="Cambiar foto">
                            <Camera size={18} />
                            <input type="file" accept="image/*" onChange={handlePhotoUpload} hidden />
                        </label>
                    </div>
                    {uploading && <span className="upload-status">Subiendo...</span>}
                    <h3 className="profile-display-name">{adminUser?.fullName || 'Admin'}</h3>
                    <span className="role-badge admin">Admin</span>
                </div>

                <div className="profile-details">
                    <div className="detail-row">
                        <div className="detail-icon"><User size={18} /></div>
                        <div className="detail-content">
                            <label>Nombre</label>
                            {editing ? (
                                <div className="name-fields">
                                    <input value={form.firstName} onChange={e => handleChange('firstName', e.target.value)} placeholder="Nombre" className="form-control" />
                                    <input value={form.lastName} onChange={e => handleChange('lastName', e.target.value)} placeholder="Apellido" className="form-control" />
                                </div>
                            ) : (
                                <span>{adminUser?.fullName || 'No configurado'}</span>
                            )}
                        </div>
                        {editing && form.fullName && (
                            <button className="delete-field-btn" onClick={() => handleDeleteField('fullName')}><Trash2 size={14} /></button>
                        )}
                    </div>

                    <div className="detail-row">
                        <div className="detail-icon"><Mail size={18} /></div>
                        <div className="detail-content">
                            <label>Email</label>
                            <span>{adminUser?.email || 'No configurado'}</span>
                        </div>
                    </div>

                    <div className="detail-row">
                        <div className="detail-icon"><Phone size={18} /></div>
                        <div className="detail-content">
                            <label>Teléfono</label>
                            {editing ? (
                                <input value={form.phone} onChange={e => handleChange('phone', e.target.value)} placeholder="+34..." className="form-control" />
                            ) : (
                                <span>{adminUser?.phone || 'No configurado'}</span>
                            )}
                        </div>
                        {editing && form.phone && (
                            <button className="delete-field-btn" onClick={() => handleDeleteField('phone')}><Trash2 size={14} /></button>
                        )}
                    </div>

                    <div className="detail-row">
                        <div className="detail-icon"><MapPin size={18} /></div>
                        <div className="detail-content">
                            <label>Ubicación</label>
                            {editing ? (
                                <div className="name-fields">
                                    <input value={form.city} onChange={e => handleChange('city', e.target.value)} placeholder="Ciudad" className="form-control" />
                                    <input value={form.province} onChange={e => handleChange('province', e.target.value)} placeholder="Provincia" className="form-control" />
                                    <input value={form.country} onChange={e => handleChange('country', e.target.value)} placeholder="País" className="form-control" />
                                </div>
                            ) : (
                                <span>{[adminUser?.city, adminUser?.province, adminUser?.country].filter(Boolean).join(', ') || 'No configurado'}</span>
                            )}
                        </div>
                    </div>

                    <div className="detail-row">
                        <div className="detail-icon"><FileText size={18} /></div>
                        <div className="detail-content">
                            <label>Bio</label>
                            {editing ? (
                                <textarea value={form.bio} onChange={e => handleChange('bio', e.target.value)} placeholder="Escribe algo sobre ti..." className="form-control" rows={3} />
                            ) : (
                                <span>{adminUser?.bio || 'Sin biografía'}</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="profile-actions">
                    {editing ? (
                        <>
                            <button className="btn-secondary" onClick={() => setEditing(false)}>Cancelar</button>
                            <button className="btn-primary" onClick={handleSave} disabled={saving}>
                                <Save size={16} /> {saving ? 'Guardando...' : 'Guardar'}
                            </button>
                        </>
                    ) : (
                        <button className="btn-primary" onClick={() => setEditing(true)}>Editar Perfil</button>
                    )}
                </div>
            </div>
        </div>
    );
}
