import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Search, Trash2, X, Image as ImageIcon, Eye } from 'lucide-react';
import './UsersPage.css'; // Shared table styles

export default function CommunityPage() {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Modal state
    const [selectedPost, setSelectedPost] = useState(null);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);

    useEffect(() => {
        fetchPosts();
    }, []);

    const fetchPosts = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            const postsData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setPosts(postsData);
        } catch (error) {
            console.error("Error fetching posts:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (postId) => {
        if (window.confirm('¿Seguro que deseas eliminar esta publicación permanentemente?')) {
            try {
                await deleteDoc(doc(db, 'posts', postId));
                setPosts(posts.filter(p => p.id !== postId));
                setIsViewModalOpen(false);
            } catch (error) {
                alert("Error al eliminar la publicación");
            }
        }
    };

    const openViewModal = (post) => {
        setSelectedPost(post);
        setIsViewModalOpen(true);
    };

    const filtered = posts.filter(post => {
        const matchesSearch = (post.authorName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (post.caption || '').toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">Moderación de Comunidad</h1>
            </div>

            <div className="filters-bar glass-panel">
                <div className="search-box">
                    <Search size={18} className="search-icon" />
                    <input 
                        type="text" 
                        placeholder="Buscar por autor o descripción..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <div className="loading-state"><div className="spinner"></div><p>Cargando publicaciones...</p></div>
            ) : (
                <div className="table-container glass-panel">
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Imagen</th>
                                <th>Autor/Fecha</th>
                                <th>Descripción</th>
                                <th>Métricas</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="empty-cell">No se encontraron publicaciones</td>
                                </tr>
                            ) : (
                                filtered.map(post => {
                                    const created = post.createdAt?.toDate ? post.createdAt.toDate().toLocaleDateString('es-ES') : '';
                                    const imgs = post.imageUrls?.length > 0 ? post.imageUrls : (post.imageUrl ? [post.imageUrl] : []);
                                    return (
                                        <tr key={post.id}>
                                            <td>
                                                <div className="user-avatar" style={{ borderRadius: '8px', width: '60px', height: '60px' }}>
                                                    {imgs.length > 0 ? (
                                                        <img src={imgs[0]} alt="post" />
                                                    ) : (
                                                        <ImageIcon size={24} color="var(--text-muted)" />
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="contact-info">
                                                    <span style={{ fontWeight: 600 }}>{post.authorName || 'Usuario'}</span>
                                                    <span className="text-muted">{created}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <p style={{ maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '13px' }}>
                                                    {post.caption || 'Sin descripción'}
                                                </p>
                                            </td>
                                            <td>
                                                <div className="contact-info">
                                                    <span style={{ color: '#ef4444', fontWeight: 600 }}>♥ {post.likesCount || 0}</span>
                                                    <span style={{ color: 'var(--primary-color)' }}>🗨 {post.commentsCount || 0}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button className="action-btn view" onClick={() => openViewModal(post)} title="Ver detalle" style={{ color: '#3b82f6' }}>
                                                        <Eye size={18} />
                                                    </button>
                                                    <button className="action-btn delete" onClick={() => handleDelete(post.id)} title="Eliminar Post">
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* View Modal */}
            {isViewModalOpen && selectedPost && (
                <div className="modal-overlay" onClick={() => setIsViewModalOpen(false)}>
                    <div className="modal-content view-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header view-header">
                            <h2>Detalle de Publicación</h2>
                            <button className="close-btn" onClick={() => setIsViewModalOpen(false)}><X size={24} /></button>
                        </div>
                        
                        <div className="modal-body view-modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                            <div className="premium-profile-header" style={{ marginBottom: '16px' }}>
                                {selectedPost.authorPhotoURL ? (
                                    <img src={selectedPost.authorPhotoURL} alt="author" className="premium-avatar" />
                                ) : (
                                    <div className="premium-avatar-placeholder" style={{background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)'}}>
                                        {selectedPost.authorName?.charAt(0) || 'U'}
                                    </div>
                                )}
                                <div className="premium-profile-info">
                                    <h3 className="premium-profile-name">{selectedPost.authorName}</h3>
                                    <p className="premium-profile-subtitle" style={{color: 'white', fontWeight: '500'}}>
                                        {selectedPost.createdAt?.toDate ? selectedPost.createdAt.toDate().toLocaleString('es-ES') : 'Fecha desconocida'}
                                    </p>
                                </div>
                            </div>
                            
                            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
                                <p style={{ fontSize: '16px', lineHeight: '1.6', color: 'white', margin: 0 }}>
                                    {selectedPost.caption}
                                </p>
                            </div>

                            {((selectedPost.imageUrls?.length > 0) || selectedPost.imageUrl) && (
                                <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', marginBottom: '24px', paddingBottom: '10px' }}>
                                    {selectedPost.imageUrls?.length > 0 ? (
                                        selectedPost.imageUrls.map((url, i) => (
                                            <img key={i} src={url} alt={`post_${i}`} style={{ height: '200px', borderRadius: '12px', objectFit: 'cover' }} />
                                        ))
                                    ) : selectedPost.imageUrl ? (
                                        <img src={selectedPost.imageUrl} alt="post" style={{ width: '100%', borderRadius: '12px', objectFit: 'cover' }} />
                                    ) : null}
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '20px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '20px', marginBottom: '10px' }}>
                                <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '10px 16px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' }}>
                                    <span style={{ fontSize: '18px' }}>♥</span> {selectedPost.likesCount || 0} Likes
                                </div>
                                <div style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '10px 16px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' }}>
                                    <span style={{ fontSize: '18px' }}>🗨</span> {selectedPost.commentsCount || 0} Comentarios
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', justifyContent: 'space-between', padding: '20px 30px' }}>
                            <button className="btn-secondary" style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.1)' }} onClick={() => handleDelete(selectedPost.id)}>
                                Eliminar Publicación
                            </button>
                            <button className="btn-primary" onClick={() => setIsViewModalOpen(false)}>Cerrar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
