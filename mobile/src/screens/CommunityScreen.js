import React, { useContext, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, Dimensions, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../context/ThemeContext';
import * as Sharing from 'expo-sharing';

const { width } = Dimensions.get('window');

// Mock Data
const MOCK_POSTS = [
    {
        id: '1',
        userName: 'María García',
        userAvatar: 'https://randomuser.me/api/portraits/women/44.jpg',
        mediaType: 'image',
        mediaUrl: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?q=80&w=1000&auto=format&fit=crop',
        text: 'Hoy fue un día increíble de paseo por el parque con Luna. 🐶☀️ #PawMate #Paseo',
        likes: 24,
        comments: 5,
        timeAgo: '2h',
        groupId: null, // Global
        isLikedByMe: false,
    },
    {
        id: '2',
        userName: 'Club Golden Retriever',
        userAvatar: 'https://images.unsplash.com/photo-1552053831-71594a27632d?q=80&w=100&auto=format&fit=crop',
        mediaType: 'image',
        mediaUrl: 'https://images.unsplash.com/photo-1633722715463-d30f4f325e24?q=80&w=1000&auto=format&fit=crop',
        text: 'Recuerden que mañana tenemos la quedada anual en el parque central a las 10:00 AM. ¡Traigan agua y juguetes!',
        likes: 112,
        comments: 34,
        timeAgo: '5h',
        groupId: 'golden_club',
        isLikedByMe: true,
    },
    {
        id: '3',
        userName: 'Carlos Rodríguez',
        userAvatar: 'https://randomuser.me/api/portraits/men/32.jpg',
        mediaType: 'image',
        mediaUrl: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?q=80&w=1000&auto=format&fit=crop',
        text: 'Resumen del paseo de hoy: 5km en 1 hora. ¡Rocco está exhausto pero feliz! 🦮',
        likes: 18,
        comments: 2,
        timeAgo: '1d',
        groupId: null,
        isLikedByMe: false,
    }
];

const CommunityScreen = ({ navigation }) => {
    const { theme } = useContext(ThemeContext);
    const styles = getStyles(theme);

    const [posts, setPosts] = useState(MOCK_POSTS);

    const toggleLike = (postId) => {
        setPosts(currentPosts => currentPosts.map(post => {
            if (post.id === postId) {
                return {
                    ...post,
                    isLikedByMe: !post.isLikedByMe,
                    likes: post.isLikedByMe ? post.likes - 1 : post.likes + 1
                };
            }
            return post;
        }));
    };

    const handleShare = async (post) => {
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
            try {
                // In a real app we'd share a URI to the content or the actual file URI downloaded locally.
                // For mock, we'll try to share standard text as we can't reliably share a remote image directly with expo-sharing without downloading it first
                await Sharing.shareAsync('https://pawmate.app/post/' + post.id, {
                    dialogTitle: 'Compartir publicación de ' + post.userName,
                });
            } catch (error) {
                console.log('Error sharing', error);
            }
        }
    };

    const renderPost = ({ item }) => (
        <View style={styles.postContainer}>
            {/* Header */}
            <View style={styles.postHeader}>
                <View style={styles.userInfo}>
                    <Image source={{ uri: item.userAvatar }} style={styles.avatar} />
                    <View>
                        <Text style={styles.userName}>{item.userName}</Text>
                        <Text style={styles.timeText}>
                            {item.timeAgo} {item.groupId ? ' • Grupo' : ' • Global'}
                        </Text>
                    </View>
                </View>
                <TouchableOpacity>
                    <Ionicons name="ellipsis-horizontal" size={20} color={theme.textSecondary} />
                </TouchableOpacity>
            </View>

            {/* Media */}
            <Image source={{ uri: item.mediaUrl }} style={styles.postImage} />

            {/* Actions */}
            <View style={styles.actionRow}>
                <View style={styles.leftActions}>
                    <TouchableOpacity style={styles.actionButton} onPress={() => toggleLike(item.id)}>
                        <Ionicons
                            name={item.isLikedByMe ? "heart" : "heart-outline"}
                            size={28}
                            color={item.isLikedByMe ? "#e91e63" : theme.text}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButton}>
                        <Ionicons name="chatbubble-outline" size={26} color={theme.text} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionButton} onPress={() => handleShare(item)}>
                        <Ionicons name="paper-plane-outline" size={26} color={theme.text} />
                    </TouchableOpacity>
                </View>
                <TouchableOpacity>
                    <Ionicons name="bookmark-outline" size={26} color={theme.text} />
                </TouchableOpacity>
            </View>

            {/* Content Info */}
            <View style={styles.contentInfo}>
                <Text style={styles.likesText}>{item.likes} Me gusta</Text>
                <Text style={styles.captionText}>
                    <Text style={styles.captionUser}>{item.userName} </Text>
                    {item.text}
                </Text>
                {item.comments > 0 && (
                    <TouchableOpacity style={styles.commentsButton}>
                        <Text style={styles.viewCommentsText}>Ver los {item.comments} comentarios</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header: Search and Title */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Comunidad</Text>
                <TouchableOpacity style={styles.searchButton} onPress={() => navigation.navigate('SearchGroups')}>
                    <Ionicons name="search" size={20} color={theme.textSecondary} />
                    <Text style={styles.searchText}>Buscar Grupos...</Text>
                </TouchableOpacity>
            </View>

            {/* Feed */}
            <FlatList
                data={posts}
                keyExtractor={(item) => item.id}
                renderItem={renderPost}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.feedContainer}
            />

            {/* FAB: Create Post */}
            <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('CreatePost')}>
                <Ionicons name="add" size={30} color="#FFF" />
            </TouchableOpacity>
        </SafeAreaView>
    );
};

const getStyles = (theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background,
    },
    header: {
        paddingHorizontal: 15,
        paddingBottom: 10,
        paddingTop: 10,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
        backgroundColor: theme.background,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: theme.text,
        marginBottom: 15,
        fontFamily: 'System',
    },
    searchButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.cardBackground,
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: theme.border,
    },
    searchText: {
        color: theme.textSecondary,
        marginLeft: 10,
        fontSize: 15,
    },
    feedContainer: {
        paddingBottom: 100, // Space for Bottom Tabs and FAB
    },
    postContainer: {
        marginBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
        paddingBottom: 15,
    },
    postHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        paddingVertical: 12,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        marginRight: 10,
        backgroundColor: theme.border,
    },
    userName: {
        fontWeight: 'bold',
        fontSize: 14,
        color: theme.text,
    },
    timeText: {
        fontSize: 12,
        color: theme.textSecondary,
        marginTop: 2,
    },
    postImage: {
        width: width,
        height: width, // Square images
        backgroundColor: theme.border,
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 12,
    },
    leftActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionButton: {
        marginRight: 15,
    },
    contentInfo: {
        paddingHorizontal: 15,
    },
    likesText: {
        fontWeight: 'bold',
        color: theme.text,
        marginBottom: 5,
    },
    captionText: {
        color: theme.text,
        lineHeight: 20,
    },
    captionUser: {
        fontWeight: 'bold',
    },
    commentsButton: {
        marginTop: 8,
    },
    viewCommentsText: {
        color: theme.textSecondary,
    },
    fab: {
        position: 'absolute',
        bottom: 90, // Above bottom tabs
        right: 20,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: theme.primary,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: theme.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
    }
});

export default CommunityScreen;
