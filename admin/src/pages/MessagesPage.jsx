import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../config/supabase';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlass, faCommentDots, faXmark, faUser } from '@fortawesome/free-solid-svg-icons';
import './UsersPage.css'; // Inheriting shared list styles

export default function MessagesPage() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [threads, setThreads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Chat read-only modal state
    const [selectedThread, setSelectedThread] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loadingMessages, setLoadingMessages] = useState(false);

    const fetchThreads = useCallback(async () => {
        try {
            const { data: convos } = await supabase.from('conversations').select('*').order('lastMessageAt', { ascending: false });
            if (!convos) { setLoading(false); return; }
            
            const threadsData = convos.map(convo => ({
                id: convo.id,
                lastMessage: convo.lastMessage || t('messages.noVisibleMessages'),
                ownerName: convo.ownerName || t('messages.user1Fallback'),
                caregiverName: convo.caregiverName || t('messages.user2Fallback'),
                status: 'activa',
                serviceType: t('messages.conversationType')
            }));
            
            setThreads(threadsData);
        } catch (error) {
            console.error("Error fetching threads:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchThreads();

        // ── Realtime: auto-refresh on new messages / conversations ──
        const convoChannel = supabase
            .channel('admin:conversations')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, fetchThreads)
            .subscribe();

        const msgChannel = supabase
            .channel('admin:messages')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, fetchThreads)
            .subscribe();

        return () => {
            supabase.removeChannel(convoChannel);
            supabase.removeChannel(msgChannel);
        };
    }, [fetchThreads]);

    const openThreadModal = async (thread) => {
        setSelectedThread(thread);
        setLoadingMessages(true);
        try {
            const { data: msgs } = await supabase.from('messages').select('*').eq('conversationId', thread.id).order('created_at', { ascending: true });
            if (msgs) setMessages(msgs);
        } catch (error) {
            console.error("Error fetching messages:", error);
            alert(t('messages.errorLoadMessages'));
        } finally {
            setLoadingMessages(false);
        }
    };

    // Realtime for open chat modal
    useEffect(() => {
        if (!selectedThread) return;
        const channel = supabase
            .channel(`admin:chat:${selectedThread.id}`)
            .on('postgres_changes', {
                event: 'INSERT', schema: 'public', table: 'messages',
                filter: `conversationId=eq.${selectedThread.id}`
            }, (payload) => {
                setMessages(prev => [...prev, payload.new]);
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [selectedThread]);

    const filteredThreads = threads.filter(thread => {
        const matchesSearch = (thread.ownerName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (thread.caregiverName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                              (thread.id || '').toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">{t('messages.pageTitle')}</h1>
            </div>

            <div className="filters-bar glass-panel">
                <div className="search-box">
                    <FontAwesomeIcon icon={faMagnifyingGlass} style={{ fontSize: 18 }} className="search-icon" />
                    <input 
                        type="text" 
                        placeholder={t('messages.searchPlaceholder')} 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <div className="loading-state"><div className="spinner"></div><p>{t('messages.loading')}</p></div>
            ) : (
                <div className="table-container glass-panel">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>{t('messages.colReservationId')}</th>
                                <th>{t('messages.colParticipants')}</th>
                                <th>{t('messages.colServiceStatus')}</th>
                                <th>{t('messages.colLastMessage')}</th>
                                <th>{t('messages.colAction')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredThreads.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="empty-cell">{t('messages.noConversationsFound')}</td>
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
                                                <span><strong>{t('messages.ownerPrefix')}</strong> {thread.ownerName}</span>
                                                <span><strong>{t('messages.caregiverPrefix')}</strong> {thread.caregiverName}</span>
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
                                            <button className="btn-secondary" onClick={() => navigate(`/messages/${thread.id}`)} style={{ padding: '6px 12px', fontSize: '13px' }}>
                                                {t('messages.viewChat')}
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
                                <h2 style={{ fontSize: '16px' }}>{t('messages.chatTitle')}</h2>
                                <p className="text-muted" style={{ fontSize: '13px' }}>{selectedThread.ownerName} & {selectedThread.caregiverName}</p>
                            </div>
                            <button className="close-btn" onClick={() => setSelectedThread(null)}><FontAwesomeIcon icon={faXmark} style={{ fontSize: 24 }} /></button>
                        </div>
                        
                        <div className="modal-body" style={{ flex: 1, overflowY: 'auto', backgroundColor: 'var(--surface-color)', padding: '20px' }}>
                            {loadingMessages ? (
                                <div className="loading-state"><div className="spinner"></div></div>
                            ) : messages.length === 0 ? (
                                <div className="empty-state">
                                    <FontAwesomeIcon icon={faCommentDots} style={{ fontSize: 40 }} />
                                    <p>{t('messages.noMessages')}</p>
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
                                                {!isSystem && <div style={{ fontSize: '11px', color: 'var(--primary-color)', fontWeight: 600, marginBottom: '4px' }}>{msg.senderName || t('messages.userFallback')}</div>}
                                                <div style={{ fontSize: '14px', color: 'var(--text-main)' }}>{msg.text}</div>
                                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px', textAlign: 'right' }}>
                                                    {msg.created_at ? new Date(msg.created_at).toLocaleString('es-ES') : ''}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="modal-footer" style={{ justifyContent: 'center', backgroundColor: 'var(--bg-color)', borderTop: 'none' }}>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                {t('messages.readOnlyNote')}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
