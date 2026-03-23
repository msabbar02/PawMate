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

const POLICY_TEXT = `POLÍTICA DE PRIVACIDAD DE PAWMATE
Última actualización: marzo 2026

1. INTRODUCCIÓN
PawMate ("nosotros", "nuestra aplicación") se compromete a proteger tu privacidad. Esta política describe cómo recopilamos, usamos y protegemos tu información personal.

2. INFORMACIÓN QUE RECOPILAMOS
• Datos de cuenta: nombre, correo electrónico, teléfono, foto de perfil.
• Datos de mascotas: nombre, especie, raza, información médica que proporciones voluntariamente.
• Datos de ubicación: coordenadas GPS durante paseos activos (solo cuando la app está en uso).
• Datos de reservas: fechas, tipo de servicio, precios.
• Contenido publicado: fotos y descripciones de posts en la comunidad.

3. USO DE LA INFORMACIÓN
Utilizamos tu información para:
• Facilitar la conexión entre dueños de mascotas y cuidadores.
• Procesar pagos de manera segura a través de Stripe.
• Enviar notificaciones sobre tus reservas y actividad en la app.
• Mejorar nuestros servicios y personalizar tu experiencia.

4. COMPARTIR INFORMACIÓN
No vendemos tu información personal a terceros. Compartimos datos solo con:
• Cuidadores/dueños involucrados en una reserva.
• Stripe para procesamiento de pagos.
• Servicios de emergencia cuando activas el botón SOS.

5. SEGURIDAD
Implementamos medidas técnicas y organizativas para proteger tu datos, incluyendo cifrado en tránsito (HTTPS) y en reposo (Firebase Security Rules).

6. TUS DERECHOS
Tienes derecho a:
• Acceder a tus datos personales.
• Corregir información inexacta.
• Solicitar la eliminación de tu cuenta y datos.
• Exportar tus datos.

Para ejercer estos derechos, contacta: soporte@pawmate.app

7. RETENCIÓN DE DATOS
Conservamos tus datos mientras tu cuenta esté activa. Tras eliminar tu cuenta, los datos se borran en un plazo de 30 días, excepto los requeridos por ley.

8. CONTACTO
PawMate · soporte@pawmate.app
Para consultas sobre privacidad: privacidad@pawmate.app`;

