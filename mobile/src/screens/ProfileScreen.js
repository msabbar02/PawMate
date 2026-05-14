import React, { useState, useContext, useEffect, useCallback } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity, ScrollView,
    Image, Alert, ActivityIndicator, TextInput, Platform,
    Switch, KeyboardAvoidingView,
} from 'react-native';
import Icon from '../components/Icon';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { supabase } from '../config/supabase';
import { uploadImageToStorage, saveAvatar } from '../utils/storageHelpers';
import { COLORS } from '../constants/colors';
import { useTranslation } from '../context/LanguageContext';

// Funciones auxiliares compartidas en este módulo.
const formatDate = (d, lang = 'es') => {
    if (!d) return '';
    if (typeof d === 'string') return d;
    const date = d?.toDate ? d.toDate() : new Date(d);
    return date.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES');
};

const sectionLabel = (text, theme) => (
    <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>{text}</Text>
);

/**
 * Fila de campo editable con etiqueta y `TextInput` o texto estático.
 */
const Field = ({ label, value, onChangeText, placeholder, keyboardType, editable = true, theme, multiline }) => (
    <View style={[styles.fieldRow, { backgroundColor: theme.cardBackground }]}>
        <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{label}</Text>
        {editable ? (
            <TextInput
                style={[styles.fieldInput, { color: theme.text }]}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder || label}
                placeholderTextColor={theme.textSecondary}
                keyboardType={keyboardType || 'default'}
                multiline={multiline}
            />
        ) : (
            <Text style={[styles.fieldValue, { color: theme.textSecondary }]}>{value || '—'}</Text>
        )}
    </View>
);

/**
 * Pantalla de perfil del usuario: datos personales, foto, ubicación,
 * preferencias, estadísticas y acciones de cuenta.
 */
