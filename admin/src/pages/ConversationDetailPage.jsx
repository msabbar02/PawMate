import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faComments, faUser, faEye, faTrash } from '@fortawesome/free-solid-svg-icons';
import './DetailPage.css';

function formatDate(d) { return d ? new Date(d).toLocaleString('es-ES') : '-'; }

export default function ConversationDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [convo, setConvo] = useState(null);
    const [user1, setUser1] = useState(null);
    const [user2, setUser2] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const { data: c } = await supabase.from('conversations').select('*').eq('id', id).single();
            setConvo(c);
            if (c) {
                const u1Id = c.user1Id || c.ownerId;
                const u2Id = c.user2Id || c.caregiverId;
                const [u1, u2, msgs] = await Promise.all([
                    u1Id ? supabase.from('users').select('id, fullName, email, photoURL').eq('id', u1Id).single() : Promise.resolve({ data: null }),
                    u2Id ? supabase.from('users').select('id, fullName, email, photoURL').eq('id', u2Id).single() : Promise.resolve({ data: null }),
                    supabase.from('messages').select('*').eq('conversationId', id).order('created_at', { ascending: true }),
                ]);
                setUser1(u1.data); setUser2(u2.data);
                setMessages(msgs.data || []);
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [id]);

    useEffect(() => {
        fetchAll();
        const ch = supabase
            .channel(`admin:conv:${id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversationId=eq.${id}` }, (p) => {
                setMessages(prev => [...prev, p.new]);
            })
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [id, fetchAll]);

    const handleDelete = async () => {
        if (!window.confirm('¿Eliminar la conversación y todos sus mensajes?')) return;
        await supabase.from('messages').delete().eq('conversationId', id);
        const { error } = await supabase.from('conversations').delete().eq('id', id);
        if (error) return alert('Error: ' + error.message);
        navigate('/messages');
    };

    const handleDeleteMessage = async (msgId) => {
        if (!window.confirm('¿Eliminar este mensaje?')) return;
        const { error } = await supabase.from('messages').delete().eq('id', msgId);
        if (error) return alert('Error: ' + error.message);
        setMessages(prev => prev.filter(m => m.id !== msgId));
    };

    if (loading) return <div className="detail-loading">Cargando conversación...</div>;
    if (!convo) return <div className="detail-loading">Conversación no encontrada.</div>;

    const senderInfo = (senderId) => {
        if (user1 && user1.id === senderId) return user1;
        if (user2 && user2.id === senderId) return user2;
        return null;
    };

    return (
        <div className="detail-page">
            <div className="detail-header">
                <button className="detail-back-btn" onClick={() => navigate(-1)}>
                    <FontAwesomeIcon icon={faArrowLeft} /> Volver
                </button>
                <div>
                    <h1 className="detail-title">Conversación</h1>
                    <div className="detail-subtitle">ID: <span style={{ fontFamily: 'monospace' }}>{convo.id}</span></div>
                </div>
            </div>

            <div className="detail-grid">
                <div>
                    <div className="detail-card">
                        <h2><FontAwesomeIcon icon={faComments} className="icon" /> Mensajes ({messages.length})</h2>
                        {messages.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>Sin mensajes en esta conversación.</p>
                        ) : (
                            <div style={{ maxHeight: 600, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {messages.map(m => {
                                    const sender = senderInfo(m.senderId);
                                    const isUser1 = user1 && m.senderId === user1.id;
                                    return (
                                        <div key={m.id} style={{
                                            alignSelf: isUser1 ? 'flex-start' : 'flex-end',
                                            maxWidth: '75%',
                                            background: isUser1 ? 'rgba(255,255,255,0.05)' : 'rgba(245,166,35,0.15)',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            borderRadius: 12, padding: '10px 14px',
                                            position: 'relative',
                                        }}>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                                <span>{sender?.fullName || sender?.email || m.senderId?.substring(0, 8)}</span>
                                                <span>{formatDate(m.created_at)}</span>
                                            </div>
                                            <div style={{ fontSize: 14, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.content || m.text || '-'}</div>
                                            {m.imageUrl && <a href={m.imageUrl} target="_blank" rel="noreferrer"><img src={m.imageUrl} style={{ marginTop: 8, maxWidth: '100%', borderRadius: 8 }} alt="" /></a>}
                                            <button
                                                onClick={() => handleDeleteMessage(m.id)}
                                                title="Eliminar mensaje"
                                                style={{ position: 'absolute', top: 4, right: 4, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', opacity: 0.5 }}
                                            >
                                                <FontAwesomeIcon icon={faTrash} style={{ fontSize: 11 }} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <div>
                    <div className="detail-card">
                        <h2>Acciones</h2>
                        <div className="detail-actions">
                            <button className="detail-action-btn danger" onClick={handleDelete}>
                                <FontAwesomeIcon icon={faTrash} /> Eliminar conversación
                            </button>
                        </div>
                    </div>

                    {[user1, user2].filter(Boolean).map(u => (
                        <div key={u.id} className="detail-card">
                            <h2><FontAwesomeIcon icon={faUser} className="icon" /> Participante</h2>
                            <div className="detail-list-item" onClick={() => navigate(`/users/${u.id}`)}>
                                <div style={{ width: 40, height: 40, borderRadius: 20, background: 'var(--primary-color)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600 }}>
                                    {u.photoURL ? <img src={u.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (u.fullName || '?').charAt(0)}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600 }}>{u.fullName}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.email}</div>
                                </div>
                                <FontAwesomeIcon icon={faEye} style={{ color: 'var(--text-muted)' }} />
                            </div>
                        </div>
                    ))}

                    <div className="detail-card">
                        <h2>Metadata</h2>
                        <div className="detail-row"><span className="label">Creada</span><span className="value">{formatDate(convo.created_at)}</span></div>
                        <div className="detail-row"><span className="label">Última actividad</span><span className="value">{formatDate(convo.lastMessageAt || convo.updated_at)}</span></div>
                        <div className="detail-row"><span className="label">Último mensaje</span><span className="value">{convo.lastMessage || '-'}</span></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
