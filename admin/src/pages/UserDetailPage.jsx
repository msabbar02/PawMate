import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { sendBanEmail } from '../config/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowLeft, faUser, faPaw, faCalendarCheck, faTriangleExclamation,
    faChartLine, faShieldHalved, faShield, faBan, faTrash, faPenToSquare,
    faEnvelope, faPhone, faLocationDot, faCalendar, faIdCard, faCircle,
    faCheck, faXmark, faEye
} from '@fortawesome/free-solid-svg-icons';
import './DetailPage.css';

function Badge({ status }) {
    const map = {
        approved:   { cls: 'green', label: 'Aprobado' },
        rejected:   { cls: 'red',   label: 'Rechazado' },
        pending:    { cls: 'amber', label: 'Pendiente' },
        accepted:   { cls: 'green', label: 'Aceptada' },
        aceptada:   { cls: 'green', label: 'Aceptada' },
        rejected_es:{ cls: 'red',   label: 'Rechazada' },
        rechazada:  { cls: 'red',   label: 'Rechazada' },
        cancelada:  { cls: 'gray',  label: 'Cancelada' },
        completed:  { cls: 'blue',  label: 'Completada' },
        completada: { cls: 'blue',  label: 'Completada' },
        pendiente:  { cls: 'amber', label: 'Pendiente' },
        paid:       { cls: 'green', label: 'Pagado' },
        refunded:   { cls: 'gray',  label: 'Reembolsado' },
    };
    const m = map[status] || { cls: 'gray', label: status || '-' };
    return <span className={`detail-badge ${m.cls}`}>{m.label}</span>;
}

function formatDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleString('es-ES');
}