export default function ProfileScreen({ navigation }) {
    const { userData, user, refreshUserData, signOut } = useContext(AuthContext);
    const { theme, isDarkMode } = useContext(ThemeContext);
    const { t, lang } = useTranslation();

    // Campos editables del perfil (inicializados desde userData).
    // Nota: 'avatar' guarda la foto; 'address' es el sub-objeto de ubicación.
    const [firstName,    setFirstName]    = useState(userData?.firstName    || userData?.fullName?.split(' ')[0] || '');
    const [lastName,     setLastName]     = useState(userData?.lastName     || userData?.fullName?.split(' ').slice(1).join(' ') || '');
    const [phone,        setPhone]        = useState(userData?.phone        || '');
    const [city,         setCity]         = useState(userData?.address?.city     || userData?.city     || '');
    const [postalCode,   setPostalCode]   = useState(userData?.address?.postalCode || userData?.postalCode || '');
    const [province,     setProvince]     = useState(userData?.address?.province  || userData?.province  || '');
    const [country,      setCountry]      = useState(userData?.address?.country   || userData?.country   || 'España');
    // Foto: acepta URLs https:// y data URIs base64.
    const rawAvatar = userData?.avatar || userData?.photoURL || null;
    const [photoUri, setPhotoUri] = useState(
        rawAvatar && (rawAvatar.startsWith('https://') || rawAvatar.startsWith('data:')) ? rawAvatar : null
    );

    // Mantiene la foto sincronizada con userData (necesario al refrescar en modo cuidador).
    useEffect(() => {
        const fresh = userData?.avatar || userData?.photoURL || null;
        if (fresh && (fresh.startsWith('https://') || fresh.startsWith('data:'))) {
            setPhotoUri(fresh);
        }
    }, [userData?.avatar, userData?.photoURL]);

    // Fecha de nacimiento.
    const [birthDate,    setBirthDate]    = useState(
        userData?.birthDate ? new Date(userData.birthDate?.seconds ? userData.birthDate.seconds * 1000 : userData.birthDate) : new Date(1990, 0, 1)
    );
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Preferencias del usuario.
    const [saveWalks,    setSaveWalks]    = useState(userData?.saveWalks    ?? true);
    const [saveLocation, setSaveLocation] = useState(userData?.saveLocation ?? true);

    // Estadísticas (solo lectura).
    const totalWalks    = userData?.totalWalks    ?? 0;
    const totalDistance = userData?.totalDistance ?? 0;
    const totalMinutes  = userData?.totalMinutes  ?? 0;
    const distanceLabel = totalDistance >= 1 ? `${totalDistance.toFixed(1)} km` : `${Math.round(totalDistance * 1000)} m`;
    const timeLabel     = totalMinutes >= 60 ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m` : `${totalMinutes} min`;

    // Estado de la UI.
    const [saving,         setSaving]         = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [fetchingCity,   setFetchingCity]   = useState(false);

    // Sincroniza los campos cuando userData cambia.
    useEffect(() => {
        if (userData) {
            setFirstName(   userData.firstName    || userData.fullName?.split(' ')[0] || '');
            setLastName(    userData.lastName     || userData.fullName?.split(' ').slice(1).join(' ') || '');
            setPhone(       userData.phone        || '');
            setCity(        userData.address?.city     || userData.city     || '');
            setPostalCode(  userData.address?.postalCode || userData.postalCode || '');
            setProvince(    userData.address?.province  || userData.province  || '');
            setCountry(     userData.address?.country   || userData.country   || 'España');
            setSaveWalks(   userData.saveWalks    ?? true);
            setSaveLocation(userData.saveLocation ?? true);
            // Solo usa el avatar si es una URL real de Storage o un data URI.
            const av = userData.avatar || userData.photoURL || null;
            if (av && (av.startsWith('https://') || av.startsWith('data:'))) setPhotoUri(av);
            if (userData.birthDate) {
                const ts = userData.birthDate?.seconds;
                setBirthDate(ts ? new Date(ts * 1000) : new Date(userData.birthDate));
            }
        }
    }, [userData]);

    // ── Get city from GPS ──────────────────────────────────
    const fetchCityFromLocation = useCallback(async () => {
        setFetchingCity(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(
                    t('profile.locationPermission'),
                    t('profile.locationPermissionMsg'),
                    [{ text: 'OK' }]
                );
                return;
            }
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const [geo] = await Location.reverseGeocodeAsync({
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
            });
            if (geo) {
                setCity(        geo.city         || geo.subregion || '');
                setPostalCode(  geo.postalCode   || '');
                setProvince(    geo.region       || '');
                setCountry(     geo.country      || 'España');
            }
        } catch (e) {
            Alert.alert(t('common.error'), t('profile.locationError'));
        } finally {
            setFetchingCity(false);
        }
    }, []);

    // ── Change Photo ───────────────────────────────────────
    const handleChangePhoto = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert(t('profile.galleryPermission'), t('profile.galleryPermissionMsg'));
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.25,     // calidad baja para que el data URI no sea excesivo
        });
        if (result.canceled) return;

        const localUri = result.assets[0].uri;
        setPhotoUri(localUri); // UI optimista
        setUploadingPhoto(true);
        try {
            // Sube el avatar a Supabase Storage.
            const base64Url = await saveAvatar(localUri, user.id);
            setPhotoUri(base64Url);
            await refreshUserData();
        } catch (e) {
            // Revierte a la foto anterior si falla la subida.
            const prev = rawAvatar && (rawAvatar.startsWith('https://') || rawAvatar.startsWith('data:')) ? rawAvatar : null;
            setPhotoUri(prev);
            Alert.alert(t('profile.photoUploadError'), e?.message || t('common.unknownError'));
        } finally {
            setUploadingPhoto(false);
        }
    };

    // Los mismos 4 campos que usa la tarjeta de progreso, para mantener la barra sincronizada.
    const completionFields = [
        !!photoUri,
        !!phone.trim(),
        !!city.trim(),
        !!firstName.trim(),
    ];
    const completionPercent = Math.round((completionFields.filter(Boolean).length / completionFields.length) * 100);

    /**
     * Guarda todos los campos del perfil en la tabla `users` de Supabase y
     * recarga `userData` desde `AuthContext`.
     */
    const handleSave = async () => {
        if (!firstName.trim()) return Alert.alert(t('common.error'), t('profile.nameRequired'));
        setSaving(true);
        try {
            const { data, error } = await supabase.from('users').update({
                firstName:    firstName.trim(),
                lastName:     lastName.trim(),
                fullName:     `${firstName.trim()} ${lastName.trim()}`.trim(),
                phone:        phone.trim(),
                address: {
                    city:       city.trim(),
                    postalCode: postalCode.trim(),
                    province:   province.trim(),
                    country:    country.trim(),
                },
                city:         city.trim(),
                postalCode:   postalCode.trim(),
                province:     province.trim(),
                country:      country.trim(),
                birthDate:    birthDate.toISOString(),
                saveWalks,
                saveLocation,
            }).eq('id', user.id).select();
            if (error) throw error;
            if (!data || data.length === 0) {
                throw new Error('No se actualizó ninguna fila. Revisa los permisos (RLS) en Supabase para la tabla users.');
            }
            await refreshUserData();
            Alert.alert(t('profile.saved'), t('profile.savedMsg'), [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } catch (e) {
            Alert.alert(t('common.error'), e?.message || t('profile.saveError'));
        } finally {
            setSaving(false);
        }
    };

    /**
     * Muestra un diálogo de confirmación y cierra la sesión del usuario.
     */
    const handleSignOut = () => {
        Alert.alert(t('profile.signOut'), t('profile.signOutConfirm'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('profile.signOutBtn'), style: 'destructive', onPress: () => signOut().catch(() => {}) },
        ]);
    };

    const role     = userData?.role || 'normal';
    const isNormal = role === 'normal';
    const isPending = userData?.verificationStatus === 'pending';

    return (
        <KeyboardAvoidingView
            style={[styles.root, { backgroundColor: theme.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <StatusBar style={isDarkMode ? 'light' : 'dark'} />

            {/* ── HEADER ── */}
            <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <Icon name="arrow-back" size={22} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>{t('profile.title')}</Text>
                <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.headerBtn}>
                    {saving
                        ? <ActivityIndicator size="small" color={COLORS.primary} />
                        : <Text style={[styles.saveText, { color: COLORS.primary }]}>{t('common.save')}</Text>
                    }
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 50 }}>

                {/* ── PHOTO + NAME SUMMARY ── */}
                <View style={[styles.heroSection, { backgroundColor: theme.cardBackground }]}>
                    <TouchableOpacity
                        style={styles.avatarWrapper}
                        onPress={handleChangePhoto}
                        disabled={uploadingPhoto}
                        activeOpacity={0.85}
                    >
                        {photoUri ? (
                            <Image source={{ uri: photoUri }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: COLORS.primaryBg }]}>
                                <Text style={{ fontSize: 48 }}></Text>
                            </View>
                        )}
                        <View style={[styles.cameraBadge, { backgroundColor: COLORS.primary, borderColor: theme.cardBackground }]}>
                            {uploadingPhoto
                                ? <ActivityIndicator size="small" color="#FFF" />
                                : <Icon name="camera" size={15} color="#FFF" />
                            }
                        </View>
                    </TouchableOpacity>

                    <Text style={[styles.heroName, { color: theme.text }]}>
                        {[userData?.firstName, userData?.lastName].filter(Boolean).join(' ') || userData?.fullName || user?.email?.split('@')[0] || t('common.user')}
                    </Text>
                    <Text style={[styles.heroEmail, { color: theme.textSecondary }]}>{user?.email}</Text>

                    {/* Role badge */}
                    {role === 'caregiver' ? (
                        <View style={[styles.roleBadge, { backgroundColor: COLORS.secondaryLight }]}>
                            <Text style={[styles.roleBadgeText, { color: COLORS.secondary }]}>{t('profile.caregiverVerified')}</Text>
                        </View>
                    ) : role === 'owner' ? (
                        <View style={[styles.roleBadge, { backgroundColor: COLORS.primaryBg }]}>
                            <Text style={[styles.roleBadgeText, { color: COLORS.primary }]}>{t('profile.ownerVerified')}</Text>
                        </View>
                    ) : isPending ? (
                        <View style={[styles.roleBadge, { backgroundColor: COLORS.warningLight }]}>
                            <Text style={[styles.roleBadgeText, { color: COLORS.warning }]}>{t('profile.verificationPending')}</Text>
                        </View>
                    ) : (
                        <View style={[styles.roleBadge, { backgroundColor: theme.background }]}>
                            <Text style={[styles.roleBadgeText, { color: theme.textSecondary }]}>{t('profile.userBadge')}</Text>
                        </View>
                    )}
                </View>

                {/* ── STATS ROW ── */}
                <View style={styles.statsRow}>
                    {[
                        { icon: 'walk-outline',     value: totalWalks,      label: t('profile.walks') },
                        { icon: 'navigate-outline', value: distanceLabel,   label: t('profile.distance') },
                        { icon: 'time-outline',     value: timeLabel,       label: t('profile.time') },
                    ].map((s, i) => (
                        <View key={i} style={[styles.statCard, { backgroundColor: theme.cardBackground }]}>
                            <Icon name={s.icon} size={20} color={COLORS.primary} />
                            <Text style={[styles.statValue, { color: theme.text }]}>{s.value}</Text>
                            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{s.label}</Text>
                        </View>
                    ))}
                </View>

                {/* ── CAREGIVER BADGE (only for caregivers) ── */}
                {userData?.role === 'caregiver' && (() => {
                    const TIERS = [
                        { min: 0,  label: t('profile.badgeBronze'), emoji: '', color: '#CD7F32', bg: '#FDF2E9' },
                        { min: 5,  label: t('profile.badgeSilver'), emoji: '', color: '#9CA3AF', bg: '#F3F4F6' },
                        { min: 20, label: t('profile.badgeGold'),   emoji: '', color: '#F5A623', bg: '#FEF3C7' },
                    ];
                    const completed = userData?.completedServices || 0;
                    let badge = TIERS[0];
                    for (const t of TIERS) { if (completed >= t.min) badge = t; }
                    const next = TIERS.find(t => completed < t.min);
                    const pct = next ? ((completed - badge.min) / (next.min - badge.min)) * 100 : 100;

                    return (
                        <View style={[styles.section, { paddingTop: 14 }]}>
                            <View style={[styles.completionCard, { backgroundColor: theme.cardBackground }]}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                    <Text style={{ fontSize: 24 }}>{badge.emoji}</Text>
                                    <Text style={[styles.completionTitle, { color: badge.color }]}>{t('roles.caregiver')} {badge.label}</Text>
                                    <Text style={{ color: theme.textSecondary, fontSize: 13, marginLeft: 'auto' }}>{completed} {t('profile.servicesText')}</Text>
                                </View>
                                {next ? (
                                    <>
                                        <View style={styles.completionTrack}>
                                            <View style={[styles.completionFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: badge.color }]} />
                                        </View>
                                        <Text style={[styles.completionHint, { color: theme.textSecondary }]}>
                                            {next.min - completed} {t('profile.servicesMore')} {next.emoji} {next.label}
                                        </Text>
                                    </>
                                ) : (
                                    <Text style={[styles.completionHint, { color: badge.color, fontWeight: '800' }]}>{t('profile.maxLevel')}</Text>
                                )}
                            </View>
                        </View>
                    );
                })()}

                {/* ── PROFILE COMPLETION ── */}
                {completionPercent < 100 && (() => {
                    const steps = [
                        { done: !!photoUri,      icon: 'camera-outline',  label: t('profile.profilePhoto') },
                        { done: !!phone.trim(),  icon: 'call-outline',    label: t('profile.phone') },
                        { done: !!city.trim(),   icon: 'location-outline',label: t('profile.city') },
                        { done: !!firstName.trim(), icon: 'person-outline', label: t('profile.firstName') },
                    ];
                    const doneCount = steps.filter(s => s.done).length;
                    return (
                        <View style={[styles.section, { paddingTop: 14 }]}>
                            <View style={[styles.completionCard, { backgroundColor: theme.cardBackground }]}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.primaryBg, justifyContent: 'center', alignItems: 'center' }}>
                                            <Icon name="shield-checkmark-outline" size={20} color={COLORS.primary} />
                                        </View>
                                        <Text style={[styles.completionTitle, { color: theme.text }]}>{t('profile.completeProfile')}</Text>
                                    </View>
                                    <View style={{ backgroundColor: COLORS.primaryBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
                                        <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.primary }}>{doneCount}/{steps.length}</Text>
                                    </View>
                                </View>
                                <View style={styles.completionTrack}>
                                    <View style={[styles.completionFill, { width: `${completionPercent}%` }]} />
                                </View>
                                <View style={{ marginTop: 12, gap: 8 }}>
                                    {steps.map((step, i) => (
                                        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: step.done ? '#dcfce7' : (isDarkMode ? '#1e293b' : '#f1f5f9'), justifyContent: 'center', alignItems: 'center' }}>
                                                <Icon name={step.done ? 'checkmark' : step.icon} size={14} color={step.done ? '#16a34a' : theme.textSecondary} />
                                            </View>
                                            <Text style={{ fontSize: 14, fontWeight: '600', color: step.done ? '#16a34a' : theme.textSecondary, textDecorationLine: step.done ? 'line-through' : 'none' }}>
                                                {step.label}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        </View>
                    );
                })()}

                {/* ── PERSONAL DATA ── */}
                <View style={styles.section}>
                    {sectionLabel(t('profile.personalData'), theme)}

                    <Field label={t('profile.firstName')}    value={firstName}  onChangeText={setFirstName}  theme={theme} />
                    <Field label={t('profile.lastName')} value={lastName}   onChangeText={setLastName}   theme={theme} />
                    <Field label={t('profile.email')}     value={user?.email || ''} theme={theme} editable={false} />
                    <Field label={t('profile.phone')}  value={phone}      onChangeText={setPhone}      theme={theme} keyboardType="phone-pad" />

                    {/* Date of birth */}
                    <TouchableOpacity
                        style={[styles.fieldRow, { backgroundColor: theme.cardBackground }]}
                        onPress={() => setShowDatePicker(true)}
                    >
                        <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{t('profile.birthdate')}</Text>
                        <Text style={[styles.fieldValue, { color: theme.text }]}>{formatDate(birthDate, lang)}</Text>
                        <Icon name="calendar-outline" size={18} color={theme.textSecondary} style={{ marginLeft: 8 }} />
                    </TouchableOpacity>

                    {showDatePicker && (
                        <DateTimePicker
                            value={birthDate}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            maximumDate={new Date()}
                            minimumDate={new Date(1920, 0, 1)}
                            onChange={(event, selected) => {
                                setShowDatePicker(Platform.OS === 'ios');
                                if (selected) setBirthDate(selected);
                            }}
                        />
                    )}
                </View>

                {/* ── LOCATION ── */}
                <View style={styles.section}>
                    {sectionLabel(t('profile.location'), theme)}

                    {/* City with GPS button */}
                    <View style={[styles.fieldRow, { backgroundColor: theme.cardBackground }]}>
                        <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{t('profile.city')}</Text>
                        <TextInput
                            style={[styles.fieldInput, { color: theme.text, flex: 1 }]}
                            value={city}
                            onChangeText={setCity}
                            placeholder={t('profile.cityPlaceholder')}
                            placeholderTextColor={theme.textSecondary}
                        />
                        <TouchableOpacity onPress={fetchCityFromLocation} disabled={fetchingCity} style={styles.gpsBtn}>
                            {fetchingCity
                                ? <ActivityIndicator size="small" color={COLORS.primary} />
                                : <Icon name="locate" size={18} color={COLORS.primary} />
                            }
                        </TouchableOpacity>
                    </View>

                    <Field label={t('profile.postalCode')} value={postalCode} onChangeText={setPostalCode} theme={theme} keyboardType="numeric" />
                    <Field label={t('profile.province')}     value={province}   onChangeText={setProvince}   theme={theme} />
                    <Field label={t('profile.country')}          value={country}    onChangeText={setCountry}    theme={theme} />

                    <View style={[styles.locationNote, { backgroundColor: COLORS.primaryBg }]}>
                        <Icon name="information-circle-outline" size={16} color={COLORS.primary} />
                        <Text style={[styles.locationNoteText, { color: COLORS.primary }]}>
                            {t('profile.locationGPSDesc')}
                        </Text>
                    </View>
                </View>

                {/* ── PRIVACY & TRACKING ── */}
                <View style={styles.section}>
                    {sectionLabel(t('profile.privacy'), theme)}

                    <View style={[styles.toggleRow, { backgroundColor: theme.cardBackground }]}>
                        <View style={{ flex: 1, marginRight: 12 }}>
                            <Text style={[styles.toggleTitle, { color: theme.text }]}>{t('profile.saveWalkHistory')}</Text>
                            <Text style={[styles.toggleSub, { color: theme.textSecondary }]}>{t('profile.saveWalkHistoryDesc')}</Text>
                        </View>
                        <Switch
                            value={saveWalks}
                            onValueChange={setSaveWalks}
                            trackColor={{ true: COLORS.primary, false: COLORS.border }}
                            thumbColor="#FFF"
                        />
                    </View>

                    <View style={[styles.toggleRow, { backgroundColor: theme.cardBackground }]}>
                        <View style={{ flex: 1, marginRight: 12 }}>
                            <Text style={[styles.toggleTitle, { color: theme.text }]}>{t('profile.shareLiveLocation')}</Text>
                            <Text style={[styles.toggleSub, { color: theme.textSecondary }]}>{t('profile.shareLiveLocationDesc')}</Text>
                        </View>
                        <Switch
                            value={saveLocation}
                            onValueChange={setSaveLocation}
                            trackColor={{ true: COLORS.primary, false: COLORS.border }}
                            thumbColor="#FFF"
                        />
                    </View>
                </View>

                {/* ── ROLE CHANGE (normal users only) ── */}
                {isNormal && !isPending && (
                    <View style={styles.section}>
                        {sectionLabel(t('profile.verifyAccount'), theme)}
                        <Text style={[styles.verifyDesc, { color: theme.textSecondary }]}>
                            {t('profile.verifyIdentity')}
                        </Text>

                        <TouchableOpacity
                            style={[styles.roleBtn, { backgroundColor: COLORS.primaryBg, borderColor: COLORS.primary }]}
                            onPress={() => navigation.navigate('Verify')}
                        >
                            <View style={[styles.roleBtnIcon, { backgroundColor: COLORS.primary }]}>
                                <Text style={{ fontSize: 22 }}></Text>
                            </View>
                            <View style={{ flex: 1, marginLeft: 14 }}>
                                <Text style={[styles.roleBtnTitle, { color: COLORS.primary }]}>{t('profile.becomeOwner')}</Text>
                                <Text style={[styles.roleBtnSub, { color: COLORS.primary }]}>{t('profile.becomeOwnerDesc')}</Text>
                            </View>
                            <Icon name="chevron-forward" size={20} color={COLORS.primary} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.roleBtn, { backgroundColor: COLORS.secondaryLight, borderColor: COLORS.secondary }]}
                            onPress={() => navigation.navigate('Verify')}
                        >
                            <View style={[styles.roleBtnIcon, { backgroundColor: COLORS.secondary }]}>
                                <Text style={{ fontSize: 22 }}></Text>
                            </View>
                            <View style={{ flex: 1, marginLeft: 14 }}>
                                <Text style={[styles.roleBtnTitle, { color: COLORS.secondary }]}>{t('profile.becomeCaregiver')}</Text>
                                <Text style={[styles.roleBtnSub, { color: COLORS.secondary }]}>{t('profile.becomeCaregiverDesc')}</Text>
                            </View>
                            <Icon name="chevron-forward" size={20} color={COLORS.secondary} />
                        </TouchableOpacity>
                    </View>
                )}

                {/* ── SAVE BUTTON ── */}
                <View style={styles.section}>
                    <TouchableOpacity
                        style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                        onPress={handleSave}
                        disabled={saving}
                    >
                        {saving
                            ? <ActivityIndicator color="#FFF" />
                            : <>
                                <Icon name="checkmark-circle-outline" size={20} color="#FFF" />
                                <Text style={styles.saveBtnText}>{t('profile.saveChanges')}</Text>
                              </>
                        }
                    </TouchableOpacity>
                </View>

                {/* ── LOGOUT ── */}
                <View style={[styles.section, { paddingBottom: 8 }]}>
                    <TouchableOpacity
                        style={[styles.logoutBtn, { borderColor: COLORS.danger }]}
                        onPress={handleSignOut}
                    >
                        <Icon name="log-out-outline" size={20} color={COLORS.danger} />
                        <Text style={[styles.logoutBtnText, { color: COLORS.danger }]}>{t('profile.signOut')}</Text>
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1 },

    // Header
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 60 : 36,
        paddingBottom: 14,
        borderBottomWidth: 1,
    },
    headerBtn: { minWidth: 60, padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: '800' },
    saveText: { fontWeight: '800', fontSize: 15, textAlign: 'right' },

    // Hero
    heroSection: {
        alignItems: 'center',
        paddingTop: 28, paddingBottom: 22, paddingHorizontal: 20,
    },
    avatarWrapper: { position: 'relative', marginBottom: 14 },
    avatar: { width: 100, height: 100, borderRadius: 28 },
    avatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
    cameraBadge: {
        position: 'absolute', bottom: 0, right: 0,
        width: 32, height: 32, borderRadius: 12,
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 2.5,
    },
    heroName: { fontSize: 22, fontWeight: '800', marginBottom: 3, textAlign: 'center', letterSpacing: -0.3 },
    heroEmail: { fontSize: 13, marginBottom: 10, textAlign: 'center' },
    roleBadge: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    },
    roleBadgeText: { fontSize: 13, fontWeight: '700' },

    // Stats
    statsRow: {
        flexDirection: 'row',
        paddingHorizontal: 12, paddingTop: 14, paddingBottom: 4,
        gap: 10,
    },
    statCard: {
        flex: 1, borderRadius: 18, padding: 14,
        alignItems: 'center', gap: 5,
        shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    },
    statValue: { fontSize: 14, fontWeight: '900', textAlign: 'center' },
    statLabel: { fontSize: 10, fontWeight: '600', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 },

    // Sections
    section: { paddingHorizontal: 16, paddingTop: 20 },
    sectionLabel: {
        fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
        letterSpacing: 0.6, marginBottom: 10, paddingLeft: 4,
    },

    // Fields
    fieldRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 14,
        borderRadius: 16, marginBottom: 8,
        shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    },
    fieldLabel: { fontSize: 13, fontWeight: '600', width: 130 },
    fieldInput: { flex: 1, fontSize: 14, fontWeight: '500', paddingVertical: 0 },
    fieldValue: { flex: 1, fontSize: 14 },

    // GPS button inside city field
    gpsBtn: {
        width: 34, height: 34, borderRadius: 17,
        backgroundColor: COLORS.primaryBg,
        justifyContent: 'center', alignItems: 'center',
        marginLeft: 8,
    },

    // Location note
    locationNote: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 8,
        borderRadius: 14, padding: 12, marginTop: 4,
    },
    locationNoteText: { flex: 1, fontSize: 12, lineHeight: 18 },

    // Toggles
    toggleRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 14,
        borderRadius: 16, marginBottom: 8,
        shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    },
    toggleTitle: { fontSize: 14, fontWeight: '700' },
    toggleSub: { fontSize: 12, marginTop: 2 },

    // Role buttons
    verifyDesc: { fontSize: 13, lineHeight: 20, marginBottom: 14 },
    roleBtn: {
        flexDirection: 'row', alignItems: 'center',
        borderRadius: 18, padding: 16, marginBottom: 10,
        borderWidth: 1.5,
        shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
    },
    roleBtnIcon: {
        width: 46, height: 46, borderRadius: 14,
        justifyContent: 'center', alignItems: 'center',
    },
    roleBtnTitle: { fontSize: 15, fontWeight: '800' },
    roleBtnSub: { fontSize: 12, marginTop: 2 },

    // Save button
    saveBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        backgroundColor: COLORS.primary, borderRadius: 18,
        paddingVertical: 16,
        shadowColor: COLORS.primary, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
    },
    saveBtnText: { color: '#FFF', fontWeight: '800', fontSize: 16 },

    // Logout
    logoutBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        borderRadius: 18, paddingVertical: 14,
        borderWidth: 1.5,
    },
    logoutBtnText: { fontWeight: '700', fontSize: 15 },

    // Profile completion bar
    completionCard: {
        borderRadius: 18, padding: 16,
        shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
    },
    completionTitle: { fontSize: 15, fontWeight: '800' },
    completionPercent: { fontSize: 18, fontWeight: '900' },
    completionTrack: {
        height: 8, borderRadius: 4,
        backgroundColor: COLORS.border, overflow: 'hidden',
    },
    completionFill: {
        height: 8, borderRadius: 4,
        backgroundColor: COLORS.primary,
    },
    completionHint: { fontSize: 13, marginTop: 10, fontWeight: '500' },
});
