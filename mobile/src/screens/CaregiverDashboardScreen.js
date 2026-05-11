import React, { useState, useContext, useEffect, useCallback } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity, ScrollView,
    Image, Alert, ActivityIndicator, Platform, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { supabase } from '../config/supabase';
import { createNotification } from '../utils/notificationHelpers';
import { uploadGalleryPhoto } from '../utils/storageHelpers';
import { COLORS } from '../constants/colors';

// ── Badge tiers ──────────────────────────────────────────────
const BADGE_TIERS = [
    { min: 0,  label: 'Bronce',   emoji: '', color: '#CD7F32', bg: '#FDF2E9' },
    { min: 5,  label: 'Plata',    emoji: '', color: '#9CA3AF', bg: '#F3F4F6' },
    { min: 20, label: 'Oro',      emoji: '', color: '#F5A623', bg: '#FEF3C7' },
    { min: 50, label: 'Platino',  emoji: '', color: '#0ea5e9', bg: '#E0F2FE' },
    { min: 100,label: 'Leyenda',  emoji: '', color: '#8B5CF6', bg: '#EDE9FE' },
];

function getBadge(completedCount) {
    let badge = BADGE_TIERS[0];
    for (const tier of BADGE_TIERS) {
        if (completedCount >= tier.min) badge = tier;
    }
    return badge;
}

function getNextBadge(completedCount) {
    for (const tier of BADGE_TIERS) {
        if (completedCount < tier.min) return tier;
    }
    return null;
}

const SERVICE_LABELS = { walking: 'Paseo', hotel: 'Hotel' };

