import React, { useState, useEffect, useContext } from 'react';
import {
    StyleSheet, View, Text, FlatList, Image, TouchableOpacity,
    ActivityIndicator, TextInput, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../config/supabase';
import { COLORS } from '../constants/colors';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';

export default function CaregiversScreen({ navigation }) {
    const { theme, isDarkMode } = useContext(ThemeContext);
    const { user } = useContext(AuthContext);
    
    const [caregivers, setCaregivers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchCaregivers();
    }, []);

    const fetchCaregivers = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('role', 'caregiver');
                
            if (error) throw error;
            setCaregivers(data || []);
        } catch (error) {
            console.error('Error fetching caregivers:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredCaregivers = caregivers.filter(cg =>
        (cg.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (cg.fullName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (cg.city?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    );

    const renderCaregiver = ({ item }) => (
        <TouchableOpacity 
            style={[styles.card, { backgroundColor: theme.cardBackground }]}
            onPress={() => navigation.navigate('CaregiverProfile', { caregiver: item })}
            activeOpacity={0.8}
        >
            <View style={styles.cardContent}>
                <View style={styles.avatarWrap}>
                    <Image source={{ uri: item.avatar || 'https://via.placeholder.com/100' }} style={styles.avatar} />
                    <View style={[styles.onlineBadge, { backgroundColor: item.isOnline ? '#22c55e' : '#9CA3AF' }]} />
                </View>

                <View style={styles.infoCol}>
                    <View style={styles.nameRow}>
                        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>{item.name || item.fullName || 'Cuidador'}</Text>
                        {item.isVerified && (
                            <View style={styles.verifiedTag}>
                                <Ionicons name="shield-checkmark" size={12} color="#F5A623" />
                            </View>
                        )}
                    </View>
                    
                    <View style={styles.ratingRow}>
                        <Ionicons name="star" size={14} color="#F5A623" />
                        <Text style={[styles.ratingText, { color: theme.text }]}>{item.rating || '5.0'}</Text>
                        <Text style={styles.reviewText}>({item.reviews || 0} reseñas)</Text>
                    </View>

                    <Text style={[styles.cityText, { color: theme.textSecondary }]} numberOfLines={1}>
                        <Ionicons name="location-outline" size={12} /> {item.city || 'Sin ubicación'}
                    </Text>

                    <View style={styles.priceRow}>
                        <Text style={styles.priceText}>{item.price || 15}€</Text>
                        <Text style={[styles.priceUnit, { color: theme.textSecondary }]}>/hora</Text>
                    </View>
                </View>
            </View>

            <View style={[styles.cardActions, { borderTopColor: theme.border }]}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Messages')}>
                    <Ionicons name="chatbubble-outline" size={17} color={theme.textSecondary} />
                    <Text style={[styles.actionText, { color: theme.textSecondary }]}>Mensaje</Text>
                </TouchableOpacity>

                <View style={[styles.actionDivider, { backgroundColor: theme.border }]} />

                <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Reservas')}>
                    <Ionicons name="calendar-outline" size={17} color={COLORS.primary} />
                    <Text style={[styles.actionText, { color: COLORS.primary, fontWeight: '800' }]}>Reservar</Text>
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar style={isDarkMode ? 'light' : 'dark'} />

            {/* Header & Search */}
            <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Cuidadores Certificados</Text>
                <Text style={[styles.headerSub, { color: theme.textSecondary }]}>Encuentra al mejor cuidador para tu mascota</Text>

                <View style={[styles.searchBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
                    <Ionicons name="search" size={20} color={theme.textSecondary} style={{ marginLeft: 15 }} />
                    <TextInput
                        style={[styles.searchInput, { color: theme.text }]}
                        placeholder="Buscar por nombre, o ciudad..."
                        placeholderTextColor={COLORS.textLight}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        returnKeyType="search"
                    />
                </View>
            </View>

            {loading ? (
                <View style={styles.centerBox}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : (
                <FlatList
                    data={filteredCaregivers}
                    keyExtractor={item => item.id}
                    renderItem={renderCaregiver}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyBox}>
                            <Ionicons name="search-outline" size={60} color={theme.textLight} />
                            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No se encontraron cuidadores.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 20, paddingBottom: 18, borderBottomWidth: 1 },
    headerTitle: { fontSize: 26, fontWeight: '800', marginBottom: 4, letterSpacing: -0.5 },
    headerSub: { fontSize: 14, marginBottom: 16 },
    searchBox: { flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: 14, borderWidth: 1.5 },
    searchInput: { flex: 1, height: '100%', paddingHorizontal: 12, fontSize: 15, fontWeight: '500' },
    centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { padding: 20, paddingBottom: 100 },
    card: { borderRadius: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 4 },
    cardContent: { flexDirection: 'row', padding: 18 },
    avatarWrap: { position: 'relative' },
    avatar: { width: 80, height: 80, borderRadius: 18, backgroundColor: '#F3F4F6' },
    onlineBadge: { position: 'absolute', bottom: 0, right: 0, width: 16, height: 16, borderRadius: 8, borderWidth: 2.5, borderColor: '#FFF' },
    infoCol: { flex: 1, marginLeft: 16, justifyContent: 'center' },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    name: { fontSize: 17, fontWeight: '800', flexShrink: 1 },
    verifiedTag: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF3E0', justifyContent: 'center', alignItems: 'center' },
    ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
    ratingText: { marginLeft: 4, fontSize: 14, fontWeight: '700' },
    reviewText: { marginLeft: 4, fontSize: 12, color: COLORS.textLight },
    cityText: { fontSize: 13, marginBottom: 6 },
    priceRow: { flexDirection: 'row', alignItems: 'baseline' },
    priceText: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
    priceUnit: { fontSize: 13, fontWeight: '600', marginLeft: 2 },
    cardActions: { flexDirection: 'row', borderTopWidth: 1, alignItems: 'center' },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 13, gap: 6 },
    actionDivider: { width: 1, height: 20 },
    actionText: { fontSize: 14, fontWeight: '700' },
    emptyBox: { alignItems: 'center', marginTop: 50 },
    emptyText: { marginTop: 15, fontSize: 15 },
});
