import React, { useState, useContext, useEffect, useCallback, useRef } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity, FlatList, Image,
    Dimensions, ActivityIndicator, TextInput, Alert, Modal,
    KeyboardAvoidingView, Platform, ScrollView, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { Video, ResizeMode } from 'expo-av';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { auth, db } from '../config/firebase';
import {
    collection, query, onSnapshot, addDoc, doc,
    updateDoc, arrayUnion, arrayRemove, serverTimestamp,
    orderBy, limit, where, increment, deleteDoc, getDoc,
} from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import { uploadImageToStorage } from '../utils/storageHelpers';

const { width, height } = Dimensions.get('window');
const POST_IMG_SIZE = (width - 3) / 3;

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
    { id: 'reels',  label: 'Reels' },
];

export default function CommunityScreen() {
    const { userData } = useContext(AuthContext);
    const { theme, isDarkMode } = useContext(ThemeContext);

    // Feed
    const [feedType, setFeedType]           = useState('forYou'); // 'forYou' | 'global' | 'reels'
    const [viewMode, setViewMode]           = useState('feed');   // 'feed' | 'grid'
    const [posts, setPosts]                 = useState([]);
    const [reels, setReels]                 = useState([]);
    const [loading, setLoading]             = useState(true);
    const [speciesFilter, setSpeciesFilter] = useState('all');

    // Upload
    const [isUploadVisible, setIsUploadVisible] = useState(false);
    const [uploadForm, setUploadForm] = useState({
        caption: '', species: 'dog', imageUri: null, videoUri: null, isVideo: false,
    });
    const [uploading, setUploading] = useState(false);

    // Comments
    const [commentsPostId, setCommentsPostId] = useState(null);
    const [commentsData, setCommentsData]     = useState([]);
    const [commentInput, setCommentInput]     = useState('');
    const [sendingComment, setSendingComment] = useState(false);
    const commentsListRef = useRef(null);

    // Post options
    const [optionsPost, setOptionsPost]   = useState(null);
    const [showEditModal, setShowEditModal] = useState(null); // post object
    const [editCaption, setEditCaption]    = useState('');
    const [editingPost, setEditingPost]    = useState(false);

    // Likers
    const [likersPost, setLikersPost]       = useState(null);
    const [likersList, setLikersList]       = useState([]);
    const [loadingLikers, setLoadingLikers] = useState(false);

    // ─────────────────────────────────────────────────
    // FETCH POSTS
    // ─────────────────────────────────────────────────
    useEffect(() => {
        if (feedType === 'reels') return;
        setLoading(true);

        let constraints = feedType === 'global'
            ? [orderBy('createdAt', 'desc'), limit(30)]
            : [orderBy('engagementScore', 'desc'), limit(30)];

        if (speciesFilter !== 'all') {
            constraints = [
                where('speciesTags', 'array-contains', speciesFilter),
                ...constraints,
            ];
        }

        const q = query(collection(db, 'posts'), ...constraints);
        const unsub = onSnapshot(q,
            snap => { setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
            ()   => setLoading(false)
        );
        return () => unsub();
    }, [feedType, speciesFilter]);

    // ─────────────────────────────────────────────────
    // FETCH REELS
    // ─────────────────────────────────────────────────
    useEffect(() => {
        const q = query(collection(db, 'reels'), orderBy('likesCount', 'desc'), limit(20));
        const unsub = onSnapshot(q, snap => {
            setReels(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, []);

    // ─────────────────────────────────────────────────
    // LIKE / UNLIKE
    // ─────────────────────────────────────────────────
    const toggleLike = async (post) => {
        if (!auth.currentUser) return;
        const uid   = auth.currentUser.uid;
        const liked = post.likedBy?.includes(uid);
        try {
            await updateDoc(doc(db, 'posts', post.id), {
                likedBy:         liked ? arrayRemove(uid) : arrayUnion(uid),
                likesCount:      (post.likesCount || 0) + (liked ? -1 : 1),
                engagementScore: Math.max(0, (post.engagementScore || 0) + (liked ? -2 : 2)),
            });
        } catch { /* ignore */ }
    };

    const toggleReelLike = async (reel) => {
        if (!auth.currentUser) return;
        const uid   = auth.currentUser.uid;
        const liked = reel.likedBy?.includes(uid);
        try {
            await updateDoc(doc(db, 'reels', reel.id), {
                likedBy:    liked ? arrayRemove(uid) : arrayUnion(uid),
                likesCount: Math.max(0, (reel.likesCount || 0) + (liked ? -1 : 1)),
            });
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
            const users = await Promise.all(
                uids.map(uid =>
                    getDoc(doc(db, 'users', uid)).then(d => d.exists() ? { uid, ...d.data() } : null)
                )
            );
            setLikersList(users.filter(Boolean));
        } catch { /* ignore */ }
        setLoadingLikers(false);
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
                    try { await deleteDoc(doc(db, 'posts', post.id)); }
                    catch { Alert.alert('Error', 'No se pudo eliminar el post.'); }
                },
            },
        ]);
    };

    const handleEditPost = (post) => {
        setOptionsPost(null);
        setEditCaption(post.caption || '');
        setShowEditModal(post);
    };

    const handleSaveEdit = async () => {
        if (!editCaption.trim() || !showEditModal) return;
        setEditingPost(true);
        try {
            await updateDoc(doc(db, 'posts', showEditModal.id), { caption: editCaption.trim() });
            setShowEditModal(null);
        } catch { Alert.alert('Error', 'No se pudo editar el post.'); }
        finally { setEditingPost(false); }
    };

    const handleSharePost = async (post) => {
        setOptionsPost(null);
        try {
            await Share.share({
                message: `🐾 ${post.caption || ''}\n\nCompartido desde PawMate`,
                title:   'PawMate',
            });
        } catch { /* user cancelled */ }
    };

    // ─────────────────────────────────────────────────
    // PICK MEDIA
    // ─────────────────────────────────────────────────
    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7,
        });
        if (!result.canceled) {
            setUploadForm(f => ({ ...f, imageUri: result.assets[0].uri, videoUri: null, isVideo: false }));
        }
    };

    const pickVideo = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['videos'], allowsEditing: true, quality: 0.7,
        });
        if (!result.canceled) {
            setUploadForm(f => ({ ...f, videoUri: result.assets[0].uri, imageUri: null, isVideo: true }));
        }
    };

    // ─────────────────────────────────────────────────
    // UPLOAD POST / REEL
    // ─────────────────────────────────────────────────
    const handleUploadPost = async () => {
        const hasMedia = uploadForm.imageUri || uploadForm.videoUri;
        if (!hasMedia) return Alert.alert('Error', 'Selecciona una imagen o video');
        if (!uploadForm.caption.trim()) return Alert.alert('Error', 'Escribe una descripción');
        setUploading(true);
        try {
            const uid       = auth.currentUser.uid;
            const timestamp = Date.now();

            if (uploadForm.isVideo) {
                const videoUrl = await uploadImageToStorage(
                    uploadForm.videoUri, `reels/${uid}/${timestamp}.mp4`
                );
                await addDoc(collection(db, 'reels'), {
                    authorUid:      uid,
                    authorName:     userData?.fullName || 'Usuario',
                    authorRole:     userData?.role || 'normal',
                    authorPhotoURL: userData?.photoURL || null,
                    videoUrl,
                    thumbnailUrl:   null,
                    caption:        uploadForm.caption,
                    speciesTags:    [uploadForm.species],
                    likesCount:     0,
                    commentsCount:  0,
                    likedBy:        [],
                    createdAt:      serverTimestamp(),
                });
                Alert.alert('¡Reel publicado! 🎬');
            } else {
                const imageUrl = await uploadImageToStorage(
                    uploadForm.imageUri, `posts/${uid}/${timestamp}.jpg`
                );
                await addDoc(collection(db, 'posts'), {
                    authorUid:      uid,
                    authorName:     userData?.fullName || 'Usuario',
                    authorRole:     userData?.role || 'normal',
                    authorPhotoURL: userData?.photoURL || null,
                    imageUrl,
                    caption:        uploadForm.caption,
                    speciesTags:    [uploadForm.species],
                    likesCount:     0,
                    commentsCount:  0,
                    likedBy:        [],
                    engagementScore: 0,
                    createdAt:      serverTimestamp(),
                });
                Alert.alert('¡Publicado! 🎉');
            }

            setIsUploadVisible(false);
            setUploadForm({ caption: '', species: 'dog', imageUri: null, videoUri: null, isVideo: false });
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
        const q = query(
            collection(db, 'posts', commentsPostId, 'comments'),
            orderBy('createdAt', 'asc')
        );
        const unsub = onSnapshot(q, snap => {
            setCommentsData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, [commentsPostId]);

    const sendComment = async () => {
        if (!commentInput.trim() || !commentsPostId || !auth.currentUser) return;
        const text = commentInput.trim();
        setCommentInput('');
        setSendingComment(true);
        try {
            await addDoc(collection(db, 'posts', commentsPostId, 'comments'), {
                authorUid:      auth.currentUser.uid,
                authorName:     userData?.fullName || 'Usuario',
                authorPhotoURL: userData?.photoURL || null,
                text,
                createdAt: serverTimestamp(),
            });
            await updateDoc(doc(db, 'posts', commentsPostId), {
                commentsCount:   increment(1),
                engagementScore: increment(1),
            });
            setTimeout(() => commentsListRef.current?.scrollToEnd({ animated: true }), 100);
        } catch { /* ignore */ } finally { setSendingComment(false); }
    };

    // ─────────────────────────────────────────────────
    // RENDER: Feed Post Card (Instagram style)
    // ─────────────────────────────────────────────────
    const renderFeedPost = useCallback(({ item: post }) => {
        const uid         = auth.currentUser?.uid;
        const liked       = post.likedBy?.includes(uid);
        const isMyPost    = post.authorUid === uid;
        const likesCount  = post.likesCount  || 0;
        const commCount   = post.commentsCount || 0;
        const dateStr     = post.createdAt?.toDate
            ? post.createdAt.toDate().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
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

                {/* Image */}
                {post.imageUrl && (
                    <Image source={{ uri: post.imageUrl }} style={s.feedImage} resizeMode="cover" />
                )}

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
                    <TouchableOpacity onPress={() => handleSharePost(post)} style={s.feedActionBtn}>
                        <Ionicons name="paper-plane-outline" size={26} color={theme.textSecondary} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }} />
                    {/* Species chip */}
                    <View style={[s.speciesChip, { backgroundColor: theme.primaryBg }]}>
                        <Text style={[s.speciesChipText, { color: theme.primary }]}>
                            {SPECIES_TAGS.find(t => t.value === post.speciesTags?.[0])?.label || '🐾'}
                        </Text>
                    </View>
                </View>

                {/* Likes - tappable to see who liked */}
                {likesCount > 0 && (
                    <TouchableOpacity style={s.likesRow} onPress={() => showLikers(post)}>
                        <Ionicons name="heart" size={13} color="#EF4444" />
                        <Text style={[s.likesText, { color: theme.text }]}>
                            {likesCount === 1 ? '1 me gusta' : `${likesCount} me gusta`}
                        </Text>
                    </TouchableOpacity>
                )}

                {/* Caption — author bold + text */}
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
    }, [theme, isDarkMode]);

    // ─────────────────────────────────────────────────
    // RENDER: Grid Cell
    // ─────────────────────────────────────────────────
    const renderGridCell = useCallback(({ item: post }) => (
        <TouchableOpacity style={s.gridCell}>
            {post.imageUrl
                ? <Image source={{ uri: post.imageUrl }} style={s.gridImage} resizeMode="cover" />
                : <View style={[s.gridImage, { backgroundColor: theme.primaryBg, justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ fontSize: 28 }}>🐾</Text>
                </View>
            }
            <View style={s.gridOverlay}>
                <Ionicons name="heart" size={11} color="#FFF" />
                <Text style={s.gridLikes}>{post.likesCount || 0}</Text>
            </View>
        </TouchableOpacity>
    ), [theme]);

    // ─────────────────────────────────────────────────
    // RENDER: Reel
    // ─────────────────────────────────────────────────
    const renderReel = useCallback(({ item: reel }) => {
        const uid   = auth.currentUser?.uid;
        const liked = reel.likedBy?.includes(uid);
        return (
            <View style={{ width, height: height - 180, position: 'relative', backgroundColor: '#000' }}>
                {reel.videoUrl
                    ? <ReelVideoPlayer videoUrl={reel.videoUrl} />
                    : <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        {reel.thumbnailUrl
                            ? <Image source={{ uri: reel.thumbnailUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                            : <Text style={{ fontSize: 64 }}>🎬</Text>
                        }
                    </View>
                }

                {/* Side actions */}
                <View style={s.reelSideBar}>
                    <TouchableOpacity style={s.reelAction} onPress={() => toggleReelLike(reel)}>
                        <Ionicons name={liked ? 'heart' : 'heart-outline'} size={32} color={liked ? '#EF4444' : '#FFF'} />
                        <Text style={s.reelActionCount}>{reel.likesCount || 0}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.reelAction}>
                        <Ionicons name="chatbubble-outline" size={28} color="#FFF" />
                        <Text style={s.reelActionCount}>{reel.commentsCount || 0}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.reelAction} onPress={() => handleSharePost(reel)}>
                        <Ionicons name="paper-plane-outline" size={28} color="#FFF" />
                    </TouchableOpacity>
                </View>

                {/* Bottom info */}
                <View style={s.reelBottom}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}>
                            {reel.authorPhotoURL
                                ? <Image source={{ uri: reel.authorPhotoURL }} style={StyleSheet.absoluteFillObject} />
                                : <Text style={{ fontSize: 14 }}>🐾</Text>
                            }
                        </View>
                        <Text style={s.reelAuthor}>@{reel.authorName || 'Usuario'}</Text>
                    </View>
                    <Text style={s.reelCaption} numberOfLines={2}>{reel.caption || ''}</Text>
                </View>
            </View>
        );
    }, []);

    // ─────────────────────────────────────────────────
    // MAIN RENDER
    // ─────────────────────────────────────────────────
    return (
        <View style={[s.container, { backgroundColor: theme.background }]}>
            <StatusBar style={isDarkMode ? 'light' : 'dark'} />

            {/* ── HEADER ── */}
            <View style={[s.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                <Text style={[s.headerTitle, { color: theme.text }]}>Comunidad</Text>
                <TouchableOpacity
                    style={[s.publishBtn, { backgroundColor: theme.primary }]}
                    onPress={() => setIsUploadVisible(true)}
                >
                    <Ionicons name="add" size={18} color="#FFF" />
                    <Text style={s.publishBtnText}>Publicar</Text>
                </TouchableOpacity>
            </View>

            {/* ── TIKTOK-STYLE FEED TABS ── */}
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

            {/* ── POSTS (Para Ti / Global) ── */}
            {feedType !== 'reels' && (
                <>
                    {/* Species filter row */}
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
                        <TouchableOpacity
                            style={[s.viewToggleBtn, { backgroundColor: theme.primaryBg }]}
                            onPress={() => setViewMode(v => v === 'feed' ? 'grid' : 'feed')}
                        >
                            <Ionicons
                                name={viewMode === 'feed' ? 'grid-outline' : 'list-outline'}
                                size={19}
                                color={theme.primary}
                            />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <ActivityIndicator size="large" color={theme.primary} />
                        </View>
                    ) : viewMode === 'feed' ? (
                        <FlatList
                            key="feed"
                            data={posts}
                            keyExtractor={item => item.id}
                            renderItem={renderFeedPost}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 100 }}
                            ListEmptyComponent={
                                <View style={s.emptyState}>
                                    <Text style={{ fontSize: 56 }}>📸</Text>
                                    <Text style={[s.emptyTitle, { color: theme.text }]}>Sin publicaciones</Text>
                                    <Text style={[s.emptyDesc, { color: theme.textSecondary }]}>
                                        ¡Sé el primero en compartir el momento de tu mascota!
                                    </Text>
                                </View>
                            }
                        />
                    ) : (
                        <FlatList
                            key="grid"
                            data={posts}
                            keyExtractor={item => item.id}
                            renderItem={renderGridCell}
                            numColumns={3}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 100 }}
                            ListEmptyComponent={
                                <View style={s.emptyState}>
                                    <Text style={{ fontSize: 56 }}>📸</Text>
                                    <Text style={[s.emptyTitle, { color: theme.text }]}>Sin publicaciones</Text>
                                </View>
                            }
                        />
                    )}
                </>
            )}

            {/* ── REELS ── */}
            {feedType === 'reels' && (
                <FlatList
                    data={reels}
                    keyExtractor={item => item.id}
                    renderItem={renderReel}
                    showsVerticalScrollIndicator={false}
                    pagingEnabled
                    contentContainerStyle={{ paddingBottom: 80 }}
                    ListEmptyComponent={
                        <View style={s.emptyState}>
                            <Text style={{ fontSize: 56 }}>🎬</Text>
                            <Text style={[s.emptyTitle, { color: theme.text }]}>Sin Reels</Text>
                            <Text style={[s.emptyDesc, { color: theme.textSecondary }]}>
                                Sube el primer video de tu mascota.
                            </Text>
                        </View>
                    }
                />
            )}

            {/* ════════════════════════════════════════
                MODAL: POST OPTIONS (bottom sheet)
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
                        {optionsPost?.authorUid === auth.currentUser?.uid && (
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
                            onPress={() => handleSharePost(optionsPost)}
                        >
                            <View style={[s.optionsIconWrap, { backgroundColor: '#F0FDF4' }]}>
                                <Ionicons name="share-social-outline" size={20} color="#22C55E" />
                            </View>
                            <Text style={[s.optionsLabel, { color: theme.text }]}>Compartir</Text>
                            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[s.optionsRow, { borderBottomWidth: 0 }]}
                            onPress={() => { setOptionsPost(null); Alert.alert('✅ Enlace copiado', 'El enlace ha sido copiado.'); }}
                        >
                            <View style={[s.optionsIconWrap, { backgroundColor: theme.primaryBg }]}>
                                <Ionicons name="link-outline" size={20} color={theme.primary} />
                            </View>
                            <Text style={[s.optionsLabel, { color: theme.text }]}>Copiar enlace</Text>
                            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                        </TouchableOpacity>

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
                MODAL: EDIT POST
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
                    <View style={{ padding: 20 }}>
                        <TextInput
                            style={[s.captionInput, { backgroundColor: theme.cardBackground, color: theme.text, borderColor: theme.border }]}
                            multiline
                            value={editCaption}
                            onChangeText={setEditCaption}
                            placeholder="Descripción..."
                            placeholderTextColor={theme.textSecondary}
                            autoFocus
                        />
                    </View>
                </View>
            </Modal>

            {/* ════════════════════════════════════════
                MODAL: LIKERS
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
                            renderItem={({ item }) => (
                                <View style={[s.likerRow, { borderBottomColor: theme.border }]}>
                                    <View style={[s.likerAvatar, { backgroundColor: theme.primaryBg }]}>
                                        {item.photoURL
                                            ? <Image source={{ uri: item.photoURL }} style={StyleSheet.absoluteFillObject} borderRadius={22} />
                                            : <Text style={{ fontSize: 18 }}>🐾</Text>
                                        }
                                    </View>
                                    <Text style={[s.likerName, { color: theme.text }]}>{item.fullName || 'Usuario'}</Text>
                                    <Ionicons name="heart" size={16} color="#EF4444" />
                                </View>
                            )}
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
                        {/* Media type toggle */}
                        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                            {[
                                { isVid: false, icon: 'image-outline', label: 'Foto' },
                                { isVid: true,  icon: 'videocam-outline', label: 'Video (Reel)' },
                            ].map(({ isVid, icon, label }) => {
                                const active = uploadForm.isVideo === isVid;
                                return (
                                    <TouchableOpacity
                                        key={label}
                                        style={[
                                            s.mediaTypeBtn,
                                            { borderColor: theme.primary, backgroundColor: theme.cardBackground },
                                            active && { backgroundColor: theme.primary },
                                        ]}
                                        onPress={isVid ? pickVideo : pickImage}
                                    >
                                        <Ionicons name={icon} size={18} color={active ? '#FFF' : theme.primary} />
                                        <Text style={[s.mediaTypeBtnText, { color: active ? '#FFF' : theme.primary }]}>{label}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Media preview */}
                        <TouchableOpacity
                            style={[s.mediaPicker, { borderColor: theme.border, backgroundColor: theme.cardBackground }]}
                            onPress={uploadForm.isVideo ? pickVideo : pickImage}
                        >
                            {uploadForm.imageUri ? (
                                <Image source={{ uri: uploadForm.imageUri }} style={s.mediaPickerImg} />
                            ) : uploadForm.videoUri ? (
                                <View style={{ alignItems: 'center', gap: 8 }}>
                                    <Ionicons name="videocam" size={48} color={theme.primary} />
                                    <Text style={{ color: theme.primary, fontWeight: '700' }}>Video seleccionado ✓</Text>
                                </View>
                            ) : (
                                <View style={{ alignItems: 'center', gap: 8 }}>
                                    <Ionicons
                                        name={uploadForm.isVideo ? 'videocam-outline' : 'image-outline'}
                                        size={48} color={theme.textSecondary}
                                    />
                                    <Text style={{ color: theme.primary, fontWeight: '700' }}>
                                        {uploadForm.isVideo ? 'Toca para añadir video' : 'Toca para añadir foto'}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        {/* Caption */}
                        <TextInput
                            style={[s.captionInput, { backgroundColor: theme.cardBackground, color: theme.text, borderColor: theme.border }]}
                            multiline
                            value={uploadForm.caption}
                            onChangeText={t => setUploadForm(f => ({ ...f, caption: t }))}
                            placeholder={uploadForm.isVideo ? 'Describe tu reel...' : 'Escribe algo sobre esta foto...'}
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
                MODAL: COMMENTS
            ════════════════════════════════════════ */}
            <Modal
                visible={!!commentsPostId}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setCommentsPostId(null)}
            >
                <View style={{ flex: 1, backgroundColor: theme.background }}>
                    <View style={[s.modalHeader, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                        <TouchableOpacity onPress={() => setCommentsPostId(null)}>
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
                        renderItem={({ item: comment }) => (
                            <View style={s.commentRow}>
                                <View style={[s.commentAvatar, { backgroundColor: theme.primaryBg }]}>
                                    {comment.authorPhotoURL
                                        ? <Image source={{ uri: comment.authorPhotoURL }} style={StyleSheet.absoluteFillObject} borderRadius={18} />
                                        : <Text style={{ fontSize: 15 }}>🐾</Text>
                                    }
                                </View>
                                <View style={[s.commentBubble, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                                    <Text style={[s.commentAuthor, { color: theme.text }]}>{comment.authorName}</Text>
                                    <Text style={[s.commentText, { color: theme.text }]}>{comment.text}</Text>
                                </View>
                            </View>
                        )}
                    />

                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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
                </View>
            </Modal>
        </View>
    );
}

// ─────────────────────────────────────────────────
// Reel Video Player
// ─────────────────────────────────────────────────
function ReelVideoPlayer({ videoUrl }) {
    const { width: W, height: H } = Dimensions.get('window');
    return (
        <Video
            source={{ uri: videoUrl }}
            style={{ width: W, height: H - 180 }}
            resizeMode={ResizeMode.COVER}
            isLooping
            shouldPlay
            useNativeControls={false}
        />
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

    // TikTok-style feed tabs
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
    viewToggleBtn:  { padding: 9, marginRight: 10, borderRadius: 12 },

    // Feed Card (Instagram style)
    feedCard:       { borderBottomWidth: 1 },
    feedAuthorRow:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
    authorAvatar:   { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    authorName:     { fontSize: 14, fontWeight: '800' },
    postDate:       { fontSize: 11, marginTop: 1 },
    feedImage:      { width: '100%', height: width },

    // Action bar
    feedActions:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingTop: 10, gap: 2 },
    feedActionBtn:  { padding: 5 },
    speciesChip:    { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
    speciesChipText: { fontSize: 12, fontWeight: '600' },

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

    // Grid
    gridCell:    { width: POST_IMG_SIZE, height: POST_IMG_SIZE, margin: 0.5, position: 'relative' },
    gridImage:   { width: '100%', height: '100%' },
    gridOverlay: { position: 'absolute', bottom: 5, left: 5, flexDirection: 'row', alignItems: 'center', gap: 3 },
    gridLikes:   { color: '#FFF', fontSize: 11, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 },

    // Reels
    reelSideBar:   { position: 'absolute', right: 14, bottom: 100, alignItems: 'center', gap: 24 },
    reelAction:    { alignItems: 'center' },
    reelActionCount: { color: '#FFF', fontSize: 12, fontWeight: '700', marginTop: 4, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 3 },
    reelBottom:    { position: 'absolute', bottom: 22, left: 16, right: 90 },
    reelAuthor:    { color: '#FFF', fontWeight: '800', fontSize: 15, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 4 },
    reelCaption:   { color: 'rgba(255,255,255,0.88)', fontSize: 13, lineHeight: 18, textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 3 },

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
    mediaTypeBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 14, borderWidth: 2 },
    mediaTypeBtnText: { fontSize: 14, fontWeight: '700' },
    captionInput:   { borderWidth: 1.5, borderRadius: 16, padding: 14, fontSize: 15, minHeight: 100, textAlignVertical: 'top', marginBottom: 16 },
    tagLabel:       { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },

    // Empty
    emptyState: { alignItems: 'center', marginTop: 80, paddingHorizontal: 30 },
    emptyTitle: { fontSize: 20, fontWeight: '800', marginTop: 14 },
    emptyDesc:  { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },

    // Comments
    commentRow:       { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
    commentAvatar:    { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginRight: 10 },
    commentBubble:    { flex: 1, borderRadius: 16, padding: 12, borderWidth: 1 },
    commentAuthor:    { fontSize: 13, fontWeight: '800', marginBottom: 3 },
    commentText:      { fontSize: 14, lineHeight: 20 },
    commentInputRow:  { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, paddingBottom: Platform.OS === 'ios' ? 28 : 12, borderTopWidth: 1 },
    commentInput:     { flex: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, maxHeight: 100 },
    commentSendBtn:   { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
});
