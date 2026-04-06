import React, { useState, useContext, useEffect, useCallback } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity, ScrollView,
    Image, Alert, ActivityIndicator, TextInput, Platform,
    Switch, KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { supabase } from '../config/supabase';
import { uploadImageToStorage, saveAvatarToFirestore } from '../utils/storageHelpers';
import { COLORS } from '../constants/colors';

// ─── helpers ─────────────────────────────────────────────────
const formatDate = (d) => {
    if (!d) return '';
    if (typeof d === 'string') return d;
    const date = d?.toDate ? d.toDate() : new Date(d);
    return date.toLocaleDateString('es-ES');
};

const sectionLabel = (text, theme) => (
    <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>{text}</Text>
);

// ─── Field Row ────────────────────────────────────────────────
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

// ─── Main Component ───────────────────────────────────────────
export default function ProfileScreen({ navigation }) {
    const { userData, user, refreshUserData } = useContext(AuthContext);
    const { theme, isDarkMode } = useContext(ThemeContext);

    // ── Editable fields state (initialized from userData)
    // NOTE: Firestore uses 'avatar' for photo, 'address' sub-object for location
    const [firstName,    setFirstName]    = useState(userData?.firstName    || userData?.fullName?.split(' ')[0] || '');
    const [lastName,     setLastName]     = useState(userData?.lastName     || userData?.fullName?.split(' ').slice(1).join(' ') || '');
    const [phone,        setPhone]        = useState(userData?.phone        || '');
    const [city,         setCity]         = useState(userData?.address?.city     || userData?.city     || '');
    const [postalCode,   setPostalCode]   = useState(userData?.address?.postalCode || userData?.postalCode || '');
    const [province,     setProvince]     = useState(userData?.address?.province  || userData?.province  || '');
    const [country,      setCountry]      = useState(userData?.address?.country   || userData?.country   || 'España');
    // Photo: 'avatar' field, accept both base64 data URLs and https URLs
    const rawAvatar = userData?.avatar || userData?.photoURL || null;
    const [photoUri, setPhotoUri] = useState(
        rawAvatar && (rawAvatar.startsWith('https://') || rawAvatar.startsWith('data:')) ? rawAvatar : null
    );

    // Birth date
    const [birthDate,    setBirthDate]    = useState(
        userData?.birthDate ? new Date(userData.birthDate?.seconds ? userData.birthDate.seconds * 1000 : userData.birthDate) : new Date(1990, 0, 1)
    );
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Preferences
    const [saveWalks,    setSaveWalks]    = useState(userData?.saveWalks    ?? true);
    const [saveLocation, setSaveLocation] = useState(userData?.saveLocation ?? true);

    // Stats (read-only)
    const totalWalks    = userData?.totalWalks    ?? 0;
    const totalDistance = userData?.totalDistance ?? 0;
    const totalMinutes  = userData?.totalMinutes  ?? 0;
    const distanceLabel = totalDistance >= 1 ? `${totalDistance.toFixed(1)} km` : `${Math.round(totalDistance * 1000)} m`;
    const timeLabel     = totalMinutes >= 60 ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m` : `${totalMinutes} min`;

    // UI state
    const [saving,         setSaving]         = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [fetchingCity,   setFetchingCity]   = useState(false);

    // ── Sync from userData when it updates ────────────────
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
            // Only use avatar if it's a real Storage URL or base64
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
                    'Permiso de ubicación',
                    'Para detectar tu ciudad necesitamos acceso a tu ubicación. Sin él tampoco podrás hacer reservas.',
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
            Alert.alert('Error', 'No se pudo obtener la ubicación.');
        } finally {
            setFetchingCity(false);
        }
    }, []);

    // ── Change Photo ───────────────────────────────────────
    const handleChangePhoto = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permiso necesario', 'Necesitamos acceso a tu galería para cambiar la foto.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.25,     // low quality to keep base64 small
        });
        if (result.canceled) return;

        const localUri = result.assets[0].uri;
        setPhotoUri(localUri); // optimistic UI
        setUploadingPhoto(true);
        try {
            // Save as base64 directly to Supabase storage by using saveAvatarToFirestore (now maps to Supabase)
            const base64Url = await saveAvatarToFirestore(localUri, user.id);
            setPhotoUri(base64Url);
            await refreshUserData();
        } catch (e) {
            // Revert to previous photo on failure
            const prev = rawAvatar && (rawAvatar.startsWith('https://') || rawAvatar.startsWith('data:')) ? rawAvatar : null;
            setPhotoUri(prev);
            Alert.alert('Error al subir foto', e?.message || 'Error desconocido');
        } finally {
            setUploadingPhoto(false);
        }
    };

    // ── Profile Completion ──────────────────────────────────
    const completionFields = [
        !!firstName.trim(),
        !!lastName.trim(),
        !!phone.trim(),
        !!city.trim(),
        !!postalCode.trim(),
        !!province.trim(),
        !!photoUri,
        birthDate && birthDate.getFullYear() !== 1990,
    ];
    const completionPercent = Math.round((completionFields.filter(Boolean).length / completionFields.length) * 100);

    // ── Save All Profile Data ──────────────────────────────
    const handleSave = async () => {
        if (!firstName.trim()) return Alert.alert('Error', 'El nombre no puede estar vacío.');
        setSaving(true);
        try {
            await supabase.from('users').update({
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
            }).eq('id', user.id);
            await refreshUserData();
            Alert.alert('✅ Guardado', 'Tu perfil ha sido actualizado.');
        } catch (e) {
            Alert.alert('Error', 'No se pudo guardar. Inténtalo de nuevo.');
        } finally {
            setSaving(false);
        }
    };

    // ── Sign Out ───────────────────────────────────────────
    const handleSignOut = () => {
        Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Salir', style: 'destructive', onPress: () => supabase.auth.signOut().catch(() => {}) },
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
                    <Ionicons name="arrow-back" size={22} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Mi Perfil</Text>
                <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.headerBtn}>
                    {saving
                        ? <ActivityIndicator size="small" color={COLORS.primary} />
                        : <Text style={[styles.saveText, { color: COLORS.primary }]}>Guardar</Text>
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
                                <Text style={{ fontSize: 48 }}>🐾</Text>
                            </View>
                        )}
                        <View style={[styles.cameraBadge, { backgroundColor: COLORS.primary, borderColor: theme.cardBackground }]}>
                            {uploadingPhoto
                                ? <ActivityIndicator size="small" color="#FFF" />
                                : <Ionicons name="camera" size={15} color="#FFF" />
                            }
                        </View>
                    </TouchableOpacity>

                    <Text style={[styles.heroName, { color: theme.text }]}>
                        {[userData?.firstName, userData?.lastName].filter(Boolean).join(' ') || userData?.fullName || user?.email?.split('@')[0] || 'Usuario'}
                    </Text>
                    <Text style={[styles.heroEmail, { color: theme.textSecondary }]}>{user?.email}</Text>

                    {/* Role badge */}
                    {role === 'caregiver' ? (
                        <View style={[styles.roleBadge, { backgroundColor: COLORS.secondaryLight }]}>
                            <Text style={[styles.roleBadgeText, { color: COLORS.secondary }]}>🛡️ Cuidador Verificado</Text>
                        </View>
                    ) : role === 'owner' ? (
                        <View style={[styles.roleBadge, { backgroundColor: COLORS.primaryBg }]}>
                            <Text style={[styles.roleBadgeText, { color: COLORS.primary }]}>🐾 Dueño Verificado ✓</Text>
                        </View>
                    ) : isPending ? (
                        <View style={[styles.roleBadge, { backgroundColor: COLORS.warningLight }]}>
                            <Text style={[styles.roleBadgeText, { color: COLORS.warning }]}>⏳ Verificación en revisión</Text>
                        </View>
                    ) : (
                        <View style={[styles.roleBadge, { backgroundColor: theme.background }]}>
                            <Text style={[styles.roleBadgeText, { color: theme.textSecondary }]}>👤 Usuario</Text>
                        </View>
                    )}
                </View>

                {/* ── STATS ROW ── */}
                <View style={styles.statsRow}>
                    {[
                        { icon: 'walk-outline',     value: totalWalks,      label: 'Paseos' },
                        { icon: 'navigate-outline', value: distanceLabel,   label: 'Distancia' },
                        { icon: 'time-outline',     value: timeLabel,       label: 'Tiempo' },
                    ].map((s, i) => (
                        <View key={i} style={[styles.statCard, { backgroundColor: theme.cardBackground }]}>
                            <Ionicons name={s.icon} size={20} color={COLORS.primary} />
                            <Text style={[styles.statValue, { color: theme.text }]}>{s.value}</Text>
                            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{s.label}</Text>
                        </View>
                    ))}
                </View>

                {/* ── PROFILE COMPLETION BAR ── */}
                {completionPercent < 100 && (
                    <View style={[styles.section, { paddingTop: 14 }]}>
                        <View style={[styles.completionCard, { backgroundColor: theme.cardBackground }]}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                <Text style={[styles.completionTitle, { color: theme.text }]}>
                                    Completa tu perfil
                                </Text>
                                <Text style={[styles.completionPercent, { color: COLORS.primary }]}>
                                    {completionPercent}%
                                </Text>
                            </View>
                            <View style={styles.completionTrack}>
                                <View style={[styles.completionFill, { width: `${completionPercent}%` }]} />
                            </View>
                            <Text style={[styles.completionHint, { color: theme.textSecondary }]}>
                                {!photoUri ? '📷 Añade una foto de perfil' :
                                 !phone.trim() ? '📞 Añade tu teléfono' :
                                 !city.trim() ? '📍 Añade tu ciudad' :
                                 '✨ ¡Ya casi está!'}
                            </Text>
                        </View>
                    </View>
                )}

                {/* ── PERSONAL DATA ── */}
                <View style={styles.section}>
                    {sectionLabel('DATOS PERSONALES', theme)}

                    <Field label="Nombre"    value={firstName}  onChangeText={setFirstName}  theme={theme} />
                    <Field label="Apellidos" value={lastName}   onChangeText={setLastName}   theme={theme} />
                    <Field label="Email"     value={user?.email || ''} theme={theme} editable={false} />
                    <Field label="Teléfono"  value={phone}      onChangeText={setPhone}      theme={theme} keyboardType="phone-pad" />

                    {/* Date of birth */}
                    <TouchableOpacity
                        style={[styles.fieldRow, { backgroundColor: theme.cardBackground }]}
                        onPress={() => setShowDatePicker(true)}
                    >
                        <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Fecha nacimiento</Text>
                        <Text style={[styles.fieldValue, { color: theme.text }]}>{formatDate(birthDate)}</Text>
                        <Ionicons name="calendar-outline" size={18} color={theme.textSecondary} style={{ marginLeft: 8 }} />
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
                    {sectionLabel('UBICACIÓN', theme)}

                    {/* City with GPS button */}
                    <View style={[styles.fieldRow, { backgroundColor: theme.cardBackground }]}>
                        <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Ciudad</Text>
                        <TextInput
                            style={[styles.fieldInput, { color: theme.text, flex: 1 }]}
                            value={city}
                            onChangeText={setCity}
                            placeholder="Tu ciudad"
                            placeholderTextColor={theme.textSecondary}
                        />
                        <TouchableOpacity onPress={fetchCityFromLocation} disabled={fetchingCity} style={styles.gpsBtn}>
                            {fetchingCity
                                ? <ActivityIndicator size="small" color={COLORS.primary} />
                                : <Ionicons name="locate" size={18} color={COLORS.primary} />
                            }
                        </TouchableOpacity>
                    </View>

                    <Field label="Código postal" value={postalCode} onChangeText={setPostalCode} theme={theme} keyboardType="numeric" />
                    <Field label="Provincia"     value={province}   onChangeText={setProvince}   theme={theme} />
                    <Field label="País"          value={country}    onChangeText={setCountry}    theme={theme} />

                    <View style={[styles.locationNote, { backgroundColor: COLORS.primaryBg }]}>
                        <Ionicons name="information-circle-outline" size={16} color={COLORS.primary} />
                        <Text style={[styles.locationNoteText, { color: COLORS.primary }]}>
                            La ubicación GPS se usa para mostrarte cuidadores cercanos. Sin permiso de ubicación no podrás hacer reservas.
                        </Text>
                    </View>
                </View>

                {/* ── PRIVACY & TRACKING ── */}
                <View style={styles.section}>
                    {sectionLabel('PRIVACIDAD', theme)}

                    <View style={[styles.toggleRow, { backgroundColor: theme.cardBackground }]}>
                        <View style={{ flex: 1, marginRight: 12 }}>
                            <Text style={[styles.toggleTitle, { color: theme.text }]}>Guardar historial de paseos</Text>
                            <Text style={[styles.toggleSub, { color: theme.textSecondary }]}>Tus paseos se guardan para estadísticas</Text>
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
                            <Text style={[styles.toggleTitle, { color: theme.text }]}>Compartir ubicación en vivo</Text>
                            <Text style={[styles.toggleSub, { color: theme.textSecondary }]}>Visible solo durante un paseo activo</Text>
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
                        {sectionLabel('VERIFICAR CUENTA', theme)}
                        <Text style={[styles.verifyDesc, { color: theme.textSecondary }]}>
                            Verifica tu identidad con DNI/NIE/Pasaporte para desbloquear funciones de dueño o cuidador.
                        </Text>

                        <TouchableOpacity
                            style={[styles.roleBtn, { backgroundColor: COLORS.primaryBg, borderColor: COLORS.primary }]}
                            onPress={() => navigation.navigate('Verify')}
                        >
                            <View style={[styles.roleBtnIcon, { backgroundColor: COLORS.primary }]}>
                                <Text style={{ fontSize: 22 }}>🐾</Text>
                            </View>
                            <View style={{ flex: 1, marginLeft: 14 }}>
                                <Text style={[styles.roleBtnTitle, { color: COLORS.primary }]}>Hacerse Dueño Verificado</Text>
                                <Text style={[styles.roleBtnSub, { color: COLORS.primary }]}>Accede a reservas y cuidadores</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.roleBtn, { backgroundColor: COLORS.secondaryLight, borderColor: COLORS.secondary }]}
                            onPress={() => navigation.navigate('Verify')}
                        >
                            <View style={[styles.roleBtnIcon, { backgroundColor: COLORS.secondary }]}>
                                <Text style={{ fontSize: 22 }}>🛡️</Text>
                            </View>
                            <View style={{ flex: 1, marginLeft: 14 }}>
                                <Text style={[styles.roleBtnTitle, { color: COLORS.secondary }]}>Hacerse Cuidador Verificado</Text>
                                <Text style={[styles.roleBtnSub, { color: COLORS.secondary }]}>Ofrece servicios y gana dinero</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={COLORS.secondary} />
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
                                <Ionicons name="checkmark-circle-outline" size={20} color="#FFF" />
                                <Text style={styles.saveBtnText}>Guardar cambios</Text>
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
                        <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
                        <Text style={[styles.logoutBtnText, { color: COLORS.danger }]}>Cerrar sesión</Text>
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
    avatar: { width: 100, height: 100, borderRadius: 50 },
    avatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
    cameraBadge: {
        position: 'absolute', bottom: 2, right: 2,
        width: 32, height: 32, borderRadius: 16,
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 2.5,
    },
    heroName: { fontSize: 20, fontWeight: '800', marginBottom: 3, textAlign: 'center' },
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