export default function CaregiverDashboardScreen({ navigation }) {
    const { user, userData, refreshUserData, updateUserOptimistic } = useContext(AuthContext);
    const { theme, isDarkMode } = useContext(ThemeContext);

    const [stats, setStats] = useState({ completed: 0, active: 0, pending: 0, earnings: 0 });
    const [reviews, setReviews] = useState([]);
    const [activeReservations, setActiveReservations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [photos, setPhotos] = useState(userData?.galleryPhotos || []);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);

    const fetchData = useCallback(async () => {
        if (!user?.id) return;
        try {
            const [
                { count: completed },
                { count: active },
                { count: pending },
                { data: completedData },
                { data: reviewsData },
                { data: activeData },
            ] = await Promise.all([
                supabase.from('reservations').select('*', { count: 'exact', head: true }).eq('caregiverId', user.id).eq('status', 'completada'),
                supabase.from('reservations').select('*', { count: 'exact', head: true }).eq('caregiverId', user.id).eq('status', 'activa'),
                supabase.from('reservations').select('*', { count: 'exact', head: true }).eq('caregiverId', user.id).eq('status', 'pendiente'),
                supabase.from('reservations').select('totalPrice').eq('caregiverId', user.id).eq('status', 'completada'),
                supabase.from('reviews').select('*').eq('revieweeId', user.id).order('created_at', { ascending: false }).limit(5),
                supabase.from('reservations').select('*').eq('caregiverId', user.id).in('status', ['activa', 'aceptada']).order('created_at', { ascending: false }).limit(5),
            ]);

            const earnings = (completedData || []).reduce((sum, r) => sum + (r.totalPrice || 0), 0);
            setStats({ completed: completed || 0, active: active || 0, pending: pending || 0, earnings });
            setReviews(reviewsData || []);
            setActiveReservations(activeData || []);
        } catch (e) {
            console.error('CaregiverDashboard fetch error:', e);
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Realtime updates
    useEffect(() => {
        if (!user?.id) return;
        const channel = supabase.channel(`cg_dashboard_${Date.now()}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations', filter: `caregiverId=eq.${user.id}` }, () => fetchData())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [user?.id, fetchData]);

    const badge = getBadge(stats.completed);
    const nextBadge = getNextBadge(stats.completed);
    const progressToNext = nextBadge ? ((stats.completed - (badge.min)) / (nextBadge.min - badge.min)) * 100 : 100;

    // Photo gallery sync
    useEffect(() => {
        if (userData?.galleryPhotos) setPhotos(userData.galleryPhotos);
    }, [userData?.galleryPhotos]);

    const handleAddPhoto = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') { Alert.alert('Permiso necesario', 'Necesitamos acceso a la galería.'); return; }
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.7,
            });
            if (result.canceled) return;
            setUploadingPhoto(true);
            const asset = result.assets[0];
            const photoUrl = await uploadGalleryPhoto(asset.uri, user.id);
            const updatedPhotos = [...photos, photoUrl].slice(0, 6); // max 6 photos
            await supabase.from('users').update({ galleryPhotos: updatedPhotos }).eq('id', user.id);
            setPhotos(updatedPhotos);
            if (refreshUserData) refreshUserData();
            Alert.alert('Foto guardada', 'La foto se ha añadido a tu galería correctamente.');
        } catch (e) {
            Alert.alert('Error', 'No se pudo subir la foto.');
        } finally {
            setUploadingPhoto(false);
        }
    };

    const handleRemovePhoto = (index) => {
        Alert.alert('Eliminar foto', '¿Eliminar esta foto de tu galería?', [
            { text: 'No', style: 'cancel' },
            { text: 'Eliminar', style: 'destructive', onPress: async () => {
                const updatedPhotos = photos.filter((_, i) => i !== index);
                await supabase.from('users').update({ galleryPhotos: updatedPhotos }).eq('id', user.id);
                setPhotos(updatedPhotos);
                if (refreshUserData) refreshUserData();
            }},
        ]);
    };

    const handleToggleOnline = async () => {
        const newVal = !userData?.isOnline;
        try {
            // Optimistic UI update — change locally immediately
            updateUserOptimistic({ isOnline: newVal });
            const update = { isOnline: newVal };
            if (newVal) {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                    const loc = await Location.getCurrentPositionAsync({});
                    update.latitude = loc.coords.latitude;
                    update.longitude = loc.coords.longitude;
                }
            }
            const { error } = await supabase.from('users').update(update).eq('id', user.id);
            if (error) throw error;
        } catch (e) {
            // Revert on error
            updateUserOptimistic({ isOnline: !newVal });
            Alert.alert('Error', 'No se pudo cambiar el estado online.');
        }
    };

    // Emergency: send location to all active booking owners
    const handleEmergency = async () => {
        Alert.alert(
            'Emergencia',
            'Se enviará tu ubicación exacta a todos los dueños con reserva activa. ¿Continuar?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Enviar', style: 'destructive', onPress: async () => {
                        try {
                            const { status } = await Location.requestForegroundPermissionsAsync();
                            if (status !== 'granted') { Alert.alert('Error', 'Se necesita permiso de ubicación.'); return; }
                            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
                            const { latitude, longitude } = loc.coords;

                            // Update caregiver location
                            await supabase.from('users').update({ latitude, longitude }).eq('id', user.id);

                            // Notify all active reservation owners
                            for (const res of activeReservations) {
                                if (res.ownerId) {
                                    await createNotification(res.ownerId, {
                                        type: 'emergency_location',
                                        title: 'Alerta del cuidador',
                                        body: `${userData?.fullName || 'El cuidador'} ha enviado una alerta de emergencia. Toca para ver su ubicación.`,
                                        icon: 'warning-outline',
                                        iconBg: '#FEE2E2',
                                        iconColor: '#EF4444',
                                        latitude: String(latitude),
                                        longitude: String(longitude),
                                    });
                                }
                            }
                            Alert.alert('Enviado', 'Los dueños han recibido tu ubicación.');
                        } catch (e) {
                            Alert.alert('Error', 'No se pudo enviar la ubicación.');
                        }
                    }
                },
            ]
        );
    };

    const avatar = userData?.avatar || userData?.photoURL;

    if (loading) {
        return (
            <View style={[s.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    return (
        <View style={[s.container, { backgroundColor: theme.background }]}>
            <StatusBar style={isDarkMode ? 'light' : 'dark'} />

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

                {/* ── HEADER CARD ── */}
                <View style={[s.heroCard, { backgroundColor: COLORS.primary }]}>
                    <View style={s.heroTop}>
                        <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
                            {avatar ? (
                                <Image source={{ uri: avatar }} style={s.heroAvatar} />
                            ) : (
                                <View style={[s.heroAvatar, { backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' }]}>
                                    <Ionicons name="person" size={28} color="#FFF" />
                                </View>
                            )}
                        </TouchableOpacity>
                        <View style={{ flex: 1, marginLeft: 14 }}>
                            <Text style={s.heroName}>{userData?.fullName || 'Cuidador'}</Text>
                            <View style={s.heroRatingRow}>
                                <Ionicons name="star" size={14} color="#FFC107" />
                                <Text style={s.heroRating}>{userData?.rating?.toFixed(1) || '0.0'}</Text>
                                <Text style={s.heroReviews}>({userData?.reviewCount || 0} reseñas)</Text>
                            </View>
                        </View>
                        {/* Badge */}
                        <View style={[s.badgeChip, { backgroundColor: badge.bg }]}>
                            <Text style={{ fontSize: 18 }}>{badge.emoji}</Text>
                            <Text style={[s.badgeLabel, { color: badge.color }]}>{badge.label}</Text>
                        </View>
                    </View>

                    {/* Online toggle */}
                    <TouchableOpacity
                        style={[s.onlineBtn, { backgroundColor: userData?.isOnline ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)' }]}
                        onPress={handleToggleOnline}
                    >
                        <View style={[s.onlineDot, { backgroundColor: userData?.isOnline ? '#22c55e' : '#9CA3AF' }]} />
                        <Text style={s.onlineBtnText}>
                            {userData?.isOnline ? 'Online — Visible en el mapa' : 'Offline — No visible'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* ── STATS ROW ── */}
                <View style={s.statsRow}>
                    {[
                        { icon: 'checkmark-done', value: stats.completed, label: 'Completados', color: '#16A34A' },
                        { icon: 'flash', value: stats.active, label: 'Activos', color: '#0ea5e9' },
                        { icon: 'time', value: stats.pending, label: 'Pendientes', color: '#F5A623' },
                        { icon: 'card', value: `€${stats.earnings.toFixed(0)}`, label: 'Ganado', color: '#8B5CF6' },
                    ].map((st, i) => (
                        <View key={i} style={[s.statCard, { backgroundColor: theme.cardBackground }]}>
                            <View style={[s.statIcon, { backgroundColor: st.color + '15' }]}>
                                <Ionicons name={st.icon} size={18} color={st.color} />
                            </View>
                            <Text style={[s.statValue, { color: theme.text }]}>{st.value}</Text>
                            <Text style={[s.statLabel, { color: theme.textSecondary }]}>{st.label}</Text>
                        </View>
                    ))}
                </View>

                {/* ── BADGE PROGRESS ── */}
                <View style={[s.section, { backgroundColor: theme.cardBackground }]}>
                    <View style={s.sectionHeader}>
                        <Text style={{ fontSize: 22 }}>{badge.emoji}</Text>
                        <Text style={[s.sectionTitle, { color: theme.text }]}>Cuidador {badge.label}</Text>
                    </View>
                    {nextBadge ? (
                        <>
                            <View style={s.progressRow}>
                                <Text style={[s.progressText, { color: theme.textSecondary }]}>
                                    {stats.completed} / {nextBadge.min} servicios para {nextBadge.emoji} {nextBadge.label}
                                </Text>
                            </View>
                            <View style={[s.progressTrack, { backgroundColor: theme.border }]}>
                                <View style={[s.progressFill, { width: `${Math.min(progressToNext, 100)}%`, backgroundColor: badge.color }]} />
                            </View>
                        </>
                    ) : (
                        <Text style={[s.progressText, { color: badge.color, fontWeight: '800', marginTop: 8 }]}>
                            ¡Has alcanzado el nivel máximo!
                        </Text>
                    )}
                </View>

                {/* ── QUICK ACTIONS ── */}
                <View style={s.actionsRow}>
                    <TouchableOpacity
                        style={[s.actionBtn, { backgroundColor: theme.cardBackground }]}
                        onPress={() => navigation.navigate('CaregiverSetup')}
                    >
                        <View style={[s.actionIconBox, { backgroundColor: COLORS.primaryBg }]}>
                            <Ionicons name="settings-outline" size={22} color={COLORS.primary} />
                        </View>
                        <Text style={[s.actionBtnText, { color: theme.text }]}>Editar Perfil</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[s.actionBtn, { backgroundColor: theme.cardBackground }]}
                        onPress={() => navigation.navigate('Reservas')}
                    >
                        <View style={[s.actionIconBox, { backgroundColor: '#FEF3C7' }]}>
                            <Ionicons name="calendar-outline" size={22} color="#F5A623" />
                        </View>
                        <Text style={[s.actionBtnText, { color: theme.text }]}>Reservas</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[s.actionBtn, { backgroundColor: theme.cardBackground }]}
                        onPress={handleEmergency}
                    >
                        <View style={[s.actionIconBox, { backgroundColor: '#FEE2E2' }]}>
                            <Ionicons name="warning-outline" size={22} color="#EF4444" />
                        </View>
                        <Text style={[s.actionBtnText, { color: theme.text }]}>Emergencia</Text>
                    </TouchableOpacity>
                </View>

                {/* ── ACTIVE RESERVATIONS ── */}
                {activeReservations.length > 0 && (
                    <View style={[s.section, { backgroundColor: theme.cardBackground }]}>
                        <View style={s.sectionHeader}>
                            <Ionicons name="flash-outline" size={20} color={COLORS.primary} />
                            <Text style={[s.sectionTitle, { color: theme.text }]}>Reservas Activas</Text>
                        </View>
                        {activeReservations.map(res => (
                            <TouchableOpacity
                                key={res.id}
                                style={[s.activeResCard, { borderColor: theme.border }]}
                                onPress={() => navigation.navigate('Reservas')}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text style={[s.activeResName, { color: theme.text }]}>{res.ownerName}</Text>
                                    <Text style={[s.activeResSub, { color: theme.textSecondary }]}>
                                        {SERVICE_LABELS[res.serviceType] || res.serviceType} · {res.startDate}
                                    </Text>
                                </View>
                                <View style={[s.activeResStatus, { backgroundColor: res.status === 'activa' ? '#DCFCE7' : '#FEF3C7' }]}>
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: res.status === 'activa' ? '#16A34A' : '#D97706' }}>
                                        {res.status === 'activa' ? 'Activa' : 'Aceptada'}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* ── REVIEWS ── */}
                <View style={[s.section, { backgroundColor: theme.cardBackground }]}>
                    <View style={s.sectionHeader}>
                        <Ionicons name="star-outline" size={20} color="#F5A623" />
                        <Text style={[s.sectionTitle, { color: theme.text }]}>Últimas Reseñas</Text>
                        {userData?.rating > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 'auto', gap: 4 }}>
                                <Ionicons name="star" size={16} color="#F5A623" />
                                <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>{userData.rating.toFixed(1)}</Text>
                            </View>
                        )}
                    </View>
                    {reviews.length > 0 ? reviews.map((r, i) => (
                        <View key={r.id || i} style={[s.reviewCard, { borderBottomColor: theme.border }]}>
                            <View style={s.reviewTop}>
                                <View style={[s.reviewAvatar, { backgroundColor: COLORS.primaryBg }]}>
                                    <Text style={{ color: COLORS.primary, fontWeight: '800', fontSize: 14 }}>
                                        {(r.reviewerName || 'U').charAt(0)}
                                    </Text>
                                </View>
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                    <Text style={[s.reviewName, { color: theme.text }]}>{r.reviewerName || 'Usuario'}</Text>
                                    <Text style={{ fontSize: 11, color: theme.textSecondary }}>
                                        {r.created_at ? new Date(r.created_at).toLocaleDateString('es-ES') : ''}
                                    </Text>
                                </View>
                                <View style={{ flexDirection: 'row', gap: 2 }}>
                                    {[1,2,3,4,5].map(star => (
                                        <Ionicons key={star} name="star" size={12} color={star <= (r.rating || 5) ? '#F5A623' : '#E5E7EB'} />
                                    ))}
                                </View>
                            </View>
                            {r.comment ? <Text style={[s.reviewComment, { color: theme.textSecondary }]}>{r.comment}</Text> : null}
                        </View>
                    )) : (
                        <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                            <Ionicons name="chatbubble-outline" size={32} color={theme.textSecondary} />
                            <Text style={[{ color: theme.textSecondary, marginTop: 8, fontSize: 14 }]}>Aún no hay reseñas</Text>
                        </View>
                    )}
                </View>

                {/* ── WITHDRAW SECTION ── */}
                <TouchableOpacity
                    style={[s.section, { backgroundColor: theme.cardBackground }]}
                    onPress={() => {
                        if (stats.earnings <= 0) {
                            return;
                        }
                        // Trigger withdraw flow (handled by backend or Stripe Connect onboarding)
                        navigation.navigate('Settings');
                    }}
                    activeOpacity={stats.earnings > 0 ? 0.7 : 1}
                >
                    <View style={s.sectionHeader}>
                        <Ionicons name="cash-outline" size={20} color="#16A34A" />
                        <Text style={[s.sectionTitle, { color: theme.text }]}>Retirar ganancias</Text>
                        <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} style={{ marginLeft: 'auto' }} />
                    </View>
                    {stats.earnings > 0 ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={{ color: theme.textSecondary, fontSize: 14 }}>
                                Disponible: €{stats.earnings.toFixed(2)}
                            </Text>
                            <View style={{ backgroundColor: '#16A34A', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 }}>
                                <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 13 }}>Retirar</Text>
                            </View>
                        </View>
                    ) : (
                        <View style={[s.ibanWarning, { backgroundColor: '#F3F4F6' }]}>
                            <Ionicons name="information-circle" size={16} color={theme.textSecondary} />
                            <Text style={{ color: theme.textSecondary, fontSize: 13, fontWeight: '600', flex: 1 }}>
                                Aún no tienes ganancias para retirar
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>

            </ScrollView>
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1 },

    // Hero
    heroCard: { marginHorizontal: 16, marginTop: Platform.OS === 'ios' ? 60 : 40, borderRadius: 24, padding: 20, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 16, elevation: 8 },
    heroTop: { flexDirection: 'row', alignItems: 'center' },
    heroAvatar: { width: 56, height: 56, borderRadius: 18, borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.4)' },
    heroName: { color: '#FFF', fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
    heroRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    heroRating: { color: '#FFF', fontSize: 14, fontWeight: '800' },
    heroReviews: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
    badgeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
    badgeLabel: { fontSize: 12, fontWeight: '800' },

    onlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, padding: 12, marginTop: 14 },
    onlineDot: { width: 10, height: 10, borderRadius: 5 },
    onlineBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },

    // Stats
    statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginTop: 16 },
    statCard: { flex: 1, borderRadius: 18, padding: 12, alignItems: 'center', gap: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
    statIcon: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    statValue: { fontSize: 16, fontWeight: '900' },
    statLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },

    // Badge progress
    progressRow: { marginTop: 8 },
    progressText: { fontSize: 13, fontWeight: '600' },
    progressTrack: { height: 8, borderRadius: 4, marginTop: 8, overflow: 'hidden' },
    progressFill: { height: 8, borderRadius: 4 },

    // Sections
    section: { marginHorizontal: 16, marginTop: 16, borderRadius: 20, padding: 18, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    sectionTitle: { fontSize: 17, fontWeight: '800' },

    // Quick actions
    actionsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginTop: 16 },
    actionBtn: { flex: 1, alignItems: 'center', borderRadius: 18, padding: 16, gap: 8, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
    actionIconBox: { width: 46, height: 46, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    actionBtnText: { fontSize: 12, fontWeight: '700', textAlign: 'center' },

    // Active reservations
    activeResCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, gap: 10 },
    activeResName: { fontSize: 15, fontWeight: '700' },
    activeResSub: { fontSize: 12, marginTop: 2 },
    activeResStatus: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },

    // Reviews
    reviewCard: { paddingVertical: 12, borderBottomWidth: 1 },
    reviewTop: { flexDirection: 'row', alignItems: 'center' },
    reviewAvatar: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    reviewName: { fontSize: 13, fontWeight: '700' },
    reviewComment: { fontSize: 13, lineHeight: 20, marginTop: 8 },

    // IBAN
    ibanWarning: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12 },
});
