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
        <View style={[styles.card, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.cardContent}>
                <TouchableOpacity 
                    style={styles.avatarWrap} 
                    onPress={() => navigation.navigate('CaregiverProfile', { caregiver: item })}
                >
                    <Image source={{ uri: item.avatar || 'https://via.placeholder.com/100' }} style={styles.avatar} />
                    <View style={[styles.onlineBadge, { backgroundColor: item.isOnline ? '#22c55e' : '#ef4444' }]} />
                </TouchableOpacity>

                <View style={styles.infoCol}>
                    <Text style={[styles.name, { color: theme.text }]}>{item.name || item.fullName || 'Cuidador'}</Text>
                    
                    <View style={styles.ratingRow}>
                        <Ionicons name="star" size={14} color={COLORS.warning} />
                        <Text style={[styles.ratingText, { color: theme.textSecondary }]}>{item.rating || '5.0'} / 5.0</Text>
                        <Text style={styles.reviewText}>({item.reviews || 0})</Text>
                    </View>

                    <Text style={[styles.cityText, { color: theme.textSecondary }]} numberOfLines={1}>
                        <Ionicons name="location-outline" size={12} /> {item.city || 'Ubicación no especificada'}
                    </Text>

                    <Text style={[styles.priceText, { color: COLORS.primary }]}>{item.price || 15}€<Text style={{ fontSize: 13, color: theme.textSecondary }}>/h</Text></Text>
                </View>
            </View>

            <View style={[styles.cardActions, { borderTopColor: theme.border }]}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('CaregiverProfile', { caregiver: item })}>
                    <Ionicons name="person-outline" size={18} color={theme.textSecondary} />
                    <Text style={[styles.actionText, { color: theme.textSecondary }]}>Ver Perfil</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Reservas')}>
                    <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
                    <Text style={[styles.actionText, { color: COLORS.primary, fontWeight: '700' }]}>Reservar</Text>
                </TouchableOpacity>
            </View>
        </View>
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
    header: { paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 20, paddingBottom: 15, borderBottomWidth: 1 },
    headerTitle: { fontSize: 24, fontWeight: '900', marginBottom: 4 },
    headerSub: { fontSize: 14, marginBottom: 15 },
    searchBox: { flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: 14, borderWidth: 1 },
    searchInput: { flex: 1, height: '100%', paddingHorizontal: 10, fontSize: 15 },
    centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { padding: 20, paddingBottom: 100 },
    card: { borderRadius: 18, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 4 },
    cardContent: { flexDirection: 'row', padding: 16 },
    avatarWrap: { position: 'relative' },
    avatar: { width: 90, height: 90, borderRadius: 20, backgroundColor: '#eee' },
    onlineBadge: { position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#FFF' },
    infoCol: { flex: 1, marginLeft: 16, justifyContent: 'center' },
    name: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
    ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    ratingText: { marginLeft: 4, fontSize: 13, fontWeight: '600' },
    reviewText: { marginLeft: 4, fontSize: 12, color: COLORS.textLight },
    cityText: { fontSize: 13, marginBottom: 6 },
    priceText: { fontSize: 18, fontWeight: '800' },
    cardActions: { flexDirection: 'row', borderTopWidth: 1 },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 6 },
    actionText: { fontSize: 14, fontWeight: '600' },
    emptyBox: { alignItems: 'center', marginTop: 50 },
    emptyText: { marginTop: 15, fontSize: 15 },
});
