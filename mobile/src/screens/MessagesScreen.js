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
            onPress={() => navigation.navigate('ChatScreen', { chatId: item.id, recipientId: item.otherParticipantId, recipientName: item.name })}
        >
            <View style={styles.avatar}>
                <Ionicons name="person" size={24} color="#FFF" />
            </View>
            <View style={styles.chatInfo}>
                <View style={styles.chatHeader}>
                    <Text style={styles.chatName}>{item.name}</Text>
                    <Text style={styles.chatTime}>{item.updatedAt ? new Date(item.updatedAt?.toDate()).toLocaleDateString() : ''}</Text>
                </View>
                <View style={styles.chatFooter}>
                    <Text style={styles.chatMessage} numberOfLines={1}>{item.message}</Text>
                    {item.unread > 0 && (
                        <View style={styles.unreadBadge}>
                            <Text style={styles.unreadText}>{item.unread}</Text>
                        </View>
                    )}
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
    header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20, backgroundColor: theme.background, borderBottomWidth: 1, borderBottomColor: theme.border },
    headerTitle: { fontSize: 28, fontWeight: 'bold', color: theme.primary },
    listContainer: { padding: 15 },
    chatItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: theme.border },
    avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 15, backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center' },
    chatInfo: { flex: 1 },
    chatHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
    chatName: { fontSize: 16, fontWeight: 'bold', color: theme.text },
    chatTime: { fontSize: 12, color: theme.textSecondary },
    chatFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    chatMessage: { fontSize: 14, color: theme.textSecondary, flex: 1, marginRight: 10 },
    unreadBadge: { backgroundColor: theme.primary, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, justifyContent: 'center', alignItems: 'center' },
    unreadText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' }
});

export default MessagesScreen;
