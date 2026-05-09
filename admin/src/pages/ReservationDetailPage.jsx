import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faCalendarCheck, faUser, faPaw, faEye, faCheck, faXmark, faTrash, faMoneyBill } from '@fortawesome/free-solid-svg-icons';
import './DetailPage.css';

function formatDate(d) { return d ? new Date(d).toLocaleString('es-ES') : '-'; }

function Badge({ status }) {
    const map = {
        accepted: { cls: 'green', label: 'Aceptada' }, aceptada: { cls: 'green', label: 'Aceptada' },
        rechazada: { cls: 'red', label: 'Rechazada' }, rejected: { cls: 'red', label: 'Rechazada' },
        cancelada: { cls: 'gray', label: 'Cancelada' }, completada: { cls: 'blue', label: 'Completada' },
        pendiente: { cls: 'amber', label: 'Pendiente' }, pending: { cls: 'amber', label: 'Pendiente' },
        paid: { cls: 'green', label: 'Pagado' }, refunded: { cls: 'gray', label: 'Reembolsado' },
        failed: { cls: 'red', label: 'Fallido' },
    };
    const m = map[status] || { cls: 'gray', label: status || '-' };
    return <span className={`detail-badge ${m.cls}`}>{m.label}</span>;
}

export default function ReservationDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [res, setRes] = useState(null);
    const [owner, setOwner] = useState(null);
    const [caregiver, setCaregiver] = useState(null);
    const [pet, setPet] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const { data: resData } = await supabase.from('reservations').select('*').eq('id', id).single();
            setRes(resData);
            if (resData) {
                const [{ data: o }, { data: c }, { data: p }] = await Promise.all([
                    resData.ownerId ? supabase.from('users').select('id, fullName, email, photoURL').eq('id', resData.ownerId).single() : Promise.resolve({ data: null }),
                    resData.caregiverId ? supabase.from('users').select('id, fullName, email, photoURL').eq('id', resData.caregiverId).single() : Promise.resolve({ data: null }),
                    resData.petId ? supabase.from('pets').select('id, name, photoURL, species, breed').eq('id', resData.petId).single() : Promise.resolve({ data: null }),
                ]);
                setOwner(o); setCaregiver(c); setPet(p);
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [id]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const updateStatus = async (status) => {
        const { error } = await supabase.from('reservations').update({ status }).eq('id', id);
        if (error) return alert('Error: ' + error.message);
        setRes({ ...res, status });
    };

    const handleDelete = async () => {
        if (!window.confirm('¿Eliminar esta reserva? Acción irreversible.')) return;
        const { error } = await supabase.from('reservations').delete().eq('id', id);
        if (error) return alert('Error: ' + error.message);
        navigate('/reservations');
    };

    if (loading) return <div className="detail-loading">Cargando reserva...</div>;
    if (!res) return <div className="detail-loading">Reserva no encontrada.</div>;

    return (
        <div className="detail-page">
            <div className="detail-header">
                <button className="detail-back-btn" onClick={() => navigate(-1)}>
                    <FontAwesomeIcon icon={faArrowLeft} /> Volver
                </button>
                <div>
                    <h1 className="detail-title">{res.serviceType || 'Reserva'}</h1>
                    <div className="detail-subtitle">ID: <span style={{ fontFamily: 'monospace' }}>{res.id}</span></div>
                </div>
            </div>

            <div className="detail-grid">
                <div>
                    <div className="detail-card">
                        <h2><FontAwesomeIcon icon={faCalendarCheck} className="icon" /> Datos reserva</h2>
                        <div className="detail-row"><span className="label">Estado</span><span className="value"><Badge status={res.status} /></span></div>
                        <div className="detail-row"><span className="label">Servicio</span><span className="value">{res.serviceType || '-'}</span></div>
                        <div className="detail-row"><span className="label">Inicio</span><span className="value">{formatDate(res.startDate)}</span></div>
                        <div className="detail-row"><span className="label">Fin</span><span className="value">{formatDate(res.endDate)}</span></div>
                        <div className="detail-row"><span className="label">Duración</span><span className="value">{res.duration || '-'}</span></div>
                        <div className="detail-row"><span className="label">Notas dueño</span><span className="value">{res.ownerNotes || '-'}</span></div>
                        <div className="detail-row"><span className="label">Notas cuidador</span><span className="value">{res.caregiverNotes || '-'}</span></div>
                        <div className="detail-row"><span className="label">Dirección</span><span className="value">{res.address || '-'}</span></div>
                        <div className="detail-row"><span className="label">Coordenadas</span><span className="value mono">{res.latitude && res.longitude ? `${res.latitude}, ${res.longitude}` : '-'}</span></div>
                        <div className="detail-row"><span className="label">Creada</span><span className="value">{formatDate(res.created_at)}</span></div>
                    </div>

                    <div className="detail-card">
                        <h2><FontAwesomeIcon icon={faMoneyBill} className="icon" /> Pago</h2>
                        <div className="detail-row"><span className="label">Total</span><span className="value">{res.totalPrice ? `${res.totalPrice}€` : '-'}</span></div>
                        <div className="detail-row"><span className="label">Estado pago</span><span className="value"><Badge status={res.paymentStatus || 'pending'} /></span></div>
                        <div className="detail-row"><span className="label">PaymentIntent</span><span className="value mono" style={{ fontSize: 11 }}>{res.paymentIntentId || '-'}</span></div>
                    </div>
                </div>

                <div>
                    <div className="detail-card">
                        <h2>Acciones</h2>
                        <div className="detail-actions">
                            <button className="detail-action-btn success" onClick={() => updateStatus('aceptada')}><FontAwesomeIcon icon={faCheck} /> Aceptar</button>
                            <button className="detail-action-btn danger" onClick={() => updateStatus('rechazada')}><FontAwesomeIcon icon={faXmark} /> Rechazar</button>
                            <button className="detail-action-btn warning" onClick={() => updateStatus('cancelada')}>Cancelar</button>
                            <button className="detail-action-btn" onClick={() => updateStatus('completada')}>Marcar completada</button>
                            <button className="detail-action-btn danger" onClick={handleDelete}><FontAwesomeIcon icon={faTrash} /> Eliminar</button>
                        </div>
                    </div>

                    {owner && (
                        <div className="detail-card">
                            <h2><FontAwesomeIcon icon={faUser} className="icon" /> Dueño</h2>
                            <div className="detail-list-item" onClick={() => navigate(`/users/${owner.id}`)}>
                                <div style={{ width: 40, height: 40, borderRadius: 20, background: 'var(--primary-color)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600 }}>
                                    {owner.photoURL ? <img src={owner.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (owner.fullName || '?').charAt(0)}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600 }}>{owner.fullName}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{owner.email}</div>
                                </div>
                                <FontAwesomeIcon icon={faEye} style={{ color: 'var(--text-muted)' }} />
                            </div>
                        </div>
                    )}

                    {caregiver && (
                        <div className="detail-card">
                            <h2><FontAwesomeIcon icon={faUser} className="icon" /> Cuidador</h2>
                            <div className="detail-list-item" onClick={() => navigate(`/users/${caregiver.id}`)}>
                                <div style={{ width: 40, height: 40, borderRadius: 20, background: 'var(--primary-color)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600 }}>
                                    {caregiver.photoURL ? <img src={caregiver.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (caregiver.fullName || '?').charAt(0)}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600 }}>{caregiver.fullName}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{caregiver.email}</div>
                                </div>
                                <FontAwesomeIcon icon={faEye} style={{ color: 'var(--text-muted)' }} />
                            </div>
                        </div>
                    )}

                    {pet && (
                        <div className="detail-card">
                            <h2><FontAwesomeIcon icon={faPaw} className="icon" /> Mascota</h2>
                            <div className="detail-list-item" onClick={() => navigate(`/pets/${pet.id}`)}>
                                <div style={{ width: 40, height: 40, borderRadius: 20, background: 'var(--primary-color)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600 }}>
                                    {pet.photoURL ? <img src={pet.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (pet.name || '?').charAt(0)}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600 }}>{pet.name}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{pet.species} · {pet.breed || '-'}</div>
                                </div>
                                <FontAwesomeIcon icon={faEye} style={{ color: 'var(--text-muted)' }} />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