export default function SettingsScreen({ navigation }) {
    const { userData, user } = useContext(AuthContext);
    const { theme, toggleTheme, isDarkMode } = useContext(ThemeContext);

    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [photoUri, setPhotoUri]             = useState(userData?.photoURL || null);

    // Password modal
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [oldPass, setOldPass]     = useState('');
    const [newPass, setNewPass]     = useState('');
    const [changingPass, setChangingPass]           = useState(false);
    const [showOld, setShowOld]     = useState(false);
    const [showNew, setShowNew]     = useState(false);

    // Emergency contacts
    const [emergencyContacts, setEmergencyContacts]         = useState(userData?.emergencyContacts || []);
    const [showContactModal, setShowContactModal]           = useState(false);
    const [editingContact, setEditingContact]               = useState(null); // null = new
    const [contactName, setContactName]                     = useState('');
    const [contactPhone, setContactPhone]                   = useState('');
    const [savingContact, setSavingContact]                 = useState(false);

    // Policy modal
    const [showPolicy, setShowPolicy] = useState(false);

    // Stats
    const [petCount, setPetCount]   = useState(0);
    const [postCount, setPostCount] = useState(0);

    const ROLE_CONFIG = {
        normal:    { label: 'Usuario',             emoji: '👤', color: '#6B7280' },
        owner:     { label: 'Dueño Verificado',    emoji: '🐾', color: theme.primary },
        caregiver: { label: 'Cuidador Verificado', emoji: '🛡️', color: '#0891b2' },
    };
    const role = ROLE_CONFIG[userData?.role] || ROLE_CONFIG.normal;

    useEffect(() => {
        if (userData) {
            setPhotoUri(userData.photoURL || null);
            setEmergencyContacts(userData.emergencyContacts || []);
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
            Alert.alert('Error', 'No se pudo subir la foto.');
        } finally {
            setUploadingPhoto(false);
        }
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
            Alert.alert('✅ Contraseña actualizada');
        } catch (e) {
            Alert.alert('Error', e.code === 'auth/wrong-password'
                ? 'La contraseña actual es incorrecta.'
                : 'No se pudo cambiar la contraseña.');
        } finally { setChangingPass(false); }
    };

    // ── Emergency contacts ──
    const openAddContact = () => {
        setEditingContact(null);
        setContactName('');
        setContactPhone('');
        setShowContactModal(true);
    };

    const openEditContact = (contact, index) => {
        setEditingContact(index);
        setContactName(contact.name);
        setContactPhone(contact.phone);
        setShowContactModal(true);
    };

    const handleSaveContact = async () => {
        if (!contactName.trim() || !contactPhone.trim()) {
            return Alert.alert('Error', 'Rellena el nombre y el teléfono.');
        }
        setSavingContact(true);
        const newContacts = [...emergencyContacts];
        const entry = { name: contactName.trim(), phone: contactPhone.trim() };
        if (editingContact !== null) {
            newContacts[editingContact] = entry;
        } else {
            if (newContacts.length >= 3) {
                setSavingContact(false);
                return Alert.alert('Límite alcanzado', 'Puedes tener como máximo 3 contactos de emergencia.');
            }
            newContacts.push(entry);
        }
        try {
            await updateDoc(doc(db, 'users', user.uid), { emergencyContacts: newContacts });
            setEmergencyContacts(newContacts);
            setShowContactModal(false);
        } catch { Alert.alert('Error', 'No se pudo guardar el contacto.'); }
        finally { setSavingContact(false); }
    };

    const handleDeleteContact = async (index) => {
        Alert.alert('Eliminar contacto', '¿Eliminar este contacto de emergencia?', [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Eliminar', style: 'destructive',
                onPress: async () => {
                    const newContacts = emergencyContacts.filter((_, i) => i !== index);
                    try {
                        await updateDoc(doc(db, 'users', user.uid), { emergencyContacts: newContacts });
                        setEmergencyContacts(newContacts);
                    } catch { Alert.alert('Error', 'No se pudo eliminar.'); }
                },
            },
        ]);
    };

    // ── Sign out / Delete account ──
    const handleSignOut = () => {
        Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Salir', style: 'destructive', onPress: () => signOut(auth).catch(() => {}) },
        ]);
    };

    const handleDeleteAccount = () => {
        Alert.alert('⚠️ Eliminar cuenta', 'Esta acción es IRREVERSIBLE.', [
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
        <Text style={[s.sectionTitle, { color: danger ? '#EF4444' : theme.textSecondary }]}>
            {children}
        </Text>
    );

    const SettingRow = ({ icon, iconBg, label, sublabel, right, onPress, danger, last }) => (
        <TouchableOpacity
            style={[s.settingRow, { backgroundColor: theme.cardBackground }, last && s.settingRowLast]}
            onPress={onPress}
            disabled={!onPress}
            activeOpacity={onPress ? 0.65 : 1}
        >
            <View style={[s.settingIconWrap, { backgroundColor: iconBg || theme.primaryBg }]}>
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
        <View style={[s.settingGroup, { borderColor: theme.border }]}>{children}</View>
    );

    // ─────────────────────────────────────────────────
    // MAIN RENDER
    // ─────────────────────────────────────────────────
    return (
        <View style={[s.container, { backgroundColor: theme.background }]}>
            <StatusBar style={isDarkMode ? 'light' : 'dark'} />

            {/* HEADER */}
            <View style={[s.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                <Text style={[s.headerTitle, { color: theme.text }]}>Ajustes</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

                {/* ── PROFILE HERO CARD ── */}
                <View style={[s.profileHero, { backgroundColor: theme.cardBackground }]}>
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

                    <Text style={[s.heroName, { color: theme.text }]}>{userData?.fullName || 'Tu nombre'}</Text>
                    <Text style={[s.heroEmail, { color: theme.textSecondary }]}>{user?.email || ''}</Text>
                    <View style={[s.rolePill, { backgroundColor: role.color + '15' }]}>
                        <Text style={{ fontSize: 12 }}>{role.emoji}</Text>
                        <Text style={[s.rolePillText, { color: role.color }]}>{role.label}</Text>
                    </View>

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

                {/* ── DATOS PERSONALES (read-only) ── */}
                <SectionTitle>DATOS PERSONALES</SectionTitle>
                <View style={[s.infoCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                    <View style={s.infoRow}>
                        <View style={[s.infoIconWrap, { backgroundColor: theme.primaryBg }]}>
                            <Ionicons name="person-outline" size={16} color={theme.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[s.infoLabel, { color: theme.textSecondary }]}>Nombre completo</Text>
                            <Text style={[s.infoValue, { color: theme.text }]}>{userData?.fullName || '—'}</Text>
                        </View>
                    </View>
                    <View style={[s.infoDiv, { backgroundColor: theme.border }]} />
                    <View style={s.infoRow}>
                        <View style={[s.infoIconWrap, { backgroundColor: '#EFF6FF' }]}>
                            <Ionicons name="call-outline" size={16} color="#3B82F6" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[s.infoLabel, { color: theme.textSecondary }]}>Teléfono</Text>
                            <Text style={[s.infoValue, { color: theme.text }]}>{userData?.phone || '—'}</Text>
                        </View>
                    </View>
                    <View style={[s.infoDiv, { backgroundColor: theme.border }]} />
                    <View style={s.infoRow}>
                        <View style={[s.infoIconWrap, { backgroundColor: '#F5F3FF' }]}>
                            <Ionicons name="mail-outline" size={16} color="#7C3AED" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[s.infoLabel, { color: theme.textSecondary }]}>Email</Text>
                            <Text style={[s.infoValue, { color: theme.text }]}>{user?.email || '—'}</Text>
                        </View>
                        <Ionicons name="lock-closed-outline" size={13} color={theme.textSecondary} />
                    </View>
                    <View style={[s.infoDiv, { backgroundColor: theme.border }]} />
                    <View style={[s.infoNote, { backgroundColor: theme.primaryBg }]}>
                        <Ionicons name="information-circle-outline" size={14} color={theme.primary} />
                        <Text style={[s.infoNoteText, { color: theme.primary }]}>
                            Para modificar tus datos, ve a la pantalla de Perfil
                        </Text>
                    </View>
                </View>

                {/* ── APARIENCIA ── */}
                <SectionTitle>APARIENCIA</SectionTitle>
                <SettingGroup>
                    <SettingRow
                        icon={isDarkMode ? 'moon' : 'sunny-outline'}
                        iconBg={isDarkMode ? theme.primaryBg : '#FEF9C3'}
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

                {/* ── CONTACTOS DE EMERGENCIA ── */}
                <SectionTitle>CONTACTOS DE EMERGENCIA</SectionTitle>
                <View style={[s.settingGroup, { borderColor: theme.border }]}>
                    {emergencyContacts.length === 0 && (
                        <View style={[s.settingRow, { backgroundColor: theme.cardBackground }]}>
                            <Ionicons name="alert-circle-outline" size={18} color={theme.textSecondary} style={{ marginRight: 8 }} />
                            <Text style={[s.settingSublabel, { color: theme.textSecondary, flex: 1 }]}>
                                Sin contactos de emergencia. El botón SOS necesita al menos uno.
                            </Text>
                        </View>
                    )}
                    {emergencyContacts.map((contact, i) => (
                        <View key={i} style={[s.settingRow, { backgroundColor: theme.cardBackground }, i === emergencyContacts.length - 1 && emergencyContacts.length > 0 && s.settingRowLast]}>
                            <View style={[s.settingIconWrap, { backgroundColor: '#FEE2E2' }]}>
                                <Ionicons name="call" size={18} color="#EF4444" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[s.settingLabel, { color: theme.text }]}>{contact.name}</Text>
                                <Text style={[s.settingSublabel, { color: theme.textSecondary }]}>{contact.phone}</Text>
                            </View>
                            <TouchableOpacity onPress={() => openEditContact(contact, i)} style={{ marginRight: 12 }}>
                                <Ionicons name="pencil-outline" size={18} color={theme.textSecondary} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDeleteContact(i)}>
                                <Ionicons name="trash-outline" size={18} color="#EF4444" />
                            </TouchableOpacity>
                        </View>
                    ))}
                    {emergencyContacts.length < 3 && (
                        <TouchableOpacity
                            style={[s.settingRow, s.settingRowLast, { backgroundColor: theme.cardBackground }]}
                            onPress={openAddContact}
                        >
                            <View style={[s.settingIconWrap, { backgroundColor: '#FEE2E2' }]}>
                                <Ionicons name="add" size={18} color="#EF4444" />
                            </View>
                            <Text style={[s.settingLabel, { color: theme.primary }]}>Añadir contacto</Text>
                            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* ── MÉTODOS DE PAGO ── */}
                <SectionTitle>MÉTODOS DE PAGO</SectionTitle>
                <SettingGroup>
                    <View style={[s.settingRow, { backgroundColor: theme.cardBackground }]}>
                        <View style={[s.settingIconWrap, { backgroundColor: '#EFF6FF' }]}>
                            <Ionicons name="card-outline" size={18} color="#3B82F6" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[s.settingLabel, { color: theme.textSecondary }]}>Sin métodos guardados</Text>
                            <Text style={[s.settingSublabel, { color: theme.textSecondary }]}>Las tarjetas se gestionan al pagar</Text>
                        </View>
                    </View>
                    <SettingRow
                        icon="shield-checkmark-outline"
                        iconBg="#ECFDF5"
                        label="Pagos seguros con Stripe"
                        sublabel="Tus datos bancarios nunca se almacenan en PawMate"
                        last
                    />
                </SettingGroup>

                {/* ── CUENTA ── */}
                <SectionTitle>CUENTA</SectionTitle>
                <SettingGroup>
                    <SettingRow
                        icon="key-outline"
                        iconBg={isDarkMode ? theme.primaryBg : '#F0F9FF'}
                        label="Cambiar contraseña"
                        onPress={() => setShowPasswordModal(true)}
                    />
                    {userData?.role === 'normal' && userData?.verificationStatus !== 'pending' && (
                        <SettingRow
                            icon="shield-checkmark-outline"
                            iconBg={theme.primaryBg}
                            label="Verificar mi cuenta"
                            sublabel="Conviértete en Dueño o Cuidador"
                            onPress={() => navigation.navigate('Verify')}
                        />
                    )}
                    {userData?.verificationStatus === 'pending' && (
                        <SettingRow
                            icon="time-outline"
                            iconBg={isDarkMode ? theme.primaryBg : '#FEF3C7'}
                            label="Verificación en revisión"
                            sublabel="Te avisaremos en 24-48h"
                        />
                    )}
                    <SettingRow
                        icon="notifications-outline"
                        iconBg={isDarkMode ? theme.primaryBg : '#FFF7ED'}
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
                        onPress={() => setShowPolicy(true)}
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
            <Modal visible={showPasswordModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPasswordModal(false)}>
                <View style={{ flex: 1, backgroundColor: theme.background }}>
                    <View style={[s.modalHeader, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                        <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
                            <Ionicons name="close" size={24} color={theme.text} />
                        </TouchableOpacity>
                        <Text style={[s.modalTitle, { color: theme.text }]}>Cambiar contraseña</Text>
                        <View style={{ width: 28 }} />
                    </View>
                    <ScrollView contentContainerStyle={{ padding: 24 }}>
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

                        {newPass.length > 0 && (
                            <View style={{ flexDirection: 'row', gap: 4, marginTop: 8 }}>
                                {[1, 2, 3, 4].map(i => (
                                    <View key={i} style={[s.strengthBar, {
                                        backgroundColor: newPass.length >= i * 2
                                            ? (newPass.length >= 8 ? '#22C55E' : '#F59E0B')
                                            : theme.border,
                                    }]} />
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

            {/* ════════════════════════════════════════
                MODAL: EMERGENCY CONTACT
            ════════════════════════════════════════ */}
            <Modal visible={showContactModal} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowContactModal(false)}>
                <View style={{ flex: 1, backgroundColor: theme.background }}>
                    <View style={[s.modalHeader, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                        <TouchableOpacity onPress={() => setShowContactModal(false)}>
                            <Ionicons name="close" size={24} color={theme.text} />
                        </TouchableOpacity>
                        <Text style={[s.modalTitle, { color: theme.text }]}>
                            {editingContact !== null ? 'Editar contacto' : 'Nuevo contacto de emergencia'}
                        </Text>
                        <View style={{ width: 28 }} />
                    </View>
                    <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
                        <View style={[s.infoBanner, { backgroundColor: '#FEE2E2' }]}>
                            <Ionicons name="alert-circle-outline" size={18} color="#EF4444" />
                            <Text style={[s.infoBannerText, { color: '#EF4444' }]}>
                                Este contacto recibirá una llamada cuando actives el botón SOS durante un paseo.
                            </Text>
                        </View>
                        <Text style={[s.fieldLabel, { color: theme.textSecondary }]}>NOMBRE</Text>
                        <View style={[s.passwordInputRow, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                            <TextInput
                                style={[s.passwordInput, { color: theme.text }]}
                                value={contactName}
                                onChangeText={setContactName}
                                placeholder="Ej. Mamá"
                                placeholderTextColor={theme.textSecondary}
                            />
                        </View>
                        <Text style={[s.fieldLabel, { color: theme.textSecondary }]}>TELÉFONO</Text>
                        <View style={[s.passwordInputRow, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                            <TextInput
                                style={[s.passwordInput, { color: theme.text }]}
                                value={contactPhone}
                                onChangeText={setContactPhone}
                                placeholder="+34 600 000 000"
                                placeholderTextColor={theme.textSecondary}
                                keyboardType="phone-pad"
                            />
                        </View>
                        <TouchableOpacity
                            style={[s.primaryBtn, { backgroundColor: '#EF4444', marginTop: 16, opacity: savingContact ? 0.7 : 1 }]}
                            onPress={handleSaveContact}
                            disabled={savingContact}
                        >
                            {savingContact
                                ? <ActivityIndicator color="#FFF" />
                                : <Text style={s.primaryBtnText}>Guardar contacto</Text>
                            }
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </Modal>

            {/* ════════════════════════════════════════
                MODAL: POLÍTICA DE PRIVACIDAD
            ════════════════════════════════════════ */}
            <Modal visible={showPolicy} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPolicy(false)}>
                <View style={{ flex: 1, backgroundColor: theme.background }}>
                    <View style={[s.modalHeader, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                        <TouchableOpacity onPress={() => setShowPolicy(false)}>
                            <Ionicons name="close" size={24} color={theme.text} />
                        </TouchableOpacity>
                        <Text style={[s.modalTitle, { color: theme.text }]}>Política de Privacidad</Text>
                        <View style={{ width: 28 }} />
                    </View>
                    <ScrollView contentContainerStyle={{ padding: 20 }}>
                        <Text style={[s.policyText, { color: theme.text }]}>{POLICY_TEXT}</Text>
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

    header: {
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 60 : 36,
        paddingBottom: 16,
        borderBottomWidth: 1,
    },
    headerTitle: { fontSize: 28, fontWeight: '900' },

    // Profile hero
    profileHero: {
        alignItems: 'center', paddingTop: 28, paddingBottom: 0,
        marginHorizontal: 16, marginTop: 20, borderRadius: 24,
        shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
        overflow: 'hidden',
    },
    avatarWrap:     { position: 'relative', marginBottom: 14 },
    avatarRing:     { width: 108, height: 108, borderRadius: 54, borderWidth: 3, overflow: 'hidden', padding: 2 },
    avatar:         { width: '100%', height: '100%', borderRadius: 50 },
    avatarFallback: { justifyContent: 'center', alignItems: 'center' },
    cameraBtn:      { position: 'absolute', bottom: 2, right: 2, width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 2.5 },
    heroName:       { fontSize: 20, fontWeight: '900', marginBottom: 2 },
    heroEmail:      { fontSize: 13, marginBottom: 10 },
    rolePill:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginBottom: 22 },
    rolePillText:   { fontSize: 13, fontWeight: '700' },
    statsStrip:     { flexDirection: 'row', width: '100%', justifyContent: 'space-evenly', alignItems: 'center', paddingVertical: 18, borderTopWidth: 1 },
    statItem:       { alignItems: 'center', flex: 1 },
    statNum:        { fontSize: 22, fontWeight: '900' },
    statLabel:      { fontSize: 11, fontWeight: '600', marginTop: 2 },
    statDivider:    { width: 1, height: 28 },

    // Section title & groups
    sectionTitle:   { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginHorizontal: 20, marginTop: 28, marginBottom: 8 },
    settingGroup:   { marginHorizontal: 16, borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
    settingRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
    settingRowLast: { borderBottomWidth: 0 },
    settingIconWrap:{ width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    settingLabel:   { fontSize: 15, fontWeight: '600' },
    settingSublabel:{ fontSize: 12, marginTop: 1 },

    // Info card (read-only personal data)
    infoCard: { marginHorizontal: 16, borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
    infoRow:  { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
    infoIconWrap: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    infoLabel:    { fontSize: 11, fontWeight: '600', marginBottom: 2 },
    infoValue:    { fontSize: 15, fontWeight: '600' },
    infoDiv:      { height: 1, marginLeft: 62 },
    infoNote:     { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, margin: 10, borderRadius: 12 },
    infoNoteText: { fontSize: 12, fontWeight: '600', flex: 1 },

    // Modals
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, paddingTop: Platform.OS === 'ios' ? 56 : 18, borderBottomWidth: 1 },
    modalTitle:  { fontSize: 17, fontWeight: '800' },
    infoBanner:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 16, marginBottom: 24 },
    infoBannerText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '500' },
    fieldLabel:  { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
    passwordInputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14 },
    passwordInput:    { flex: 1, fontSize: 15, paddingVertical: 0 },
    strengthBar:      { flex: 1, height: 4, borderRadius: 2 },
    strengthLabel:    { fontSize: 12, fontWeight: '600', alignSelf: 'center', marginLeft: 4 },
    primaryBtn:       { paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
    primaryBtnText:   { color: '#FFF', fontWeight: '800', fontSize: 16 },

    // Policy
    policyText: { fontSize: 14, lineHeight: 22 },
});
