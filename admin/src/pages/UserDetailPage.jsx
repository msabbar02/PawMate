/**
 * Página de detalle de un usuario.
 *
 * Carga en paralelo el perfil y todas sus colecciones relacionadas:
 * mascotas, reservas como dueño y como cuidador (deduplicadas), reportes
 * en cualquiera de los dos lados, los últimos 50 logs de sistema y las
 * conversaciones donde participa. Permite banear/desbanear, cambiar rol,
 * cambiar estado de verificación y eliminar al usuario vía RPC.
 */
import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { sendBanEmail } from '../config/api';
import { AuthContext } from '../context/AuthContext';
import { isSuperadmin } from '../config/superadmin';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowLeft, faUser, faPaw, faCalendarCheck, faTriangleExclamation,
    faChartLine, faShieldHalved, faShield, faBan, faTrash, faPenToSquare,
    faEnvelope, faPhone, faLocationDot, faCalendar, faIdCard, faCircle,
    faCheck, faXmark, faEye
} from '@fortawesome/free-solid-svg-icons';
import './DetailPage.css';

const DETAIL_LABELS = {
    event: 'Evento', platform: 'Plataforma', version: 'Versión',
    totalKm: 'Distancia (km)', totalkmm: 'Distancia (km)', totalkm: 'Distancia (km)', distance: 'Distancia (km)',
    calories: 'Calorías', petName: 'Mascota', duration: 'Duración (s)',
    steps: 'Pasos', reason: 'Motivo', type: 'Tipo',
    serviceType: 'Servicio', status: 'Estado', role: 'Rol', amount: 'Importe',
};

/**
 * Convierte el JSON de detalles de un log en una cadena legible
 * usando `DETAIL_LABELS` para traducir las claves al español.
 *
 * @param {string|null|undefined} raw JSON serializado o nulo.
 * @returns {string|null}
 */
function formatDetails(raw) {
    if (!raw) return null;
    try {
        const obj = JSON.parse(raw);
        const entries = Object.entries(obj).filter(([, v]) => v != null && v !== '');
        if (entries.length === 0) return null;
        return entries.map(([k, v]) => `${DETAIL_LABELS[k] || k}: ${v}`).join(' · ');
    } catch {
        return raw;
    }
}

const ACTION_LABEL = {
    USER_LOGIN: 'Inicio de sesión', USER_LOGOUT: 'Cierre de sesión',
    USER_SIGNUP: 'Registro', PET_CREATED: 'Mascota creada',
    PET_UPDATED: 'Mascota editada', PET_DELETED: 'Mascota eliminada',
    RESERVATION_CREATED: 'Reserva creada', RESERVATION_UPDATED: 'Reserva actualizada',
    REPORT_CREATED: 'Reporte creado', WALK_COMPLETED: 'Paseo completado',
};
const ACTION_COLOR = {
    USER_LOGIN: '#22c55e', USER_LOGOUT: '#94a3b8', USER_SIGNUP: '#3b82f6',
    PET_CREATED: '#22c55e', PET_UPDATED: '#f59e0b', PET_DELETED: '#ef4444',
    RESERVATION_CREATED: '#22c55e', RESERVATION_UPDATED: '#f59e0b',
    REPORT_CREATED: '#ef4444', WALK_COMPLETED: '#06b6d4',
};

/** Etiqueta de estado coloreada (aprobado, rechazado, pendiente, etc.). */
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

/** Formatea una fecha ISO al formato corto en castellano. */
function formatDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleString('es-ES');
}

