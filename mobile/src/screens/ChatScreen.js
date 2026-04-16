import React, { useState, useContext, useEffect, useRef } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity, FlatList,
    TextInput, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { supabase } from '../config/supabase';
import { COLORS } from '../constants/colors';

export default function ChatScreen({ route, navigation }) {
    const { conversation, otherUser } = route.params || {};
    const { user, userData } = useContext(AuthContext);
    const { theme } = useContext(ThemeContext);

    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const flatListRef = useRef(null);

    const convoId = conversation?.id;
    const otherName = otherUser?.fullName || otherUser?.firstName
        || (userData?.role === 'caregiver' ? conversation?.ownerName : conversation?.caregiverName)
        || 'Usuario';
    const otherAvatar = otherUser?.avatar
        || (userData?.role === 'caregiver' ? conversation?.ownerAvatar : conversation?.caregiverAvatar);

    useEffect(() => {
        if (!convoId) return;

        const fetchMessages = async () => {
            const { data } = await supabase
                .from('messages')
                .select('*')
                .eq('conversationId', convoId)
                .order('created_at', { ascending: true });
            if (data) setMessages(data);
        };
        fetchMessages();

        const channel = supabase.channel(`chat_${convoId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `conversationId=eq.${convoId}`,
            }, (payload) => {
                setMessages(prev => [...prev, payload.new]);
                setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [convoId]);

    const sendMessage = async () => {
        const text = input.trim();
        if (!text || !convoId || !user?.id) return;
        setInput('');

        try {
            await supabase.from('messages').insert({
                conversationId: convoId,
                senderId: user.id,
                senderName: userData?.fullName || 'Usuario',
                text,
                read: false,
            });

            // Update conversation last message
            await supabase.from('conversations').update({
                lastMessage: text,
                lastMessageAt: new Date().toISOString(),
            }).eq('id', convoId);
        } catch (e) {
            console.error('Send message error:', e);
        }
    };

    const renderMessage = ({ item }) => {
        const isMe = item.senderId === user?.id;
        return (
            <View style={[styles.msgWrap, isMe ? styles.msgRight : styles.msgLeft]}>
                <View style={[styles.bubble, isMe ? styles.bubbleMine : [styles.bubbleOther, { backgroundColor: theme.cardBackground }]]}>
                    {!isMe && (
                        <Text style={[styles.senderName, { color: COLORS.primary }]}>{item.senderName || otherName}</Text>
                    )}
                    <Text style={[styles.bubbleText, { color: isMe ? '#FFF' : theme.text }]}>{item.text}</Text>
                    {item.created_at && (
                        <Text style={[styles.bubbleTime, { color: isMe ? 'rgba(255,255,255,0.6)' : theme.textSecondary }]}>
                            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    )}
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    {otherAvatar ? (
                        <Image source={{ uri: otherAvatar }} style={styles.headerAvatar} />
                    ) : (
                        <View style={[styles.headerAvatar, { backgroundColor: COLORS.primaryBg, justifyContent: 'center', alignItems: 'center' }]}>
                            <Text style={{ fontSize: 16, fontWeight: '800', color: COLORS.primary }}>{otherName.charAt(0)}</Text>
                        </View>
                    )}
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.headerName, { color: theme.text }]} numberOfLines={1}>{otherName}</Text>
                        <Text style={[styles.headerRole, { color: theme.textSecondary }]}>
                            {otherUser?.role === 'caregiver' ? 'Cuidador' : 'Dueño'}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Messages */}
            <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={item => item.id}
                renderItem={renderMessage}
                contentContainerStyle={styles.messagesList}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
                ListEmptyComponent={
                    <View style={styles.emptyChat}>
                        <Text style={{ fontSize: 44 }}>💬</Text>
                        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                            Empieza la conversación con {otherName}
                        </Text>
                    </View>
                }
            />

            {/* Input */}
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <View style={[styles.inputRow, { backgroundColor: theme.cardBackground, borderTopColor: theme.border }]}>
                    <TextInput
                        style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
                        value={input}
                        onChangeText={setInput}
                        placeholder="Escribe un mensaje..."
                        placeholderTextColor={theme.textSecondary}
                        multiline
                        maxLength={1000}
                    />
                    <TouchableOpacity
                        style={[styles.sendBtn, { backgroundColor: input.trim() ? COLORS.primary : theme.border }]}
                        onPress={sendMessage}
                        disabled={!input.trim()}
                    >
                        <Ionicons name="send" size={18} color="#FFF" />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 56 : 36, paddingHorizontal: 12, paddingBottom: 12,
        borderBottomWidth: 1,
    },
    backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
    headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 4, gap: 10 },
    headerAvatar: { width: 40, height: 40, borderRadius: 14 },
    headerName: { fontSize: 16, fontWeight: '800' },
    headerRole: { fontSize: 12, fontWeight: '600' },

    messagesList: { padding: 16, paddingBottom: 20, flexGrow: 1 },
    emptyChat: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
    emptyText: { fontSize: 14, marginTop: 10, textAlign: 'center' },

    msgWrap: { marginBottom: 8 },
    msgRight: { alignItems: 'flex-end' },
    msgLeft: { alignItems: 'flex-start' },
    bubble: { maxWidth: '80%', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
    bubbleMine: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
    bubbleOther: { borderBottomLeftRadius: 4 },
    senderName: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
    bubbleText: { fontSize: 15, lineHeight: 21 },
    bubbleTime: { fontSize: 10, marginTop: 4, textAlign: 'right' },

    inputRow: {
        flexDirection: 'row', alignItems: 'flex-end',
        paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1,
        paddingBottom: Platform.OS === 'ios' ? 30 : 10,
        gap: 8,
    },
    input: {
        flex: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
        fontSize: 15, maxHeight: 100,
    },
    sendBtn: {
        width: 42, height: 42, borderRadius: 21,
        justifyContent: 'center', alignItems: 'center',
    },
});
