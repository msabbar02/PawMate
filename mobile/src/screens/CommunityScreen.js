import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    TouchableOpacity,
    Dimensions,
    SafeAreaView,
    StatusBar,
    ScrollView,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

// Mock Data
const CURRENT_USER_ID = 'user123';
const IS_ADMIN = false;

const MOCK_POSTS = [
    {
        id: 'post1',
        userId: 'user123',
        userProfilePic: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?ixlib=rb-1.2.1&auto=format&fit=crop&w=200&q=80',
        userName: 'msabbar02',
        images: [
            'https://images.unsplash.com/photo-1543466835-00a7907e9de1?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1507146426996-ef05306b995a?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
        ],
        songName: 'Chill Vibes - Original Audio',
        likes: 124,
        comments: 12,
        description: 'Enjoying the weekend with max! 🐶✨',
        date: 'Hace 2 horas',
        isLiked: false,
        isSaved: false,
    },
    {
        id: 'post2',
        userId: 'user456',
        userProfilePic: 'https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?ixlib=rb-1.2.1&auto=format&fit=crop&w=200&q=80',
        userName: 'alex_dogs',
        images: [
            'https://images.unsplash.com/photo-1450778869180-41d0601e046e?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
        ],
        songName: null,
        likes: 890,
        comments: 45,
        description: 'Look at this little guy sleep 💤 #naptime',
        date: 'Ayer',
        isLiked: true,
        isSaved: true,
    },
    {
        id: 'post3',
        userId: 'user789',
        userProfilePic: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?ixlib=rb-1.2.1&auto=format&fit=crop&w=200&q=80',
        userName: 'laura_cats',
        images: [
            'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80',
        ],
        songName: 'Trending Song - Cat Edition',
        likes: 342,
        comments: 8,
        description: 'She loves the new toy! 😻',
        date: 'Hace 3 días',
        isLiked: false,
        isSaved: true,
    }
];

