import React, { useState, useContext, useEffect } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity, ScrollView,
    TextInput, Alert, ActivityIndicator, Platform, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { supabase } from '../config/supabase';
import { COLORS } from '../constants/colors';

const SERVICES = [
    { value: 'walking', label: 'Paseo', icon: 'walk-outline', emoji: '🚶' },
    { value: 'hotel', label: 'Hotel', icon: 'home-outline', emoji: '🏨' },
    { value: 'daycare', label: 'Guardería', icon: 'sunny-outline', emoji: '☀️' },
    { value: 'grooming', label: 'Peluquería', icon: 'cut-outline', emoji: '✂️' },
    { value: 'training', label: 'Entrenamiento', icon: 'fitness-outline', emoji: '🏋️' },
];

const SPECIES = [
    { value: 'perro', label: '🐶 Perros' },
    { value: 'gato', label: '🐱 Gatos' },
    { value: 'ave', label: '🐦 Aves' },
    { value: 'reptil', label: '🦎 Reptiles' },
    { value: 'otro', label: '🐾 Otros' },
];

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export default function CaregiverSetupScreen({ navigation }) {
    const { user, userData, refreshUserData } = useContext(AuthContext);
    const { theme, isDarkMode } = useContext(ThemeContext);

    const [saving, setSaving] = useState(false);
    const [bio, setBio] = useState(userData?.bio || '');
    const [price, setPrice] = useState(String(userData?.price || ''));
    const [experience, setExperience] = useState(userData?.experience || '');
    const [serviceRadius, setServiceRadius] = useState(String(userData?.serviceRadius || '5'));
    const [maxWalks, setMaxWalks] = useState(String(userData?.maxConcurrentWalks || '5'));
    const [maxHotel, setMaxHotel] = useState(String(userData?.maxConcurrentHotel || '3'));
    const [iban, setIban] = useState(userData?.iban || '');

    const [selectedServices, setSelectedServices] = useState(userData?.serviceTypes || []);
    const [acceptedSpecies, setAcceptedSpecies] = useState(userData?.acceptedSpecies || []);

    const defaultSchedule = {};
    DAYS.forEach(d => { defaultSchedule[d] = { available: true, from: '09:00', to: '18:00' }; });
    const [schedule, setSchedule] = useState(userData?.schedule || defaultSchedule);

    useEffect(() => {
        if (userData) {
            setBio(userData.bio || '');
            setPrice(String(userData.price || ''));
            setExperience(userData.experience || '');
            setServiceRadius(String(userData.serviceRadius || '5'));
            setMaxWalks(String(userData.maxConcurrentWalks || '5'));
            setMaxHotel(String(userData.maxConcurrentHotel || '3'));
            setIban(userData.iban || '');
            setSelectedServices(userData.serviceTypes || []);
            setAcceptedSpecies(userData.acceptedSpecies || []);
            if (userData.schedule && Object.keys(userData.schedule).length > 0) {
                setSchedule(userData.schedule);
            }
        }
    }, [userData]);

    const toggleService = (val) => {
        setSelectedServices(prev =>
            prev.includes(val) ? prev.filter(s => s !== val) : [...prev, val]
        );
    };

    const toggleSpecies = (val) => {
        setAcceptedSpecies(prev =>
            prev.includes(val) ? prev.filter(s => s !== val) : [...prev, val]
        );
    };

    const toggleDay = (day) => {
        setSchedule(prev => ({
            ...prev,
            [day]: { ...prev[day], available: !prev[day]?.available },
        }));
    };

    const updateTime = (day, field, value) => {
        const cleaned = value.replace(/[^0-9:]/g, '');
        setSchedule(prev => ({
            ...prev,
            [day]: { ...prev[day], [field]: cleaned },
        }));
    };

    const handleSave = async () => {
        if (!price || parseFloat(price) <= 0) {
            Alert.alert('Error', 'Introduce un precio válido por hora.');
            return;
        }
        if (selectedServices.length === 0) {
            Alert.alert('Error', 'Selecciona al menos un servicio.');
            return;
        }
        if (acceptedSpecies.length === 0) {
            Alert.alert('Error', 'Selecciona al menos un tipo de mascota.');
            return;
        }
        if (!iban.trim()) {
            Alert.alert('Error', 'Introduce tu IBAN para recibir pagos.');
            return;
        }

        setSaving(true);
        try {
            const { error } = await supabase.from('users').update({
                bio: bio.trim(),
                price: parseFloat(price),
                experience: experience.trim(),
                serviceRadius: parseInt(serviceRadius) || 5,
                maxConcurrentWalks: parseInt(maxWalks) || 5,
                maxConcurrentHotel: parseInt(maxHotel) || 3,
                serviceTypes: selectedServices,
                acceptedSpecies,
                schedule,
                iban: iban.trim(),
            }).eq('id', user.id);

            if (error) throw error;
            await refreshUserData();
            Alert.alert('✅ Guardado', 'Tu perfil de cuidador se ha actualizado.');
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'No se pudo guardar. Intenta de nuevo.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar style={isDarkMode ? 'light' : 'dark'} />

            {/* Header */}
            <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={22} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Mi Perfil de Cuidador</Text>
                <TouchableOpacity
                    style={[styles.saveBtn, { backgroundColor: COLORS.primary, opacity: saving ? 0.6 : 1 }]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.saveBtnText}>Guardar</Text>}
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* Bio */}
                <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="person-outline" size={20} color={COLORS.primary} />
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Sobre mí</Text>
                    </View>
                    <TextInput
                        style={[styles.textArea, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                        value={bio}
                        onChangeText={setBio}
                        placeholder="Cuéntales a los dueños por qué eres el mejor cuidador..."
                        placeholderTextColor={theme.textSecondary}
                        multiline
                        maxLength={300}
                    />
                    <Text style={[styles.charCount, { color: theme.textSecondary }]}>{bio.length}/300</Text>
                </View>

                {/* Precio y experiencia */}
                <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="cash-outline" size={20} color={COLORS.primary} />
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Tarifa y Experiencia</Text>
                    </View>

                    <View style={styles.row}>
                        <View style={styles.fieldHalf}>
                            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Precio/hora (€)</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                                value={price}
                                onChangeText={setPrice}
                                keyboardType="decimal-pad"
                                placeholder="15"
                                placeholderTextColor={theme.textSecondary}
                            />
                        </View>
                        <View style={styles.fieldHalf}>
                            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Experiencia</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                                value={experience}
                                onChangeText={setExperience}
                                placeholder="3 años"
                                placeholderTextColor={theme.textSecondary}
                            />
                        </View>
                    </View>

                    <View style={styles.row}>
                        <View style={styles.fieldHalf}>
                            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Radio (km)</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                                value={serviceRadius}
                                onChangeText={setServiceRadius}
                                keyboardType="number-pad"
                                placeholder="5"
                                placeholderTextColor={theme.textSecondary}
                            />
                        </View>
                        <View style={styles.fieldHalf}>
                            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Máx. paseos</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                                value={maxWalks}
                                onChangeText={setMaxWalks}
                                keyboardType="number-pad"
                                placeholder="5"
                                placeholderTextColor={theme.textSecondary}
                            />
                        </View>
                    </View>
                </View>

                {/* IBAN */}
                <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="card-outline" size={20} color="#8B5CF6" />
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Datos de pago</Text>
                    </View>
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary, marginBottom: 6 }]}>
                        IBAN (obligatorio para recibir pagos)
                    </Text>
                    <TextInput
                        style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                        value={iban}
                        onChangeText={setIban}
                        placeholder="ES00 0000 0000 0000 0000 0000"
                        placeholderTextColor={theme.textSecondary}
                        autoCapitalize="characters"
                        maxLength={34}
                    />
                </View>

                {/* Servicios */}
                <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="briefcase-outline" size={20} color={COLORS.primary} />
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Servicios que ofrezco</Text>
                    </View>
                    <View style={styles.chipsWrap}>
                        {SERVICES.map(s => {
                            const active = selectedServices.includes(s.value);
                            return (
                                <TouchableOpacity
                                    key={s.value}
                                    style={[styles.chip, active ? { backgroundColor: COLORS.primary } : { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1.5 }]}
                                    onPress={() => toggleService(s.value)}
                                >
                                    <Text style={{ fontSize: 16 }}>{s.emoji}</Text>
                                    <Text style={[styles.chipLabel, { color: active ? '#FFF' : theme.text }]}>{s.label}</Text>
                                    {active && <Ionicons name="checkmark-circle" size={16} color="#FFF" />}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Mascotas aceptadas */}
                <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="paw-outline" size={20} color={COLORS.primary} />
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Mascotas que acepto</Text>
                    </View>
                    <View style={styles.chipsWrap}>
                        {SPECIES.map(s => {
                            const active = acceptedSpecies.includes(s.value);
                            return (
                                <TouchableOpacity
                                    key={s.value}
                                    style={[styles.chip, active ? { backgroundColor: COLORS.primary } : { backgroundColor: theme.background, borderColor: theme.border, borderWidth: 1.5 }]}
                                    onPress={() => toggleSpecies(s.value)}
                                >
                                    <Text style={[styles.chipLabel, { color: active ? '#FFF' : theme.text }]}>{s.label}</Text>
                                    {active && <Ionicons name="checkmark-circle" size={16} color="#FFF" />}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Horario semanal */}
                <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="calendar-outline" size={20} color={COLORS.primary} />
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Horario semanal</Text>
                    </View>
                    {DAYS.map(day => {
                        const dayData = schedule[day] || { available: false, from: '09:00', to: '18:00' };
                        return (
                            <View key={day} style={[styles.scheduleRow, { borderBottomColor: theme.border }]}>
                                <View style={styles.dayHeader}>
                                    <Text style={[styles.dayText, { color: theme.text }]}>{day}</Text>
                                    <Switch
                                        value={dayData.available !== false}
                                        onValueChange={() => toggleDay(day)}
                                        trackColor={{ false: theme.border, true: COLORS.primary }}
                                        thumbColor="#FFF"
                                    />
                                </View>
                                {dayData.available !== false && (
                                    <View style={styles.timeRow}>
                                        <TextInput
                                            style={[styles.timeInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                                            value={dayData.from || '09:00'}
                                            onChangeText={(v) => updateTime(day, 'from', v)}
                                            placeholder="09:00"
                                            placeholderTextColor={theme.textSecondary}
                                            maxLength={5}
                                        />
                                        <Text style={[styles.timeSep, { color: theme.textSecondary }]}>—</Text>
                                        <TextInput
                                            style={[styles.timeInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                                            value={dayData.to || '18:00'}
                                            onChangeText={(v) => updateTime(day, 'to', v)}
                                            placeholder="18:00"
                                            placeholderTextColor={theme.textSecondary}
                                            maxLength={5}
                                        />
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 16, paddingBottom: 14,
        borderBottomWidth: 1,
    },
    backBtn: { width: 40, height: 40, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '800' },
    saveBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14 },
    saveBtnText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
    scrollContent: { padding: 16, paddingBottom: 40 },

    section: { borderRadius: 20, padding: 20, marginBottom: 16 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
    sectionTitle: { fontSize: 17, fontWeight: '800' },

    textArea: { borderWidth: 1.5, borderRadius: 14, padding: 14, fontSize: 15, minHeight: 100, textAlignVertical: 'top' },
    charCount: { textAlign: 'right', fontSize: 12, marginTop: 6 },

    row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
    fieldHalf: { flex: 1 },
    fieldLabel: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
    input: { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontWeight: '600' },

    chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14 },
    chipLabel: { fontSize: 14, fontWeight: '700' },

    scheduleRow: { paddingVertical: 12, borderBottomWidth: 1 },
    dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    dayText: { fontSize: 15, fontWeight: '700' },
    timeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
    timeInput: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, fontWeight: '600', width: 90, textAlign: 'center' },
    timeSep: { fontSize: 16, fontWeight: '600' },
});
