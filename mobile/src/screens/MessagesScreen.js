import React, { useContext, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, Platform, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { supabase } from '../config/supabase';
import { COLORS } from '../constants/colors';

export default function MessagesScreen({ navigation }) {
    const { theme } = useContext(ThemeContext);
    const { user, userData } = useContext(AuthContext);
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const isCaregiver = userData?.role === 'caregiver';

    const fetchConversations = useCallback(async () => {
        if (!user?.id) return;
        try {
            const field = isCaregiver ? 'caregiverId' : 'ownerId';
            const { data, error } = await supabase
                .from('conversations')
                .select('*')
                .eq(field, user.id)
                .order('lastMessageAt', { ascending: false });
            if (!error) setConversations(data || []);
        } catch (e) {
            console.error('Error fetching conversations:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user?.id, isCaregiver]);

    useEffect(() => {
        fetchConversations();

        if (!user?.id) return;
        const field = isCaregiver ? 'caregiverId' : 'ownerId';
        const channel = supabase.channel('convos_list')
            .on('postgres_changes', {
                event: '*', schema: 'public', table: 'conversations',
                filter: `${field}=eq.${user.id}`,
            }, fetchConversations)
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [fetchConversations, user?.id, isCaregiver]);

    const onRefresh = () => { setRefreshing(true); fetchConversations(); };

    const renderConversation = ({ item }) => {
        const name = isCaregiver ? item.ownerName : item.caregiverName;
        const avatar = isCaregiver ? item.ownerAvatar : item.caregiverAvatar;
        const otherUserId = isCaregiver ? item.ownerId : item.caregiverId;
        const timeAgo = item.lastMessageAt
            ? new Date(item.lastMessageAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
            : '';

        return (
            <TouchableOpacity
                style={[styles.convoRow, { backgroundColor: theme.cardBackground }]}
                onPress={() => navigation.navigate('Chat', {
                    conversation: item,
                    otherUser: {
                        id: otherUserId,
                        fullName: name,
                        avatar,
                        role: isCaregiver ? 'owner' : 'caregiver',
                    },
                })}
                activeOpacity={0.8}
            >
                {avatar ? (
                    <Image source={{ uri: avatar }} style={styles.convoAvatar} />
                ) : (
                    <View style={[styles.convoAvatar, { backgroundColor: COLORS.primaryBg, justifyContent: 'center', alignItems: 'center' }]}>
                        <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.primary }}>{(name || 'U').charAt(0)}</Text>
                    </View>
                )}
                <View style={{ flex: 1, marginLeft: 14 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={[styles.convoName, { color: theme.text }]} numberOfLines={1}>{name || 'Usuario'}</Text>
                        <Text style={[styles.convoTime, { color: theme.textSecondary }]}>{timeAgo}</Text>
                    </View>
                    <Text style={[styles.convoMsg, { color: theme.textSecondary }]} numberOfLines={1}>
                        {item.lastMessage || 'Toca para empezar a chatear'}
                    </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} style={{ marginLeft: 8 }} />
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={26} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: theme.text }]}>Mensajes</Text>
            </View>

            <FlatList
                data={conversations}
                keyExtractor={item => item.id}
                renderItem={renderConversation}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
                ListEmptyComponent={
                    <View style={styles.emptyBox}>
                        <Ionicons name="chatbubbles-outline" size={64} color={COLORS.textLight} />
                        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                            {loading ? 'Cargando...' : 'No tienes mensajes recientes'}
                        </Text>
                        <Text style={[styles.emptySub, { color: COLORS.textLight }]}>
                            Cuando contactes a un cuidador, aparecerán aquí.
                        </Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 16, borderBottomWidth: 1,
    },
    backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
    title: { fontSize: 24, fontWeight: '800' },
    listContent: { padding: 16, paddingBottom: 100, flexGrow: 1 },
    convoRow: {
        flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 18, marginBottom: 10,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
    },
    convoAvatar: { width: 50, height: 50, borderRadius: 16 },
    convoName: { fontSize: 16, fontWeight: '800', flex: 1, marginRight: 8 },
    convoTime: { fontSize: 12, fontWeight: '600' },
    convoMsg: { fontSize: 13, marginTop: 3 },
    emptyBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    emptyText: { fontSize: 18, fontWeight: '700', marginTop: 15 },
    emptySub: { fontSize: 14, textAlign: 'center', marginTop: 8 },
});
