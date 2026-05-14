/**
 * Página de gestión de verificaciones de identidad.
 *
 * Muestra todos los usuarios que han iniciado el proceso de
 * verificación (DNI/selfie/certificado de cuidador). Permite aprobar
 * (asignando el rol pendiente, p. ej. `caregiver`), rechazar con
 * motivo o resetear a pendiente. Incluye visor de imágenes a tamaño
 * completo.
 */
import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faShieldHalved, faClock, faXmark, faEye, faUserCheck, faRotateLeft, faFileImage, faCheck, faBan } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import './VerificationsPage.css';

export default function VerificationsPage() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('pending');
    const [previewImage, setPreviewImage] = useState(null);
    const [previewLabel, setPreviewLabel] = useState('');
    const { t } = useTranslation();

    useEffect(() => {
        fetchVerifications();
    }, []);

    /** Carga todos los usuarios con `verificationStatus` no nulo. */
    const fetchVerifications = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('users')
                .select('id, fullName, firstName, lastName, email, avatar, photoURL, role, pendingRole, verificationStatus, verificationRequestedAt, idFrontUrl, idBackUrl, selfieUrl, certDocUrl, acceptedSpecies, serviceTypes')
                .not('verificationStatus', 'is', null);

            if (error) throw error;
            setRequests(data || []);
        } catch (err) {
            console.error('Error fetching verifications:', err);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Aprueba la verificación y promueve el rol al `pendingRole`
     * solicitado (por defecto `owner`).
     */
    const handleApprove = async (user) => {
        if (!window.confirm(t('verifications.confirmApprove', { name: user.fullName || user.email, role: user.pendingRole || 'owner' }))) return;

        try {
            const newRole = user.pendingRole || 'owner';
            const { error } = await supabase.from('users').update({
                verificationStatus: 'approved',
                role: newRole,
            }).eq('id', user.id);

            if (error) {
                console.error('Supabase update error:', error);
                alert(`${t('verifications.errorApprove')} ${error.message}`);
                return;
            }

            setRequests(prev => prev.map(r =>
                r.id === user.id ? { ...r, verificationStatus: 'approved', role: newRole } : r
            ));
        } catch (err) {
            console.error('Error approving:', err);
            alert(t('verifications.errorApproveGeneric'));
        }
    };

    /** Rechaza la verificación almacenando el motivo proporcionado. */
    const handleReject = async (user) => {
        const reason = window.prompt(t('verifications.rejectPrompt', { name: user.fullName || user.email }), t('verifications.rejectDefaultReason'));
        if (reason === null) return;

        try {
            const { error } = await supabase.from('users').update({
                verificationStatus: 'rejected',
                verificationRejectionReason: reason,
            }).eq('id', user.id);

            if (error) {
                console.error('Supabase update error:', error);
                alert(`${t('verifications.errorReject')} ${error.message}`);
                return;
            }

            setRequests(prev => prev.map(r =>
                r.id === user.id ? { ...r, verificationStatus: 'rejected' } : r
            ));
        } catch (err) {
            console.error('Error rejecting:', err);
            alert(t('verifications.errorRejectGeneric'));
        }
    };

    /** Devuelve un usuario aprobado/rechazado al estado `pending`. */
    const handleResetToPending = async (user) => {
        if (!window.confirm(t('verifications.confirmRevert', { name: user.fullName || user.email }))) return;

        try {
            const { error } = await supabase.from('users').update({
                verificationStatus: 'pending',
            }).eq('id', user.id);

            if (error) {
                console.error('Supabase update error:', error);
                alert(`${t('verifications.errorRevert')} ${error.message}`);
                return;
            }

            setRequests(prev => prev.map(r =>
                r.id === user.id ? { ...r, verificationStatus: 'pending' } : r
            ));
        } catch (err) {
            console.error('Error resetting:', err);
            alert(t('verifications.errorRevertGeneric'));
        }
    };

    /** Abre el modal de previsualización de un documento. */
    const openPreview = (url, label) => {
        setPreviewImage(url);
        setPreviewLabel(label);
    };

    /** Cierra el modal de previsualización. */
    const closePreview = () => {
        setPreviewImage(null);
        setPreviewLabel('');
    };

    // Datos derivados.
    const counts = {
        all: requests.length,
        pending: requests.filter(r => r.verificationStatus === 'pending').length,
        approved: requests.filter(r => r.verificationStatus === 'approved').length,
        rejected: requests.filter(r => r.verificationStatus === 'rejected').length,
    };

    const filtered = statusFilter === 'all'
        ? requests
        : requests.filter(r => r.verificationStatus === statusFilter);

    /** Formatea una fecha ISO en formato corto en castellano. */
    const formatDate = (iso) => {
        if (!iso) return '—';
        return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const getUserName = (u) => u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email?.split('@')[0] || t('verifications.userFallback');
    const getInitial = (u) => getUserName(u).charAt(0).toUpperCase();

    // Renderizado.
    if (loading) {
        return (
            <div className="verifications-page">
                <div className="verifications-loading">
                    <div className="spinner" />
                    <span>{t('verifications.loading')}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="verifications-page">

            {/* Header */}
            <div className="page-header">
                <h1>
                    <FontAwesomeIcon icon={faShieldHalved} style={{ fontSize: 26 }} />
                    {t('verifications.pageTitle')}
                </h1>
                <div className="stat-pills">
                    <span className="stat-pill pending"><FontAwesomeIcon icon={faClock} style={{ fontSize: 14 }} /> {counts.pending} {t('verifications.pendingCount')}</span>
                    <span className="stat-pill approved"><FontAwesomeIcon icon={faCheck} style={{ fontSize: 14 }} /> {counts.approved} {t('verifications.approvedCount')}</span>
                    <span className="stat-pill rejected"><FontAwesomeIcon icon={faBan} style={{ fontSize: 14 }} /> {counts.rejected} {t('verifications.rejectedCount')}</span>
                </div>
            </div>

            {/* Filter */}
            <div className="filter-bar">
                {['all', 'pending', 'approved', 'rejected'].map(f => (
                    <button
                        key={f}
                        className={`filter-btn ${statusFilter === f ? 'active' : ''}`}
                        onClick={() => setStatusFilter(f)}
                    >
                        {f === 'all' ? t('verifications.filterAll') : f === 'pending' ? t('verifications.filterPending') : f === 'approved' ? t('verifications.filterApproved') : t('verifications.filterRejected')}
                        {' '}({counts[f]})
                    </button>
                ))}
            </div>

            {/* Grid */}
            {filtered.length === 0 ? (
                <div className="verifications-empty">
                    <FontAwesomeIcon icon={faFileImage} style={{ fontSize: 52 }} />
                    <h3>{t('verifications.noRequests')}</h3>
                    <p>{t('verifications.noRequestsMessage')} {statusFilter !== 'all' ? `${t('verifications.withStatus')} "${statusFilter}"` : ''}.</p>
                </div>
            ) : (
                <div className="verifications-grid">
                    {filtered.map(req => (
                        <div key={req.id} className="verification-card">

                            {/* Card header */}
                            <div className="card-header">
                                <div className="user-avatar">
                                    {(req.avatar || req.photoURL)
                                        ? <img src={req.avatar || req.photoURL} alt="" />
                                        : getInitial(req)
                                    }
                                </div>
                                <div className="user-info">
                                    <h3>{getUserName(req)}</h3>
                                    <span className="email">{req.email}</span>
                                </div>
                                <span className={`role-badge ${req.pendingRole || 'owner'}`}>
                                    {req.pendingRole === 'caregiver' ? `${t('verifications.roleCaregiver')}` : `${t('verifications.roleOwner')}`}
                                </span>
                            </div>

                            {/* Document previews */}
                            <div className={`docs-preview ${req.certDocUrl ? 'has-cert' : ''}`}>
                                {[
                                    { url: req.idFrontUrl, label: t('verifications.docFront') },
                                    { url: req.idBackUrl, label: t('verifications.docBack') },
                                    { url: req.selfieUrl, label: t('verifications.docSelfie') },
                                    ...(req.certDocUrl ? [{ url: req.certDocUrl, label: t('verifications.docCert') }] : []),
                                ].map((doc, i) => (
                                    <div
                                        key={i}
                                        className="doc-thumb"
                                        onClick={() => doc.url && openPreview(doc.url, doc.label)}
                                    >
                                        {doc.url ? (
                                            <>
                                                <img src={doc.url} alt={doc.label} />
                                                <span className="doc-label">{doc.label}</span>
                                            </>
                                        ) : (
                                            <span className="no-doc">{t('verifications.noDoc')} {doc.label}</span>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Meta chips */}
                            <div className="card-meta">
                                <span className={`status-badge ${req.verificationStatus}`}>
                                    {req.verificationStatus === 'pending' ? `⏳ ${t('verifications.statusPending')}` : req.verificationStatus === 'approved' ? `${t('verifications.statusApproved')}` : `${t('verifications.statusRejected')}`}
                                </span>
                                <span className="meta-chip">
                                    <FontAwesomeIcon icon={faClock} style={{ fontSize: 12 }} /> {formatDate(req.verificationRequestedAt)}
                                </span>
                                {req.pendingRole === 'caregiver' && req.serviceTypes?.length > 0 && (
                                    <span className="meta-chip">
                                        {t('verifications.servicesLabel')} {req.serviceTypes.join(', ')}
                                    </span>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="card-actions">
                                {req.verificationStatus === 'pending' && (
                                    <>
                                        <button className="approve-btn" onClick={() => handleApprove(req)}>
                                            <FontAwesomeIcon icon={faUserCheck} style={{ fontSize: 16 }} /> {t('verifications.approve')}
                                        </button>
                                        <button className="reject-btn" onClick={() => handleReject(req)}>
                                            <FontAwesomeIcon icon={faBan} style={{ fontSize: 16 }} /> {t('verifications.reject')}
                                        </button>
                                    </>
                                )}
                                {(req.verificationStatus === 'approved' || req.verificationStatus === 'rejected') && (
                                    <button className="undo-btn" onClick={() => handleResetToPending(req)}>
                                        <FontAwesomeIcon icon={faRotateLeft} style={{ fontSize: 16 }} /> {t('verifications.revertToPending')}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Image preview modal */}
            {previewImage && (
                <div className="image-preview-overlay" onClick={closePreview}>
                    <button className="close-preview" onClick={closePreview}>
                        <FontAwesomeIcon icon={faXmark} style={{ fontSize: 22 }} />
                    </button>
                    <img src={previewImage} alt={previewLabel} onClick={e => e.stopPropagation()} />
                    <span className="preview-label">{previewLabel}</span>
                </div>
            )}
        </div>
    );
}
