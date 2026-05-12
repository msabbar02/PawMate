import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
    StyleSheet, View, Text, FlatList, Image, TouchableOpacity,
    ActivityIndicator, TextInput, Platform, RefreshControl, ScrollView,
} from 'react-native';
import Icon from '../components/Icon';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../config/supabase';
import { COLORS } from '../constants/colors';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';

export default function CaregiversScreen({ navigation }) {
    const { theme, isDarkMode } = useContext(ThemeContext);
    const { user, userData } = useContext(AuthContext);
    const { t } = useTranslation();
    const SERVICE_META = {
        walking: { icon: 'walk-outline', label: t('services.walking') },
        hotel: { icon: 'home-outline', label: t('services.hotel') },
    };
    
    const [caregivers, setCaregivers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterService, setFilterService] = useState('all'); // 'all' | 'walking' | 'hotel'
    const [filterSpecies, setFilterSpecies] = useState('all'); // 'all' | 'perro' | 'gato'
    const [filterVerified, setFilterVerified] = useState(false);

    const fetchCaregivers = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('role', 'caregiver')
                .neq('id', user?.id || '');
                
            if (error) throw error;
            setCaregivers(data || []);
        } catch (error) {
            console.error('Error fetching caregivers:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user?.id]);

    useEffect(() => { fetchCaregivers(); }, [fetchCaregivers]);

    const onRefresh = () => { setRefreshing(true); fetchCaregivers(); };

    const filteredCaregivers = caregivers.filter(cg => {
        const matchesSearch =
            (cg.fullName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
            (cg.firstName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
            (cg.city?.toLowerCase() || '').includes(searchQuery.toLowerCase());
        const matchesService = filterService === 'all' || (cg.serviceTypes || []).includes(filterService);
        // Match against both legacy Spanish and canonical English keys
        const legacyMap = { dog: 'perro', cat: 'gato', bird: 'ave' };
        const matchesSpecies = filterSpecies === 'all' ||
            (cg.acceptedSpecies || []).some(s => s === filterSpecies || s === legacyMap[filterSpecies]);
        const matchesVerified = !filterVerified || cg.verificationStatus === 'verified';
        return matchesSearch && matchesService && matchesSpecies && matchesVerified;
    });

    const handleMessage = async (caregiver) => {
        try {
            // Find or create conversation
            const { data: existing } = await supabase
                .from('conversations')
                .select('*')
                .eq('ownerId', user.id)
                .eq('caregiverId', caregiver.id)
                .limit(1);

            let conversation = existing?.[0];
            if (!conversation) {
                const { data: newConvo, error } = await supabase.from('conversations').insert({
                    ownerId: user.id,
                    caregiverId: caregiver.id,
                    ownerName: userData?.fullName || t('roles.owner'),
                    caregiverName: caregiver.fullName || t('roles.caregiver'),
                    ownerAvatar: userData?.avatar || null,
                    caregiverAvatar: caregiver.avatar || null,
                }).select().single();
                if (error) throw error;
                conversation = newConvo;
            }
            navigation.navigate('Chat', { conversation, otherUser: caregiver });
        } catch (e) {
            console.error('Error creating conversation:', e);
        }
    };

    const renderCaregiver = ({ item }) => {
        const hasPrice = item.price != null && item.price > 0;
        const services = item.serviceTypes || [];
        const species = item.acceptedSpecies || [];

        return (
            <TouchableOpacity 
                style={[styles.card, { backgroundColor: theme.cardBackground }]}
                onPress={() => navigation.navigate('CaregiverProfile', { caregiverId: item.id })}
                activeOpacity={0.8}
            >
                <View style={styles.cardContent}>
                    <View style={styles.avatarWrap}>
                        {item.avatar ? (
                            <Image source={{ uri: item.avatar }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, { backgroundColor: COLORS.primaryBg, justifyContent: 'center', alignItems: 'center' }]}>
                                <Text style={{ fontSize: 28 }}>{(item.fullName || 'C').charAt(0)}</Text>
                            </View>
                        )}
                        <View style={[styles.onlineBadge, { backgroundColor: item.isOnline ? '#22c55e' : '#9CA3AF' }]} />
                    </View>

                    <View style={styles.infoCol}>
                        <View style={styles.nameRow}>
                            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                                {item.fullName || item.firstName || t('roles.caregiver')}
                            </Text>
                            {item.verificationStatus === 'verified' && (
                                <View style={styles.verifiedTag}>
                                    <Icon name="shield-checkmark" size={12} color="#F5A623" />
                                </View>
                            )}
                        </View>
                        
                        {(item.rating > 0 || item.reviewCount > 0) && (
                            <View style={styles.ratingRow}>
                                <Icon name="star" size={14} color="#F5A623" />
                                <Text style={[styles.ratingText, { color: theme.text }]}>{item.rating?.toFixed(1) || '0.0'}</Text>
                                <Text style={styles.reviewText}>({item.reviewCount || 0} {t('caregivers.reviews')})</Text>
                            </View>
                        )}

                        {item.experience ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                                <Icon name="time-outline" size={12} color={theme.textSecondary} />
                                <Text style={[styles.cityText, { color: theme.textSecondary }]}>{item.experience}</Text>
                            </View>
                        ) : null}

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Icon name="location-outline" size={12} color={theme.textSecondary} />
                            <Text style={[styles.cityText, { color: theme.textSecondary }]} numberOfLines={1}>
                                {item.city || t('caregivers.noLocation')}
                            </Text>
                        </View>

                        {hasPrice && (
                            <View style={styles.priceRow}>
                                <Text style={styles.priceText}>{item.price}€</Text>
                                <Text style={[styles.priceUnit, { color: theme.textSecondary }]}>{t('caregivers.perHour')}</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Services chips */}
                {services.length > 0 && (
                    <View style={styles.servicesRow}>
                        {services.slice(0, 3).map(svc => (
                            <View key={svc} style={[styles.serviceChip, { backgroundColor: COLORS.primaryBg, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                                <Icon name={(SERVICE_META[svc] || {}).icon || 'paw'} size={11} color={COLORS.primary} />
                                <Text style={{ fontSize: 11, color: COLORS.primary, fontWeight: '700' }}>
                                    {(SERVICE_META[svc] || {}).label || svc}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Accepted species */}
                {species.length > 0 && (() => {
                    // Normalize and dedupe to avoid duplicates like 'perro'+'dog'
                    const normMap = { perro: 'dog', gato: 'cat', ave: 'bird', reptil: 'other' };
                    const norm = [...new Set(species.map(s => normMap[s] || s))];
                    const labelMap = {
                        dog: t('species.dogs'),
                        cat: t('species.cats'),
                        bird: t('species.birds'),
                        rabbit: 'Conejo',
                        other: 'Otros',
                    };
                    const iconMap = { dog: 'dog', cat: 'cat', bird: 'dove', rabbit: 'rabbit', other: 'paw' };
                    return (
                        <View style={[styles.servicesRow, { paddingTop: 0 }]}>
                            {norm.map(sp => (
                                <View key={sp} style={[styles.serviceChip, { backgroundColor: '#E0F2FE', flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                                    <Icon name={iconMap[sp] || 'paw'} size={11} color="#0891b2" />
                                    <Text style={{ fontSize: 11, color: '#0891b2', fontWeight: '700' }}>
                                        {labelMap[sp] || sp}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    );
                })()}

                <View style={[styles.cardActions, { borderTopColor: theme.border }]}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleMessage(item)}>
                        <Icon name="chatbubble-outline" size={17} color={theme.textSecondary} />
                        <Text style={[styles.actionText, { color: theme.textSecondary }]}>{t('caregivers.message')}</Text>
                    </TouchableOpacity>

                    <View style={[styles.actionDivider, { backgroundColor: theme.border }]} />

                    <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('CaregiverProfile', { caregiverId: item.id })}>
                        <Icon name="calendar-outline" size={17} color={COLORS.primary} />
                        <Text style={[styles.actionText, { color: COLORS.primary, fontWeight: '800' }]}>{t('caregivers.book')}</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar style={isDarkMode ? 'light' : 'dark'} />

            {/* Header & Search */}
            <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                <Text style={[styles.headerTitle, { color: theme.text }]}>{t('caregivers.title')}</Text>
                <Text style={[styles.headerSub, { color: theme.textSecondary }]}>{t('caregivers.subtitle')}</Text>

                <View style={[styles.searchBox, { backgroundColor: theme.background, borderColor: theme.border }]}>
                    <Icon name="search" size={20} color={theme.textSecondary} style={{ marginLeft: 15 }} />
                    <TextInput
                        style={[styles.searchInput, { color: theme.text }]}
                        placeholder={t('caregivers.searchPlaceholder')}
                        placeholderTextColor={COLORS.textLight}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        returnKeyType="search"
                    />
                </View>

                {/* ── FILTER CHIPS ── */}
                <View style={styles.filtersRow}>
                    {/* Service filter */}
                    {[
                        { key: 'all', label: 'Todos' },
                        { key: 'walking', label: ' ' + t('services.walking') },
                        { key: 'hotel', label: ' ' + t('services.hotel') },
                    ].map(f => (
                        <TouchableOpacity
                            key={f.key}
                            style={[styles.filterChip, filterService === f.key && styles.filterChipActive]}
                            onPress={() => setFilterService(f.key)}
                        >
                            <Text style={[styles.filterChipText, filterService === f.key && styles.filterChipTextActive]}>
                                {f.label}
                            </Text>
                        </TouchableOpacity>
                    ))}

                    <View style={styles.filterDivider} />

                    {/* Species filter */}
                    {[
                        { key: 'all', label: 'Todos', icon: 'paw' },
                        { key: 'dog', label: t('species.dogs'), icon: 'dog' },
                        { key: 'cat', label: t('species.cats'), icon: 'cat' },
                        { key: 'bird', label: t('species.birds'), icon: 'dove' },
                        { key: 'rabbit', label: 'Conejo', icon: 'rabbit' },
                    ].map(f => (
                        <TouchableOpacity
                            key={f.key}
                            style={[styles.filterChip, filterSpecies === f.key && styles.filterChipActive]}
                            onPress={() => setFilterSpecies(f.key)}
                        >
                            <Icon name={f.icon} size={12} color={filterSpecies === f.key ? '#fff' : '#F5A623'} style={{ marginRight: 3 }} />
                            <Text style={[styles.filterChipText, filterSpecies === f.key && styles.filterChipTextActive]}>
                                {f.label}
                            </Text>
                        </TouchableOpacity>
                    ))}

                    <View style={styles.filterDivider} />

                    {/* Verified filter */}
                    <TouchableOpacity
                        style={[styles.filterChip, filterVerified && styles.filterChipActive]}
                        onPress={() => setFilterVerified(v => !v)}
                    >
                        <Icon name="shield-checkmark" size={12} color={filterVerified ? '#fff' : '#F5A623'} style={{ marginRight: 3 }} />
                        <Text style={[styles.filterChipText, filterVerified && styles.filterChipTextActive]}>Verificados</Text>
                    </TouchableOpacity>
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
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
                    ListEmptyComponent={
                        <View style={styles.emptyBox}>
                            <Icon name="search-outline" size={60} color={COLORS.textLight} />
                            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>{t('caregivers.noCaregiversFound')}</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1 },
    headerTitle: { fontSize: 26, fontWeight: '800', marginBottom: 4, letterSpacing: -0.5 },
    headerSub: { fontSize: 14, marginBottom: 16 },
    searchBox: { flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: 14, borderWidth: 1.5 },
    searchInput: { flex: 1, height: '100%', paddingHorizontal: 12, fontSize: 15, fontWeight: '500' },
    filtersRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 10, paddingBottom: 4 },
    filterChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.05)', borderWidth: 1, borderColor: 'transparent' },
    filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    filterChipText: { fontSize: 12, fontWeight: '700', color: COLORS.textLight },
    filterChipTextActive: { color: '#fff' },
    filterDivider: { width: 1, height: 20, backgroundColor: 'rgba(0,0,0,0.1)', marginHorizontal: 2 },
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
    cityText: { fontSize: 13, marginBottom: 4 },
    priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 2 },
    priceText: { fontSize: 20, fontWeight: '800', color: COLORS.primary },
    priceUnit: { fontSize: 13, fontWeight: '600', marginLeft: 2 },
    servicesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 18, paddingBottom: 12 },
    serviceChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
    cardActions: { flexDirection: 'row', borderTopWidth: 1, alignItems: 'center' },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 13, gap: 6 },
    actionDivider: { width: 1, height: 20 },
    actionText: { fontSize: 14, fontWeight: '700' },
    emptyBox: { alignItems: 'center', marginTop: 50 },
    emptyText: { marginTop: 15, fontSize: 15 },
});