export default function UserDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { adminUser } = useContext(AuthContext);
    const callerIsSuperadmin = isSuperadmin(adminUser?.email);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [pets, setPets] = useState([]);
    const [reservations, setReservations] = useState([]);
    const [reports, setReports] = useState([]);
    const [logs, setLogs] = useState([]);
    const [conversations, setConversations] = useState([]);

    /**
     * Carga en paralelo todas las colecciones relacionadas con el usuario.
     */
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
            // Deduplica por id (un usuario puede aparecer como dueño y cuidador en la misma reserva).
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

    useEffect(() => {
        fetchAll();
        window.addEventListener('pawmate:wake', fetchAll);
        return () => window.removeEventListener('pawmate:wake', fetchAll);
    }, [fetchAll]);

    /** Banea o desbanea al usuario; al banear emite el email de aviso. */
    const handleBan = async () => {
        if (!user) return;
        if (isSuperadmin(user.email)) { alert('No se puede banear al superadministrador'); return; }
        if (user.role === 'admin' && !callerIsSuperadmin) { alert('Solo el superadministrador puede banear a otros admins'); return; }
        const action = user.is_banned ? 'desbanear' : 'banear';
        if (!window.confirm(`Seguro que quieres ${action} a este usuario?`)) return;
        const { error } = await supabase.from('users').update({ is_banned: !user.is_banned }).eq('id', id);
        if (error) { alert('Error: ' + error.message); return; }
        if (!user.is_banned && user.email) sendBanEmail(user.email, user.fullName);
        setUser({ ...user, is_banned: !user.is_banned });
    };

    /** Borra el usuario va RPC `admin_delete_user`. */
    const handleDelete = async () => {
        if (!user) return;
        if (isSuperadmin(user.email)) { alert('No se puede eliminar al superadministrador'); return; }
        if (user.id === adminUser?.id) { alert('No puedes eliminar tu propia cuenta desde aqu'); return; }
        if (user.role === 'admin' && !callerIsSuperadmin) { alert('Solo el superadministrador puede eliminar a otros admins'); return; }
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

    /** Cambia el estado de verificación del usuario. */
    const handleVerify = async (status) => {
        if (!user) return;
        const { error } = await supabase.from('users').update({ verificationStatus: status }).eq('id', id);
        if (error) { alert('Error: ' + error.message); return; }
        setUser({ ...user, verificationStatus: status });
    };

    /** Cambia el rol del usuario (normal/owner/caregiver/admin). */
    const handleRoleChange = async (role) => {
        if (!user) return;
        if (isSuperadmin(user.email)) { alert('No se puede cambiar el rol del superadministrador'); return; }
        if ((user.role === 'admin' || role === 'admin') && !callerIsSuperadmin) {
            alert('Solo el superadministrador puede gestionar el rol "admin"');
            return;
        }
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
                            <div className="detail-row"><span className="label">Total paseos</span><span className="value">{logs.filter(l => l.actionType === 'WALK_COMPLETED').length}</span></div>
                            <div className="detail-row"><span className="label">Distancia total</span><span className="value">{(() => { const km = logs.filter(l => l.actionType === 'WALK_COMPLETED').reduce((s, l) => { try { const d = JSON.parse(l.details); return s + parseFloat(d.totalKm || d.totalkmm || d.totalkm || d.distance || 0); } catch { return s; } }, 0); return km > 0 ? `${km.toFixed(2)} km` : '-'; })()}</span></div>
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
                                {logs.map(l => {
                                    const color = ACTION_COLOR[l.actionType] || '#94a3b8';
                                    const label = ACTION_LABEL[l.actionType] || l.actionType;
                                    const detail = formatDetails(l.details);
                                    return (
                                        <div key={l.id} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontWeight: 600, color, fontSize: 12, background: `${color}18`, padding: '2px 10px', borderRadius: 10 }}>{label}</span>
                                                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{formatDate(l.created_at)}</span>
                                            </div>
                                            {detail && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{detail}</div>}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT */}
                <div>
                    <div className="detail-card">
                        <h2><FontAwesomeIcon icon={faShield} className="icon" /> Acciones</h2>
                        <div className="detail-actions">
                            {/* Cambio de rol: oculto para el superadmin; restringido si toca el rol admin. */}
                            {!isSuperadmin(user.email) && (user.role !== 'admin' || callerIsSuperadmin) && (
                                <select className="detail-action-btn" value={user.role || 'normal'} onChange={(e) => handleRoleChange(e.target.value)}>
                                    <option value="normal">Cambiar rol: Normal</option>
                                    <option value="owner">Cambiar rol: Dueño</option>
                                    <option value="caregiver">Cambiar rol: Cuidador</option>
                                    {callerIsSuperadmin && <option value="admin">Cambiar rol: Admin</option>}
                                </select>
                            )}
                            <button className="detail-action-btn success" onClick={() => handleVerify('approved')}>
                                <FontAwesomeIcon icon={faCheck} /> Aprobar verificación
                            </button>
                            <button className="detail-action-btn warning" onClick={() => handleVerify('pending')}>
                                <FontAwesomeIcon icon={faPenToSquare} /> Marcar pendiente
                            </button>
                            <button className="detail-action-btn danger" onClick={() => handleVerify('rejected')}>
                                <FontAwesomeIcon icon={faXmark} /> Rechazar verificación
                            </button>
                            {/* Banear: oculto para superadmin y para admins si el actor no es superadmin. */}
                            {!isSuperadmin(user.email) && (user.role !== 'admin' || callerIsSuperadmin) && (
                                <button className="detail-action-btn" onClick={handleBan}>
                                    <FontAwesomeIcon icon={faBan} /> {user.is_banned ? 'Desbanear usuario' : 'Banear usuario'}
                                </button>
                            )}
                            {/* Eliminar: oculto para superadmin, auto-eliminación y admins (salvo si el actor es superadmin). */}
                            {!isSuperadmin(user.email) && user.id !== adminUser?.id && (user.role !== 'admin' || callerIsSuperadmin) && (
                                <button className="detail-action-btn danger" onClick={handleDelete}>
                                    <FontAwesomeIcon icon={faTrash} /> Eliminar usuario
                                </button>
                            )}
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
