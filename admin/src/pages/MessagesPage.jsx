import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, query, orderBy, limit, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Search, MessageSquare, X, User } from 'lucide-react';
import './UsersPage.css'; // Inheriting shared list styles

export default function MessagesPage() {
    const [threads, setThreads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Chat read-only modal state
    const [selectedThread, setSelectedThread] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loadingMessages, setLoadingMessages] = useState(false);

    useEffect(() => {
        fetchThreads();
    }, []);

    const fetchThreads = async () => {
        setLoading(true);
        try {
            // We have a 'messages' root collection where each doc ID is a reservationId
            const messagesSnap = await getDocs(collection(db, 'messages'));
            
            const threadsData = await Promise.all(messagesSnap.docs.map(async (docSnap) => {
                const threadId = docSnap.id;
                let reservationData = null;
                
                // Try to get reservation details for context
                try {
                    const resDoc = await getDoc(doc(db, 'reservations', threadId));
                    if (resDoc.exists()) {
                        reservationData = resDoc.data();
                    }
                } catch (e) {}

                // Try to get latest message
                let lastMessage = 'Sin mensajes visibles';
                try {
                    const threadSnap = await getDocs(query(collection(db, 'messages', threadId, 'thread'), orderBy('timestamp', 'desc'), limit(1)));
                    if (!threadSnap.empty) {
                        lastMessage = threadSnap.docs[0].data().text || 'Mensaje multimedia/sistema';
                    }
                } catch (e) {}

                return {
                    id: threadId,
                    lastMessage,
                    ownerName: reservationData?.ownerName || 'Usuario 1',
                    caregiverName: reservationData?.caregiverName || 'Usuario 2',
                    status: reservationData?.status || 'Desconocido',
                    serviceType: reservationData?.serviceType || 'Desconocido'
                };
            }));
            
            setThreads(threadsData);
        } catch (error) {
            console.error("Error fetching threads:", error);
        } finally {
            setLoading(false);
        }
    };

    const openThreadModal = async (thread) => {
        setSelectedThread(thread);
        setLoadingMessages(true);
        try {
            const threadSnap = await getDocs(query(collection(db, 'messages', thread.id, 'thread'), orderBy('timestamp', 'asc')));
            const msgs = threadSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            setMessages(msgs);
        } catch (error) {
            console.error("Error fetching messages:", error);
            alert("No se pudieron cargar los mensajes.");
        } finally {
            setLoadingMessages(false);
        }
    };

    const filteredThreads = threads.filter(thread => {
        const matchesSearch = (thread.ownerName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (thread.caregiverName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                              (thread.id || '').toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">Gestión de Mensajes (Solo lectura)</h1>
            </div>

            <div className="filters-bar glass-panel">
                <div className="search-box">
                    <Search size={18} className="search-icon" />
                    <input 
                        type="text" 
                        placeholder="Buscar por dueño, cuidador o ID..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <div className="loading-state"><div className="spinner"></div><p>Cargando conversaciones...</p></div>
            ) : (
                <div className="table-container glass-panel">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>ID Reserva</th>
                                <th>Participantes</th>
                                <th>Servicio / Estado</th>
                                <th>Último Mensaje</th>
                                <th>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredThreads.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="empty-cell">No se encontraron conversaciones</td>
                                </tr>
                            ) : (
                                filteredThreads.map(thread => (
                                    <tr key={thread.id}>
                                        <td>
                                            <div className="user-info">
                                                <span className="user-id">{thread.id}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="contact-info">
                                                <span><strong>D:</strong> {thread.ownerName}</span>
                                                <span><strong>C:</strong> {thread.caregiverName}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="contact-info">
                                                <span style={{ textTransform: 'capitalize' }}>{thread.serviceType}</span>
                                                <span className={`status-badge ${thread.status}`}>{thread.status}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <p style={{ maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '13px', color: 'var(--text-muted)' }}>
                                                {thread.lastMessage}
                                            </p>
                                        </td>
                                        <td>
                                            <button className="btn-secondary" onClick={() => openThreadModal(thread)} style={{ padding: '6px 12px', fontSize: '13px' }}>
                                                Ver Chat
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Chat Modal */}
            {selectedThread && (
                <div className="modal-overlay" onClick={() => setSelectedThread(null)}>
                    <div className="modal-content glass-panel" style={{ maxWidth: '600px', height: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h2 style={{ fontSize: '16px' }}>Chat de Reserva</h2>
                                <p className="text-muted" style={{ fontSize: '13px' }}>{selectedThread.ownerName} & {selectedThread.caregiverName}</p>
                            </div>
                            <button className="close-btn" onClick={() => setSelectedThread(null)}><X size={24} /></button>
                        </div>
                        
                        <div className="modal-body" style={{ flex: 1, overflowY: 'auto', backgroundColor: 'var(--surface-color)', padding: '20px' }}>
                            {loadingMessages ? (
                                <div className="loading-state"><div className="spinner"></div></div>
                            ) : messages.length === 0 ? (
                                <div className="empty-state">
                                    <MessageSquare size={40} />
                                    <p>No hay mensajes en esta conversación.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {messages.map(msg => {
                                        const isSystem = msg.system;
                                        return (
                                            <div key={msg.id} style={{
                                                alignSelf: isSystem ? 'center' : 'flex-start',
                                                backgroundColor: isSystem ? 'rgba(255,255,255,0.05)' : 'var(--bg-color)',
                                                padding: '12px 16px',
                                                borderRadius: '12px',
                                                maxWidth: '85%',
                                                border: '1px solid var(--border-color)'
                                            }}>
                                                {!isSystem && <div style={{ fontSize: '11px', color: 'var(--primary-color)', fontWeight: 600, marginBottom: '4px' }}>{msg.senderName || 'Usuario'}</div>}
                                                <div style={{ fontSize: '14px', color: 'var(--text-main)' }}>{msg.text}</div>
                                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px', textAlign: 'right' }}>
                                                    {msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleString('es-ES') : ''}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="modal-footer" style={{ justifyContent: 'center', backgroundColor: 'var(--bg-color)', borderTop: 'none' }}>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                Nota: Como administrador solo tienes acceso de lectura a los mensajes para moderación y soporte.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
