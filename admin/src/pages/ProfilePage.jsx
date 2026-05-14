/**
 * Página de perfil del administrador autenticado.
 *
 * Permite editar nombre, teléfono, ubicación y bio, subir foto de perfil
 * (límite 2 MB, almacenada en el bucket `pawmate` de Storage con cache-bust
 * por timestamp) y borrar campos individuales.
 */
import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { supabase } from '../config/supabase';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCamera, faFloppyDisk, faTrash, faUser, faEnvelope, faPhone, faLocationDot, faFileLines } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import './ProfilePage.css';

export default function ProfilePage() {
    const { t } = useTranslation();
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

    /** Actualiza un campo del formulario en estado local. */
    const handleChange = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    /**
     * Sube una nueva foto de perfil al bucket `pawmate` (máximo 2 MB),
     * actualiza la columna `photoURL` con cache-bust y refresca el perfil.
     */
    const handlePhotoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const maxSize = 2 * 1024 * 1024;
        if (file.size > maxSize) {
            setMessage({ text: t('profile.imageTooLarge'), type: 'error' });
            return;
        }

        setUploading(true);
        try {
            const ext = file.name.split('.').pop();
            const path = `avatars/${adminUser.id}.${ext}`;
            const { error: uploadError } = await supabase.storage
                .from('pawmate')
                .upload(path, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('pawmate')
                .getPublicUrl(path);

            // Cache-bust: la URL de Storage es estable al sobre-escribir el mismo path,
            // así que añadimos un parámetro de versión para forzar la recarga del navegador.
            const versionedUrl = `${publicUrl}?v=${Date.now()}`;
            await supabase.from('users').update({ photoURL: versionedUrl }).eq('id', adminUser.id);
            await refreshProfile();
            setMessage({ text: t('profile.photoUpdated'), type: 'success' });
        } catch (err) {
            setMessage({ text: t('profile.errorUploadPhoto') + err.message, type: 'error' });
        }
        setUploading(false);
    };

    /** Guarda los cambios del formulario en la fila del usuario admin. */
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
            setMessage({ text: t('profile.profileUpdated'), type: 'success' });
        } catch (err) {
            setMessage({ text: t('profile.errorSave') + err.message, type: 'error' });
        }
        setSaving(false);
    };

    /** Borra (pone a NULL) un campo individual del perfil tras confirmar. */
    const handleDeleteField = async (field) => {
        if (!window.confirm(t('profile.confirmDeleteField', { field }))) return;
        try {
            await supabase.from('users').update({ [field]: null }).eq('id', adminUser.id);
            setForm(prev => ({ ...prev, [field]: '' }));
            await refreshProfile();
            setMessage({ text: t('profile.fieldDeleted', { field }), type: 'success' });
        } catch (err) {
            setMessage({ text: t('profile.errorGeneric') + err.message, type: 'error' });
        }
    };

    return (
        <div className="profile-page">
            <h2 className="page-title">{t('profile.pageTitle')}</h2>

            {message.text && (
                <div className={`profile-message ${message.type}`}>{message.text}</div>
            )}

            <div className="profile-card glass-panel">
                <div className="profile-photo-section">
                    <div className="profile-photo-wrapper">
                        {adminUser?.photoURL ? (
                            <img src={adminUser.photoURL} alt={t('profile.profilePhotoAlt')} className="profile-photo" />
                        ) : (
                            <div className="profile-photo-placeholder">
                                {adminUser?.fullName?.charAt(0) || 'A'}
                            </div>
                        )}
                        <label className="photo-upload-btn" title={t('profile.changePhoto')}>
                            <FontAwesomeIcon icon={faCamera} style={{ fontSize: 18 }} />
                            <input type="file" accept="image/*" onChange={handlePhotoUpload} hidden />
                        </label>
                    </div>
                    {uploading && <span className="upload-status">{t('profile.uploading')}</span>}
                    <h3 className="profile-display-name">{adminUser?.fullName || 'Admin'}</h3>
                    <span className="role-badge admin">{t('profile.adminBadge')}</span>
                </div>

                <div className="profile-details">
                    <div className="detail-row">
                        <div className="detail-icon"><FontAwesomeIcon icon={faUser} style={{ fontSize: 18 }} /></div>
                        <div className="detail-content">
                            <label>{t('profile.nameLabel')}</label>
                            {editing ? (
                                <div className="name-fields">
                                    <input value={form.firstName} onChange={e => handleChange('firstName', e.target.value)} placeholder={t('profile.firstNamePlaceholder')} className="form-control" />
                                    <input value={form.lastName} onChange={e => handleChange('lastName', e.target.value)} placeholder={t('profile.lastNamePlaceholder')} className="form-control" />
                                </div>
                            ) : (
                                <span>{adminUser?.fullName || t('profile.notConfigured')}</span>
                            )}
                        </div>
                        {editing && form.fullName && (
                            <button className="delete-field-btn" onClick={() => handleDeleteField('fullName')}><FontAwesomeIcon icon={faTrash} style={{ fontSize: 14 }} /></button>
                        )}
                    </div>

                    <div className="detail-row">
                        <div className="detail-icon"><FontAwesomeIcon icon={faEnvelope} style={{ fontSize: 18 }} /></div>
                        <div className="detail-content">
                            <label>{t('profile.emailLabel')}</label>
                            <span>{adminUser?.email || t('profile.notConfigured')}</span>
                        </div>
                    </div>

                    <div className="detail-row">
                        <div className="detail-icon"><FontAwesomeIcon icon={faPhone} style={{ fontSize: 18 }} /></div>
                        <div className="detail-content">
                            <label>{t('profile.phoneLabel')}</label>
                            {editing ? (
                                <input value={form.phone} onChange={e => handleChange('phone', e.target.value)} placeholder={t('profile.phonePlaceholder')} className="form-control" />
                            ) : (
                                <span>{adminUser?.phone || t('profile.notConfigured')}</span>
                            )}
                        </div>
                        {editing && form.phone && (
                            <button className="delete-field-btn" onClick={() => handleDeleteField('phone')}><FontAwesomeIcon icon={faTrash} style={{ fontSize: 14 }} /></button>
                        )}
                    </div>

                    <div className="detail-row">
                        <div className="detail-icon"><FontAwesomeIcon icon={faLocationDot} style={{ fontSize: 18 }} /></div>
                        <div className="detail-content">
                            <label>{t('profile.locationLabel')}</label>
                            {editing ? (
                                <div className="name-fields">
                                    <input value={form.city} onChange={e => handleChange('city', e.target.value)} placeholder={t('profile.cityPlaceholder')} className="form-control" />
                                    <input value={form.province} onChange={e => handleChange('province', e.target.value)} placeholder={t('profile.provincePlaceholder')} className="form-control" />
                                    <input value={form.country} onChange={e => handleChange('country', e.target.value)} placeholder={t('profile.countryPlaceholder')} className="form-control" />
                                </div>
                            ) : (
                                <span>{[adminUser?.city, adminUser?.province, adminUser?.country].filter(Boolean).join(', ') || t('profile.notConfigured')}</span>
                            )}
                        </div>
                    </div>

                    <div className="detail-row">
                        <div className="detail-icon"><FontAwesomeIcon icon={faFileLines} style={{ fontSize: 18 }} /></div>
                        <div className="detail-content">
                            <label>{t('profile.bioLabel')}</label>
                            {editing ? (
                                <textarea value={form.bio} onChange={e => handleChange('bio', e.target.value)} placeholder={t('profile.bioPlaceholder')} className="form-control" rows={3} />
                            ) : (
                                <span>{adminUser?.bio || t('profile.noBio')}</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="profile-actions">
                    {editing ? (
                        <>
                            <button className="btn-secondary" onClick={() => setEditing(false)}>{t('profile.cancel')}</button>
                            <button className="btn-primary" onClick={handleSave} disabled={saving}>
                                <FontAwesomeIcon icon={faFloppyDisk} style={{ fontSize: 16 }} /> {saving ? t('profile.saving') : t('profile.save')}
                            </button>
                        </>
                    ) : (
                        <button className="btn-primary" onClick={() => {
                            setForm({
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
                            setEditing(true);
                        }}>{t('profile.editProfile')}</button>
                    )}
                </div>
            </div>
        </div>
    );
}
