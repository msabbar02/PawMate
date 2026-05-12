import React, { useState, useContext, useEffect } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity, ScrollView,
    TextInput, Alert, ActivityIndicator, Platform, Switch,
} from 'react-native';
import Icon from '../components/Icon';
import { StatusBar } from 'expo-status-bar';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { supabase } from '../config/supabase';
import { COLORS } from '../constants/colors';
import { useTranslation } from '../context/LanguageContext';

export default function CaregiverSetupScreen({ navigation }) {
    const { user, userData, refreshUserData } = useContext(AuthContext);
    const { theme, isDarkMode } = useContext(ThemeContext);
    const { t } = useTranslation();

    const SERVICES = [
        { value: 'walking', label: t('services.walking'), icon: 'walk-outline', emoji: '' },
        { value: 'hotel', label: t('services.hotel'), icon: 'home-outline', emoji: '' },
    ];

    const SPECIES = [
        { value: 'dog',    label: t('species.dogs'),  icon: 'dog' },
        { value: 'cat',    label: t('species.cats'),  icon: 'cat' },
        { value: 'bird',   label: t('species.birds'), icon: 'dove' },
        { value: 'rabbit', label: 'Conejo',           icon: 'rabbit' },
        { value: 'other',  label: 'Otros',            icon: 'paw' },
    ];

    const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const DAYS = DAY_KEYS;
    const getDayLabel = (key) => t(`days.${key}`);

    const [saving, setSaving] = useState(false);
    const [bio, setBio] = useState(userData?.bio || '');
    const [price, setPrice] = useState(String(userData?.price || ''));
    const [hotelPrice, setHotelPrice] = useState(String(userData?.hotelPrice || ''));
    const [experience, setExperience] = useState(userData?.experience || '');
    const [serviceRadius, setServiceRadius] = useState(String(userData?.serviceRadius || '5'));

    const [selectedServices, setSelectedServices] = useState(userData?.serviceTypes || []);
    // Migrate any legacy 'perro'/'gato' to canonical 'dog'/'cat'
    const normalizeSpecies = (arr) => (arr || []).map(v => v === 'perro' ? 'dog' : v === 'gato' ? 'cat' : v === 'ave' ? 'bird' : v === 'reptil' ? 'other' : v);
    const [acceptedSpecies, setAcceptedSpecies] = useState(normalizeSpecies(userData?.acceptedSpecies));

    useEffect(() => {
        if (userData) {
            setBio(userData.bio || '');
            setPrice(String(userData.price || ''));
            setHotelPrice(String(userData.hotelPrice || ''));
            setExperience(userData.experience || '');
            setServiceRadius(String(userData.serviceRadius || '5'));
            setSelectedServices(userData.serviceTypes || []);
            setAcceptedSpecies(normalizeSpecies(userData.acceptedSpecies));
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

    const handleSave = async () => {
        if (!price || parseFloat(price) <= 0) {
            Alert.alert(t('common.error'), t('caregiverSetup.priceError'));
            return;
        }
        if (selectedServices.length === 0) {
            Alert.alert(t('common.error'), t('caregiverSetup.serviceRequired'));
            return;
        }
        if (acceptedSpecies.length === 0) {
            Alert.alert(t('common.error'), t('caregiverSetup.speciesRequired'));
            return;
        }

        setSaving(true);
        try {
            const { error } = await supabase.from('users').update({
                bio: bio.trim(),
                price: parseFloat(price),
                hotelPrice: hotelPrice ? parseFloat(hotelPrice) : null,
                experience: experience.trim(),
                serviceRadius: parseInt(serviceRadius) || 5,
                serviceTypes: selectedServices,
                acceptedSpecies,
            }).eq('id', user.id);

            if (error) throw error;
            await refreshUserData();
            Alert.alert(t('caregiverSetup.saved'), t('caregiverSetup.savedMsg'));
        } catch (e) {
            console.error(e);
            Alert.alert(t('common.error'), t('caregiverSetup.saveError'));
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
                    <Icon name="arrow-back" size={22} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>{t('caregiverSetup.title')}</Text>
                <TouchableOpacity
                    style={[styles.saveBtn, { backgroundColor: COLORS.primary, opacity: saving ? 0.6 : 1 }]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.saveBtnText}>{t('common.save')}</Text>}
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* Bio */}
                <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
                    <View style={styles.sectionHeader}>
                        <Icon name="person-outline" size={20} color={COLORS.primary} />
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('caregiverSetup.aboutMe')}</Text>
                    </View>
                    <TextInput
                        style={[styles.textArea, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                        value={bio}
                        onChangeText={setBio}
                        placeholder={t('caregiverSetup.aboutMePlaceholder')}
                        placeholderTextColor={theme.textSecondary}
                        multiline
                        maxLength={300}
                    />
                    <Text style={[styles.charCount, { color: theme.textSecondary }]}>{bio.length}/300</Text>
                </View>

                {/* Precio y experiencia */}
                <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
                    <View style={styles.sectionHeader}>
                        <Icon name="cash-outline" size={20} color={COLORS.primary} />
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('caregiverSetup.rateAndExperience')}</Text>
                    </View>

                    <View style={styles.row}>
                        <View style={styles.fieldHalf}>
                            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{t('caregiverSetup.priceHour')}</Text>
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
                            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{t('caregiverSetup.experienceLabel')}</Text>
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
                            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{t('caregiverSetup.radiusKm')}</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                                value={serviceRadius}
                                onChangeText={setServiceRadius}
                                keyboardType="number-pad"
                                placeholder="5"
                                placeholderTextColor={theme.textSecondary}
                            />
                        </View>
                        {selectedServices.includes('hotel') && (
                            <View style={styles.fieldHalf}>
                                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Precio noche hotel (€)</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                                    value={hotelPrice}
                                    onChangeText={setHotelPrice}
                                    keyboardType="decimal-pad"
                                    placeholder="30"
                                    placeholderTextColor={theme.textSecondary}
                                />
                            </View>
                        )}
                    </View>
                </View>

                {/* Servicios */}
                <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
                    <View style={styles.sectionHeader}>
                        <Icon name="briefcase-outline" size={20} color={COLORS.primary} />
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('caregiverSetup.servicesOffered')}</Text>
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
                                    <Icon name={s.icon} size={16} color={active ? '#FFF' : theme.text} />
                                    <Text style={[styles.chipLabel, { color: active ? '#FFF' : theme.text }]}>{s.label}</Text>
                                    {active && <Icon name="checkmark-circle" size={16} color="#FFF" />}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Mascotas aceptadas */}
                <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
                    <View style={styles.sectionHeader}>
                        <Icon name="paw-outline" size={20} color={COLORS.primary} />
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>{t('caregiverSetup.acceptedPets')}</Text>
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
                                    <Icon name={s.icon} size={14} color={active ? '#FFF' : theme.text} />
                                    <Text style={[styles.chipLabel, { color: active ? '#FFF' : theme.text }]}>{s.label}</Text>
                                    {active && <Icon name="checkmark-circle" size={16} color="#FFF" />}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Horario semanal — REMOVED (FASE 4: cuidador no controla horario) */}

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