export default function CommunityScreen() {
    const [posts, setPosts] = useState(MOCK_POSTS);
    const [currentSlide, setCurrentSlide] = useState({});

    const toggleLike = (postId) => {
        setPosts(posts.map(post =>
            post.id === postId
                ? { ...post, isLiked: !post.isLiked, likes: post.isLiked ? post.likes - 1 : post.likes + 1 }
                : post
        ));
    };

    const toggleSave = (postId) => {
        setPosts(posts.map(post =>
            post.id === postId ? { ...post, isSaved: !post.isSaved } : post
        ));
    };

    const handleScroll = (postId, event) => {
        const slideSize = event.nativeEvent.layoutMeasurement.width;
        const index = event.nativeEvent.contentOffset.x / slideSize;
        setCurrentSlide(prev => ({ ...prev, [postId]: Math.round(index) }));
    };

    const renderPost = ({ item }) => {
        const canModify = item.userId === CURRENT_USER_ID || IS_ADMIN;
        const activeIndex = currentSlide[item.id] || 0;

        return (
            <View style={styles.postContainer}>
                {/* Header */}
                <View style={styles.postHeader}>
                    <View style={styles.userInfo}>
                        <Image source={{ uri: item.userProfilePic }} style={styles.profilePic} />
                        <Text style={styles.userName}>{item.userName}</Text>
                    </View>
                    {canModify && (
                        <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Feather name="more-vertical" size={24} color="#FFF" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Media Carousel */}
                <View>
                    <ScrollView
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onScroll={(e) => handleScroll(item.id, e)}
                        scrollEventThrottle={16}
                    >
                        {item.images.map((img, index) => (
                            <Image key={index} source={{ uri: img }} style={styles.postImage} />
                        ))}
                    </ScrollView>
                    {item.images.length > 1 && (
                        <View style={styles.carouselIndicatorContainer}>
                            {item.images.map((_, idx) => (
                                <View key={idx} style={[styles.carouselDot, idx === activeIndex && styles.carouselDotActive]} />
                            ))}
                        </View>
                    )}
                </View>

                {/* Music Indicator */}
                {item.songName && (
                    <View style={styles.musicContainer}>
                        <Ionicons name="musical-notes" size={14} color="#1a7a4c" />
                        <Text style={styles.musicText}>{item.songName}</Text>
                    </View>
                )}

                {/* Actions */}
                <View style={styles.actionsContainer}>
                    <View style={styles.leftActions}>
                        <TouchableOpacity onPress={() => toggleLike(item.id)} style={styles.actionIcon}>
                            <Ionicons name={item.isLiked ? "heart" : "heart-outline"} size={28} color={item.isLiked ? "#ff3040" : "#FFF"} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionIcon}>
                            <Ionicons name="chatbubble-outline" size={26} color="#FFF" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionIcon}>
                            <Feather name="send" size={24} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={() => toggleSave(item.id)}>
                        <Ionicons name={item.isSaved ? "bookmark" : "bookmark-outline"} size={26} color="#FFF" />
                    </TouchableOpacity>
                </View>

                {/* Details */}
                <View style={styles.detailsContainer}>
                    <Text style={styles.likesText}>{item.likes} me gusta</Text>
                    <View style={styles.descriptionContainer}>
                        <Text style={styles.userNameDesc}>{item.userName} </Text>
                        <Text style={styles.descriptionText}>{item.description}</Text>
                    </View>
                    {item.comments > 0 && (
                        <Text style={styles.viewCommentsText}>Ver los {item.comments} comentarios</Text>
                    )}
                    <Text style={styles.dateText}>{item.date}</Text>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#101820" />
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Community</Text>
                <TouchableOpacity style={styles.addPostButton}>
                    <Feather name="plus-square" size={24} color="#FFF" />
                </TouchableOpacity>
            </View>
            <FlatList
                data={posts}
                keyExtractor={item => item.id}
                renderItem={renderPost}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#101820', // Tema oscuro elegante propuesto
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#1a2430',
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 26,
        fontWeight: 'bold',
        fontStyle: 'italic',
        letterSpacing: 1,
    },
    addPostButton: {
        padding: 8,
    },
    listContent: {
        paddingBottom: 20,
    },
    postContainer: {
        marginBottom: 20,
        backgroundColor: '#151f2b',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#1a2430',
    },
    postHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    profilePic: {
        width: 38,
        height: 38,
        borderRadius: 19,
        marginRight: 10,
        borderWidth: 2,
        borderColor: '#1a7a4c', // Verde representativo PawMate
    },
    userName: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 15,
    },
    postImage: {
        width: width,
        height: width, // Hace que la imagen sea cuadrada
        backgroundColor: '#202a36',
    },
    carouselIndicatorContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        position: 'absolute',
        bottom: 15,
        width: '100%',
    },
    carouselDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
        marginHorizontal: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.5,
        shadowRadius: 1,
        elevation: 2,
    },
    carouselDotActive: {
        backgroundColor: '#1a7a4c',
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    musicContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingTop: 10,
        paddingBottom: 2,
    },
    musicText: {
        color: '#1a7a4c',
        fontSize: 13,
        marginLeft: 6,
        fontWeight: '600',
    },
    actionsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginTop: 4,
    },
    leftActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionIcon: {
        marginRight: 18,
    },
    detailsContainer: {
        paddingHorizontal: 12,
        paddingBottom: 15,
    },
    likesText: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 14,
        marginBottom: 6,
    },
    descriptionContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 6,
    },
    userNameDesc: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 14,
    },
    descriptionText: {
        color: '#e0e0e0',
        fontSize: 14,
    },
    viewCommentsText: {
        color: '#9ba4b5',
        fontSize: 14,
        marginBottom: 4,
        fontWeight: '500',
    },
    dateText: {
        color: '#768598',
        fontSize: 12,
        marginTop: 2,
    },
});
