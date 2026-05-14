/**
 * Página de detalle de una mascota.
 *
 * Carga la mascota, su dueño (si existe) y todas las reservas en las que
 * aparece (`petIds` contiene su id). Permite eliminarla.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faPaw, faTrash, faUser, faCalendarCheck, faEye } from '@fortawesome/free-solid-svg-icons';
import './DetailPage.css';

/** Formatea una fecha ISO al formato corto en castellano. */
function formatDate(d) { return d ? new Date(d).toLocaleString('es-ES') : '-'; }

export default function PetDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [pet, setPet] = useState(null);
    const [owner, setOwner] = useState(null);
    const [reservations, setReservations] = useState([]);
    const [loading, setLoading] = useState(true);

    /** Carga mascota + dueño + reservas asociadas. */
    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const { data: petData } = await supabase.from('pets').select('*').eq('id', id).single();
            setPet(petData);
            if (petData?.ownerId) {
                const [{ data: ownerData }, { data: resData }] = await Promise.all([
                    supabase.from('users').select('id, fullName, email, photoURL').eq('id', petData.ownerId).single(),
                    supabase.from('reservations').select('*').contains('petIds', [id]).order('created_at', { ascending: false }),
                ]);
                setOwner(ownerData);
                setReservations(resData || []);
            }
        } catch (e) {
            console.error('Error loading pet:', e);
        } finally { setLoading(false); }
    }, [id]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    /** Borra la mascota tras confirmar y vuelve al listado. */
    const handleDelete = async () => {
        if (!window.confirm('¿Eliminar esta mascota? Esta acción es irreversible.')) return;
        const { error } = await supabase.from('pets').delete().eq('id', id);
        if (error) return alert('Error: ' + error.message);
        navigate('/pets');
    };

    if (loading) return <div className="detail-loading">Cargando mascota...</div>;
    if (!pet) return <div className="detail-loading">Mascota no encontrada.</div>;

    return (
        <div className="detail-page">
            <div className="detail-header">
                <button className="detail-back-btn" onClick={() => navigate(-1)}>
                    <FontAwesomeIcon icon={faArrowLeft} /> Volver
                </button>
                <div>
                    <h1 className="detail-title">{pet.name}</h1>
                    <div className="detail-subtitle">ID: <span style={{ fontFamily: 'monospace' }}>{pet.id}</span></div>
                </div>
            </div>

            <div className="detail-grid">
                <div>
                    <div className="detail-card">
                        <div className="detail-hero">
                            <div className="detail-avatar">
                                {pet.photoURL ? <img src={pet.photoURL} alt="" /> : <FontAwesomeIcon icon={faPaw} />}
                            </div>
                            <div>
                                <h3>{pet.name}</h3>
                                <div className="meta">{pet.species} · {pet.breed || 'Sin raza'} · {pet.gender || '-'}</div>
                            </div>
                        </div>
                        <div className="detail-row"><span className="label">Especie</span><span className="value">{pet.species || '-'}</span></div>
                        <div className="detail-row"><span className="label">Raza</span><span className="value">{pet.breed || '-'}</span></div>
                        <div className="detail-row"><span className="label">Edad</span><span className="value">{pet.age ? `${pet.age} años` : '-'}</span></div>
                        <div className="detail-row"><span className="label">Peso</span><span className="value">{pet.weight ? `${pet.weight} kg` : '-'}</span></div>
                        <div className="detail-row"><span className="label">Color</span><span className="value">{pet.color || '-'}</span></div>
                        <div className="detail-row"><span className="label">Esterilizado</span><span className="value">{pet.sterilized ? 'Sí' : 'No'}</span></div>
                        <div className="detail-row"><span className="label">Microchip</span><span className="value mono">{pet.microchip || '-'}</span></div>
                        <div className="detail-row"><span className="label">Vacunas</span><span className="value">{pet.vaccinated ? 'Sí' : 'No'}</span></div>
                        <div className="detail-row"><span className="label">Alergias</span><span className="value">{pet.allergies || '-'}</span></div>
                        <div className="detail-row"><span className="label">Medicación</span><span className="value">{pet.medications || '-'}</span></div>
                        <div className="detail-row"><span className="label">Notas</span><span className="value">{pet.notes || '-'}</span></div>
                        <div className="detail-row"><span className="label">Creado</span><span className="value">{formatDate(pet.created_at)}</span></div>
                    </div>

                    <div className="detail-card">
                        <h2><FontAwesomeIcon icon={faCalendarCheck} className="icon" /> Reservas ({reservations.length})</h2>
                        {reservations.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>Sin reservas.</p> : reservations.map(r => (
                            <div key={r.id} className="detail-list-item" onClick={() => navigate(`/reservations/${r.id}`)}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600 }}>{r.serviceType || 'Servicio'} · {formatDate(r.startDate || r.created_at)}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.totalPrice ? `${r.totalPrice}€` : '-'} · {r.status}</div>
                                </div>
                                <FontAwesomeIcon icon={faEye} style={{ color: 'var(--text-muted)' }} />
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <div className="detail-card">
                        <h2><FontAwesomeIcon icon={faUser} className="icon" /> Dueño</h2>
                        {owner ? (
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
                        ) : <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>Dueño no encontrado.</p>}
                    </div>

                    <div className="detail-card">
                        <h2>Acciones</h2>
                        <div className="detail-actions">
                            <button className="detail-action-btn danger" onClick={handleDelete}>
                                <FontAwesomeIcon icon={faTrash} /> Eliminar mascota
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