export default function UserDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [pets, setPets] = useState([]);
    const [reservations, setReservations] = useState([]);
    const [reports, setReports] = useState([]);
    const [logs, setLogs] = useState([]);
    const [conversations, setConversations] = useState([]);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [u, p, rOwn, rCare, rep, lg, conv] = await Promise.all([
                supabase.from('users').select('*').eq('id', id).single(),
                supabase.from('pets').select('*').eq('ownerId', id),
                supabase.from('reservations').select('*').eq('ownerId', id).order('created_at', { ascending: false }),
                supabase.from('reservations').select('*').eq('caregiverId', id).order('created_at', { ascending: false }),
                supabase.from('reports').select('*').or(`reportedUserId.eq.${id},reporterUserId.eq.${id}`).order('created_at', { ascending: false }),
                supabase.from('system_logs').select('*').eq('userId', id).order('created_at', { ascending: false }).limit(50),
                supabase.from('conversations').select('*').or(`user1Id.eq.${id},user2Id.eq.${id}`).order('updated_at', { ascending: false }),
            ]);
            setUser(u.data || null);
            setPets(p.data || []);
            const all = [...(rOwn.data || []), ...(rCare.data || [])];
            // Dedupe by id
            const dedup = Array.from(new Map(all.map(r => [r.id, r])).values());
            setReservations(dedup);
            setReports(rep.data || []);
            setLogs(lg.data || []);
            setConversations(conv.data || []);
        } catch (e) {
            console.error('Error loading user detail:', e);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const handleBan = async () => {
        if (!user) return;
        const action = user.is_banned ? 'desbanear' : 'banear';
        if (!window.confirm(`¿Seguro que quieres ${action} a este usuario?`)) return;
        const { error } = await supabase.from('users').update({ is_banned: !user.is_banned }).eq('id', id);
        if (error) { alert('Error: ' + error.message); return; }
        if (!user.is_banned && user.email) sendBanEmail(user.email, user.fullName);
        setUser({ ...user, is_banned: !user.is_banned });
    };

    const handleDelete = async () => {
        if (!window.confirm('¿Seguro que quieres ELIMINAR este usuario? Esta acción es irreversible.')) return;
        const { error: rpcError } = await supabase.rpc('admin_delete_user', { target_uid: id });
        if (rpcError) {
            console.error('admin_delete_user RPC error:', rpcError);
            alert(
                'No se pudo borrar el usuario.\n\n' +
                'Causa: ' + (rpcError.message || rpcError.details || 'desconocida') + '\n\n' +
                'SOLUCIÓN: Ejecuta supabase_schema.sql en el SQL Editor de Supabase.'
            );
            return;
        }
        navigate('/users');
    };

    const handleVerify = async (status) => {
        if (!user) return;
        const { error } = await supabase.from('users').update({ verificationStatus: status }).eq('id', id);
        if (error) { alert('Error: ' + error.message); return; }
        setUser({ ...user, verificationStatus: status });
    };

    const handleRoleChange = async (role) => {
        if (!user) return;
        const { error } = await supabase.from('users').update({ role }).eq('id', id);
        if (error) { alert('Error: ' + error.message); return; }
        setUser({ ...user, role });
    };

    if (loading) return <div className="detail-loading">Cargando perfil...</div>;
    if (!user) return <div className="detail-loading">Usuario no encontrado.</div>;

    const initial = (user.fullName || user.email || '?').charAt(0).toUpperCase();
    const isOnline = user.isOnline;

    return (
        <div className="detail-page">
            <div className="detail-header">
                <button className="detail-back-btn" onClick={() => navigate(-1)}>
                    <FontAwesomeIcon icon={faArrowLeft} /> Volver
                </button>
                <div>
                    <h1 className="detail-title">{user.fullName || 'Sin nombre'}</h1>
                    <div className="detail-subtitle">ID: <span style={{ fontFamily: 'monospace' }}>{user.id}</span></div>
                </div>
            </div>

            <div className="detail-grid">
                {/* LEFT */}
                <div>
                    <div className="detail-card">
                        <div className="detail-hero">
                            <div className="detail-avatar">
                                {user.photoURL ? <img src={user.photoURL} alt="" /> : initial}
                            </div>
                            <div>
                                <h3>{user.fullName || 'Sin nombre'}</h3>
                                <div className="meta">
                                    <FontAwesomeIcon icon={faCircle} style={{ fontSize: 8, color: isOnline ? '#22c55e' : '#94a3b8' }} />
                                    {isOnline ? 'Online' : `Última vez: ${formatDate(user.last_seen)}`}
                                    {user.is_banned && <Badge status="rejected_es" />}
                                    <Badge status={user.role || 'normal'} />
                                </div>
                            </div>
                        </div>
                        <div className="detail-row"><span className="label"><FontAwesomeIcon icon={faEnvelope} /> Email</span><span className="value">{user.email || '-'}</span></div>
                        <div className="detail-row"><span className="label"><FontAwesomeIcon icon={faPhone} /> Teléfono</span><span className="value">{user.phone || '-'}</span></div>
                        <div className="detail-row"><span className="label"><FontAwesomeIcon icon={faCalendar} /> Nacimiento</span><span className="value">{user.birthDate || '-'}</span></div>
                        <div className="detail-row"><span className="label">Género</span><span className="value">{user.gender || '-'}</span></div>
                        <div className="detail-row"><span className="label"><FontAwesomeIcon icon={faLocationDot} /> Ubicación</span><span className="value">{[user.city, user.province, user.country].filter(Boolean).join(', ') || '-'}</span></div>
                        <div className="detail-row"><span className="label">Coordenadas</span><span className="value mono">{user.latitude && user.longitude ? `${user.latitude}, ${user.longitude}` : '-'}</span></div>
                        <div className="detail-row"><span className="label">Bio</span><span className="value">{user.bio || '-'}</span></div>
                        <div className="detail-row"><span className="label"><FontAwesomeIcon icon={faShieldHalved} /> Verificación</span><span className="value"><Badge status={user.verificationStatus || 'pending'} /></span></div>
                        <div className="detail-row"><span className="label">Solicitada</span><span className="value">{formatDate(user.verificationRequestedAt)}</span></div>
                        <div className="detail-row"><span className="label">Rol pendiente</span><span className="value">{user.pendingRole || '-'}</span></div>
                        <div className="detail-row"><span className="label">Creado</span><span className="value">{formatDate(user.created_at || user.createdAt)}</span></div>
                    </div>

                    {(user.role === 'caregiver' || user.role === 'owner') && (
                        <div className="detail-card">
                            <h2><FontAwesomeIcon icon={faPaw} className="icon" /> Datos cuidador</h2>
                            <div className="detail-row"><span className="label">Tipos de servicio</span><span className="value">{(user.serviceTypes || []).join(', ') || '-'}</span></div>
                            <div className="detail-row"><span className="label">Especies aceptadas</span><span className="value">{(user.acceptedSpecies || []).join(', ') || '-'}</span></div>
                            <div className="detail-row"><span className="label">Precio</span><span className="value">{user.price ? `${user.price}€` : '-'}</span></div>
                            <div className="detail-row"><span className="label">Radio servicio</span><span className="value">{user.serviceRadius ? `${user.serviceRadius} km` : '-'}</span></div>
                            <div className="detail-row"><span className="label">Max paseos simultáneos</span><span className="value">{user.maxConcurrentWalks || '-'}</span></div>
                            <div className="detail-row"><span className="label">Max hotel simultáneos</span><span className="value">{user.maxConcurrentHotel || '-'}</span></div>
                            <div className="detail-row"><span className="label">Rating</span><span className="value">{user.rating ? `${user.rating} (${user.reviewCount || 0})` : '-'}</span></div>
                            <div className="detail-row"><span className="label">Total paseos</span><span className="value">{user.totalWalks || 0}</span></div>
                            <div className="detail-row"><span className="label">Distancia total</span><span className="value">{user.totalDistance ? `${user.totalDistance} km` : '-'}</span></div>
                        </div>
                    )}

                    <div className="detail-card">
                        <h2><FontAwesomeIcon icon={faIdCard} className="icon" /> Documentos verificación</h2>
                        {!user.idFrontUrl && !user.idBackUrl && !user.selfieUrl && !user.certDocUrl ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>Sin documentos subidos.</p>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
                                {user.idFrontUrl && <div><div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>DNI Frontal</div><a href={user.idFrontUrl} target="_blank" rel="noreferrer"><img className="detail-doc-img" src={user.idFrontUrl} alt="DNI frontal" /></a></div>}
                                {user.idBackUrl && <div><div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>DNI Trasero</div><a href={user.idBackUrl} target="_blank" rel="noreferrer"><img className="detail-doc-img" src={user.idBackUrl} alt="DNI trasero" /></a></div>}
                                {user.selfieUrl && <div><div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Selfie</div><a href={user.selfieUrl} target="_blank" rel="noreferrer"><img className="detail-doc-img" src={user.selfieUrl} alt="Selfie" /></a></div>}
                                {user.certDocUrl && <div><div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Certificado</div><a href={user.certDocUrl} target="_blank" rel="noreferrer"><img className="detail-doc-img" src={user.certDocUrl} alt="Certificado" /></a></div>}
                            </div>
                        )}
                    </div>

                    <div className="detail-card">
                        <h2><FontAwesomeIcon icon={faPaw} className="icon" /> Mascotas ({pets.length})</h2>
                        {pets.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>Sin mascotas.</p> : pets.map(p => (
                            <div key={p.id} className="detail-list-item" onClick={() => navigate(`/pets/${p.id}`)}>
                                <div style={{ width: 40, height: 40, borderRadius: 20, background: 'var(--primary-color)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600 }}>
                                    {p.photoURL ? <img src={p.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (p.name || '?').charAt(0)}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.species} · {p.breed || 'Sin raza'} · {p.age || '-'} años</div>
                                </div>
                                <FontAwesomeIcon icon={faEye} style={{ color: 'var(--text-muted)' }} />
                            </div>
                        ))}
                    </div>

                    <div className="detail-card">
                        <h2><FontAwesomeIcon icon={faCalendarCheck} className="icon" /> Reservas ({reservations.length})</h2>
                        {reservations.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>Sin reservas.</p> : reservations.slice(0, 10).map(r => (
                            <div key={r.id} className="detail-list-item" onClick={() => navigate(`/reservations/${r.id}`)}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600 }}>{r.serviceType || 'Servicio'} · {formatDate(r.startDate || r.created_at)}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                        {r.ownerId === id ? 'Como dueño' : 'Como cuidador'} · {r.totalPrice ? `${r.totalPrice}€` : '-'}
                                    </div>
                                </div>
                                <Badge status={r.status} />
                            </div>
                        ))}
                    </div>

                    <div className="detail-card">
                        <h2><FontAwesomeIcon icon={faTriangleExclamation} className="icon" /> Reportes ({reports.length})</h2>
                        {reports.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>Sin reportes.</p> : reports.map(r => (
                            <div key={r.id} className="detail-list-item" onClick={() => navigate(`/reports/${r.id}`)}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600 }}>{r.reason || 'Sin motivo'}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                        {r.reporterUserId === id ? 'Reportado por este usuario' : 'Este usuario fue reportado'} · {formatDate(r.created_at)}
                                    </div>
                                </div>
                                <Badge status={r.status || 'pending'} />
                            </div>
                        ))}
                    </div>

                    <div className="detail-card">
                        <h2><FontAwesomeIcon icon={faChartLine} className="icon" /> Actividad reciente ({logs.length})</h2>
                        {logs.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>Sin actividad.</p> : (
                            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                                {logs.map(l => (
                                    <div key={l.id} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ fontWeight: 500 }}>{l.actionType}</span>
                                            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{formatDate(l.created_at)}</span>
                                        </div>
                                        {l.details && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>{l.details}</div>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT */}
                <div>
                    <div className="detail-card">
                        <h2><FontAwesomeIcon icon={faShield} className="icon" /> Acciones</h2>
                        <div className="detail-actions">
                            <select className="detail-action-btn" value={user.role || 'normal'} onChange={(e) => handleRoleChange(e.target.value)}>
                                <option value="normal">Cambiar rol: Normal</option>
                                <option value="owner">Cambiar rol: Dueño</option>
                                <option value="caregiver">Cambiar rol: Cuidador</option>
                                <option value="admin">Cambiar rol: Admin</option>
                            </select>
                            <button className="detail-action-btn success" onClick={() => handleVerify('approved')}>
                                <FontAwesomeIcon icon={faCheck} /> Aprobar verificación
                            </button>
                            <button className="detail-action-btn warning" onClick={() => handleVerify('pending')}>
                                <FontAwesomeIcon icon={faPenToSquare} /> Marcar pendiente
                            </button>
                            <button className="detail-action-btn danger" onClick={() => handleVerify('rejected')}>
                                <FontAwesomeIcon icon={faXmark} /> Rechazar verificación
                            </button>
                            <button className="detail-action-btn" onClick={handleBan}>
                                <FontAwesomeIcon icon={faBan} /> {user.is_banned ? 'Desbanear usuario' : 'Banear usuario'}
                            </button>
                            <button className="detail-action-btn danger" onClick={handleDelete}>
                                <FontAwesomeIcon icon={faTrash} /> Eliminar usuario
                            </button>
                        </div>
                    </div>

                    <div className="detail-card">
                        <h2><FontAwesomeIcon icon={faEnvelope} className="icon" /> Conversaciones ({conversations.length})</h2>
                        {conversations.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>Sin conversaciones.</p> : conversations.slice(0, 10).map(c => (
                            <div key={c.id} className="detail-list-item">
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: 13 }}>Conv. {c.id.substring(0, 8)}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDate(c.updated_at || c.created_at)}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="detail-card">
                        <h2><FontAwesomeIcon icon={faUser} className="icon" /> Datos técnicos</h2>
                        <div className="detail-row"><span className="label">FCM Token</span><span className="value mono" style={{ fontSize: 10 }}>{user.fcmToken ? user.fcmToken.substring(0, 20) + '...' : '-'}</span></div>
                        <div className="detail-row"><span className="label">Expo Token</span><span className="value mono" style={{ fontSize: 10 }}>{user.expoPushToken ? user.expoPushToken.substring(0, 20) + '...' : '-'}</span></div>
                        <div className="detail-row"><span className="label">Provider</span><span className="value">{user.provider || '-'}</span></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
