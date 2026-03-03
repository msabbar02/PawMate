import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Ionicons } from '@expo/vector-icons';

const MessagesScreen = ({ navigation }) => {
    const { theme } = useContext(ThemeContext);
    const { user } = useContext(AuthContext);
    const styles = getStyles(theme);

    const [chats, setChats] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, 'chats'),
            where('participants', 'array-contains', user.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedChats = [];
            snapshot.forEach((doc) => {
                const data = doc.data();

                // Determine the other participant's ID
                const otherParticipantId = data.participants.find(p => p !== user.uid) || user.uid;
                // Grab the name if we stored it, else generic
                const chatName = data.participantNames ? data.participantNames[otherParticipantId] : 'Usuario';

                fetchedChats.push({
                    id: doc.id,
                    name: chatName,
                    message: data.lastMessage || 'Nuevo chat...',
                    otherParticipantId,
                    ...data
                });
            });
            setChats(fetchedChats);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const renderItem = ({ item }) => (
        <TouchableOpacity
            style={styles.chatItem}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('ChatScreen', { chatId: item.id, recipientId: item.otherParticipantId, recipientName: item.name })}
        >
            <View style={styles.avatarContainer}>
                {item.avatar ? (
                    <Image source={{ uri: item.avatar }} style={styles.avatarImage} />
                ) : (
                    <View style={styles.avatar}>
                        <Ionicons name="person" size={24} color={theme.primary} />
                    </View>
                )}
                {item.isOnline && <View style={styles.onlineIndicator} />}
            </View>
            <View style={styles.chatInfo}>
                <View style={styles.chatHeader}>
                    <Text style={styles.chatName}>{item.name}</Text>
                    <Text style={styles.chatTime}>
                        {item.updatedAt && typeof item.updatedAt?.toDate === 'function' ?
                            new Date(item.updatedAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : ''}
                    </Text>
                </View>
                <View style={styles.chatFooter}>
                    <Text style={[styles.chatMessage, (item.unread ?? 0) > 0 && styles.chatMessageUnread]} numberOfLines={1}>
                        {item.message ?? 'Nuevo chat...'}
                    </Text>
                    {(item.unread ?? 0) > 0 ? (
                        <View style={styles.unreadBadge}>
                            <Text style={styles.unreadText}>{String(item.unread)}</Text>
                        </View>
                    ) : null}
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Mensajes</Text>
            </View>
            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={theme.primary} /></View>
            ) : chats.length === 0 ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: theme.textSecondary }}>No tienes mensajes aún.</Text>
                </View>
            ) : (
                <FlatList
                    data={chats}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContainer}
                />
            )}
        </View>
    );
};

const getStyles = (theme) => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: { paddingTop: 60, paddingBottom: 15, paddingHorizontal: 20, backgroundColor: theme.background },
    headerTitle: { fontSize: 32, fontWeight: '800', color: theme.text, letterSpacing: -0.5 },
    listContainer: { padding: 20, paddingBottom: 100 },
    chatItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 20,
        backgroundColor: theme.cardBackground,
        marginBottom: 12,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
        borderWidth: 1,
        borderColor: theme.border,
    },
    avatarContainer: { position: 'relative', marginRight: 16 },
    avatarImage: { width: 56, height: 56, borderRadius: 28 },
    avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.primary + '15', justifyContent: 'center', alignItems: 'center' },
    onlineIndicator: {
        position: 'absolute', bottom: 2, right: 2,
        width: 14, height: 14, borderRadius: 7,
        backgroundColor: '#4caf50', borderWidth: 2, borderColor: theme.cardBackground
    },
    chatInfo: { flex: 1, justifyContent: 'center' },
    chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    chatName: { fontSize: 17, fontWeight: '700', color: theme.text },
    chatTime: { fontSize: 12, color: theme.textSecondary, fontWeight: '500' },
    chatFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    chatMessage: { fontSize: 14, color: theme.textSecondary, flex: 1, marginRight: 12 },
    chatMessageUnread: { color: theme.text, fontWeight: '600' },
    unreadBadge: { backgroundColor: theme.primary, borderRadius: 12, minWidth: 24, paddingHorizontal: 8, paddingVertical: 4, justifyContent: 'center', alignItems: 'center' },
    unreadText: { color: '#FFF', fontSize: 12, fontWeight: '800' }
});

export default MessagesScreen;
