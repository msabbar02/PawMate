import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { db } from '../config/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

const SearchCaregiversScreen = ({ navigation }) => {
    const { theme } = useContext(ThemeContext);
    const { user } = useContext(AuthContext);
    const styles = getStyles(theme);

    const [caregivers, setCaregivers] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [searchText, setSearchText] = useState('');
    const [filterStatus, setFilterStatus] = useState('All'); // 'All', 'Online', 'Offline'
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(
            collection(db, 'users'),
            where('role', '==', 'caregiver')
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = [];
            snapshot.forEach((docSnap) => {
                if (docSnap.id !== user?.uid) {
                    list.push({ id: docSnap.id, ...docSnap.data() });
                }
            });
            setCaregivers(list);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [user?.uid]);

    useEffect(() => {
        let result = caregivers;

        // Apply Status Filter
        if (filterStatus === 'Online') {
            result = result.filter(c => c.isOnline);
        } else if (filterStatus === 'Offline') {
            result = result.filter(c => !c.isOnline);
        }

        // Apply Text Search
        if (searchText.trim()) {
            const lower = searchText.toLowerCase();
            result = result.filter(c => {
                const name = (c.name || '') + ' ' + (c.surname || '');
                return name.toLowerCase().includes(lower) || (c.email || '').toLowerCase().includes(lower);
            });
        }

        setFiltered(result);
    }, [caregivers, searchText, filterStatus]);

    const openProfile = (caregiver) => {
        navigation.navigate('UserProfile', { userId: caregiver.id });
    };

    const openChat = (caregiver) => {
        const name = [caregiver.name, caregiver.surname].filter(Boolean).join(' ') || 'Cuidador';
        navigation.navigate('ChatScreen', { recipientId: caregiver.id, recipientName: name });
    };

    const openReserva = (caregiver) => {
        const name = [caregiver.name, caregiver.surname].filter(Boolean).join(' ') || 'Cuidador';
        navigation.navigate('BookingRequest', { caregiverId: caregiver.id, caregiverName: name });
    };

    const renderItem = ({ item }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => openProfile(item)}
            activeOpacity={0.8}
        >
            <Image
                source={{ uri: item.avatar || 'https://via.placeholder.com/80' }}
                style={styles.avatar}
            />
            <View style={styles.cardContent}>
                <Text style={styles.name}>{item.name} {item.surname}</Text>
                <View style={styles.statusRow}>
                    <View style={[styles.statusDot, item.isOnline && styles.statusDotOnline]} />
                    <Text style={styles.statusText}>{item.isOnline ? 'Disponible' : 'No disponible'}</Text>
                </View>
                <View style={styles.actions}>
                    <TouchableOpacity style={styles.profileBtn} onPress={() => openProfile(item)}>
                        <Text style={styles.profileBtnText}>Ver perfil</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.reservaBtn} onPress={() => openReserva(item)}>
                        <Ionicons name="calendar-outline" size={18} color="#FFF" />
                        <Text style={styles.reservaBtnText}>Reserva</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.chatBtn} onPress={() => openChat(item)}>
                        <Ionicons name="chatbubble-outline" size={18} color="#FFF" />
                        <Text style={styles.chatBtnText}>Chat</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Buscar cuidadores</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.searchWrap}>
                <Ionicons name="search" size={20} color={theme.textSecondary} style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Nombre o email..."
                    placeholderTextColor={theme.textSecondary}
                    value={searchText}
                    onChangeText={setSearchText}
                />
            </View>

            {/* Filter Chips */}
            <View style={styles.filtersContainer}>
                <TouchableOpacity
                    style={[styles.filterChip, filterStatus === 'All' && styles.filterChipActive]}
                    onPress={() => setFilterStatus('All')}
                >
                    <Text style={[styles.filterText, filterStatus === 'All' && styles.filterTextActive]}>Todos</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.filterChip, filterStatus === 'Online' && styles.filterChipActive]}
                    onPress={() => setFilterStatus('Online')}
                >
                    <Text style={[styles.filterText, filterStatus === 'Online' && styles.filterTextActive]}>Conectados</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.filterChip, filterStatus === 'Offline' && styles.filterChipActive]}
                    onPress={() => setFilterStatus('Offline')}
                >
                    <Text style={[styles.filterText, filterStatus === 'Offline' && styles.filterTextActive]}>Desconectados</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.centered}><ActivityIndicator size="large" color={theme.primary} /></View>
            ) : filtered.length === 0 ? (
                <View style={styles.centered}>
                    <Ionicons name="people-outline" size={64} color={theme.border} />
                    <Text style={styles.emptyText}>No hay cuidadores que coincidan.</Text>
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </View>
    );
};

const getStyles = (theme) => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 50,
        paddingHorizontal: 20,
        paddingBottom: 15,
        backgroundColor: theme.background,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
    },
    backBtn: { padding: 5 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: theme.text },
    searchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.cardBackground,
        marginHorizontal: 20,
        marginTop: 15,
        marginBottom: 10,
        paddingHorizontal: 15,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.border,
    },
    searchIcon: { marginRight: 10 },
    searchInput: { flex: 1, paddingVertical: 14, fontSize: 16, color: theme.text },
    filtersContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginBottom: 10,
    },
    filterChip: {
        backgroundColor: theme.cardBackground,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginRight: 10,
        borderWidth: 1,
        borderColor: theme.border,
    },
    filterChipActive: {
        backgroundColor: theme.primary,
        borderColor: theme.primary,
    },
    filterText: {
        color: theme.textSecondary,
        fontSize: 14,
        fontWeight: '500',
    },
    filterTextActive: {
        color: '#fff',
        fontWeight: 'bold',
    },
    list: { padding: 20, paddingBottom: 40 },
    card: {
        flexDirection: 'row',
        backgroundColor: theme.cardBackground,
        borderRadius: 15,
        padding: 15,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: theme.border,
    },
    avatar: { width: 60, height: 60, borderRadius: 30, marginRight: 15 },
    cardContent: { flex: 1 },
    name: { fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 6 },
    statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.border, marginRight: 6 },
    statusDotOnline: { backgroundColor: '#4caf50' },
    statusText: { fontSize: 14, color: theme.textSecondary },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    profileBtn: { backgroundColor: theme.background, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: theme.border },
    profileBtnText: { fontSize: 13, fontWeight: '600', color: theme.primary },
    reservaBtn: { backgroundColor: '#FF9800', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 4 },
    reservaBtnText: { fontSize: 13, fontWeight: '600', color: '#FFF' },
    chatBtn: { backgroundColor: theme.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 4 },
    chatBtnText: { fontSize: 13, fontWeight: '600', color: '#FFF' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    emptyText: { marginTop: 15, fontSize: 16, color: theme.textSecondary, textAlign: 'center' },
});

export default SearchCaregiversScreen;
