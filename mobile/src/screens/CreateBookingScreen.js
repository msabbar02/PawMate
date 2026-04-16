import React, { useState, useContext, useEffect } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity, ScrollView,
    TextInput, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { supabase } from '../config/supabase';
import { createNotification } from '../utils/notificationHelpers';
import { COLORS } from '../constants/colors';

const SERVICE_TYPES = [
    { value: 'walking', label: '🚶 Paseo', icon: 'walk-outline' },
    { value: 'hotel', label: '🏨 Hotel', icon: 'home-outline' },
    { value: 'daycare', label: '☀️ Guardería', icon: 'sunny-outline' },
    { value: 'grooming', label: '✂️ Peluquería', icon: 'cut-outline' },
    { value: 'training', label: '🏋️ Entreno', icon: 'fitness-outline' },
];

export default function CreateBookingScreen({ route, navigation }) {
    const { caregiver } = route.params || {};
    const { user, userData } = useContext(AuthContext);
    const { theme, isDarkMode } = useContext(ThemeContext);

    const [serviceType, setServiceType] = useState(null);
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date());
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    const [notes, setNotes] = useState('');
    const [selectedPets, setSelectedPets] = useState([]);
    const [myPets, setMyPets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingPets, setLoadingPets] = useState(true);

    // Only show services that the caregiver offers
    const availableServices = caregiver?.serviceTypes?.length > 0
        ? SERVICE_TYPES.filter(s => caregiver.serviceTypes.includes(s.value))
        : SERVICE_TYPES;

    useEffect(() => {
        if (!user?.id) return;
        const fetchPets = async () => {
            const { data } = await supabase.from('pets').select('*').eq('ownerId', user.id);
            setMyPets(data || []);
            setLoadingPets(false);
        };
        fetchPets();
    }, [user?.id]);

    const togglePet = (petId) => {
        setSelectedPets(prev =>
            prev.includes(petId) ? prev.filter(p => p !== petId) : [...prev, petId]
        );
    };

    const formatDate = (date) => {
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const calculatePrice = () => {
        if (!caregiver?.price) return 0;
        const diffMs = endDate.getTime() - startDate.getTime();
        const diffHours = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
        if (serviceType === 'hotel' || serviceType === 'daycare') {
            const days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
            return days * caregiver.price * 8; // 8h/day rate
        }
        return diffHours * caregiver.price;
    };

    const handleSubmit = async () => {
        if (!serviceType) {
            Alert.alert('Error', 'Selecciona un tipo de servicio.');
            return;
        }
        if (selectedPets.length === 0) {
            Alert.alert('Error', 'Selecciona al menos una mascota.');
            return;
        }

        setLoading(true);
        try {
            const petNames = myPets.filter(p => selectedPets.includes(p.id)).map(p => p.name);
            const totalPrice = calculatePrice();

            const { data: insertedRes, error } = await supabase.from('reservations').insert({
                ownerId: user.id,
                caregiverId: caregiver.id,
                ownerName: userData?.fullName || 'Dueño',
                caregiverName: caregiver.fullName || 'Cuidador',
                serviceType,
                startDate: formatDate(startDate),
                endDate: formatDate(endDate),
                totalPrice,
                petNames,
                petIds: selectedPets,
                notes: notes.trim(),
                status: 'pendiente',
            }).select().single();

            if (error) throw error;

            // Create conversation between owner & caregiver if it doesn't exist
            await supabase.from('conversations').upsert({
                ownerId: user.id,
                caregiverId: caregiver.id,
                ownerName: userData?.fullName || 'Dueño',
                caregiverName: caregiver.fullName || 'Cuidador',
                ownerAvatar: userData?.photoURL || userData?.avatar || null,
                caregiverAvatar: caregiver.photoURL || caregiver.avatar || null,
            }, { onConflict: 'ownerId,caregiverId' });

            // Notify the caregiver (bookingId goes into data jsonb)
            await createNotification(caregiver.id, {
                type: 'booking_request',
                bookingId: insertedRes?.id,
                title: '📅 Nueva solicitud de reserva',
                body: `${userData?.fullName || 'Un dueño'} quiere reservar ${SERVICE_TYPES.find(s => s.value === serviceType)?.label || serviceType}`,
                icon: 'calendar-outline',
                iconBg: '#FEF3C7',
                iconColor: '#D97706',
            });

            Alert.alert(
                '✅ Reserva enviada',
                `Tu solicitud ha sido enviada a ${caregiver.fullName || 'el cuidador'}. Te notificaremos cuando responda.`,
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
        } catch (e) {
            console.error('Error creating booking:', e);
            Alert.alert('Error', 'No se pudo crear la reserva. Intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    if (!caregiver) {
        return (
            <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: theme.text }}>Error: cuidador no encontrado</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar style={isDarkMode ? 'light' : 'dark'} />

            {/* Header */}
            <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Nueva Reserva</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* Caregiver info */}
                <View style={[styles.caregiverCard, { backgroundColor: theme.cardBackground }]}>
                    <View style={[styles.cgAvatar, { backgroundColor: COLORS.primaryBg }]}>
                        <Text style={{ fontSize: 24 }}>{(caregiver.fullName || 'C').charAt(0)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.cgName, { color: theme.text }]}>{caregiver.fullName || 'Cuidador'}</Text>
                        <Text style={[styles.cgCity, { color: theme.textSecondary }]}>
                            <Ionicons name="location-outline" size={12} /> {caregiver.city || 'Sin ubicación'}
                        </Text>
                        {caregiver.price > 0 && (
                            <Text style={styles.cgPrice}>{caregiver.price}€/hora</Text>
                        )}
                    </View>
                </View>

                {/* Service type */}
                <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        <Ionicons name="briefcase-outline" size={16} /> Tipo de servicio
                    </Text>
                    <View style={styles.chipsWrap}>
                        {availableServices.map(s => {
                            const active = serviceType === s.value;
                            return (
                                <TouchableOpacity
                                    key={s.value}
                                    style={[styles.chip, active
                                        ? { backgroundColor: COLORS.primary }
                                        : { backgroundColor: theme.background, borderWidth: 1.5, borderColor: theme.border }
                                    ]}
                                    onPress={() => setServiceType(s.value)}
                                >
                                    <Ionicons name={s.icon} size={16} color={active ? '#FFF' : theme.text} />
                                    <Text style={[styles.chipLabel, { color: active ? '#FFF' : theme.text }]}>{s.label}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Dates */}
                <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        <Ionicons name="calendar-outline" size={16} /> Fechas
                    </Text>
                    <View style={styles.dateRow}>
                        <TouchableOpacity
                            style={[styles.dateBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
                            onPress={() => setShowStartPicker(true)}
                        >
                            <Text style={[styles.dateLabel, { color: theme.textSecondary }]}>Inicio</Text>
                            <Text style={[styles.dateValue, { color: theme.text }]}>{formatDate(startDate)}</Text>
                        </TouchableOpacity>
                        <Ionicons name="arrow-forward" size={18} color={theme.textSecondary} />
                        <TouchableOpacity
                            style={[styles.dateBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
                            onPress={() => setShowEndPicker(true)}
                        >
                            <Text style={[styles.dateLabel, { color: theme.textSecondary }]}>Fin</Text>
                            <Text style={[styles.dateValue, { color: theme.text }]}>{formatDate(endDate)}</Text>
                        </TouchableOpacity>
                    </View>
                    {showStartPicker && (
                        <DateTimePicker
                            value={startDate}
                            mode="date"
                            minimumDate={new Date()}
                            onChange={(e, d) => { setShowStartPicker(false); if (d) { setStartDate(d); if (d > endDate) setEndDate(d); } }}
                        />
                    )}
                    {showEndPicker && (
                        <DateTimePicker
                            value={endDate}
                            mode="date"
                            minimumDate={startDate}
                            onChange={(e, d) => { setShowEndPicker(false); if (d) setEndDate(d); }}
                        />
                    )}
                </View>

                {/* My Pets */}
                <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        <Ionicons name="paw-outline" size={16} /> Selecciona mascotas
                    </Text>
                    {loadingPets ? (
                        <ActivityIndicator color={COLORS.primary} />
                    ) : myPets.length > 0 ? (
                        <View style={styles.chipsWrap}>
                            {myPets.map(pet => {
                                const active = selectedPets.includes(pet.id);
                                return (
                                    <TouchableOpacity
                                        key={pet.id}
                                        style={[styles.chip, active
                                            ? { backgroundColor: COLORS.primary }
                                            : { backgroundColor: theme.background, borderWidth: 1.5, borderColor: theme.border }
                                        ]}
                                        onPress={() => togglePet(pet.id)}
                                    >
                                        <Text style={{ fontSize: 14 }}>{pet.species === 'perro' || pet.species === 'dog' ? '🐶' : pet.species === 'gato' || pet.species === 'cat' ? '🐱' : '🐾'}</Text>
                                        <Text style={[styles.chipLabel, { color: active ? '#FFF' : theme.text }]}>{pet.name}</Text>
                                        {active && <Ionicons name="checkmark-circle" size={16} color="#FFF" />}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    ) : (
                        <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                            <Ionicons name="paw-outline" size={36} color={COLORS.textLight} />
                            <Text style={[{ color: theme.textSecondary, marginTop: 8 }]}>No tienes mascotas registradas</Text>
                        </View>
                    )}
                </View>

                {/* Notes */}
                <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>
                        <Ionicons name="document-text-outline" size={16} /> Notas (opcional)
                    </Text>
                    <TextInput
                        style={[styles.notesInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                        value={notes}
                        onChangeText={setNotes}
                        placeholder="Instrucciones especiales, alergias, medicamentos..."
                        placeholderTextColor={theme.textSecondary}
                        multiline
                        maxLength={500}
                    />
                </View>

                {/* Price summary */}
                {serviceType && caregiver.price > 0 && (
                    <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>
                            <Ionicons name="card-outline" size={16} /> Resumen
                        </Text>
                        <View style={styles.summaryRow}>
                            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Tarifa del cuidador</Text>
                            <Text style={[styles.summaryValue, { color: theme.text }]}>{caregiver.price}€/hora</Text>
                        </View>
                        <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
                        <View style={styles.summaryRow}>
                            <Text style={[styles.totalLabel, { color: theme.text }]}>Total estimado</Text>
                            <Text style={styles.totalValue}>{calculatePrice().toFixed(2)}€</Text>
                        </View>
                        <Text style={[styles.summaryNote, { color: theme.textSecondary }]}>
                            El pago se realizará una vez el cuidador acepte la reserva.
                        </Text>
                    </View>
                )}

                {/* Submit */}
                <TouchableOpacity
                    style={[styles.submitBtn, { opacity: loading ? 0.6 : 1 }]}
                    onPress={handleSubmit}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <>
                            <Ionicons name="send" size={18} color="#FFF" />
                            <Text style={styles.submitText}>Enviar solicitud de reserva</Text>
                        </>
                    )}
                </TouchableOpacity>

                <View style={{ height: 100 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1,
    },
    backBtn: { width: 40, height: 40, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '800' },
    scrollContent: { padding: 16, paddingBottom: 40 },

    caregiverCard: {
        flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, marginBottom: 16,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
    },
    cgAvatar: { width: 56, height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
    cgName: { fontSize: 17, fontWeight: '800' },
    cgCity: { fontSize: 13, marginTop: 2 },
    cgPrice: { fontSize: 16, fontWeight: '800', color: COLORS.primary, marginTop: 4 },

    section: { borderRadius: 20, padding: 20, marginBottom: 16 },
    sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 14 },

    chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 14 },
    chipLabel: { fontSize: 14, fontWeight: '700' },

    dateRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    dateBtn: { flex: 1, padding: 14, borderRadius: 14, borderWidth: 1.5 },
    dateLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
    dateValue: { fontSize: 15, fontWeight: '700' },

    notesInput: { borderWidth: 1.5, borderRadius: 14, padding: 14, fontSize: 15, minHeight: 80, textAlignVertical: 'top' },

    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
    summaryLabel: { fontSize: 14, fontWeight: '600' },
    summaryValue: { fontSize: 14, fontWeight: '700' },
    summaryDivider: { height: 1, marginVertical: 8 },
    totalLabel: { fontSize: 16, fontWeight: '800' },
    totalValue: { fontSize: 22, fontWeight: '800', color: COLORS.primary },
    summaryNote: { fontSize: 12, marginTop: 8, fontStyle: 'italic' },

    submitBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 18, gap: 8,
        shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
    },
    submitText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});
