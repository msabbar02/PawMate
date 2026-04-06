import React, { useContext, useState, useEffect } from 'react';
import {
    StyleSheet, View, Text, Image, ScrollView,
    TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { supabase } from '../config/supabase';
import { COLORS } from '../constants/colors';

// Mapeos de servicios
const SERVICE_LABELS = { walking: '🚶 Paseos', hotel: '🏨 Hotel', daycare: '☀️ Guardería' };

export default function CaregiverProfileScreen({ route, navigation }) {
    const { caregiver } = route.params || {};
    const { theme, isDarkMode } = useContext(ThemeContext);
    const { user, userData } = useContext(AuthContext);

    const [pets, setPets] = useState([]);
    const [loadingPets, setLoadingPets] = useState(true);

    useEffect(() => {
        if (!caregiver?.id) return;
        const fetchCaregiverPets = async () => {
            try {
                // Obtenemos las mascotas que ha registrado como Dueño y posibles reseñas/fotos de paseos.
                // Por simplicidad, descargamos mascotas de las cuales es owner.
                const { data } = await supabase.from('pets').select('*').eq('ownerId', caregiver.id);
                setPets(data || []);
            } catch (e) {
                console.error(e);
            } finally {
                setLoadingPets(false);
            }
        };
        fetchCaregiverPets();
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

    const startChat = () => {
        // Asumiendo que se creará una pantalla Messages o ChatScreen
        navigation.navigate('Messages'); // Ajustaremos esto adelante si hace falta pantalla específica de chat
    };

    const makeReservation = () => {
        // Redirigimos al tab de Reservas o abrimos un Flow desde BookingScreen
        // En este caso mandamos al usuario a Reservas (Ajustaremos el flujo si es necesario)
        navigation.navigate('Reservas');
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar style={isDarkMode ? 'light' : 'dark'} />

            {/* HEADER CABECERA (Con imagen de fondo si hubiera, o color por defecto) */}
            <View style={[styles.headerBanner, { backgroundColor: theme.primaryBg }]}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                
                {/* INFO PRINCIPAL COLAPSADA EN EL BANNER */}
                <View style={styles.profileBox}>
                    <View style={[styles.avatarWrap, { borderColor: theme.cardBackground }]}>
                        <Image source={{ uri: caregiver.avatar || 'https://via.placeholder.com/150' }} style={styles.avatar} />
                        <View style={[styles.onlineBadge, { backgroundColor: caregiver.isOnline ? '#22c55e' : '#ef4444' }]} />
                    </View>
                    
                    <Text style={[styles.nameText, { color: theme.text }]}>{caregiver.name || caregiver.fullName || 'Cuidador'}</Text>
                    
                    <View style={styles.ratingRow}>
                        <Ionicons name="star" size={16} color={COLORS.warning} />
                        <Text style={[styles.ratingText, { color: theme.textSecondary }]}>
                            {caregiver.rating || '5.0'} ({caregiver.reviews || '0'} reseñas)
                        </Text>
                    </View>

                    {/* Certificado (Visual) */}
                    <View style={styles.certBadge}>
                        <Ionicons name="shield-checkmark" size={14} color={COLORS.primary} />
                        <Text style={styles.certBadgeText}>Perfil Verificado Oficialmente</Text>
                    </View>
                </View>

                {/* ACCIONES RÁPIDAS (MENSAJE / RESERVA) */}
                <View style={styles.actionRow}>
                    <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline, { borderColor: COLORS.primary }]} onPress={startChat}>
                        <Ionicons name="chatbubble-ellipses-outline" size={20} color={COLORS.primary} />
                        <Text style={[styles.actionBtnText, { color: COLORS.primary }]}>Enviar Mensaje</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSolid, { backgroundColor: COLORS.primary }]} onPress={makeReservation}>
                        <Ionicons name="calendar-outline" size={20} color="#FFF" />
                        <Text style={[styles.actionBtnText, { color: '#FFF' }]}>Hacer Reserva</Text>
                    </TouchableOpacity>
                </View>

                {/* ABOUT & SERVICES */}
                <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Servicios ({caregiver.price}€/h)</Text>
                    <View style={styles.serviceChips}>
                        {(caregiver.services || ['walking', 'daycare']).map(s => (
                            <View key={s} style={[styles.chip, { backgroundColor: theme.background, borderColor: theme.border }]}>
                                <Text style={[styles.chipText, { color: theme.text }]}>{SERVICE_LABELS[s] || s}</Text>
                            </View>
                        ))}
                    </View>

                    <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 24 }]}>Sobre Mí</Text>
                    <Text style={[styles.aboutText, { color: theme.textSecondary }]}>
                        {caregiver.bio || '¡Hola! Soy un gran amante de los animales. Cuidaré a tu mascota como si fuera la mía.'}
                    </Text>
                </View>

                {/* MASCOTAS GESTIONADAS / ATENDIDAS */}
                <View style={[styles.section, { backgroundColor: theme.cardBackground, marginTop: 15 }]}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Mascotas en PawMate</Text>
                    {loadingPets ? (
                        <ActivityIndicator style={{ marginVertical: 20 }} color={COLORS.primary} />
                    ) : pets.length > 0 ? (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.petsScroll}>
                            {pets.map(pet => (
                                <View key={pet.id} style={styles.petCard}>
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

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    headerBanner: { height: 140, paddingTop: 60, paddingHorizontal: 20 },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 4 },
    scrollContent: { paddingBottom: 40 },
    profileBox: { alignItems: 'center', marginTop: -50, marginBottom: 20 },
    avatarWrap: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, backfaceVisibility: 'hidden', backgroundColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
    avatar: { width: '100%', height: '100%', borderRadius: 50 },
    onlineBadge: { position: 'absolute', bottom: 4, right: 4, width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#FFF' },
    nameText: { fontSize: 24, fontWeight: '800', marginTop: 12 },
    ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 5 },
    ratingText: { fontSize: 14, fontWeight: '600' },
    certBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ecfdf5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6, marginTop: 10 },
    certBadgeText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
    actionRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 15, marginBottom: 20 },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: 14, gap: 8 },
    actionBtnOutline: { borderWidth: 1.5, backgroundColor: 'transparent' },
    actionBtnSolid: {},
    actionBtnText: { fontSize: 15, fontWeight: '700' },
    section: { padding: 20, borderTopWidth: 1, borderBottomWidth: 1, borderColor: 'transparent' },
    sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 14 },
    serviceChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
    chipText: { fontSize: 14, fontWeight: '600' },
    aboutText: { fontSize: 15, lineHeight: 24 },
    petsScroll: { gap: 15, paddingRight: 20 },
    petCard: { width: 85, alignItems: 'center' },
    petImage: { width: 70, height: 70, borderRadius: 35, marginBottom: 8, backgroundColor: '#EEE' },
    petName: { fontSize: 14, fontWeight: '700', marginBottom: 2, textAlign: 'center' },
    petSpecies: { fontSize: 12, color: COLORS.textLight, textTransform: 'capitalize' },
    emptyPets: { fontSize: 15, fontStyle: 'italic', marginVertical: 10 },
});
