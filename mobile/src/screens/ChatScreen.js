import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { collection, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
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

    // Listen to messages (sin orderBy para evitar índice compuesto; ordenamos en memoria)
    useEffect(() => {
        if (!chatId) return;

        const messagesRef = collection(db, 'chats', chatId, 'messages');
        const unsubscribe = onSnapshot(messagesRef, (snapshot) => {
            const msgs = [];
            snapshot.forEach((docSnap) => {
                msgs.push({ id: docSnap.id, ...docSnap.data() });
            });
            msgs.sort((a, b) => {
                const tA = (a.createdAt && typeof a.createdAt.toMillis === 'function') ? a.createdAt.toMillis() : (a.createdAt?.seconds ?? 0) * 1000;
                const tB = (b.createdAt && typeof b.createdAt.toMillis === 'function') ? b.createdAt.toMillis() : (b.createdAt?.seconds ?? 0) * 1000;
                return tA - tB;
            });
            setMessages(msgs);
            setLoading(false);
        }, (err) => {
            console.error('Chat messages error:', err);
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

            await updateDoc(doc(db, 'chats', chatId), {
                lastMessage: text,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error sending message:", error);
        }
    };

    const renderMessage = ({ item, index }) => {
        const isMyMessage = item.senderId === user.uid;

        let showDate = false;
        if (index === 0) {
            showDate = true;
        } else {
            const prevMsg = messages[index - 1]; // Messages are inverted, so index - 1 is older
            if (item.createdAt && prevMsg?.createdAt && typeof item.createdAt.toMillis === 'function' && typeof prevMsg.createdAt.toMillis === 'function') {
                const currentDate = new Date(item.createdAt.toMillis()).toLocaleDateString();
                const prevDate = new Date(prevMsg.createdAt.toMillis()).toLocaleDateString();
                if (currentDate !== prevDate) showDate = true;
            }
        }

        return (
            <View>
                {showDate && item.createdAt && typeof item.createdAt.toMillis === 'function' && (
                    <Text style={styles.dateSeparator}>
                        {new Date(item.createdAt.toMillis()).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                    </Text>
                )}
                <View style={[styles.messageWrapper, isMyMessage ? styles.messageWrapperMe : styles.messageWrapperOther]}>
                    <View style={[styles.messageBubble, isMyMessage ? styles.myMessage : styles.theirMessage]}>
                        <Text style={[styles.messageText, isMyMessage ? styles.myMessageText : styles.theirMessageText]}>
                            {item.text ?? ''}
                        </Text>
                        <Text style={[styles.messageTime, isMyMessage ? styles.messageTimeMe : styles.messageTimeOther]}>
                            {item.createdAt && typeof item.createdAt.toMillis === 'function' ?
                                new Date(item.createdAt.toMillis()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) :
                                ''}
                        </Text>
                    </View>
                </View>
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
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle}>{recipientName || 'Chat'}</Text>
                    <Text style={styles.headerStatus}>En línea</Text>
                </View>
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
        backgroundColor: theme.background, borderBottomWidth: 1, borderBottomColor: theme.border,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 3, zIndex: 10
    },
    backButton: { padding: 5 },
    headerTitleContainer: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: theme.text },
    headerStatus: { fontSize: 12, color: '#4caf50', marginTop: 2, fontWeight: '500' },
    listContent: { padding: 15 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    dateSeparator: { alignSelf: 'center', marginVertical: 15, fontSize: 12, color: theme.textSecondary, fontWeight: '600', backgroundColor: theme.cardBackground, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
    messageWrapper: { marginBottom: 15, flexDirection: 'row' },
    messageWrapperMe: { justifyContent: 'flex-end' },
    messageWrapperOther: { justifyContent: 'flex-start' },
    messageBubble: { maxWidth: '80%', padding: 12, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 1 },
    myMessage: { backgroundColor: theme.primary, borderBottomRightRadius: 4 },
    theirMessage: { backgroundColor: theme.cardBackground, borderWidth: 1, borderColor: theme.border, borderBottomLeftRadius: 4 },
    messageText: { fontSize: 15, lineHeight: 22 },
    myMessageText: { color: '#FFF' },
    theirMessageText: { color: theme.text },
    messageTime: { fontSize: 11, alignSelf: 'flex-end', marginTop: 4 },
    messageTimeMe: { color: 'rgba(255,255,255,0.7)' },
    messageTimeOther: { color: theme.textSecondary },
    inputArea: {
        flexDirection: 'row', alignItems: 'flex-end', padding: 10,
        backgroundColor: theme.background, borderTopWidth: 1, borderTopColor: theme.border,
        paddingBottom: Platform.OS === 'ios' ? 25 : 10
    },
    input: {
        flex: 1, backgroundColor: theme.cardBackground, color: theme.text,
        borderRadius: 24, paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 10 : 12, paddingBottom: Platform.OS === 'ios' ? 10 : 12,
        maxHeight: 100, minHeight: 45, borderWidth: 1, borderColor: theme.border, marginRight: 10, fontSize: 16
    },
    sendButton: { backgroundColor: theme.primary, width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', shadowColor: theme.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 }
});

export default ChatScreen;
