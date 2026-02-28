import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Ionicons } from '@expo/vector-icons';

const ChatScreen = ({ route, navigation }) => {
    const { theme } = useContext(ThemeContext);
    const { user } = useContext(AuthContext);
    const styles = getStyles(theme);

    // Can receive chatId orrecipient data
    const { chatId: initialChatId, recipientId, recipientName } = route.params;

    const [chatId, setChatId] = useState(initialChatId);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);

    // If we only have recipientId, find or create chat thread
    useEffect(() => {
        const initChat = async () => {
            if (chatId) return; // Already have a chat thread
            if (!user || !recipientId) return;

            // Look for existing chat between these two
            const q = query(
                collection(db, 'chats'),
                where('participants', 'array-contains', user.uid)
            );

            const snapshot = await getDocs(q);
            let foundChatId = null;

            snapshot.forEach((doc) => {
                const data = doc.data();
                if (data.participants.includes(recipientId)) {
                    foundChatId = doc.id;
                }
            });

            if (foundChatId) {
                setChatId(foundChatId);
            } else {
                // Create new chat
                const newChatRef = await addDoc(collection(db, 'chats'), {
                    participants: [user.uid, recipientId],
                    participantNames: {
                        [user.uid]: 'Yo', // Current user's perspective
                        [recipientId]: recipientName
                    },
                    lastMessage: '',
                    updatedAt: serverTimestamp()
                });
                setChatId(newChatRef.id);
            }
        };

        initChat();
    }, [recipientId, user]);

    // Listen to messages
    useEffect(() => {
        if (!chatId) return;

        const q = query(
            collection(db, 'chats', chatId, 'messages'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = [];
            snapshot.forEach((doc) => {
                msgs.push({ id: doc.id, ...doc.data() });
            });
            setMessages(msgs);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [chatId]);

    const sendMessage = async () => {
        if (inputText.trim().length === 0 || !chatId) return;

        const text = inputText.trim();
        setInputText('');

        try {
            await addDoc(collection(db, 'chats', chatId, 'messages'), {
                text,
                senderId: user.uid,
                createdAt: serverTimestamp()
            });

            // Update thread's last message
            /* await updateDoc(doc(db, 'chats', chatId), {
                lastMessage: text,
                updatedAt: serverTimestamp()
            }); */ // Skipping strict thread updates for simplicity, but ideal in production
        } catch (error) {
            console.error("Error sending message:", error);
        }
    };

    const renderMessage = ({ item }) => {
        const isMyMessage = item.senderId === user.uid;

        return (
            <View style={[styles.messageBubble, isMyMessage ? styles.myMessage : styles.theirMessage]}>
                <Text style={[styles.messageText, isMyMessage ? styles.myMessageText : styles.theirMessageText]}>
                    {item.text}
                </Text>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{recipientName || 'Chat'}</Text>
                <View style={{ width: 24 }} />
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator color={theme.primary} /></View>
            ) : (
                <FlatList
                    data={messages}
                    keyExtractor={(item) => item.id}
                    renderItem={renderMessage}
                    inverted
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}

            <View style={styles.inputArea}>
                <TextInput
                    style={styles.input}
                    placeholder="Escribe un mensaje..."
                    placeholderTextColor={theme.textSecondary}
                    value={inputText}
                    onChangeText={setInputText}
                    multiline
                />
                <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
                    <Ionicons name="send" size={24} color="#FFF" />
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
};

const getStyles = (theme) => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 50, paddingBottom: 15, paddingHorizontal: 20,
        backgroundColor: theme.cardBackground, borderBottomWidth: 1, borderBottomColor: theme.border
    },
    backButton: { padding: 5 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: theme.text },
    listContent: { padding: 15 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    messageBubble: { maxWidth: '80%', padding: 12, borderRadius: 20, marginBottom: 10 },
    myMessage: { alignSelf: 'flex-end', backgroundColor: theme.primary, borderBottomRightRadius: 5 },
    theirMessage: { alignSelf: 'flex-start', backgroundColor: theme.cardBackground, borderWidth: 1, borderColor: theme.border, borderBottomLeftRadius: 5 },
    messageText: { fontSize: 16, lineHeight: 22 },
    myMessageText: { color: '#FFF' },
    theirMessageText: { color: theme.text },
    inputArea: {
        flexDirection: 'row', alignItems: 'flex-end', padding: 15,
        backgroundColor: theme.cardBackground, borderTopWidth: 1, borderTopColor: theme.border
    },
    input: {
        flex: 1, backgroundColor: theme.background, color: theme.text,
        borderRadius: 20, paddingHorizontal: 15, paddingTop: 12, paddingBottom: 12,
        maxHeight: 100, minHeight: 45, borderWidth: 1, borderColor: theme.border, marginRight: 10
    },
    sendButton: { backgroundColor: theme.primary, width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center' }
});

export default ChatScreen;
