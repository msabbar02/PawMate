import React, { useContext, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

// Mock Data
const MOCK_GROUP = {
    id: 'golden_club',
    name: 'Club Golden Retriever',
    type: 'Privado', // 'Público' or 'Privado'
    members: 120,
    description: 'Un lugar para los amantes de los Goldens en la ciudad.',
    isMember: false, // Change this to true to see the feed
    isAdmin: false,
};

const MOCK_POSTS = [
    {
        id: '1',
        userName: 'María García',
        userAvatar: 'https://randomuser.me/api/portraits/women/44.jpg',
        mediaUrl: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?q=80&w=1000&auto=format&fit=crop',
        text: 'Nala disfrutando de su primer baño 🐕💦',
        likes: 45,
        comments: 12,
        timeAgo: '2h',
    }
];

const GroupDetailsScreen = ({ route, navigation }) => {
    // In a real app we'd get the group ID from route.params and fetch data
    const [groupData, setGroupData] = useState(MOCK_GROUP);
    const { theme } = useContext(ThemeContext);
    const styles = getStyles(theme);

    const handleJoinRequest = () => {
        if (groupData.type === 'Público') {
            setGroupData({ ...groupData, isMember: true });
        } else {
            console.log("Solicitud de unión enviada a los admins.");
        }
    };

    const renderPost = ({ item }) => (
        <View style={styles.postContainer}>
            <View style={styles.postHeader}>
                <View style={styles.userInfo}>
                    <Image source={{ uri: item.userAvatar }} style={styles.avatar} />
                    <View>
                        <Text style={styles.userName}>{item.userName}</Text>
                        <Text style={styles.timeText}>{item.timeAgo}</Text>
                    </View>
                </View>
                {groupData.isAdmin && (
                    <TouchableOpacity onPress={() => console.log('Eliminar Post - Admin Action')}>
                        <Ionicons name="trash-outline" size={20} color="#e53935" />
                    </TouchableOpacity>
                )}
            </View>
            <Image source={{ uri: item.mediaUrl }} style={styles.postImage} />
            <View style={styles.postActions}>
                <Ionicons name="heart-outline" size={26} color={theme.text} />
                <Ionicons name="chatbubble-outline" size={24} color={theme.text} style={{ marginLeft: 15 }} />
            </View>
            <Text style={styles.postText}>
                <Text style={styles.userName}>{item.userName} </Text>
                {item.text}
            </Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={28} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{groupData.name}</Text>
                <View style={{ width: 28 }} />
            </View>

            <FlatList
                data={groupData.isMember ? MOCK_POSTS : []}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={
                    <View style={styles.groupInfoContainer}>
                        <View style={styles.groupAvatarPlaceholder}>
                            <Ionicons name={groupData.type === 'Privado' ? "lock-closed" : "people"} size={40} color="#FFF" />
                        </View>
                        <Text style={styles.groupName}>{groupData.name}</Text>
                        <Text style={styles.groupMeta}>{groupData.type} • {groupData.members} miembros</Text>
                        <Text style={styles.groupDescription}>{groupData.description}</Text>

                        {groupData.isMember ? (
                            <View style={styles.memberActionsRow}>
                                <TouchableOpacity style={styles.createPostBtn} onPress={() => navigation.navigate('CreatePost')}>
                                    <Text style={styles.createPostText}>Publicar en Grupo</Text>
                                </TouchableOpacity>
                                {groupData.isAdmin && (
                                    <TouchableOpacity style={styles.adminBtn} onPress={() => console.log('Gestionar Miembros')}>
                                        <Ionicons name="settings" size={20} color={theme.primary} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        ) : (
                            <TouchableOpacity style={styles.joinBtn} onPress={handleJoinRequest}>
                                <Text style={styles.joinBtnText}>
                                    {groupData.type === 'Privado' ? 'Solicitar Unirse' : 'Unirme al Grupo'}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                }
                ListEmptyComponent={
                    !groupData.isMember && groupData.type === 'Privado' ? (
                        <View style={styles.privateMessageContainer}>
                            <Ionicons name="eye-off-outline" size={60} color={theme.textSecondary} />
                            <Text style={styles.privateMessageTitle}>Este grupo es Privado</Text>
                            <Text style={styles.privateMessageBody}>
                                Debes ser miembro para poder ver sus fotos, videos y publicaciones.
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.privateMessageContainer}>
                            <Text style={styles.privateMessageBody}>No hay publicaciones aún.</Text>
                        </View>
                    )
                }
                renderItem={renderPost}
            />
        </SafeAreaView>
    );
};

const getStyles = (theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
        backgroundColor: theme.background,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.text,
    },
    groupInfoContainer: {
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
    },
    groupAvatarPlaceholder: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: theme.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    groupName: {
        fontSize: 22,
        fontWeight: 'bold',
        color: theme.text,
        marginBottom: 5,
        textAlign: 'center',
    },
    groupMeta: {
        fontSize: 14,
        color: theme.textSecondary,
        marginBottom: 10,
    },
    groupDescription: {
        fontSize: 15,
        color: theme.text,
        textAlign: 'center',
        marginBottom: 20,
    },
    joinBtn: {
        backgroundColor: theme.primary,
        paddingHorizontal: 30,
        paddingVertical: 12,
        borderRadius: 25,
        width: '80%',
        alignItems: 'center',
    },
    joinBtnText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    memberActionsRow: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    createPostBtn: {
        backgroundColor: theme.primary,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 25,
        flex: 1,
        alignItems: 'center',
        marginRight: 10,
    },
    createPostText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    adminBtn: {
        backgroundColor: theme.cardBackground,
        borderWidth: 1,
        borderColor: theme.border,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
    },
    privateMessageContainer: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
    },
    privateMessageTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.text,
        marginTop: 15,
        marginBottom: 10,
    },
    privateMessageBody: {
        fontSize: 14,
        color: theme.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
    },
    postContainer: {
        marginBottom: 20,
    },
    postHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 15,
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
    },
    userName: {
        fontWeight: 'bold',
        fontSize: 14,
        color: theme.text,
    },
    timeText: {
        fontSize: 12,
        color: theme.textSecondary,
    },
    postImage: {
        width: width,
        height: width, // Square images
        backgroundColor: theme.border,
    },
    postActions: {
        flexDirection: 'row',
        padding: 15,
        paddingBottom: 5,
    },
    postText: {
        paddingHorizontal: 15,
        color: theme.text,
        lineHeight: 20,
    }
});

export default GroupDetailsScreen;
