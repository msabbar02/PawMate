import React, { useState, useContext, useEffect } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity, ScrollView,
    TextInput, Alert, ActivityIndicator, Platform, Image,
} from 'react-native';
import Icon from '../components/Icon';
import { StatusBar } from 'expo-status-bar';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { supabase } from '../config/supabase';
import { createNotification } from '../utils/notificationHelpers';
import { COLORS } from '../constants/colors';
import { useTranslation } from '../context/LanguageContext';

export default function CreateBookingScreen({ route, navigation }) {
    const { caregiver } = route.params || {};
    const { user, userData } = useContext(AuthContext);
    const { theme, isDarkMode } = useContext(ThemeContext);
    const { t } = useTranslation();

    const SERVICE_TYPES = [
        { value: 'walking', label: ' ' + t('services.walking'), icon: 'walk-outline' },
        { value: 'hotel', label: ' ' + t('services.hotel'), icon: 'home-outline' },
    ];

    const [serviceType, setServiceType] = useState(null);
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date());
    const [showStartPicker, setShowStartPicker] = useState(false);
    const [showEndPicker, setShowEndPicker] = useState(false);
    const [showStartTimePicker, setShowStartTimePicker] = useState(false);
    const [showEndTimePicker, setShowEndTimePicker] = useState(false);
    const [notes, setNotes] = useState('');
    const [selectedPets, setSelectedPets] = useState([]);
    const [myPets, setMyPets] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingPets, setLoadingPets] = useState(true);
    const [walkHours, setWalkHours] = useState(1);

    // Muestra solo los servicios que ofrece el cuidador.
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

    const formatTime = (date) => {
        return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });
    };

    const calculatePrice = () => {
        if (!caregiver?.price) return 0;
        if (serviceType === 'walking') {
            return walkHours * caregiver.price;
        }
        const diffMs = endDate.getTime() - startDate.getTime();
        if (serviceType === 'hotel') {
            const days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
            return days * caregiver.price * 8;
        }
        const diffHours = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
        return diffHours * caregiver.price;
    };

    const handleSubmit = async () => {
        if (!serviceType) {
            Alert.alert(t('common.error'), t('createBooking.serviceRequired'));
            return;
        }
        if (selectedPets.length === 0) {
            Alert.alert(t('common.error'), t('createBooking.petRequired'));
            return;
        }

        setLoading(true);
        try {
            const petNames = myPets.filter(p => selectedPets.includes(p.id)).map(p => p.name);
            const totalPrice = calculatePrice();

            // Para paseos: la hora de fin = inicio + duración del paseo.
            const effectiveEndDate = serviceType === 'walking'
                ? new Date(startDate.getTime() + walkHours * 60 * 60 * 1000)
                : endDate;

            const { data: insertedRes, error } = await supabase.from('reservations').insert({
                ownerId: user.id,
                caregiverId: caregiver.id,
                ownerName: userData?.fullName || t('roles.owner'),
                caregiverName: caregiver.fullName || t('roles.caregiver'),
                ownerAvatar: userData?.photoURL || userData?.avatar || null,
                caregiverAvatar: caregiver.photoURL || caregiver.avatar || null,
                serviceType,
                startDate: formatDate(startDate),
                endDate: formatDate(effectiveEndDate),
                startTime: formatTime(startDate),
                endTime: formatTime(effectiveEndDate),
                startDateTime: startDate.toISOString(),
                endDateTime: effectiveEndDate.toISOString(),
                totalPrice,
                petNames,
                petIds: selectedPets,
                notes: notes.trim(),
                status: 'pendiente',
                walkHours: serviceType === 'walking' ? walkHours : null,
            }).select().single();

            if (error) throw error;

            // Crea la conversación entre dueño y cuidador si no existe.
            await supabase.from('conversations').upsert({
                ownerId: user.id,
                caregiverId: caregiver.id,
                ownerName: userData?.fullName || t('roles.owner'),
                caregiverName: caregiver.fullName || t('roles.caregiver'),
                ownerAvatar: userData?.photoURL || userData?.avatar || null,
                caregiverAvatar: caregiver.photoURL || caregiver.avatar || null,
            }, { onConflict: 'ownerId,caregiverId' });

            // Notifica al cuidador (bookingId va en el campo data jsonb).
            await createNotification(caregiver.id, {
                type: 'booking_request',
                bookingId: insertedRes?.id,
                title: ' Nueva solicitud de reserva',
                body: `${userData?.fullName || t('roles.owner')} quiere reservar ${SERVICE_TYPES.find(s => s.value === serviceType)?.label || serviceType}`,
                icon: 'calendar-outline',
                iconBg: '#FEF3C7',
                iconColor: '#D97706',
            });

            Alert.alert(
                t('createBooking.bookingSent'),
                t('createBooking.bookingSentMsg'),
                [{ text: t('tabs.bookings'), onPress: () => navigation.navigate('MainTabs', { screen: 'Reservas' }) }]
            );
        } catch (e) {
            console.error('Error creating booking:', e);
            Alert.alert(t('common.error'), t('createBooking.bookingError'));
        } finally {
            setLoading(false);
        }
    };

    if (!caregiver) {
        return (
            <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: theme.text }}>{t('createBooking.caregiverNotFound')}</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar style={isDarkMode ? 'light' : 'dark'} />

            {/* Header */}
            <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Icon name="arrow-back" size={22} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>{t('createBooking.title')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* ── Caregiver Profile Card ── */}
                <View style={[styles.caregiverCard, { backgroundColor: theme.cardBackground }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {(caregiver.avatar || caregiver.photoURL) ? (
                            <Image source={{ uri: caregiver.avatar || caregiver.photoURL }} style={styles.cgAvatarImg} />
                        ) : (
                            <View style={[styles.cgAvatarImg, { backgroundColor: COLORS.primaryBg, justifyContent: 'center', alignItems: 'center' }]}>
                                <Text style={{ fontSize: 26, fontWeight: '800' }}>{(caregiver.fullName || 'C').charAt(0)}</Text>
                            </View>
                        )}
                        <View style={{ flex: 1, marginLeft: 14 }}>
                            <Text style={[styles.cgName, { color: theme.text }]}>{caregiver.fullName || t('roles.caregiver')}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 }}>
                                <Icon name="location-outline" size={13} color={theme.textSecondary} />
                                <Text style={{ fontSize: 13, color: theme.textSecondary }}>{caregiver.city || t('caregivers.noLocation')}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 }}>
                                <Icon name="star" size={14} color="#f59e0b" />
                                <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>
                                    {caregiver.rating ? Number(caregiver.rating).toFixed(1) : t('caregivers.newBadge')}
                                </Text>
                                {caregiver.reviewCount > 0 && (
                                    <Text style={{ fontSize: 12, color: theme.textSecondary }}>({caregiver.reviewCount} {t('caregivers.reviews')})</Text>
                                )}
                            </View>
                        </View>
                        {Number(caregiver.price) > 0 && (
                            <View style={{ backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 }}>
                                <Text style={{ fontSize: 20, fontWeight: '900', color: COLORS.primary }}>{caregiver.price}€</Text>
                                <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.primary, textAlign: 'center' }}>{t('caregivers.perHour')}</Text>
                            </View>
                        )}
                    </View>

                    {/* Accepted species */}
                    {caregiver.acceptedSpecies?.length > 0 && (() => {
                        const normMap = { perro: 'dog', gato: 'cat', ave: 'bird', reptil: 'other' };
                        const norm = [...new Set(caregiver.acceptedSpecies.map(s => normMap[s] || s))];
                        const labelMap = { dog: t('species.dogs'), cat: t('species.cats'), bird: t('species.birds'), rabbit: 'Conejo', other: 'Otros' };
                        return (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                                {norm.map(sp => (
                                    <View key={sp} style={{ backgroundColor: '#E0F2FE', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
                                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#0891b2' }}>
                                            {labelMap[sp] || sp}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        );
                    })()}

                    {/* Bio */}
                    {caregiver.bio ? (
                        <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 10, lineHeight: 18 }} numberOfLines={3}>
                            {caregiver.bio}
                        </Text>
                    ) : null}

                    {/* Gallery photos */}
                    {caregiver.galleryPhotos?.length > 0 && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
                            {caregiver.galleryPhotos.map((uri, i) => (
                                <Image key={i} source={{ uri }} style={{ width: 80, height: 80, borderRadius: 14, marginRight: 8 }} />
                            ))}
                        </ScrollView>
                    )}
                </View>

                {/* Service type */}
                <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                        <Icon name="briefcase-outline" size={16} color={theme.text} />
                        <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>{t('createBooking.serviceType')}</Text>
                    </View>
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
                                    <Icon name={s.icon} size={16} color={active ? '#FFF' : theme.text} />
                                    <Text style={[styles.chipLabel, { color: active ? '#FFF' : theme.text }]}>{s.label}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Walk Hours Picker (only for walks) */}
                {serviceType === 'walking' && (
                    <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                            <Icon name="time-outline" size={16} color={theme.text} />
                            <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>{t('createBooking.walkDuration')}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                            <TouchableOpacity
                                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: walkHours <= 1 ? theme.border : COLORS.primary, justifyContent: 'center', alignItems: 'center' }}
                                onPress={() => setWalkHours(Math.max(1, walkHours - 1))}
                                disabled={walkHours <= 1}
                            >
                                <Icon name="remove" size={22} color="#FFF" />
                            </TouchableOpacity>
                            <View style={{ alignItems: 'center', minWidth: 80 }}>
                                <Text style={{ fontSize: 36, fontWeight: '900', color: theme.text }}>{walkHours}</Text>
                                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary }}>{walkHours === 1 ? t('createBooking.hour') : t('createBooking.hours')}</Text>
                            </View>
                            <TouchableOpacity
                                style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: walkHours >= 24 ? theme.border : COLORS.primary, justifyContent: 'center', alignItems: 'center' }}
                                onPress={() => setWalkHours(Math.min(24, walkHours + 1))}
                                disabled={walkHours >= 24}
                            >
                                <Icon name="add" size={22} color="#FFF" />
                            </TouchableOpacity>
                        </View>
                        <Text style={{ textAlign: 'center', fontSize: 12, color: theme.textSecondary, marginTop: 8 }}>{t('createBooking.maxHours')}</Text>

                        {/* Start date + time only for walks */}
                        <View style={{ marginTop: 18 }}>
                            <View style={[styles.dateRow]}>
                                <TouchableOpacity
                                    style={[styles.dateBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
                                    onPress={() => setShowStartPicker(true)}
                                >
                                    <Text style={[styles.dateLabel, { color: theme.textSecondary }]}>{t('createBooking.startDate')}</Text>
                                    <Text style={[styles.dateValue, { color: theme.text }]}>{formatDate(startDate)}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.dateBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
                                    onPress={() => setShowStartTimePicker(true)}
                                >
                                    <Text style={[styles.dateLabel, { color: theme.textSecondary }]}>{t('createBooking.startTime')}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Icon name="time-outline" size={14} color={COLORS.primary} />
                                        <Text style={[styles.dateValue, { color: theme.text }]}>{formatTime(startDate)}</Text>
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )}

                {/* Dates & Times - only for hotel */}
                {serviceType === 'hotel' && (
                <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                        <Icon name="calendar-outline" size={16} color={theme.text} />
                        <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>{t('createBooking.datesAndTime')}</Text>
                    </View>

                    {/* Date row */}
                    <View style={styles.dateRow}>
                        <TouchableOpacity
                            style={[styles.dateBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
                            onPress={() => setShowStartPicker(true)}
                        >
                            <Text style={[styles.dateLabel, { color: theme.textSecondary }]}>{t('createBooking.startDate')}</Text>
                            <Text style={[styles.dateValue, { color: theme.text }]}>{formatDate(startDate)}</Text>
                        </TouchableOpacity>
                        <Icon name="arrow-forward" size={18} color={theme.textSecondary} />
                        <TouchableOpacity
                            style={[styles.dateBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
                            onPress={() => setShowEndPicker(true)}
                        >
                            <Text style={[styles.dateLabel, { color: theme.textSecondary }]}>{t('createBooking.endDate')}</Text>
                            <Text style={[styles.dateValue, { color: theme.text }]}>{formatDate(endDate)}</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Time row */}
                    <View style={[styles.dateRow, { marginTop: 12 }]}>
                        <TouchableOpacity
                            style={[styles.dateBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
                            onPress={() => setShowStartTimePicker(true)}
                        >
                            <Text style={[styles.dateLabel, { color: theme.textSecondary }]}>{t('createBooking.startTime')}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Icon name="time-outline" size={14} color={COLORS.primary} />
                                <Text style={[styles.dateValue, { color: theme.text }]}>{formatTime(startDate)}</Text>
                            </View>
                        </TouchableOpacity>
                        <Icon name="arrow-forward" size={18} color={theme.textSecondary} />
                        <TouchableOpacity
                            style={[styles.dateBtn, { backgroundColor: theme.background, borderColor: theme.border }]}
                            onPress={() => setShowEndTimePicker(true)}
                        >
                            <Text style={[styles.dateLabel, { color: theme.textSecondary }]}>{t('createBooking.endTime')}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Icon name="time-outline" size={14} color={COLORS.primary} />
                                <Text style={[styles.dateValue, { color: theme.text }]}>{formatTime(endDate)}</Text>
                            </View>
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
                    {showStartTimePicker && (
                        <DateTimePicker
                            value={startDate}
                            mode="time"
                            is24Hour={true}
                            onChange={(e, d) => {
                                setShowStartTimePicker(false);
                                if (d) {
                                    const updated = new Date(startDate);
                                    updated.setHours(d.getHours(), d.getMinutes());
                                    setStartDate(updated);
                                }
                            }}
                        />
                    )}
                    {showEndTimePicker && (
                        <DateTimePicker
                            value={endDate}
                            mode="time"
                            is24Hour={true}
                            onChange={(e, d) => {
                                setShowEndTimePicker(false);
                                if (d) {
                                    const updated = new Date(endDate);
                                    updated.setHours(d.getHours(), d.getMinutes());
                                    setEndDate(updated);
                                }
                            }}
                        />
                    )}
                </View>
                )}

                {/* Common pickers (also used by walks) */}
                {showStartPicker && serviceType === 'walking' && (
                    <DateTimePicker
                        value={startDate}
                        mode="date"
                        minimumDate={new Date()}
                        onChange={(e, d) => { setShowStartPicker(false); if (d) setStartDate(d); }}
                    />
                )}
                {showStartTimePicker && serviceType === 'walking' && (
                    <DateTimePicker
                        value={startDate}
                        mode="time"
                        is24Hour={true}
                        onChange={(e, d) => {
                            setShowStartTimePicker(false);
                            if (d) {
                                const updated = new Date(startDate);
                                updated.setHours(d.getHours(), d.getMinutes());
                                setStartDate(updated);
                            }
                        }}
                    />
                )}

                {/* My Pets */}
                <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                        <Icon name="paw-outline" size={16} color={theme.text} />
                        <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>{t('createBooking.selectPets')}</Text>
                    </View>
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
                                        <Text style={{ fontSize: 14 }}>{pet.species === 'perro' || pet.species === 'dog' ? '' : pet.species === 'gato' || pet.species === 'cat' ? '' : ''}</Text>
                                        <Text style={[styles.chipLabel, { color: active ? '#FFF' : theme.text }]}>{pet.name}</Text>
                                        {active && <Icon name="checkmark-circle" size={16} color="#FFF" />}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    ) : (
                        <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                            <Icon name="paw-outline" size={36} color={COLORS.textLight} />
                            <Text style={[{ color: theme.textSecondary, marginTop: 8 }]}>{t('createBooking.noPetsRegistered')}</Text>
                        </View>
                    )}
                </View>

                {/* Notes */}
                <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                        <Icon name="document-text-outline" size={16} color={theme.text} />
                        <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>{t('createBooking.notesOptional')}</Text>
                    </View>
                    <TextInput
                        style={[styles.notesInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                        value={notes}
                        onChangeText={setNotes}
                        placeholder={t('createBooking.notesPlaceholder')}
                        placeholderTextColor={theme.textSecondary}
                        multiline
                        maxLength={500}
                    />
                </View>

                {/* Price summary */}
                {serviceType && Number(caregiver.price) > 0 && (
                    <View style={[styles.section, { backgroundColor: theme.cardBackground }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                            <Icon name="card-outline" size={16} color={theme.text} />
                            <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 0 }]}>{t('createBooking.summary')}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{t('createBooking.caregiverRate')}</Text>
                            <Text style={[styles.summaryValue, { color: theme.text }]}>{caregiver.price}€/hora</Text>
                        </View>
                        {serviceType === 'walking' && (
                            <View style={styles.summaryRow}>
                                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{t('createBooking.walkHours')}</Text>
                                <Text style={[styles.summaryValue, { color: theme.text }]}>{walkHours}h</Text>
                            </View>
                        )}
                        <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
                        <View style={styles.summaryRow}>
                            <Text style={[styles.totalLabel, { color: theme.text }]}>{t('createBooking.estimatedTotal')}</Text>
                            <Text style={styles.totalValue}>{calculatePrice().toFixed(2)}€</Text>
                        </View>
                        <Text style={[styles.summaryNote, { color: theme.textSecondary }]}>
                            {t('createBooking.paymentNote')}
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
                            <Icon name="send" size={18} color="#FFF" />
                            <Text style={styles.submitText}>{t('createBooking.submitBooking')}</Text>
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
        padding: 16, borderRadius: 20, marginBottom: 16,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
    },
    cgAvatarImg: { width: 60, height: 60, borderRadius: 20 },
    cgName: { fontSize: 18, fontWeight: '800' },

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
