import React, { useState, useContext, useEffect, useCallback, useRef } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity, FlatList, Image,
    Dimensions, ActivityIndicator, TextInput, Alert, Modal,
    KeyboardAvoidingView, Platform, ScrollView, Clipboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { supabase } from '../config/supabase';
import * as ImagePicker from 'expo-image-picker';
import { uploadImageToStorage } from '../utils/storageHelpers';
import { createNotification } from '../utils/notificationHelpers';

const { width } = Dimensions.get('window');

const SPECIES_TAGS = [
    { value: 'all',    label: '🌍 Todos' },
    { value: 'dog',    label: '🐕 Perros' },
    { value: 'cat',    label: '🐈 Gatos' },
    { value: 'bird',   label: '🐦 Aves' },
    { value: 'rabbit', label: '🐇 Conejos' },
    { value: 'other',  label: '🐾 Otros' },
];

const FEED_TABS = [
    { id: 'forYou', label: 'Para Ti' },
    { id: 'global', label: 'Global' },
];

export default function CommunityScreen() {
    const { user, userData } = useContext(AuthContext);
    const { theme, isDarkMode } = useContext(ThemeContext);

    // Feed
    const [feedType, setFeedType]           = useState('global');
    const [posts, setPosts]                 = useState([]);
    const [loading, setLoading]             = useState(true);
    const [speciesFilter, setSpeciesFilter] = useState('all');
    const [filtersOpen, setFiltersOpen]     = useState(false);

    // Friends (for "Para Ti")
    const [friendIds, setFriendIds] = useState([]);

    // Upload
    const [isUploadVisible, setIsUploadVisible] = useState(false);
    const [uploadForm, setUploadForm] = useState({
        caption: '', species: 'dog', images: [],
    });
    const [uploading, setUploading] = useState(false);

    // Comments
    const [commentsPostId, setCommentsPostId] = useState(null);
    const [commentsData, setCommentsData]     = useState([]);
    const [commentInput, setCommentInput]     = useState('');
    const [sendingComment, setSendingComment] = useState(false);
    const [replyingTo, setReplyingTo]         = useState(null); // { id, authorName }
    const commentsListRef = useRef(null);

    // Post options
    const [optionsPost, setOptionsPost]   = useState(null);
    const [showEditModal, setShowEditModal] = useState(null);
    const [editCaption, setEditCaption]    = useState('');
    const [editImageUri, setEditImageUri]  = useState(null);
    const [editingPost, setEditingPost]    = useState(false);

    // Likers
    const [likersPost, setLikersPost]       = useState(null);
    const [likersList, setLikersList]       = useState([]);
    const [loadingLikers, setLoadingLikers] = useState(false);

    // ─────────────────────────────────────────────────
    // FETCH FRIEND IDS
    // ─────────────────────────────────────────────────
    useEffect(() => {
        if (!user?.id) return;
        const fetchFriends = async () => {
            const { data } = await supabase.from('friends').select('friendId').eq('userId', user.id);
            if (data) Object.values(data).forEach((d) => setFriendIds((prev) => [...prev, d.friendId]));
        };
        fetchFriends();
        
        const channel = supabase.channel('friends_comm')
             .on('postgres_changes', { event: '*', schema: 'public', table: 'friends', filter: `userId=eq.${user.id}` }, fetchFriends)
             .subscribe();
             
        return () => { supabase.removeChannel(channel); };
    }, [user?.id]);

    // ─────────────────────────────────────────────────
    // FETCH POSTS
    // ─────────────────────────────────────────────────
    useEffect(() => {
        setLoading(true);

        const fetchPosts = async () => {
             let query = supabase.from('posts').select('*').order('createdAt', { ascending: false }).limit(30);
             
             if (feedType === 'forYou') {
                 const uidsToShow = [...friendIds];
                 if (user?.id) uidsToShow.push(user.id);
                 
                 if (uidsToShow.length === 0) {
                     setPosts([]); setLoading(false); return;
                 }
                 
                 query = query.in('authorUid', uidsToShow.slice(0, 30));
             } else {
                 if (speciesFilter !== 'all') {
                     query = query.contains('speciesTags', [speciesFilter]);
                 }
             }
             
             const { data, error } = await query;
             if (data) setPosts(data);
             setLoading(false);
        };
        fetchPosts();
        
        const channel = supabase.channel('posts_comm')
             .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, fetchPosts)
             .subscribe();
             
        return () => { supabase.removeChannel(channel); };
    }, [feedType, speciesFilter, friendIds, user?.id]);

    // ─────────────────────────────────────────────────
    // LIKE / UNLIKE (also updates user preferences)
    // ─────────────────────────────────────────────────
    const toggleLike = async (post) => {
        if (!user?.id) return;
        const uid   = user.id;
        const liked = post.likedBy?.includes(uid);
        try {
            const newLikedBy = liked ? post.likedBy.filter(id => id !== uid) : [...(post.likedBy || []), uid];
            
            await supabase.from('posts').update({
                likedBy: newLikedBy,
                likesCount: (post.likesCount || 0) + (liked ? -1 : 1),
                engagementScore: Math.max(0, (post.engagementScore || 0) + (liked ? -2 : 2)),
            }).eq('id', post.id);

            // Update user species preference for recommendations
            const species = post.speciesTags?.[0];
            if (species) {
                const { data: prefData } = await supabase.from('userPreferences').select('*').eq('userId', uid).eq('species', species).single();
                if (prefData) {
                    await supabase.from('userPreferences').update({ count: prefData.count + (liked ? -1 : 1) }).eq('id', prefData.id);
                } else if (!liked) {
                    await supabase.from('userPreferences').insert({ userId: uid, species, count: 1 });
                }
            }
        } catch { /* ignore */ }
    };

    // ─────────────────────────────────────────────────
    // SHOW LIKERS
    // ─────────────────────────────────────────────────
    const showLikers = async (post) => {
        if (!post.likedBy?.length) return;
        setLikersPost(post);
        setLoadingLikers(true);
        try {
            const uids  = post.likedBy.slice(0, 20);
            const { data } = await supabase.from('users').select('*').in('id', uids);
            setLikersList(data || []);
        } catch { /* ignore */ }
        setLoadingLikers(false);
    };

    // ─────────────────────────────────────────────────
    // FRIEND REQUESTS (from likers modal)
    // ─────────────────────────────────────────────────
    const sendFriendRequest = async (toUid, toName) => {
        if (!user?.id || toUid === user.id) return;
        try {
            // Check if already friends
            const { data: friendDoc } = await supabase.from('friends').select('*').eq('userId', user.id).eq('friendId', toUid).maybeSingle();
            if (friendDoc) {
                Alert.alert('Ya sois amigos', `${toName} ya está en tu lista de amigos.`);
                return;
            }
            // Check if already sent
            const { data: existing } = await supabase.from('friendRequests')
                .select('*')
                .eq('fromUid', user.id)
                .eq('toUid', toUid)
                .eq('status', 'pending');
            if (existing && existing.length > 0) {
                Alert.alert('Ya enviada', 'Ya tienes una solicitud pendiente.');
                return;
            }

            await supabase.from('friendRequests').insert({
                fromUid: user.id,
                fromName: userData?.fullName || 'Usuario',
                fromPhotoURL: userData?.photoURL || null,
                toUid,
                toName,
                status: 'pending',
            });

            await createNotification(toUid, {
                type: 'friend_request',
                title: 'Solicitud de amistad 🤝',
                body: `${userData?.fullName || 'Un usuario'} quiere ser tu amigo.`,
                fromUid: user.id,
                icon: 'person-add-outline',
                iconBg: '#EFF6FF',
                iconColor: '#3B82F6',
            });

            Alert.alert('¡Solicitud enviada! 🤝', `Se envió la solicitud a ${toName}.`);
        } catch (e) {
            console.error('sendFriendRequest error:', e);
            Alert.alert('Error', 'No se pudo enviar la solicitud.');
        }
    };

    // ─────────────────────────────────────────────────
    // POST OPTIONS
    // ─────────────────────────────────────────────────
    const handleDeletePost = (post) => {
        Alert.alert('Eliminar post', '¿Seguro que quieres eliminar este post?', [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Eliminar', style: 'destructive',
                onPress: async () => {
                    setOptionsPost(null);
                    try { await supabase.from('posts').delete().eq('id', post.id); }
                    catch { Alert.alert('Error', 'No se pudo eliminar el post.'); }
                },
            },
        ]);
    };

    const handleEditPost = (post) => {
        setOptionsPost(null);
        setEditCaption(post.caption || '');
        setEditImageUri(post.imageUrl || null);
        setShowEditModal(post);
    };

    const pickEditImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7,
        });
        if (!result.canceled) {
            setEditImageUri(result.assets[0].uri);
        }
    };

    const handleSaveEdit = async () => {
        if (!editCaption.trim() || !showEditModal || !user?.id) return;
        setEditingPost(true);
        try {
            const updates = { caption: editCaption.trim() };

            // If user picked a new image (local URI)
            if (editImageUri && !editImageUri.startsWith('http')) {
                const uid = user.id;
                const timestamp = Date.now();
                const newUrl = await uploadImageToStorage(editImageUri, `posts/${uid}/${timestamp}.jpg`);
                updates.imageUrl = newUrl;
            }

            await supabase.from('posts').update(updates).eq('id', showEditModal.id);
            setShowEditModal(null);
        } catch { Alert.alert('Error', 'No se pudo editar el post.'); }
        finally { setEditingPost(false); }
    };

    const handleCopyLink = (post) => {
        setOptionsPost(null);
        const link = `pawmate://post/${post.id}`;
        if (Clipboard.setString) {
            Clipboard.setString(link);
        }
        Alert.alert('✅ Enlace copiado', 'El enlace ha sido copiado.');
    };

    const handleReportPost = async (post) => {
        setOptionsPost(null);
        if (!user?.id) return;
        try {
            await supabase.from('reports').insert({
                postId: post.id,
                reporterUid: user.id,
                reporterName: userData?.fullName || 'Usuario',
                authorUid: post.authorUid,
                authorName: post.authorName,
                reason: 'Contenido inapropiado',
                status: 'pending',
            });
            // Notify admin (first admin found or system)
            try {
                const { data: adminSnap } = await supabase.from('users').select('id').eq('role', 'admin').limit(1);
                if (adminSnap && adminSnap.length > 0) {
                    const adminUid = adminSnap[0].id;
                    await createNotification(adminUid, {
                        type: 'post_report',
                        title: '⚠️ Post reportado',
                        body: `${userData?.fullName || 'Un usuario'} ha reportado un post de ${post.authorName}.`,
                        postId: post.id,
                        icon: 'flag-outline',
                        iconBg: '#FEF2F2',
                        iconColor: '#EF4444',
                    });
                }
            } catch { /* no admin found */ }
            Alert.alert('Reportado', 'Gracias por reportar. Nuestro equipo revisará el contenido.');
        } catch {
            Alert.alert('Error', 'No se pudo enviar el reporte.');
        }
    };

    // ─────────────────────────────────────────────────
    // PICK MEDIA (up to 5 photos)
    // ─────────────────────────────────────────────────
    const pickImage = async () => {
        if (uploadForm.images.length >= 5) {
            Alert.alert('Límite alcanzado', 'Puedes subir máximo 5 fotos por publicación.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7,
        });
        if (!result.canceled) {
            setUploadForm(f => ({ ...f, images: [...f.images, result.assets[0].uri] }));
        }
    };

    const removeUploadImage = (index) => {
        setUploadForm(f => ({ ...f, images: f.images.filter((_, i) => i !== index) }));
    };

    // ─────────────────────────────────────────────────
    // UPLOAD POST
    // ─────────────────────────────────────────────────
    const handleUploadPost = async () => {
        if (!user?.id) return;
        if (uploadForm.images.length === 0) return Alert.alert('Error', 'Selecciona al menos una imagen');
        if (!uploadForm.caption.trim()) return Alert.alert('Error', 'Escribe una descripción');
        setUploading(true);
        try {
            const uid       = user.id;
            const timestamp = Date.now();

            // Upload all images in parallel
            const imageUrls = await Promise.all(
                uploadForm.images.map((uri, i) =>
                    uploadImageToStorage(uri, `posts/${uid}/${timestamp}_${i}.jpg`)
                )
            );

            await supabase.from('posts').insert({
                authorUid:      uid,
                authorName:     userData?.fullName || (userData?.firstName ? `${userData.firstName} ${userData?.lastName || ''}`.trim() : null) || 'Usuario',
                authorRole:     userData?.role || 'normal',
                authorPhotoURL: userData?.photoURL || userData?.avatar || null,
                imageUrl:       imageUrls[0],   // keep for backward compat
                imageUrls,                       // new multi-photo array
                caption:        uploadForm.caption,
                speciesTags:    [uploadForm.species],
                likesCount:     0,
                commentsCount:  0,
                likedBy:        [],
                engagementScore: 0,
            });

            // Notify friends about new post
            if (friendIds.length > 0) {
                Promise.all(friendIds.map(fid =>
                    createNotification(fid, {
                        type: 'friend_post',
                        title: 'Nuevo post de tu amigo 📸',
                        body: `${userData?.fullName || 'Tu amigo'} publicó algo nuevo.`,
                        icon: 'image-outline',
                        iconBg: '#E8F5EE',
                        iconColor: '#1a7a4c',
                    }).catch(() => {})
                ));
            }

            Alert.alert('¡Publicado! 🎉');
            setIsUploadVisible(false);
            setUploadForm({ caption: '', species: 'dog', images: [] });
        } catch (e) {
            console.error('Upload error:', e);
            Alert.alert('Error', 'No se pudo publicar. Verifica tu conexión.');
        } finally {
            setUploading(false);
        }
    };

    // ─────────────────────────────────────────────────
    // COMMENTS
    // ─────────────────────────────────────────────────
    useEffect(() => {
        if (!commentsPostId) { setCommentsData([]); return; }
        
        const fetchComments = async () => {
             const { data } = await supabase.from('comments').select('*').eq('postId', commentsPostId).order('createdAt', { ascending: true });
             if (data) setCommentsData(data);
        };
        fetchComments();
        
        const channel = supabase.channel('comments_comm')
             .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `postId=eq.${commentsPostId}` }, fetchComments)
             .subscribe();
             
        return () => { supabase.removeChannel(channel); };
    }, [commentsPostId]);

    const sendComment = async () => {
        if (!commentInput.trim() || !commentsPostId || !user?.id) return;
        const text = commentInput.trim();
        setCommentInput('');
        setReplyingTo(null);
        setSendingComment(true);
        try {
            await supabase.from('comments').insert({
                postId:         commentsPostId,
                authorUid:      user.id,
                authorName:     userData?.fullName || (userData?.firstName ? `${userData.firstName} ${userData?.lastName || ''}`.trim() : null) || 'Usuario',
                authorPhotoURL: userData?.photoURL || userData?.avatar || null,
                text,
                replyTo:        replyingTo ? { id: replyingTo.id, authorName: replyingTo.authorName } : null,
                likedBy:        [],
                likesCount:     0,
            });
            
            const { data: pData } = await supabase.from('posts').select('commentsCount, engagementScore').eq('id', commentsPostId).single();
            if (pData) {
                await supabase.from('posts').update({
                    commentsCount:   (pData.commentsCount || 0) + 1,
                    engagementScore: (pData.engagementScore || 0) + 1,
                }).eq('id', commentsPostId);
            }
            setTimeout(() => commentsListRef.current?.scrollToEnd({ animated: true }), 100);
        } catch { /* ignore */ } finally { setSendingComment(false); }
    };

    const toggleCommentLike = async (comment) => {
        if (!user?.id || !commentsPostId) return;
        const uid = user.id;
        const liked = comment.likedBy?.includes(uid);
        try {
            const newLikedBy = liked ? comment.likedBy.filter(i => i !== uid) : [...(comment.likedBy || []), uid];
            await supabase.from('comments').update({
                likedBy:    newLikedBy,
                likesCount: Math.max(0, (comment.likesCount || 0) + (liked ? -1 : 1)),
            }).eq('id', comment.id);
        } catch { /* ignore */ }
    };

    const handleDeleteComment = (comment) => {
        if (comment.authorUid !== user?.id) return;
        Alert.alert('Eliminar comentario', '¿Seguro que quieres eliminar este comentario?', [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Eliminar', style: 'destructive',
                onPress: async () => {
                    try {
                        await supabase.from('comments').delete().eq('id', comment.id);
                        const { data: pData } = await supabase.from('posts').select('commentsCount').eq('id', commentsPostId).single();
                        if (pData) {
                            await supabase.from('posts').update({ commentsCount: Math.max(0, (pData.commentsCount || 0) - 1) }).eq('id', commentsPostId);
                        }
                    } catch { Alert.alert('Error', 'No se pudo eliminar.'); }
                },
            },
        ]);
    };

    // ─────────────────────────────────────────────────
    // RENDER: Feed Post Card
    // ─────────────────────────────────────────────────
    const renderFeedPost = useCallback(({ item: post }) => {
        const uid         = user?.id;
        const liked       = post.likedBy?.includes(uid);
        const isMyPost    = post.authorUid === uid;
        const likesCount  = post.likesCount  || 0;
        const commCount   = post.commentsCount || 0;
        const dateStr     = post.createdAt
            ? new Date(post.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
            : '';

        return (
            <View style={[s.feedCard, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                {/* Author row */}
                <View style={s.feedAuthorRow}>
                    <View style={[s.authorAvatar, { backgroundColor: theme.primaryBg }]}>
                        {post.authorPhotoURL
                            ? <Image source={{ uri: post.authorPhotoURL }} style={StyleSheet.absoluteFillObject} borderRadius={20} />
                            : <Text style={{ fontSize: 18 }}>🐾</Text>
                        }
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={[s.authorName, { color: theme.text }]}>{post.authorName}</Text>
                        <Text style={[s.postDate, { color: theme.textSecondary }]}>{dateStr}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setOptionsPost(post)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Ionicons name="ellipsis-horizontal" size={22} color={theme.textSecondary} />
                    </TouchableOpacity>
                </View>

                {/* Images: carousel if multiple, single if one */}
                {(() => {
                    const imgs = post.imageUrls?.length > 0 ? post.imageUrls : (post.imageUrl ? [post.imageUrl] : []);
                    if (imgs.length === 0) return null;
                    if (imgs.length === 1) {
                        return <Image source={{ uri: imgs[0] }} style={s.feedImage} resizeMode="cover" />;
                    }
                    return (
                        <View>
                            <ScrollView
                                horizontal
                                pagingEnabled
                                showsHorizontalScrollIndicator={false}
                                style={{ width }}
                            >
                                {imgs.map((uri, i) => (
                                    <Image key={i} source={{ uri }} style={[s.feedImage, { width }]} resizeMode="cover" />
                                ))}
                            </ScrollView>
                            {/* Dot indicators */}
                            <View style={s.dotRow}>
                                {imgs.map((_, i) => (
                                    <View key={i} style={[s.dot, { backgroundColor: theme.primary }]} />
                                ))}
                            </View>
                        </View>
                    );
                })()}

                {/* Action bar */}
                <View style={s.feedActions}>
                    <TouchableOpacity onPress={() => toggleLike(post)} style={s.feedActionBtn}>
                        <Ionicons
                            name={liked ? 'heart' : 'heart-outline'}
                            size={28}
                            color={liked ? '#EF4444' : theme.textSecondary}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setCommentsPostId(post.id)} style={s.feedActionBtn}>
                        <Ionicons name="chatbubble-outline" size={26} color={theme.textSecondary} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }} />
                </View>

                {/* Likes */}
                {likesCount > 0 && (
                    <TouchableOpacity style={s.likesRow} onPress={() => showLikers(post)}>
                        <Ionicons name="heart" size={13} color="#EF4444" />
                        <Text style={[s.likesText, { color: theme.text }]}>
                            {likesCount === 1 ? '1 me gusta' : `${likesCount} me gusta`}
                        </Text>
                    </TouchableOpacity>
                )}

                {/* Caption */}
                <View style={s.feedCaption}>
                    <Text style={[s.captionText, { color: theme.text }]}>
                        <Text style={[s.captionAuthor, { color: theme.text }]}>{post.authorName} </Text>
                        {post.caption}
                    </Text>
                </View>

                {/* View comments link */}
                {commCount > 0 && (
                    <TouchableOpacity style={s.viewCommentsBtn} onPress={() => setCommentsPostId(post.id)}>
                        <Text style={[s.viewCommentsText, { color: theme.textSecondary }]}>
                            Ver los {commCount} comentarios
                        </Text>
                    </TouchableOpacity>
                )}

                <View style={{ height: 14 }} />
            </View>
        );
    }, [theme, isDarkMode, friendIds]);

    // ─────────────────────────────────────────────────
    // MAIN RENDER
    // ─────────────────────────────────────────────────
    return (
        <View style={[s.container, { backgroundColor: theme.background }]}>
            <StatusBar style={isDarkMode ? 'light' : 'dark'} />

            {/* ── HEADER ── */}
            <View style={[s.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                <Text style={[s.headerTitle, { color: theme.text }]}>Comunidad</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                        style={[s.filterToggleBtn, { backgroundColor: filtersOpen ? theme.primary : theme.primaryBg }]}
                        onPress={() => setFiltersOpen(f => !f)}
                    >
                        <Ionicons name="filter" size={18} color={filtersOpen ? '#FFF' : theme.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[s.publishBtn, { backgroundColor: theme.primary }]}
                        onPress={() => setIsUploadVisible(true)}
                    >
                        <Ionicons name="add" size={18} color="#FFF" />
                        <Text style={s.publishBtnText}>Publicar</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── FEED TABS ── */}
            <View style={[s.feedTabsBar, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                {FEED_TABS.map(tab => {
                    const active = feedType === tab.id;
                    return (
                        <TouchableOpacity
                            key={tab.id}
                            style={s.feedTab}
                            onPress={() => setFeedType(tab.id)}
                        >
                            <Text style={[
                                s.feedTabText,
                                { color: active ? theme.primary : theme.textSecondary },
                                active && s.feedTabTextActive,
                            ]}>
                                {tab.label}
                            </Text>
                            {active && (
                                <View style={[s.feedTabUnderline, { backgroundColor: theme.primary }]} />
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* ── COLLAPSIBLE FILTERS ── */}
            {filtersOpen && (
                <View style={[s.filterRow, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 8, paddingHorizontal: 14, paddingVertical: 10 }}
                    >
                        {SPECIES_TAGS.map(tag => {
                            const active = speciesFilter === tag.value;
                            return (
                                <TouchableOpacity
                                    key={tag.value}
                                    style={[
                                        s.filterChip,
                                        { backgroundColor: theme.background, borderColor: theme.border },
                                        active && { backgroundColor: theme.primary, borderColor: theme.primary },
                                    ]}
                                    onPress={() => setSpeciesFilter(tag.value)}
                                >
                                    <Text style={[
                                        s.filterChipText,
                                        { color: theme.textSecondary },
                                        active && { color: '#FFF' },
                                    ]}>
                                        {tag.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>
            )}

            {/* ── POSTS ── */}
            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={theme.primary} />
                </View>
            ) : (
                <FlatList
                    data={posts}
                    keyExtractor={item => item.id}
                    renderItem={renderFeedPost}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    ListEmptyComponent={
                        <View style={s.emptyState}>
                            <Text style={{ fontSize: 56 }}>📸</Text>
                            <Text style={[s.emptyTitle, { color: theme.text }]}>
                                {feedType === 'forYou' ? 'Sin posts de amigos' : 'Sin publicaciones'}
                            </Text>
                            <Text style={[s.emptyDesc, { color: theme.textSecondary }]}>
                                {feedType === 'forYou'
                                    ? 'Añade amigos para ver sus posts aquí.'
                                    : '¡Sé el primero en compartir el momento de tu mascota!'
                                }
                            </Text>
                        </View>
                    }
                />
            )}

            {/* ════════════════════════════════════════
                MODAL: POST OPTIONS
            ════════════════════════════════════════ */}
            <Modal
                visible={!!optionsPost}
                transparent
                animationType="slide"
                onRequestClose={() => setOptionsPost(null)}
            >
                <TouchableOpacity
                    style={s.optionsOverlay}
                    activeOpacity={1}
                    onPress={() => setOptionsPost(null)}
                >
                    <View style={[s.optionsSheet, { backgroundColor: theme.cardBackground }]}>
                        <View style={[s.optionsHandle, { backgroundColor: theme.border }]} />

                        {/* Only owner sees edit/delete */}
                        {optionsPost?.authorUid === user?.id && (
                            <>
                                <TouchableOpacity
                                    style={[s.optionsRow, { borderBottomColor: theme.border }]}
                                    onPress={() => handleEditPost(optionsPost)}
                                >
                                    <View style={[s.optionsIconWrap, { backgroundColor: '#EFF6FF' }]}>
                                        <Ionicons name="pencil" size={20} color="#3B82F6" />
                                    </View>
                                    <Text style={[s.optionsLabel, { color: theme.text }]}>Editar post</Text>
                                    <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[s.optionsRow, { borderBottomColor: theme.border }]}
                                    onPress={() => handleDeletePost(optionsPost)}
                                >
                                    <View style={[s.optionsIconWrap, { backgroundColor: '#FEF2F2' }]}>
                                        <Ionicons name="trash-outline" size={20} color="#EF4444" />
                                    </View>
                                    <Text style={[s.optionsLabel, { color: '#EF4444' }]}>Eliminar post</Text>
                                    <Ionicons name="chevron-forward" size={16} color="#EF4444" />
                                </TouchableOpacity>
                            </>
                        )}

                        <TouchableOpacity
                            style={[s.optionsRow, { borderBottomColor: theme.border }]}
                            onPress={() => handleCopyLink(optionsPost)}
                        >
                            <View style={[s.optionsIconWrap, { backgroundColor: theme.primaryBg }]}>
                                <Ionicons name="link-outline" size={20} color={theme.primary} />
                            </View>
                            <Text style={[s.optionsLabel, { color: theme.text }]}>Copiar enlace</Text>
                            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                        </TouchableOpacity>

                        {/* Report (only for others' posts) */}
                        {optionsPost?.authorUid !== user?.id && (
                            <TouchableOpacity
                                style={[s.optionsRow, { borderBottomWidth: 0 }]}
                                onPress={() => handleReportPost(optionsPost)}
                            >
                                <View style={[s.optionsIconWrap, { backgroundColor: '#FEF2F2' }]}>
                                    <Ionicons name="flag-outline" size={20} color="#EF4444" />
                                </View>
                                <Text style={[s.optionsLabel, { color: '#EF4444' }]}>Reportar</Text>
                                <Ionicons name="chevron-forward" size={16} color="#EF4444" />
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={[s.optionsCancelBtn, { backgroundColor: theme.background }]}
                            onPress={() => setOptionsPost(null)}
                        >
                            <Text style={[s.optionsCancelText, { color: theme.primary }]}>Cancelar</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* ════════════════════════════════════════
                MODAL: EDIT POST (photo + description)
            ════════════════════════════════════════ */}
            <Modal
                visible={!!showEditModal}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowEditModal(null)}
            >
                <View style={{ flex: 1, backgroundColor: theme.background }}>
                    <View style={[s.modalHeader, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                        <TouchableOpacity onPress={() => setShowEditModal(null)}>
                            <Ionicons name="close" size={24} color={theme.text} />
                        </TouchableOpacity>
                        <Text style={[s.modalTitle, { color: theme.text }]}>Editar post</Text>
                        <TouchableOpacity onPress={handleSaveEdit} disabled={editingPost}>
                            {editingPost
                                ? <ActivityIndicator color={theme.primary} />
                                : <Text style={[s.modalAction, { color: theme.primary }]}>Guardar</Text>
                            }
                        </TouchableOpacity>
                    </View>
                    <ScrollView style={{ padding: 20 }}>
                        {/* Edit image */}
                        <TouchableOpacity
                            style={[s.mediaPicker, { borderColor: theme.border, backgroundColor: theme.cardBackground }]}
                            onPress={pickEditImage}
                        >
                            {editImageUri ? (
                                <Image source={{ uri: editImageUri }} style={s.mediaPickerImg} />
                            ) : (
                                <View style={{ alignItems: 'center', gap: 8 }}>
                                    <Ionicons name="image-outline" size={48} color={theme.textSecondary} />
                                    <Text style={{ color: theme.primary, fontWeight: '700' }}>Toca para cambiar foto</Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        {/* Edit caption */}
                        <TextInput
                            style={[s.captionInput, { backgroundColor: theme.cardBackground, color: theme.text, borderColor: theme.border }]}
                            multiline
                            value={editCaption}
                            onChangeText={setEditCaption}
                            placeholder="Descripción..."
                            placeholderTextColor={theme.textSecondary}
                        />
                    </ScrollView>
                </View>
            </Modal>

            {/* ════════════════════════════════════════
                MODAL: LIKERS (with Add Friend btn)
            ════════════════════════════════════════ */}
            <Modal
                visible={!!likersPost}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setLikersPost(null)}
            >
                <View style={{ flex: 1, backgroundColor: theme.background }}>
                    <View style={[s.modalHeader, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                        <TouchableOpacity onPress={() => setLikersPost(null)}>
                            <Ionicons name="close" size={24} color={theme.text} />
                        </TouchableOpacity>
                        <Text style={[s.modalTitle, { color: theme.text }]}>Me gusta</Text>
                        <View style={{ width: 28 }} />
                    </View>
                    {loadingLikers ? (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <ActivityIndicator color={theme.primary} />
                        </View>
                    ) : (
                        <FlatList
                            data={likersList}
                            keyExtractor={item => item.uid}
                            contentContainerStyle={{ padding: 16 }}
                            ListEmptyComponent={
                                <View style={{ alignItems: 'center', marginTop: 60 }}>
                                    <Text style={{ fontSize: 44 }}>❤️</Text>
                                    <Text style={[s.emptyTitle, { color: theme.text }]}>Sin likes aún</Text>
                                </View>
                            }
                            renderItem={({ item }) => {
                                const isMe = item.id === user?.id;
                                const isFriend = friendIds.includes(item.id);
                                return (
                                    <View style={[s.likerRow, { borderBottomColor: theme.border }]}>
                                        <View style={[s.likerAvatar, { backgroundColor: theme.primaryBg }]}>
                                            {item.photoURL
                                                ? <Image source={{ uri: item.photoURL }} style={StyleSheet.absoluteFillObject} borderRadius={22} />
                                                : <Text style={{ fontSize: 18 }}>🐾</Text>
                                            }
                                        </View>
                                        <Text style={[s.likerName, { color: theme.text }]}>{item.fullName || 'Usuario'}</Text>
                                        {!isMe && !isFriend && (
                                            <TouchableOpacity
                                                style={[s.addFriendBtn, { backgroundColor: theme.primary }]}
                                                onPress={() => sendFriendRequest(item.id, item.fullName || 'Usuario')}
                                            >
                                                <Ionicons name="person-add" size={14} color="#FFF" />
                                                <Text style={s.addFriendText}>Añadir</Text>
                                            </TouchableOpacity>
                                        )}
                                        {!isMe && isFriend && (
                                            <View style={[s.friendBadge, { backgroundColor: theme.primaryBg }]}>
                                                <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '700' }}>Amigo</Text>
                                            </View>
                                        )}
                                        {isMe ? null : null}
                                    </View>
                                );
                            }}
                        />
                    )}
                </View>
            </Modal>

            {/* ════════════════════════════════════════
                MODAL: UPLOAD
            ════════════════════════════════════════ */}
            <Modal visible={isUploadVisible} animationType="slide" presentationStyle="formSheet">
                <KeyboardAvoidingView
                    style={{ flex: 1, backgroundColor: theme.background }}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <View style={[s.modalHeader, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                        <TouchableOpacity onPress={() => setIsUploadVisible(false)}>
                            <Ionicons name="close" size={24} color={theme.text} />
                        </TouchableOpacity>
                        <Text style={[s.modalTitle, { color: theme.text }]}>Nueva Publicación</Text>
                        <TouchableOpacity onPress={handleUploadPost} disabled={uploading}>
                            {uploading
                                ? <ActivityIndicator color={theme.primary} />
                                : <Text style={[s.modalAction, { color: theme.primary }]}>Publicar</Text>
                            }
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={{ padding: 20 }}>
                        {/* Multi-photo picker grid */}
                        <Text style={[s.tagLabel, { color: theme.textSecondary }]}>
                            FOTOS ({uploadForm.images.length}/5)
                        </Text>
                        <View style={s.photoGrid}>
                            {uploadForm.images.map((uri, i) => (
                                <View key={i} style={s.photoThumbWrap}>
                                    <Image source={{ uri }} style={s.photoThumb} resizeMode="cover" />
                                    <TouchableOpacity
                                        style={s.photoRemoveBtn}
                                        onPress={() => removeUploadImage(i)}
                                    >
                                        <Ionicons name="close-circle" size={22} color="#EF4444" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                            {uploadForm.images.length < 5 && (
                                <TouchableOpacity
                                    style={[s.photoAddBtn, { borderColor: theme.border, backgroundColor: theme.cardBackground }]}
                                    onPress={pickImage}
                                >
                                    <Ionicons name="add" size={32} color={theme.primary} />
                                    <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '700', marginTop: 4 }}>Añadir</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Caption */}
                        <TextInput
                            style={[s.captionInput, { backgroundColor: theme.cardBackground, color: theme.text, borderColor: theme.border }]}
                            multiline
                            value={uploadForm.caption}
                            onChangeText={t => setUploadForm(f => ({ ...f, caption: t }))}
                            placeholder="Escribe algo sobre estas fotos..."
                            placeholderTextColor={theme.textSecondary}
                        />

                        {/* Species tag */}
                        <Text style={[s.tagLabel, { color: theme.textSecondary }]}>Etiquetar especie</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                            {SPECIES_TAGS.filter(t => t.value !== 'all').map(tag => {
                                const active = uploadForm.species === tag.value;
                                return (
                                    <TouchableOpacity
                                        key={tag.value}
                                        style={[
                                            s.filterChip,
                                            { backgroundColor: theme.background, borderColor: theme.border },
                                            active && { backgroundColor: theme.primary, borderColor: theme.primary },
                                        ]}
                                        onPress={() => setUploadForm(f => ({ ...f, species: tag.value }))}
                                    >
                                        <Text style={[
                                            s.filterChipText, { color: theme.textSecondary },
                                            active && { color: '#FFF' },
                                        ]}>
                                            {tag.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                        <View style={{ height: 60 }} />
                    </ScrollView>
                </KeyboardAvoidingView>
            </Modal>

            {/* ════════════════════════════════════════
                MODAL: COMMENTS (with keyboard fix, likes, replies, delete)
            ════════════════════════════════════════ */}
            <Modal
                visible={!!commentsPostId}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => { setCommentsPostId(null); setReplyingTo(null); }}
            >
                <KeyboardAvoidingView
                    style={{ flex: 1, backgroundColor: theme.background }}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
                >
                    <View style={[s.modalHeader, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                        <TouchableOpacity onPress={() => { setCommentsPostId(null); setReplyingTo(null); }}>
                            <Ionicons name="close" size={24} color={theme.text} />
                        </TouchableOpacity>
                        <Text style={[s.modalTitle, { color: theme.text }]}>Comentarios</Text>
                        <View style={{ width: 28 }} />
                    </View>

                    <FlatList
                        ref={commentsListRef}
                        data={commentsData}
                        keyExtractor={item => item.id}
                        contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <View style={{ alignItems: 'center', marginTop: 60 }}>
                                <Text style={{ fontSize: 44 }}>💬</Text>
                                <Text style={[s.emptyTitle, { color: theme.text }]}>Sin comentarios</Text>
                                <Text style={[s.emptyDesc, { color: theme.textSecondary }]}>¡Sé el primero en comentar!</Text>
                            </View>
                        }
                        renderItem={({ item: comment }) => {
                            const uid = user?.id;
                            const isMyComment = comment.authorUid === uid;
                            const liked = comment.likedBy?.includes(uid);
                            const likeCount = comment.likesCount || 0;

                            return (
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onLongPress={() => isMyComment && handleDeleteComment(comment)}
                                    style={s.commentRow}
                                >
                                    <View style={[s.commentAvatar, { backgroundColor: theme.primaryBg }]}>
                                        {comment.authorPhotoURL
                                            ? <Image source={{ uri: comment.authorPhotoURL }} style={StyleSheet.absoluteFillObject} borderRadius={18} />
                                            : <Text style={{ fontSize: 15 }}>🐾</Text>
                                        }
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <View style={[s.commentBubble, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                                            <Text style={[s.commentAuthor, { color: theme.text }]}>{comment.authorName}</Text>
                                            {comment.replyTo && (
                                                <Text style={[s.replyTag, { color: theme.primary }]}>
                                                    ↳ @{comment.replyTo.authorName}
                                                </Text>
                                            )}
                                            <Text style={[s.commentText, { color: theme.text }]}>{comment.text}</Text>
                                        </View>
                                        {/* Comment actions */}
                                        <View style={s.commentActionsRow}>
                                            <TouchableOpacity
                                                style={s.commentActionBtn}
                                                onPress={() => toggleCommentLike(comment)}
                                            >
                                                <Ionicons
                                                    name={liked ? 'heart' : 'heart-outline'}
                                                    size={14}
                                                    color={liked ? '#EF4444' : theme.textSecondary}
                                                />
                                                {likeCount > 0 && (
                                                    <Text style={[s.commentActionText, { color: theme.textSecondary }]}>
                                                        {likeCount}
                                                    </Text>
                                                )}
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={s.commentActionBtn}
                                                onPress={() => {
                                                    setReplyingTo({ id: comment.id, authorName: comment.authorName });
                                                    setCommentInput(`@${comment.authorName} `);
                                                }}
                                            >
                                                <Ionicons name="arrow-undo-outline" size={14} color={theme.textSecondary} />
                                                <Text style={[s.commentActionText, { color: theme.textSecondary }]}>Responder</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            );
                        }}
                    />

                    {/* Reply indicator */}
                    {replyingTo && (
                        <View style={[s.replyIndicator, { backgroundColor: theme.primaryBg, borderTopColor: theme.border }]}>
                            <Text style={[s.replyIndicatorText, { color: theme.primary }]}>
                                Respondiendo a @{replyingTo.authorName}
                            </Text>
                            <TouchableOpacity onPress={() => { setReplyingTo(null); setCommentInput(''); }}>
                                <Ionicons name="close" size={18} color={theme.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Comment input */}
                    <View style={[s.commentInputRow, { backgroundColor: theme.cardBackground, borderTopColor: theme.border }]}>
                        <TextInput
                            style={[s.commentInput, { backgroundColor: theme.background, color: theme.text }]}
                            value={commentInput}
                            onChangeText={setCommentInput}
                            placeholder="Escribe un comentario..."
                            placeholderTextColor={theme.textSecondary}
                            multiline
                        />
                        <TouchableOpacity
                            style={[s.commentSendBtn, { backgroundColor: theme.primary, opacity: !commentInput.trim() ? 0.4 : 1 }]}
                            onPress={sendComment}
                            disabled={sendingComment || !commentInput.trim()}
                        >
                            {sendingComment
                                ? <ActivityIndicator size="small" color="#FFF" />
                                : <Ionicons name="send" size={17} color="#FFF" />
                            }
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

// ─────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────
const s = StyleSheet.create({
    container: { flex: 1 },

    // Header
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 60 : 36,
        paddingBottom: 14,
        borderBottomWidth: 1,
    },
    headerTitle:    { fontSize: 24, fontWeight: '900' },
    publishBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
    publishBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
    filterToggleBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },

    // Feed tabs
    feedTabsBar: {
        flexDirection: 'row',
        borderBottomWidth: 1,
    },
    feedTab: {
        flex: 1, alignItems: 'center', paddingVertical: 13,
        position: 'relative',
    },
    feedTabText: {
        fontSize: 15, fontWeight: '600',
    },
    feedTabTextActive: {
        fontWeight: '800',
    },
    feedTabUnderline: {
        position: 'absolute', bottom: 0,
        left: '20%', right: '20%',
        height: 3, borderRadius: 2,
    },

    // Filter row
    filterRow: {
        flexDirection: 'row', alignItems: 'center',
        borderBottomWidth: 1,
    },
    filterChip: {
        paddingHorizontal: 13, paddingVertical: 7,
        borderRadius: 20, borderWidth: 1.5,
    },
    filterChipText: { fontSize: 13, fontWeight: '600' },

    // Feed Card
    feedCard:       { borderBottomWidth: 1 },
    feedAuthorRow:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
    authorAvatar:   { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    authorName:     { fontSize: 14, fontWeight: '800' },
    postDate:       { fontSize: 11, marginTop: 1 },
    feedImage:      { width: '100%', height: width },

    // Action bar
    feedActions:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingTop: 10, gap: 2 },
    feedActionBtn:  { padding: 5 },

    // Likes
    likesRow:   { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingTop: 8 },
    likesText:  { fontSize: 13, fontWeight: '700' },

    // Caption
    feedCaption:    { paddingHorizontal: 14, paddingTop: 6 },
    captionText:    { fontSize: 14, lineHeight: 20 },
    captionAuthor:  { fontWeight: '800' },

    // View comments
    viewCommentsBtn: { paddingHorizontal: 14, paddingTop: 5 },
    viewCommentsText: { fontSize: 13 },

    // Options bottom sheet
    optionsOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    optionsSheet:    { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === 'ios' ? 34 : 16, paddingTop: 12 },
    optionsHandle:   { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
    optionsRow:      { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1 },
    optionsIconWrap: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    optionsLabel:    { flex: 1, fontSize: 16, fontWeight: '600' },
    optionsCancelBtn:  { marginHorizontal: 16, marginTop: 10, paddingVertical: 15, borderRadius: 16, alignItems: 'center' },
    optionsCancelText: { fontSize: 16, fontWeight: '700' },

    // Likers modal
    likerRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1 },
    likerAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginRight: 12 },
    likerName:   { flex: 1, fontSize: 15, fontWeight: '700' },
    addFriendBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14 },
    addFriendText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
    friendBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },

    // Modal header (shared)
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 18, paddingTop: Platform.OS === 'ios' ? 56 : 18,
        borderBottomWidth: 1,
    },
    modalTitle:  { fontSize: 17, fontWeight: '800' },
    modalAction: { fontWeight: '800', fontSize: 16 },

    // Upload
    mediaPicker:    { height: 220, borderRadius: 20, borderWidth: 2, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginBottom: 16 },
    mediaPickerImg: { width: '100%', height: '100%', resizeMode: 'cover' },
    captionInput:   { borderWidth: 1.5, borderRadius: 16, padding: 14, fontSize: 15, minHeight: 100, textAlignVertical: 'top', marginBottom: 16 },
    tagLabel:       { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },

    // Multi-photo grid (upload form)
    photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    photoThumbWrap: { position: 'relative', width: (width - 64) / 3, height: (width - 64) / 3, borderRadius: 12, overflow: 'visible' },
    photoThumb: { width: '100%', height: '100%', borderRadius: 12 },
    photoRemoveBtn: { position: 'absolute', top: -8, right: -8, backgroundColor: '#FFF', borderRadius: 12 },
    photoAddBtn: { width: (width - 64) / 3, height: (width - 64) / 3, borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },

    // Carousel dots (feed)
    dotRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 8 },
    dot:    { width: 6, height: 6, borderRadius: 3, opacity: 0.6 },


    // Empty
    emptyState: { alignItems: 'center', marginTop: 80, paddingHorizontal: 30 },
    emptyTitle: { fontSize: 20, fontWeight: '800', marginTop: 14 },
    emptyDesc:  { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },

    // Comments
    commentRow:       { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
    commentAvatar:    { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginRight: 10 },
    commentBubble:    { borderRadius: 16, padding: 12, borderWidth: 1 },
    commentAuthor:    { fontSize: 13, fontWeight: '800', marginBottom: 3 },
    commentText:      { fontSize: 14, lineHeight: 20 },
    replyTag:         { fontSize: 12, fontWeight: '600', marginBottom: 3 },
    commentActionsRow: { flexDirection: 'row', gap: 16, paddingLeft: 12, paddingTop: 6 },
    commentActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    commentActionText: { fontSize: 12, fontWeight: '600' },
    commentInputRow:  { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, paddingBottom: Platform.OS === 'ios' ? 28 : 12, borderTopWidth: 1 },
    commentInput:     { flex: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, maxHeight: 100 },
    commentSendBtn:   { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    replyIndicator:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1 },
    replyIndicatorText: { fontSize: 13, fontWeight: '600' },
});
