import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { ShieldCheck, ShieldX, Clock, X, Eye, UserCheck, Undo2, FileImage } from 'lucide-react';
import './VerificationsPage.css';

export default function VerificationsPage() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('pending');
    const [previewImage, setPreviewImage] = useState(null);
    const [previewLabel, setPreviewLabel] = useState('');

    useEffect(() => {
        fetchVerifications();
    }, []);

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

    const handleApprove = async (user) => {
        if (!window.confirm(`¿Aprobar la verificación de ${user.fullName || user.email}? Se le asignará el rol "${user.pendingRole || 'owner'}".`)) return;

        try {
            const newRole = user.pendingRole || 'owner';
            await supabase.from('users').update({
                verificationStatus: 'approved',
                verificationApprovedAt: new Date().toISOString(),
                role: newRole,
                isVerified: true,
            }).eq('id', user.id);

            setRequests(prev => prev.map(r =>
                r.id === user.id ? { ...r, verificationStatus: 'approved', role: newRole } : r
            ));
        } catch (err) {
            console.error('Error approving:', err);
            alert('Error al aprobar la verificación.');
        }
    };

    const handleReject = async (user) => {
        const reason = window.prompt(`Motivo del rechazo para ${user.fullName || user.email}:`, 'Documentación insuficiente o ilegible.');
        if (reason === null) return;

        try {
            await supabase.from('users').update({
                verificationStatus: 'rejected',
                verificationRejectedAt: new Date().toISOString(),
                verificationRejectReason: reason,
            }).eq('id', user.id);

            setRequests(prev => prev.map(r =>
                r.id === user.id ? { ...r, verificationStatus: 'rejected' } : r
            ));
        } catch (err) {
            console.error('Error rejecting:', err);
            alert('Error al rechazar la verificación.');
        }
    };

    const handleResetToPending = async (user) => {
        if (!window.confirm(`¿Revertir la verificación de ${user.fullName || user.email} a pendiente?`)) return;

        try {
            await supabase.from('users').update({
                verificationStatus: 'pending',
                verificationApprovedAt: null,
                verificationRejectedAt: null,
                verificationRejectReason: null,
            }).eq('id', user.id);

            setRequests(prev => prev.map(r =>
                r.id === user.id ? { ...r, verificationStatus: 'pending' } : r
            ));
        } catch (err) {
            console.error('Error resetting:', err);
        }
    };

    const openPreview = (url, label) => {
        setPreviewImage(url);
        setPreviewLabel(label);
    };

    const closePreview = () => {
        setPreviewImage(null);
        setPreviewLabel('');
    };

    // ── Derived data ──────────────────────────
    const counts = {
        all: requests.length,
        pending: requests.filter(r => r.verificationStatus === 'pending').length,
        approved: requests.filter(r => r.verificationStatus === 'approved').length,
        rejected: requests.filter(r => r.verificationStatus === 'rejected').length,
    };

    const filtered = statusFilter === 'all'
        ? requests
        : requests.filter(r => r.verificationStatus === statusFilter);

    const formatDate = (iso) => {
        if (!iso) return '—';
        return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    const getUserName = (u) => u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email?.split('@')[0] || 'Usuario';
    const getInitial = (u) => getUserName(u).charAt(0).toUpperCase();

    // ── Render ──────────────────────────
    if (loading) {
        return (
            <div className="verifications-page">
                <div className="verifications-loading">
                    <div className="spinner" />
                    <span>Cargando solicitudes...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="verifications-page">

            {/* Header */}
            <div className="page-header">
                <h1>
                    <ShieldCheck size={26} />
                    Verificaciones de Identidad
                </h1>
                <div className="stat-pills">
                    <span className="stat-pill pending"><Clock size={14} /> {counts.pending} pendientes</span>
                    <span className="stat-pill approved"><ShieldCheck size={14} /> {counts.approved} aprobados</span>
                    <span className="stat-pill rejected"><ShieldX size={14} /> {counts.rejected} rechazados</span>
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
                        {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendientes' : f === 'approved' ? 'Aprobados' : 'Rechazados'}
                        {' '}({counts[f]})
                    </button>
                ))}
            </div>

            {/* Grid */}
            {filtered.length === 0 ? (
                <div className="verifications-empty">
                    <FileImage size={52} />
                    <h3>Sin solicitudes</h3>
                    <p>No hay solicitudes de verificación {statusFilter !== 'all' ? `con estado "${statusFilter}"` : ''}.</p>
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
                                    {req.pendingRole === 'caregiver' ? '🛡️ Cuidador' : '🐾 Dueño'}
                                </span>
                            </div>

                            {/* Document previews */}
                            <div className={`docs-preview ${req.certDocUrl ? 'has-cert' : ''}`}>
                                {[
                                    { url: req.idFrontUrl, label: 'DNI Frente' },
                                    { url: req.idBackUrl, label: 'DNI Dorso' },
                                    { url: req.selfieUrl, label: 'Selfie' },
                                    ...(req.certDocUrl ? [{ url: req.certDocUrl, label: 'Certificado' }] : []),
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
                                            <span className="no-doc">Sin {doc.label}</span>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Meta chips */}
                            <div className="card-meta">
                                <span className={`status-badge ${req.verificationStatus}`}>
                                    {req.verificationStatus === 'pending' ? '⏳ Pendiente' : req.verificationStatus === 'approved' ? '✅ Aprobado' : '❌ Rechazado'}
                                </span>
                                <span className="meta-chip">
                                    <Clock size={12} /> {formatDate(req.verificationRequestedAt)}
                                </span>
                                {req.pendingRole === 'caregiver' && req.serviceTypes?.length > 0 && (
                                    <span className="meta-chip">
                                        Servicios: {req.serviceTypes.join(', ')}
                                    </span>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="card-actions">
                                {req.verificationStatus === 'pending' && (
                                    <>
                                        <button className="approve-btn" onClick={() => handleApprove(req)}>
                                            <UserCheck size={16} /> Aprobar
                                        </button>
                                        <button className="reject-btn" onClick={() => handleReject(req)}>
                                            <ShieldX size={16} /> Rechazar
                                        </button>
                                    </>
                                )}
                                {(req.verificationStatus === 'approved' || req.verificationStatus === 'rejected') && (
                                    <button className="undo-btn" onClick={() => handleResetToPending(req)}>
                                        <Undo2 size={16} /> Revertir a Pendiente
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
                        <X size={22} />
                    </button>
                    <img src={previewImage} alt={previewLabel} onClick={e => e.stopPropagation()} />
                    <span className="preview-label">{previewLabel}</span>
                </div>
            )}
        </div>
    );
}
