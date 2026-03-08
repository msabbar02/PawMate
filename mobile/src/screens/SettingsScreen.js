import React, { useState, useContext, useEffect } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity, ScrollView,
    Image, Alert, ActivityIndicator, TextInput, Switch,
    Platform, Linking, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { auth, db } from '../config/firebase';
import { doc, updateDoc, deleteDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { signOut, deleteUser, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { uploadImageToStorage } from '../utils/storageHelpers';

const APP_VERSION = '1.0.0';

export default function SettingsScreen({ navigation }) {
    const { userData, user } = useContext(AuthContext);
    const { theme, toggleTheme, isDarkMode } = useContext(ThemeContext);

    const [fullName, setFullName]         = useState(userData?.fullName || '');
    const [phone, setPhone]               = useState(userData?.phone || '');
    const [saving, setSaving]             = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [photoUri, setPhotoUri]         = useState(userData?.photoURL || null);

    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [oldPass, setOldPass]   = useState('');
    const [newPass, setNewPass]   = useState('');
    const [changingPass, setChangingPass] = useState(false);
    const [showOld, setShowOld]   = useState(false);
    const [showNew, setShowNew]   = useState(false);

    const [petCount, setPetCount]   = useState(0);
    const [postCount, setPostCount] = useState(0);

    const ROLE_CONFIG = {
        normal:    { label: 'Usuario',              emoji: '👤', color: '#6B7280' },
        owner:     { label: 'Dueño Verificado',     emoji: '🐾', color: theme.primary },
        caregiver: { label: 'Cuidador Verificado',  emoji: '🛡️', color: '#0891b2' },
    };
    const role = ROLE_CONFIG[userData?.role] || ROLE_CONFIG.normal;

    useEffect(() => {
        if (userData) {
            setFullName(userData.fullName || '');
            setPhone(userData.phone || '');
            setPhotoUri(userData.photoURL || null);
        }
    }, [userData]);

    useEffect(() => {
        if (!user?.uid) return;
        (async () => {
            try {
                const petsSnap  = await getDocs(query(collection(db, 'pets'),  where('ownerId',   '==', user.uid)));
                const postsSnap = await getDocs(query(collection(db, 'posts'), where('authorUid', '==', user.uid)));
                setPetCount(petsSnap.size);
                setPostCount(postsSnap.size);
            } catch { /* ignore */ }
        })();
    }, [user?.uid]);

    // ── Photo ──
    const handleChangePhoto = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8,
        });
        if (result.canceled) return;
        const localUri = result.assets[0].uri;
        setPhotoUri(localUri);
        setUploadingPhoto(true);
        try {
            const url = await uploadImageToStorage(localUri, `avatars/${user.uid}.jpg`);
            await updateDoc(doc(db, 'users', user.uid), { photoURL: url });
        } catch {
            Alert.alert('Error', 'No se pudo subir la foto. Inténtalo de nuevo.');
        } finally {
            setUploadingPhoto(false);
        }
    };

    // ── Save profile ──
    const handleSave = async () => {
        if (!fullName.trim()) return Alert.alert('Error', 'El nombre no puede estar vacío.');
        setSaving(true);
        try {
            await updateDoc(doc(db, 'users', user.uid), {
                fullName: fullName.trim(),
                phone:    phone.trim(),
            });
            Alert.alert('¡Guardado! ✅', 'Tu perfil ha sido actualizado.');
        } catch { Alert.alert('Error', 'No se pudo guardar.'); }
        finally { setSaving(false); }
    };

    // ── Change password ──
    const handleChangePassword = async () => {
        if (!oldPass || newPass.length < 6) {
            return Alert.alert('Error', 'La nueva contraseña debe tener al menos 6 caracteres.');
        }
        setChangingPass(true);
        try {
            const credential = EmailAuthProvider.credential(user.email, oldPass);
            await reauthenticateWithCredential(auth.currentUser, credential);
            await updatePassword(auth.currentUser, newPass);
            setShowPasswordModal(false);
            setOldPass(''); setNewPass('');
            Alert.alert('✅ Contraseña actualizada', 'Tu contraseña ha sido cambiada.');
        } catch (e) {
            Alert.alert('Error', e.code === 'auth/wrong-password'
                ? 'La contraseña actual es incorrecta.'
                : 'No se pudo cambiar la contraseña.');
        } finally { setChangingPass(false); }
    };

    // ── Sign out ──
    const handleSignOut = () => {
        Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Salir', style: 'destructive', onPress: () => signOut(auth).catch(() => {}) },
        ]);
    };

    // ── Delete account ──
    const handleDeleteAccount = () => {
        Alert.alert('⚠️ Eliminar cuenta', 'Esta acción es IRREVERSIBLE. Se borrarán todos tus datos.', [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Eliminar', style: 'destructive',
                onPress: async () => {
                    try {
                        await deleteDoc(doc(db, 'users', user.uid));
                        await deleteUser(auth.currentUser);
                    } catch {
                        Alert.alert('Error', 'Vuelve a iniciar sesión antes de eliminar tu cuenta.');
                    }
                },
            },
        ]);
    };

    // ─────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────
    const SectionTitle = ({ children, danger }) => (
        <Text style={[s.sectionTitle, {
            color: danger ? '#EF4444' : theme.textSecondary,
        }]}>
            {children}
        </Text>
    );

    const SettingRow = ({ icon, iconBg, label, sublabel, right, onPress, danger, last }) => (
        <TouchableOpacity
            style={[
                s.settingRow,
                { backgroundColor: theme.cardBackground },
                last && s.settingRowLast,
            ]}
            onPress={onPress}
            disabled={!onPress}
            activeOpacity={onPress ? 0.65 : 1}
        >
            <View style={[s.settingIconWrap, { backgroundColor: iconBg || (isDarkMode ? '#1a3626' : '#e8f5ee') }]}>
                <Ionicons name={icon} size={18} color={danger ? '#EF4444' : theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={[s.settingLabel, { color: danger ? '#EF4444' : theme.text }]}>{label}</Text>
                {sublabel && <Text style={[s.settingSublabel, { color: theme.textSecondary }]}>{sublabel}</Text>}
            </View>
            {right !== undefined
                ? right
                : onPress
                    ? <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                    : null
            }
        </TouchableOpacity>
    );

    const SettingGroup = ({ children }) => (
        <View style={[s.settingGroup, { borderColor: theme.border }]}>
            {children}
        </View>
    );

    // ─────────────────────────────────────────────────
    // MAIN RENDER
    // ─────────────────────────────────────────────────
    return (
        <View style={[s.container, { backgroundColor: theme.background }]}>
            <StatusBar style={isDarkMode ? 'light' : 'dark'} />

            {/* ── HEADER ── */}
            <View style={[s.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                <Text style={[s.headerTitle, { color: theme.text }]}>Ajustes</Text>
                <TouchableOpacity
                    style={[s.saveBtn, { backgroundColor: theme.primary, opacity: saving ? 0.7 : 1 }]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    {saving
                        ? <ActivityIndicator size="small" color="#FFF" />
                        : <Text style={s.saveBtnText}>Guardar</Text>
                    }
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

                {/* ── PROFILE HERO CARD ── */}
                <View style={[s.profileHero, { backgroundColor: theme.cardBackground }]}>
                    {/* Avatar */}
                    <TouchableOpacity style={s.avatarWrap} onPress={handleChangePhoto} disabled={uploadingPhoto}>
                        <View style={[s.avatarRing, { borderColor: theme.primary + '40' }]}>
                            {photoUri
                                ? <Image source={{ uri: photoUri }} style={s.avatar} />
                                : <View style={[s.avatar, s.avatarFallback, { backgroundColor: theme.primaryBg }]}>
                                    <Text style={{ fontSize: 42 }}>🐾</Text>
                                  </View>
                            }
                        </View>
                        <View style={[s.cameraBtn, { backgroundColor: theme.primary, borderColor: theme.cardBackground }]}>
                            {uploadingPhoto
                                ? <ActivityIndicator size="small" color="#FFF" />
                                : <Ionicons name="camera" size={14} color="#FFF" />
                            }
                        </View>
                    </TouchableOpacity>

                    {/* Name + Role */}
                    <Text style={[s.heroName, { color: theme.text }]}>
                        {userData?.fullName || 'Tu nombre'}
                    </Text>
                    <Text style={[s.heroEmail, { color: theme.textSecondary }]}>
                        {user?.email || ''}
                    </Text>
                    <View style={[s.rolePill, { backgroundColor: role.color + '15' }]}>
                        <Text style={{ fontSize: 12 }}>{role.emoji}</Text>
                        <Text style={[s.rolePillText, { color: role.color }]}>{role.label}</Text>
                    </View>

                    {/* Stats strip */}
                    <View style={[s.statsStrip, { borderTopColor: theme.border }]}>
                        <View style={s.statItem}>
                            <Text style={[s.statNum, { color: theme.text }]}>{petCount}</Text>
                            <Text style={[s.statLabel, { color: theme.textSecondary }]}>Mascotas</Text>
                        </View>
                        <View style={[s.statDivider, { backgroundColor: theme.border }]} />
                        <View style={s.statItem}>
                            <Text style={[s.statNum, { color: theme.text }]}>{postCount}</Text>
                            <Text style={[s.statLabel, { color: theme.textSecondary }]}>Posts</Text>
                        </View>
                        <View style={[s.statDivider, { backgroundColor: theme.border }]} />
                        <View style={s.statItem}>
                            <Text style={[s.statNum, { color: theme.text }]}>{userData?.reviewCount || 0}</Text>
                            <Text style={[s.statLabel, { color: theme.textSecondary }]}>Reseñas</Text>
                        </View>
                    </View>
                </View>

                {/* ── DATOS PERSONALES ── */}
                <SectionTitle>DATOS PERSONALES</SectionTitle>
                <View style={[s.formCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                    <View style={s.inputGroup}>
                        <View style={[s.inputIconWrap, { backgroundColor: theme.primaryBg }]}>
                            <Ionicons name="person-outline" size={17} color={theme.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[s.inputLabel, { color: theme.textSecondary }]}>Nombre completo</Text>
                            <TextInput
                                style={[s.textInput, { color: theme.text }]}
                                value={fullName}
                                onChangeText={setFullName}
                                placeholder="Tu nombre"
                                placeholderTextColor={theme.textSecondary}
                            />
                        </View>
                    </View>

                    <View style={[s.inputDivider, { backgroundColor: theme.border }]} />

                    <View style={s.inputGroup}>
                        <View style={[s.inputIconWrap, { backgroundColor: '#EFF6FF' }]}>
                            <Ionicons name="call-outline" size={17} color="#3B82F6" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[s.inputLabel, { color: theme.textSecondary }]}>Teléfono</Text>
                            <TextInput
                                style={[s.textInput, { color: theme.text }]}
                                value={phone}
                                onChangeText={setPhone}
                                placeholder="+34 600 000 000"
                                placeholderTextColor={theme.textSecondary}
                                keyboardType="phone-pad"
                            />
                        </View>
                    </View>

                    <View style={[s.inputDivider, { backgroundColor: theme.border }]} />

                    <View style={s.inputGroup}>
                        <View style={[s.inputIconWrap, { backgroundColor: '#F5F3FF' }]}>
                            <Ionicons name="mail-outline" size={17} color="#7C3AED" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[s.inputLabel, { color: theme.textSecondary }]}>Email</Text>
                            <Text style={[s.textInput, { color: theme.textSecondary }]}>{user?.email || '—'}</Text>
                        </View>
                        <Ionicons name="lock-closed-outline" size={14} color={theme.textSecondary} />
                    </View>
                </View>

                {/* ── APARIENCIA ── */}
                <SectionTitle>APARIENCIA</SectionTitle>
                <SettingGroup>
                    <SettingRow
                        icon={isDarkMode ? 'moon' : 'sunny-outline'}
                        iconBg={isDarkMode ? '#1e293b' : '#FEF9C3'}
                        label={isDarkMode ? 'Modo oscuro' : 'Modo claro'}
                        sublabel="Cambia el aspecto de la app"
                        last
                        right={
                            <Switch
                                value={isDarkMode}
                                onValueChange={toggleTheme}
                                trackColor={{ false: theme.border, true: theme.primary }}
                                thumbColor="#FFF"
                            />
                        }
                    />
                </SettingGroup>

                {/* ── CUENTA ── */}
                <SectionTitle>CUENTA</SectionTitle>
                <SettingGroup>
                    <SettingRow
                        icon="key-outline"
                        iconBg={isDarkMode ? '#1e293b' : '#F0F9FF'}
                        label="Cambiar contraseña"
                        onPress={() => setShowPasswordModal(true)}
                    />
                    {userData?.role === 'normal' && userData?.verificationStatus !== 'pending' && (
                        <SettingRow
                            icon="shield-checkmark-outline"
                            iconBg={isDarkMode ? '#1a3626' : '#ECFDF5'}
                            label="Verificar mi cuenta"
                            sublabel="Conviértete en Dueño o Cuidador"
                            onPress={() => navigation.navigate('Verify')}
                        />
                    )}
                    {userData?.verificationStatus === 'pending' && (
                        <SettingRow
                            icon="time-outline"
                            iconBg={isDarkMode ? '#2d2000' : '#FEF3C7'}
                            label="Verificación en revisión"
                            sublabel="Te avisaremos en 24-48h"
                        />
                    )}
                    <SettingRow
                        icon="notifications-outline"
                        iconBg={isDarkMode ? '#1e293b' : '#FFF7ED'}
                        label="Notificaciones"
                        last
                        onPress={() => navigation.navigate('Notifications')}
                    />
                </SettingGroup>

                {/* ── INFORMACIÓN ── */}
                <SectionTitle>INFORMACIÓN</SectionTitle>
                <SettingGroup>
                    <SettingRow
                        icon="information-circle-outline"
                        label="Versión de la app"
                        sublabel={`PawMate v${APP_VERSION}`}
                    />
                    <SettingRow
                        icon="document-text-outline"
                        label="Política de privacidad"
                        onPress={() => Linking.openURL('https://pawmate.app/privacy')}
                    />
                    <SettingRow
                        icon="chatbubble-ellipses-outline"
                        label="Contactar soporte"
                        sublabel="soporte@pawmate.app"
                        last
                        onPress={() => Linking.openURL('mailto:soporte@pawmate.app')}
                    />
                </SettingGroup>

                {/* ── ZONA DE PELIGRO ── */}
                <SectionTitle danger>ZONA DE PELIGRO</SectionTitle>
                <SettingGroup>
                    <SettingRow
                        icon="log-out-outline"
                        iconBg="#FEE2E2"
                        label="Cerrar sesión"
                        onPress={handleSignOut}
                        danger
                    />
                    <SettingRow
                        icon="trash-outline"
                        iconBg="#FEE2E2"
                        label="Eliminar mi cuenta"
                        sublabel="Esta acción es irreversible"
                        onPress={handleDeleteAccount}
                        danger
                        last
                    />
                </SettingGroup>

            </ScrollView>

            {/* ════════════════════════════════════════
                MODAL: CHANGE PASSWORD
            ════════════════════════════════════════ */}
            <Modal
                visible={showPasswordModal}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowPasswordModal(false)}
            >
                <View style={{ flex: 1, backgroundColor: theme.background }}>
                    {/* Header */}
                    <View style={[s.modalHeader, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                        <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
                            <Ionicons name="close" size={24} color={theme.text} />
                        </TouchableOpacity>
                        <Text style={[s.modalTitle, { color: theme.text }]}>Cambiar contraseña</Text>
                        <View style={{ width: 28 }} />
                    </View>

                    <ScrollView contentContainerStyle={{ padding: 24 }}>
                        {/* Info banner */}
                        <View style={[s.infoBanner, { backgroundColor: theme.primaryBg }]}>
                            <Ionicons name="shield-checkmark-outline" size={18} color={theme.primary} />
                            <Text style={[s.infoBannerText, { color: theme.primary }]}>
                                Por seguridad necesitamos verificar tu contraseña actual.
                            </Text>
                        </View>

                        <Text style={[s.fieldLabel, { color: theme.textSecondary }]}>CONTRASEÑA ACTUAL</Text>
                        <View style={[s.passwordInputRow, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                            <TextInput
                                style={[s.passwordInput, { color: theme.text }]}
                                secureTextEntry={!showOld}
                                value={oldPass}
                                onChangeText={setOldPass}
                                placeholder="••••••••"
                                placeholderTextColor={theme.textSecondary}
                            />
                            <TouchableOpacity onPress={() => setShowOld(v => !v)}>
                                <Ionicons name={showOld ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        <Text style={[s.fieldLabel, { color: theme.textSecondary, marginTop: 20 }]}>NUEVA CONTRASEÑA</Text>
                        <View style={[s.passwordInputRow, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                            <TextInput
                                style={[s.passwordInput, { color: theme.text }]}
                                secureTextEntry={!showNew}
                                value={newPass}
                                onChangeText={setNewPass}
                                placeholder="Mínimo 6 caracteres"
                                placeholderTextColor={theme.textSecondary}
                            />
                            <TouchableOpacity onPress={() => setShowNew(v => !v)}>
                                <Ionicons name={showNew ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {/* Strength indicator */}
                        {newPass.length > 0 && (
                            <View style={{ flexDirection: 'row', gap: 4, marginTop: 8 }}>
                                {[1, 2, 3, 4].map(i => (
                                    <View
                                        key={i}
                                        style={[s.strengthBar, {
                                            backgroundColor: newPass.length >= i * 2
                                                ? (newPass.length >= 8 ? '#22C55E' : '#F59E0B')
                                                : theme.border,
                                        }]}
                                    />
                                ))}
                                <Text style={[s.strengthLabel, { color: theme.textSecondary }]}>
                                    {newPass.length < 4 ? 'Débil' : newPass.length < 8 ? 'Media' : 'Fuerte'}
                                </Text>
                            </View>
                        )}

                        <TouchableOpacity
                            style={[s.primaryBtn, { backgroundColor: theme.primary, marginTop: 32, opacity: changingPass ? 0.7 : 1 }]}
                            onPress={handleChangePassword}
                            disabled={changingPass}
                        >
                            {changingPass
                                ? <ActivityIndicator color="#FFF" />
                                : <Text style={s.primaryBtnText}>Cambiar contraseña</Text>
                            }
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </Modal>
        </View>
    );
}

// ─────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────
const s = StyleSheet.create({
    container: { flex: 1 },

    // Header
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 60 : 36,
        paddingBottom: 16,
        borderBottomWidth: 1,
    },
    headerTitle: { fontSize: 28, fontWeight: '900' },
    saveBtn:     { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 4 },
    saveBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },

    // Profile hero card
    profileHero: {
        alignItems: 'center',
        paddingTop: 28, paddingBottom: 0,
        marginHorizontal: 16, marginTop: 20,
        borderRadius: 24,
        shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
        overflow: 'hidden',
    },
    avatarWrap: { position: 'relative', marginBottom: 14 },
    avatarRing: { width: 108, height: 108, borderRadius: 54, borderWidth: 3, overflow: 'hidden', padding: 2 },
    avatar:     { width: '100%', height: '100%', borderRadius: 50 },
    avatarFallback: { justifyContent: 'center', alignItems: 'center' },
    cameraBtn:  {
        position: 'absolute', bottom: 2, right: 2,
        width: 30, height: 30, borderRadius: 15,
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 2.5,
    },
    heroName:  { fontSize: 20, fontWeight: '900', marginBottom: 2 },
    heroEmail: { fontSize: 13, marginBottom: 10 },
    rolePill:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginBottom: 22 },
    rolePillText: { fontSize: 13, fontWeight: '700' },

    statsStrip: {
        flexDirection: 'row', width: '100%',
        justifyContent: 'space-evenly', alignItems: 'center',
        paddingVertical: 18, borderTopWidth: 1,
    },
    statItem:    { alignItems: 'center', flex: 1 },
    statNum:     { fontSize: 22, fontWeight: '900' },
    statLabel:   { fontSize: 11, fontWeight: '600', marginTop: 2 },
    statDivider: { width: 1, height: 28 },

    // Section title
    sectionTitle: {
        fontSize: 11, fontWeight: '800', letterSpacing: 1,
        marginHorizontal: 20, marginTop: 28, marginBottom: 8,
    },

    // Form card (inline inputs)
    formCard: {
        marginHorizontal: 16, borderRadius: 20,
        borderWidth: 1, overflow: 'hidden',
    },
    inputGroup: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 14, gap: 12,
    },
    inputIconWrap: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    inputLabel:    { fontSize: 11, fontWeight: '600', marginBottom: 2 },
    textInput:     { fontSize: 15, paddingVertical: 0 },
    inputDivider:  { height: 1, marginLeft: 62 },

    // Setting groups
    settingGroup: {
        marginHorizontal: 16, borderRadius: 20,
        borderWidth: 1, overflow: 'hidden',
    },
    settingRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 16, paddingVertical: 15,
        borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
    },
    settingRowLast: { borderBottomWidth: 0 },
    settingIconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    settingLabel:    { fontSize: 15, fontWeight: '600' },
    settingSublabel: { fontSize: 12, marginTop: 1 },

    // Password modal
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 18, paddingTop: Platform.OS === 'ios' ? 56 : 18,
        borderBottomWidth: 1,
    },
    modalTitle: { fontSize: 17, fontWeight: '800' },

    infoBanner: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 10,
        padding: 14, borderRadius: 16, marginBottom: 24,
    },
    infoBannerText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '500' },

    fieldLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },

    passwordInputRow: {
        flexDirection: 'row', alignItems: 'center',
        borderWidth: 1.5, borderRadius: 16,
        paddingHorizontal: 16, paddingVertical: 14,
    },
    passwordInput: { flex: 1, fontSize: 15, paddingVertical: 0 },

    strengthBar:   { flex: 1, height: 4, borderRadius: 2 },
    strengthLabel: { fontSize: 12, fontWeight: '600', alignSelf: 'center', marginLeft: 4 },

    primaryBtn:     { paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
    primaryBtnText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
});
