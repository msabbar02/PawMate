import React, { useContext, useState, useEffect } from 'react';
import {
    StyleSheet, View, Text, Image, ScrollView,
    TouchableOpacity, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { supabase } from '../config/supabase';
import { COLORS } from '../constants/colors';

const SERVICE_LABELS = { walking: '🚶 Paseos', hotel: '🏨 Hotel', daycare: '☀️ Guardería' };
const TABS = ['General', 'Disponibilidad', 'Reseñas'];

export default function CaregiverProfileScreen({ route, navigation }) {
    const { caregiver } = route.params || {};
    const { theme, isDarkMode } = useContext(ThemeContext);
    const { user, userData } = useContext(AuthContext);

    const [pets, setPets] = useState([]);
    const [loadingPets, setLoadingPets] = useState(true);
    const [activeTab, setActiveTab] = useState(0);
    const [reviews, setReviews] = useState([]);

    useEffect(() => {
        if (!caregiver?.id) return;
        const fetchData = async () => {
            try {
                const [{ data: petsData }, { data: reviewsData }] = await Promise.all([
                    supabase.from('pets').select('*').eq('ownerId', caregiver.id),
                    supabase.from('reviews').select('*').eq('caregiverId', caregiver.id).order('created_at', { ascending: false }).limit(10),
                ]);
                setPets(petsData || []);
                setReviews(reviewsData || []);
            } catch (e) {
                console.error(e);
            } finally {
                setLoadingPets(false);
            }
        };
        fetchData();
    }, [caregiver?.id]);

    if (!caregiver) {
        return (
            <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: theme.text }}>Cuidador no encontrado</Text>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
                    <Text style={{ color: COLORS.primary }}>Volver</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const startChat = () => navigation.navigate('Messages');
    const makeReservation = () => navigation.navigate('Reservas');

    // ── Tab: General ──────────────────────────
    const renderGeneralTab = () => (
        <>
            {/* Stats row */}
            <View style={styles.statsRow}>
                {[
                    { label: 'Reseñas', value: caregiver.reviews || '0', icon: 'chatbubble-outline' },
                    { label: 'Experiencia', value: caregiver.experience || '1 año', icon: 'time-outline' },
                    { label: 'Clientes', value: caregiver.clients || '0', icon: 'people-outline' },
                ].map((s, i) => (
                    <View key={i} style={[styles.statCard, { backgroundColor: theme.cardBackground }]}>
                        <Ionicons name={s.icon} size={18} color={COLORS.primary} />
                        <Text style={[styles.statValue, { color: theme.text }]}>{s.value}</Text>
                        <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{s.label}</Text>
                    </View>
                ))}
            </View>

            {/* Services */}
            <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Servicios</Text>
                <View style={styles.serviceChips}>
                    {(caregiver.services || ['walking', 'daycare']).map(s => (
                        <View key={s} style={[styles.chip, { backgroundColor: COLORS.primaryBg }]}>
                            <Text style={[styles.chipText, { color: COLORS.primary }]}>{SERVICE_LABELS[s] || s}</Text>
                        </View>
                    ))}
                </View>
                <View style={[styles.priceTag, { backgroundColor: theme.background }]}>
                    <Ionicons name="pricetag" size={16} color={COLORS.primary} />
                    <Text style={[styles.priceText, { color: theme.text }]}>{caregiver.price || 15}€</Text>
                    <Text style={[styles.priceUnit, { color: theme.textSecondary }]}>/hora</Text>
                </View>
            </View>

            {/* About */}
            <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Sobre Mí</Text>
                <Text style={[styles.aboutText, { color: theme.textSecondary }]}>
                    {caregiver.bio || '¡Hola! Soy un gran amante de los animales. Cuidaré a tu mascota como si fuera la mía. Tengo experiencia con todo tipo de razas y tamaños.'}
                </Text>
            </View>

            {/* Pets */}
            <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Mascotas en PawMate</Text>
                {loadingPets ? (
                    <ActivityIndicator style={{ marginVertical: 20 }} color={COLORS.primary} />
                ) : pets.length > 0 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.petsScroll}>
                        {pets.map(pet => (
                            <View key={pet.id} style={[styles.petCard, { backgroundColor: theme.background }]}>
                                <Image source={{ uri: pet.image || 'https://via.placeholder.com/60' }} style={styles.petImage} />
                                <Text style={[styles.petName, { color: theme.text }]} numberOfLines={1}>{pet.name}</Text>
                                <Text style={styles.petSpecies}>{pet.species}</Text>
                            </View>
                        ))}
                    </ScrollView>
                ) : (
                    <Text style={[styles.emptyPets, { color: theme.textSecondary }]}>No tiene mascotas asociadas.</Text>
                )}
            </View>
        </>
    );

    // ── Tab: Disponibilidad ──────────────────
    const renderAvailabilityTab = () => {
        const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        const schedule = caregiver.schedule || {};
        return (
            <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Horario Semanal</Text>
                {days.map((day, i) => {
                    const daySchedule = schedule[day.toLowerCase()] || schedule[i];
                    const available = daySchedule?.available !== false;
                    return (
                        <View key={day} style={[styles.scheduleRow, { borderBottomColor: theme.border }]}>
                            <Text style={[styles.dayText, { color: theme.text }]}>{day}</Text>
                            {available ? (
                                <View style={styles.timeSlot}>
                                    <Ionicons name="time-outline" size={14} color={COLORS.primary} />
                                    <Text style={[styles.timeText, { color: theme.textSecondary }]}>
                                        {daySchedule?.from || '09:00'} - {daySchedule?.to || '18:00'}
                                    </Text>
                                </View>
                            ) : (
                                <Text style={styles.unavailableText}>No disponible</Text>
                            )}
                        </View>
                    );
                })}
                <View style={[styles.radiusInfo, { backgroundColor: theme.background }]}>
                    <Ionicons name="location" size={16} color={COLORS.primary} />
                    <Text style={[styles.radiusText, { color: theme.textSecondary }]}>
                        Radio de servicio: <Text style={{ fontWeight: '800', color: theme.text }}>{caregiver.serviceRadius || 5} km</Text>
                    </Text>
                </View>
            </View>
        );
    };

    // ── Tab: Reseñas ─────────────────────────
    const renderReviewsTab = () => (
        <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.reviewHeader}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>Reseñas</Text>
                <View style={styles.overallRating}>
                    <Ionicons name="star" size={18} color="#F5A623" />
                    <Text style={[styles.overallRatingText, { color: theme.text }]}>{caregiver.rating || '5.0'}</Text>
                </View>
            </View>
            {reviews.length > 0 ? reviews.map((r, i) => (
                <View key={i} style={[styles.reviewCard, { borderBottomColor: theme.border }]}>
                    <View style={styles.reviewTop}>
                        <View style={styles.reviewUser}>
                            <View style={[styles.reviewAvatar, { backgroundColor: COLORS.primaryBg }]}>
                                <Text style={{ color: COLORS.primary, fontWeight: '800' }}>{(r.userName || 'U').charAt(0)}</Text>
                            </View>
                            <View>
                                <Text style={[styles.reviewName, { color: theme.text }]}>{r.userName || 'Usuario'}</Text>
                                <Text style={[styles.reviewDate, { color: theme.textSecondary }]}>
                                    {r.created_at ? new Date(r.created_at).toLocaleDateString('es-ES') : ''}
                                </Text>
                            </View>
                        </View>
                        <View style={styles.reviewStars}>
                            {[1, 2, 3, 4, 5].map(s => (
                                <Ionicons key={s} name="star" size={14} color={s <= (r.rating || 5) ? '#F5A623' : '#E5E7EB'} />
                            ))}
                        </View>
                    </View>
                    <Text style={[styles.reviewComment, { color: theme.textSecondary }]}>{r.comment || ''}</Text>
                </View>
            )) : (
                <View style={styles.noReviews}>
                    <Ionicons name="chatbubble-outline" size={40} color={COLORS.textLight} />
                    <Text style={[styles.noReviewsText, { color: theme.textSecondary }]}>Aún no hay reseñas</Text>
                </View>
            )}
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar style={isDarkMode ? 'light' : 'dark'} />

            {/* Header */}
            <View style={[styles.headerBanner, { backgroundColor: COLORS.primaryBg }]}>
                <TouchableOpacity style={[styles.backBtn, { backgroundColor: theme.cardBackground }]} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={22} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerLabel, { color: COLORS.primary }]}>Perfil del Cuidador</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                
                {/* Profile card */}
                <View style={[styles.profileCard, { backgroundColor: theme.cardBackground }]}>
                    <View style={styles.avatarWrap}>
                        <Image source={{ uri: caregiver.avatar || 'https://via.placeholder.com/150' }} style={styles.avatar} />
                        <View style={[styles.onlineBadge, { backgroundColor: caregiver.isOnline ? '#22c55e' : '#9CA3AF' }]} />
                    </View>
                    
                    <View style={styles.profileInfo}>
                        <View style={styles.nameRow}>
                            <Text style={[styles.nameText, { color: theme.text }]} numberOfLines={1}>{caregiver.name || caregiver.fullName || 'Cuidador'}</Text>
                            {caregiver.isVerified && (
                                <View style={styles.verifiedBadge}>
                                    <Ionicons name="shield-checkmark" size={14} color="#F5A623" />
                                </View>
                            )}
                        </View>
                        
                        <View style={styles.ratingRow}>
                            <Ionicons name="star" size={15} color="#F5A623" />
                            <Text style={[styles.ratingText, { color: theme.text }]}>{caregiver.rating || '5.0'}</Text>
                            <Text style={[styles.ratingCount, { color: theme.textSecondary }]}>({caregiver.reviews || '0'} reseñas)</Text>
                        </View>

                        <View style={styles.locationRow}>
                            <Ionicons name="location-outline" size={14} color={theme.textSecondary} />
                            <Text style={[styles.locationText, { color: theme.textSecondary }]}>{caregiver.city || 'Sin ubicación'}</Text>
                        </View>
                    </View>
                </View>

                {/* CTA Buttons */}
                <View style={styles.actionRow}>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.cardBackground, borderWidth: 1.5, borderColor: COLORS.primary }]} onPress={startChat}>
                        <Ionicons name="chatbubble-outline" size={19} color={COLORS.primary} />
                        <Text style={[styles.actionBtnText, { color: COLORS.primary }]}>Mensaje</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: COLORS.primary }]} onPress={makeReservation}>
                        <Ionicons name="calendar-outline" size={19} color="#FFF" />
                        <Text style={[styles.actionBtnText, { color: '#FFF' }]}>Reservar</Text>
                    </TouchableOpacity>
                </View>

                {/* Tab selector */}
                <View style={[styles.tabBar, { backgroundColor: theme.cardBackground }]}>
                    {TABS.map((tab, i) => (
                        <TouchableOpacity
                            key={tab}
                            style={[styles.tab, activeTab === i && styles.tabActive]}
                            onPress={() => setActiveTab(i)}
                        >
                            <Text style={[styles.tabText, { color: activeTab === i ? COLORS.primary : theme.textSecondary }, activeTab === i && styles.tabTextActive]}>
                                {tab}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Tab content */}
                {activeTab === 0 && renderGeneralTab()}
                {activeTab === 1 && renderAvailabilityTab()}
                {activeTab === 2 && renderReviewsTab()}

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    headerBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 20, paddingBottom: 16 },
    backBtn: { width: 40, height: 40, borderRadius: 14, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3 },
    headerLabel: { fontSize: 17, fontWeight: '800' },
    scrollContent: { paddingBottom: 100 },

    // Profile card
    profileCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, padding: 20, borderRadius: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 3 },
    avatarWrap: { position: 'relative' },
    avatar: { width: 80, height: 80, borderRadius: 24, backgroundColor: '#F3F4F6' },
    onlineBadge: { position: 'absolute', bottom: 0, right: 0, width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: '#FFF' },
    profileInfo: { flex: 1, marginLeft: 16 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    nameText: { fontSize: 20, fontWeight: '800', flexShrink: 1 },
    verifiedBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFF3E0', justifyContent: 'center', alignItems: 'center' },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    ratingText: { fontSize: 15, fontWeight: '800' },
    ratingCount: { fontSize: 13, fontWeight: '500' },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    locationText: { fontSize: 13, fontWeight: '500' },

    // Actions
    actionRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 20 },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 50, borderRadius: 16, gap: 8, shadowColor: COLORS.primary, shadowOpacity: 0.15, shadowRadius: 8, elevation: 3 },
    actionBtnText: { fontSize: 15, fontWeight: '800' },

    // Tabs
    tabBar: { flexDirection: 'row', marginHorizontal: 20, borderRadius: 16, padding: 4, marginBottom: 16 },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
    tabActive: { backgroundColor: COLORS.primaryBg },
    tabText: { fontSize: 14, fontWeight: '600' },
    tabTextActive: { fontWeight: '800' },

    // Stats
    statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 16 },
    statCard: { flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    statValue: { fontSize: 18, fontWeight: '800', marginTop: 6 },
    statLabel: { fontSize: 12, fontWeight: '600', marginTop: 2 },

    // Sections
    section: { marginHorizontal: 20, borderRadius: 20, padding: 20, marginBottom: 16 },
    sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 14, letterSpacing: -0.3 },
    serviceChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
    chipText: { fontSize: 14, fontWeight: '700' },
    priceTag: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, padding: 14, borderRadius: 14 },
    priceText: { fontSize: 22, fontWeight: '800' },
    priceUnit: { fontSize: 14, fontWeight: '600' },
    aboutText: { fontSize: 15, lineHeight: 24 },
    petsScroll: { gap: 14, paddingRight: 10 },
    petCard: { width: 90, alignItems: 'center', paddingVertical: 12, borderRadius: 16 },
    petImage: { width: 64, height: 64, borderRadius: 20, marginBottom: 8, backgroundColor: '#F3F4F6' },
    petName: { fontSize: 13, fontWeight: '700', marginBottom: 2, textAlign: 'center' },
    petSpecies: { fontSize: 11, color: COLORS.textLight, textTransform: 'capitalize' },
    emptyPets: { fontSize: 14, fontStyle: 'italic', marginVertical: 10 },

    // Schedule
    scheduleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
    dayText: { fontSize: 15, fontWeight: '700' },
    timeSlot: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    timeText: { fontSize: 14, fontWeight: '600' },
    unavailableText: { fontSize: 14, color: '#9CA3AF', fontWeight: '600' },
    radiusInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, padding: 14, borderRadius: 14 },
    radiusText: { fontSize: 14, fontWeight: '600' },

    // Reviews
    reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    overallRating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    overallRatingText: { fontSize: 20, fontWeight: '800' },
    reviewCard: { paddingVertical: 16, borderBottomWidth: 1 },
    reviewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    reviewUser: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    reviewAvatar: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    reviewName: { fontSize: 14, fontWeight: '700' },
    reviewDate: { fontSize: 12, marginTop: 1 },
    reviewStars: { flexDirection: 'row', gap: 2 },
    reviewComment: { fontSize: 14, lineHeight: 22 },
    noReviews: { alignItems: 'center', paddingVertical: 30 },
    noReviewsText: { marginTop: 10, fontSize: 15, fontWeight: '600' },
});
