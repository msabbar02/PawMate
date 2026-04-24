import React, { useState, useContext, useEffect, useCallback } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity, ScrollView,
    Image, Alert, ActivityIndicator, TextInput, Switch,
    Platform, Linking, Modal,
} from 'react-native';
import Icon from '../components/Icon';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { supabase } from '../config/supabase';
import { uploadImageToStorage, uploadReportImage } from '../utils/storageHelpers';
import * as Contacts from 'expo-contacts';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from '../context/LanguageContext';
import { COLORS } from '../constants/colors';
import { deleteAccount } from '../config/api';

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
• Contenido de reservas: historial de servicios contratados.

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
    const { userData, user, refreshUserData } = useContext(AuthContext);
    const { theme, toggleTheme, isDarkMode, isLeftHanded, toggleHandedness } = useContext(ThemeContext);
    const { t, lang, switchLanguage } = useTranslation();

    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [photoUri, setPhotoUri]             = useState(userData?.photoURL || null);

    // Password modal
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [oldPass, setOldPass]       = useState('');
    const [newPass, setNewPass]       = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [changingPass, setChangingPass]             = useState(false);
    const [showOld, setShowOld]       = useState(false);
    const [showNew, setShowNew]       = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    // Report modal
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportReason, setReportReason]       = useState('');
    const [reportText, setReportText]           = useState('');
    const [reportImages, setReportImages]       = useState([]);
    const [sendingReport, setSendingReport]     = useState(false);

    // Emergency contacts
    const [emergencyContacts, setEmergencyContacts]         = useState(userData?.emergencyContacts || []);
    const [showContactModal, setShowContactModal]           = useState(false);
    const [editingContact, setEditingContact]               = useState(null); // null = new
    const [contactName, setContactName]                     = useState('');
    const [contactPhone, setContactPhone]                   = useState('');
    const [savingContact, setSavingContact]                 = useState(false);
    
    // Phone contacts picker
    const [showPhonePicker, setShowPhonePicker]             = useState(false);
    const [deviceContacts, setDeviceContacts]               = useState([]);
    const [loadingDeviceContacts, setLoadingDeviceContacts] = useState(false);

    // Policy modal & Invites
    const [showPolicy, setShowPolicy] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [sendingInvite, setSendingInvite] = useState(false);

    // Notification local state
    const [notifsEnabled, setNotifsEnabled] = useState(userData?.notificationsEnabled !== false);

    // Stats
    const [petCount, setPetCount]   = useState(0);


    const ROLE_CONFIG = {
        normal:    { label: t('roles.user'),             emoji: '👤', color: '#6B7280' },
        owner:     { label: t('roles.verifiedOwner'),    emoji: '🐾', color: theme.primary },
        caregiver: { label: t('roles.verifiedCaregiver'), emoji: '🛡️', color: '#0891b2' },
    };
    const role = ROLE_CONFIG[userData?.role] || ROLE_CONFIG.normal;

    useEffect(() => {
        if (userData) {
            setPhotoUri(userData.photoURL || null);
            setEmergencyContacts(userData.emergencyContacts || []);
            setNotifsEnabled(userData.notificationsEnabled !== false);
        }
    }, [userData]);

    useEffect(() => {
        if (!user?.id) return;
        const fetchStats = async () => {
            try {
                const { count: petsCount } = await supabase.from('pets').select('*', { count: 'exact', head: true }).eq('ownerId', user.id);
                setPetCount(petsCount || 0);
            } catch { /* ignore */ }
        };
        fetchStats();

        // Real-time listener for pets changes
        const channel = supabase
            .channel(`settings_pets_sync_${Date.now()}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pets', filter: `ownerId=eq.${user.id}` }, () => {
                fetchStats();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [user?.id]);

    // Also re-fetch on screen focus (e.g. coming back from MyPetsScreen)
    useFocusEffect(
        useCallback(() => {
            if (!user?.id) return;
            (async () => {
                try {
                    const { count: petsCount } = await supabase.from('pets').select('*', { count: 'exact', head: true }).eq('ownerId', user.id);
                    setPetCount(petsCount || 0);
                } catch { /* ignore */ }
            })();
        }, [user?.id])
    );

    // ── Invites ──
    const handleInviteFriend = async () => {
        if (!inviteEmail || !inviteEmail.includes('@')) {
            return Alert.alert(t('settings.invalidEmail'), t('settings.invalidEmailMsg'));
        }
        setSendingInvite(true);
        try {
            const { error } = await supabase.auth.signInWithOtp({
                email: inviteEmail.trim(),
                options: { emailRedirectTo: 'pawmate://' }
            });
            if (error) throw error;
            Alert.alert(t('settings.magicSent'), t('settings.magicSentMsg'));
            setShowInviteModal(false);
            setInviteEmail('');
        } catch (err) {
            Alert.alert(t('common.error'), err.message || t('settings.magicSendError'));
        } finally {
            setSendingInvite(false);
        }
    };

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
            const url = await uploadImageToStorage(localUri, `avatars/${user.id}.jpg`);
            await supabase.from('users').update({ photoURL: url, avatar: url }).eq('id', user.id);
            await refreshUserData();
        } catch {
            Alert.alert(t('common.error'), t('settings.reportPhotoError'));
        } finally {
            setUploadingPhoto(false);
        }
    };

    // ── Change password ──
    const handleChangePassword = async () => {
        if (!oldPass) return Alert.alert(t('common.error'), t('settings.currentRequired'));
        if (newPass.length < 6) return Alert.alert(t('common.error'), t('settings.newMinLength'));
        if (newPass === oldPass) return Alert.alert(t('common.error'), t('settings.sameAsOld'));
        if (newPass !== confirmPass) return Alert.alert(t('common.error'), t('settings.mismatch'));
        setChangingPass(true);
        try {
            const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: oldPass });
            if (signInError) throw new Error('wrong-password');
            const { error: updateError } = await supabase.auth.updateUser({ password: newPass });
            if (updateError) throw updateError;
            setShowPasswordModal(false);
            setOldPass(''); setNewPass(''); setConfirmPass('');
            Alert.alert(t('settings.passwordUpdated'));
        } catch (e) {
            Alert.alert(t('common.error'), e.message === 'wrong-password'
                ? t('settings.wrongPassword')
                : t('settings.passwordError'));
        } finally { setChangingPass(false); }
    };

    // ── Send report ──
    const handleAddReportImage = async () => {
        if (reportImages.length >= 4) return Alert.alert(t('settings.limitTitle'), t('settings.reportImageLimit'));
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'], allowsEditing: false, quality: 0.7,
        });
        if (result.canceled) return;
        setReportImages([...reportImages, result.assets[0].uri]);
    };

    const handleRemoveReportImage = (index) => {
        setReportImages(reportImages.filter((_, i) => i !== index));
    };

    const handleSendReport = async () => {
        if (!reportText.trim()) return Alert.alert(t('common.error'), t('settings.reportDescRequired'));
        setSendingReport(true);
        try {
            // Upload images if any
            const imageUrls = [];
            for (let i = 0; i < reportImages.length; i++) {
                const uri = reportImages[i];
                const path = `reports/${user.id}/${Date.now()}_${i}.jpg`;
                try {
                    const url = await uploadReportImage(uri, path);
                    imageUrls.push(url);
                } catch { /* skip failed uploads */ }
            }

            const { error } = await supabase.from('reports').insert({
                userId: user?.id || null,
                reporterName: userData?.fullName || user?.email || 'Anónimo',
                reporterEmail: user?.email || null,
                reason: reportReason.trim() || 'Reporte general',
                message: reportText.trim(),
                imageUrls,
                status: 'pending',
                created_at: new Date().toISOString(),
            });
            if (error) throw error;
            setShowReportModal(false);
            setReportText('');
            setReportReason('');
            setReportImages([]);
            Alert.alert(t('settings.reportSent'), t('settings.reportSentMsg'));
        } catch (e) {
            console.error('Report error:', e);
            Alert.alert(t('common.error'), t('settings.reportSendError'));
        } finally {
            setSendingReport(false);
        }
    };

    // ── Emergency contacts ──
    const handleAddContactOption = () => {
        Alert.alert(t('settings.addContactTitle'), t('settings.addContactMsg'), [
            { text: t('settings.addManually'), onPress: openAddContact },
            { text: t('settings.importFromPhone'), onPress: importContactFromDevice },
            { text: t('common.cancel'), style: 'cancel' }
        ]);
    };

    const importContactFromDevice = async () => {
        setLoadingDeviceContacts(true);
        try {
            const { status } = await Contacts.requestPermissionsAsync();
            if (status !== 'granted') return Alert.alert(t('settings.permissionDenied'), t('settings.contactsPermission'));
            const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers] });
            const valid = data.filter(c => c.name && c.phoneNumbers && c.phoneNumbers.length > 0);
            setDeviceContacts(valid.sort((a,b) => a.name.localeCompare(b.name)));
            setShowPhonePicker(true);
        } catch (e) {
            Alert.alert(t('common.error'), t('settings.contactsFetchError'));
        } finally {
            setLoadingDeviceContacts(false);
        }
    };

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
            return Alert.alert(t('common.error'), t('settings.contactFieldsRequired'));
        }
        setSavingContact(true);
        const newContacts = [...emergencyContacts];
        const entry = { name: contactName.trim(), phone: contactPhone.trim() };
        if (editingContact !== null) {
            newContacts[editingContact] = entry;
        } else {
            if (newContacts.length >= 3) {
                setSavingContact(false);
                return Alert.alert(t('settings.contactLimit'), t('settings.contactLimitMsg'));
            }
            newContacts.push(entry);
        }
        try {
            await supabase.from('users').update({ emergencyContacts: newContacts }).eq('id', user.id);
            setEmergencyContacts(newContacts);
            setShowContactModal(false);
            await refreshUserData();
        } catch { Alert.alert(t('common.error'), t('settings.contactSaveError')); }
        finally { setSavingContact(false); }
    };

    const handleDeleteContact = async (index) => {
        Alert.alert(t('settings.deleteContact'), t('settings.deleteContactConfirm'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: t('common.delete'), style: 'destructive',
                onPress: async () => {
                    const newContacts = emergencyContacts.filter((_, i) => i !== index);
                    try {
                        await supabase.from('users').update({ emergencyContacts: newContacts }).eq('id', user.id);
                        setEmergencyContacts(newContacts);
                        await refreshUserData();
                    } catch { Alert.alert(t('common.error'), t('settings.deleteContactError')); }
                },
            },
        ]);
    };

    // ── Sign out / Delete account ──
    const handleSignOut = () => {
        Alert.alert(t('settings.signOut'), t('settings.signOutConfirm'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('settings.signOutBtn'), style: 'destructive', onPress: () => supabase.auth.signOut().catch(() => {}) },
        ]);
    };

    const handleDeleteAccount = () => {
        Alert.alert(t('settings.deleteAccountTitle'), t('settings.deleteAccountMsg'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: t('common.delete'), style: 'destructive',
                onPress: async () => {
                    try {
                        await deleteAccount(user.id);
                        await supabase.auth.signOut();
                    } catch (e) {
                        Alert.alert(t('common.error'), e.message || t('settings.deleteAccountReauth'));
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
                <Icon name={icon} size={18} color={danger ? '#EF4444' : theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={[s.settingLabel, { color: danger ? '#EF4444' : theme.text }]}>{label}</Text>
                {sublabel ? <Text style={[s.settingSublabel, { color: theme.textSecondary }]}>{sublabel}</Text> : null}
            </View>
            {right !== undefined
                ? right
                : onPress
                    ? <Icon name="chevron-forward" size={16} color={theme.textSecondary} />
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
                                    <Text style={{ fontSize: 32, fontWeight: '800', color: theme.primary }}>
                                        {(userData?.fullName || userData?.email || 'U').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()}
                                    </Text>
                                  </View>
                            }
                        </View>
                        <View style={[s.cameraBtn, { backgroundColor: theme.primary, borderColor: theme.cardBackground }]}>
                            {uploadingPhoto
                                ? <ActivityIndicator size="small" color="#FFF" />
                                : <Icon name="camera" size={14} color="#FFF" />
                            }
                        </View>
                    </TouchableOpacity>

                    <Text style={[s.heroName, { color: theme.text }]}>{userData?.fullName || t('settings.yourName')}</Text>
                    <Text style={[s.heroEmail, { color: theme.textSecondary }]}>{user?.email || ''}</Text>
                    <View style={[s.rolePill, { backgroundColor: role.color + '15', marginBottom: 16 }]}>
                        <Text style={{ fontSize: 12 }}>{role.emoji}</Text>
                        <Text style={[s.rolePillText, { color: role.color }]}>{role.label}</Text>
                    </View>

                    {/* Badge for caregivers */}
                    {userData?.role === 'caregiver' && (() => {
                        const TIERS = [
                            { min: 0,  label: t('settings.tierBronze'), emoji: '🥉', color: '#CD7F32', bg: '#FDF2E9' },
                            { min: 5,  label: t('settings.tierSilver'),  emoji: '🥈', color: '#9CA3AF', bg: '#F3F4F6' },
                            { min: 20, label: t('settings.tierGold'),    emoji: '🥇', color: '#F5A623', bg: '#FEF3C7' },
                            { min: 50, label: t('settings.tierPlatinum'), emoji: '💎', color: '#0ea5e9', bg: '#E0F2FE' },
                            { min: 100,label: t('settings.tierLegend'),   emoji: '👑', color: '#8B5CF6', bg: '#EDE9FE' },
                        ];
                        const done = userData?.completedServices || 0;
                        let b = TIERS[0];
                        for (const t of TIERS) { if (done >= t.min) b = t; }
                        return (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, backgroundColor: b.bg, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14 }}>
                                <Text style={{ fontSize: 18 }}>{b.emoji}</Text>
                                <Text style={{ fontSize: 13, fontWeight: '800', color: b.color }}>{t('settings.caregiverTier', { tier: b.label })}</Text>
                                <Text style={{ fontSize: 11, color: b.color + '99' }}> · {t('settings.servicesCount', { count: done })}</Text>
                            </View>
                        );
                    })()}

                    <View style={[s.statsStrip, { borderTopColor: theme.border }]}>
                        <View style={s.statItem}>
                            <Text style={[s.statNum, { color: theme.text }]}>{petCount}</Text>
                            <Text style={[s.statLabel, { color: theme.textSecondary }]}>{t('settings.petsCount')}</Text>
                        </View>
                        <View style={[s.statDivider, { backgroundColor: theme.border }]} />
                        <View style={s.statItem}>
                            <Text style={[s.statNum, { color: theme.text }]}>{userData?.reviewCount || 0}</Text>
                            <Text style={[s.statLabel, { color: theme.textSecondary }]}>{t('settings.reviewsCount')}</Text>
                        </View>
                    </View>
                </View>

                {/* ── DATOS PERSONALES (read-only) ── */}
                <SectionTitle>{t('settings.personalData')}</SectionTitle>
                <View style={[s.infoCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                    <View style={s.infoRow}>
                        <View style={[s.infoIconWrap, { backgroundColor: theme.primaryBg }]}>
                            <Icon name="person-outline" size={16} color={theme.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[s.infoLabel, { color: theme.textSecondary }]}>{t('settings.fullName')}</Text>
                            <Text style={[s.infoValue, { color: theme.text }]}>{userData?.fullName || '—'}</Text>
                        </View>
                    </View>
                    <View style={[s.infoDiv, { backgroundColor: theme.border }]} />
                    <View style={s.infoRow}>
                        <View style={[s.infoIconWrap, { backgroundColor: '#EFF6FF' }]}>
                            <Icon name="call-outline" size={16} color="#3B82F6" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[s.infoLabel, { color: theme.textSecondary }]}>{t('settings.phone')}</Text>
                            <Text style={[s.infoValue, { color: theme.text }]}>{userData?.phone || '—'}</Text>
                        </View>
                    </View>
                    <View style={[s.infoDiv, { backgroundColor: theme.border }]} />
                    <View style={s.infoRow}>
                        <View style={[s.infoIconWrap, { backgroundColor: '#F5F3FF' }]}>
                            <Icon name="mail-outline" size={16} color="#7C3AED" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[s.infoLabel, { color: theme.textSecondary }]}>{t('settings.email')}</Text>
                            <Text style={[s.infoValue, { color: theme.text }]}>{user?.email || '—'}</Text>
                        </View>
                        <Icon name="lock-closed-outline" size={13} color={theme.textSecondary} />
                    </View>
                    <View style={[s.infoDiv, { backgroundColor: theme.border }]} />
                    <TouchableOpacity style={[s.infoNote, { backgroundColor: theme.primaryBg }]} onPress={() => navigation.navigate('Profile')}>
                        <Icon name="pencil" size={14} color={theme.primary} />
                        <Text style={[s.infoNoteText, { color: theme.primary }]}>
                            {t('settings.editProfile')}
                        </Text>
                        <Icon name="chevron-forward" size={16} color={theme.primary} />
                    </TouchableOpacity>
                </View>

                {/* ── APARIENCIA ── */}
                <SectionTitle>{t('settings.appearance')}</SectionTitle>
                <SettingGroup>
                    <SettingRow
                        icon={isDarkMode ? 'moon' : 'sunny-outline'}
                        iconBg={isDarkMode ? theme.primaryBg : '#FEF9C3'}
                        label={isDarkMode ? t('settings.darkMode') : t('settings.lightMode')}
                        sublabel={t('settings.changeAppearance')}
                        right={
                            <Switch
                                value={isDarkMode}
                                onValueChange={toggleTheme}
                                trackColor={{ false: theme.border, true: theme.primary }}
                                thumbColor="#FFF"
                            />
                        }
                    />
                    <SettingRow
                        icon="hand-left-outline"
                        iconBg={isLeftHanded ? theme.primaryBg : '#FEF9C3'}
                        label={t('settings.leftHanded')}
                        sublabel={t('settings.leftHandedDesc')}
                        right={
                            <Switch
                                value={isLeftHanded}
                                onValueChange={toggleHandedness}
                                trackColor={{ false: theme.border, true: theme.primary }}
                                thumbColor="#FFF"
                            />
                        }
                    />
                    <SettingRow
                        icon="language-outline"
                        iconBg="#DBEAFE"
                        label={t('settings.languageLabel')}
                        sublabel={lang === 'es' ? t('settings.spanish') : t('settings.english')}
                        last
                        right={
                            <TouchableOpacity
                                onPress={() => switchLanguage(lang === 'es' ? 'en' : 'es')}
                                style={{ backgroundColor: theme.primaryBg, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12 }}
                            >
                                <Text style={{ color: COLORS.primary, fontWeight: '700', fontSize: 13 }}>
                                    {lang === 'es' ? 'EN 🇬🇧' : 'ES 🇪🇸'}
                                </Text>
                            </TouchableOpacity>
                        }
                    />
                </SettingGroup>

                {/* ── CONTACTOS DE EMERGENCIA ── */}
                <SectionTitle>{t('settings.emergencyContacts')}</SectionTitle>
                <View style={[s.settingGroup, { borderColor: theme.border }]}>
                    {emergencyContacts.length === 0 && (
                        <View style={[s.settingRow, { backgroundColor: theme.cardBackground }]}>
                            <Icon name="alert-circle-outline" size={18} color={theme.textSecondary} style={{ marginRight: 8 }} />
                            <Text style={[s.settingSublabel, { color: theme.textSecondary, flex: 1 }]}>
                                {t('settings.noEmergencyContacts')}
                            </Text>
                        </View>
                    )}
                    {emergencyContacts.map((contact, i) => (
                        <View key={i} style={[s.settingRow, { backgroundColor: theme.cardBackground }, i === emergencyContacts.length - 1 && emergencyContacts.length > 0 && s.settingRowLast]}>
                            <View style={[s.settingIconWrap, { backgroundColor: '#FEE2E2' }]}>
                                <Icon name="call" size={18} color="#EF4444" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[s.settingLabel, { color: theme.text }]}>{contact.name}</Text>
                                <Text style={[s.settingSublabel, { color: theme.textSecondary }]}>{contact.phone}</Text>
                            </View>
                            <TouchableOpacity onPress={() => openEditContact(contact, i)} style={{ marginRight: 12 }}>
                                <Icon name="pencil-outline" size={18} color={theme.textSecondary} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDeleteContact(i)}>
                                <Icon name="trash-outline" size={18} color="#EF4444" />
                            </TouchableOpacity>
                        </View>
                    ))}
                    {emergencyContacts.length < 3 && (
                        <TouchableOpacity
                            style={[s.settingRow, s.settingRowLast, { backgroundColor: theme.cardBackground }]}
                            onPress={handleAddContactOption}
                        >
                            <View style={[s.settingIconWrap, { backgroundColor: '#FEE2E2' }]}>
                                <Icon name="add" size={18} color="#EF4444" />
                            </View>
                            <Text style={[s.settingLabel, { color: theme.primary }]}>{t('settings.addContact')}</Text>
                            <Icon name="chevron-forward" size={16} color={theme.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* ── MÉTODOS DE PAGO ── */}
                <SectionTitle>{t('settings.payment')}</SectionTitle>
                <SettingGroup>
                    <View style={[s.settingRow, { backgroundColor: theme.cardBackground }]}>
                        <View style={[s.settingIconWrap, { backgroundColor: '#EFF6FF' }]}>
                            <Icon name="card-outline" size={18} color="#3B82F6" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[s.settingLabel, { color: theme.textSecondary }]}>{t('settings.noPaymentMethods')}</Text>
                            <Text style={[s.settingSublabel, { color: theme.textSecondary }]}>{t('settings.paymentManaged')}</Text>
                        </View>
                    </View>
                    <SettingRow
                        icon="shield-checkmark-outline"
                        iconBg="#ECFDF5"
                        label={t('settings.securePayments')}
                        sublabel={t('settings.noBankData')}
                        last
                    />
                </SettingGroup>

                {/* ── CUENTA ── */}
                <SectionTitle>{t('settings.account')}</SectionTitle>
                <SettingGroup>
                    <SettingRow
                        icon="key-outline"
                        iconBg={isDarkMode ? theme.primaryBg : '#F0F9FF'}
                        label={t('settings.changePassword')}
                        onPress={() => setShowPasswordModal(true)}
                        last={userData?.role !== 'normal' && userData?.verificationStatus !== 'pending'}
                    />
                    {userData?.role === 'normal' && userData?.verificationStatus !== 'pending' && (
                        <SettingRow
                            icon="shield-checkmark-outline"
                            iconBg={theme.primaryBg}
                            label={t('settings.verifyAccount')}
                            sublabel={t('settings.verifyAccountDesc')}
                            onPress={() => navigation.navigate('Verify')}
                            last
                        />
                    )}
                    {userData?.verificationStatus === 'pending' && (
                        <SettingRow
                            icon="time-outline"
                            iconBg={isDarkMode ? theme.primaryBg : '#FEF3C7'}
                            label={t('settings.verificationPending')}
                            sublabel={t('settings.verificationPendingDesc')}
                            last
                        />
                    )}
                </SettingGroup>

                {/* ── CUIDADOR: ESTADO ONLINE ── */}
                {userData?.role === 'caregiver' && (
                    <>
                        <SectionTitle>{t('settings.caregiverSection')}</SectionTitle>
                        <SettingGroup>
                            <SettingRow
                                icon="radio-outline"
                                iconBg="#dcfce7"
                                label={t('settings.onlineStatus')}
                                sublabel={t('settings.onlineStatusDesc')}
                                last
                                right={
                                    <Switch
                                        value={!!userData?.isOnline}
                                        onValueChange={async (val) => {
                                            const update = { isOnline: val };
                                            if (val) {
                                                try {
                                                    const { status } = await Location.requestForegroundPermissionsAsync();
                                                    if (status === 'granted') {
                                                        const loc = await Location.getCurrentPositionAsync({});
                                                        update.latitude = loc.coords.latitude;
                                                        update.longitude = loc.coords.longitude;
                                                    }
                                                } catch { /* ignore */ }
                                            }
                                            await supabase.from('users').update(update).eq('id', user.id);
                                            await refreshUserData();
                                        }}
                                        trackColor={{ false: theme.border, true: '#22c55e' }}
                                        thumbColor="#FFF"
                                    />
                                }
                            />
                        </SettingGroup>
                    </>
                )}

                {/* ── RECOMPENSAS ── */}
                <SectionTitle>{t('settings.rewards')}</SectionTitle>
                <SettingGroup>
                    <SettingRow
                        icon="gift-outline"
                        iconBg="#FEF3C7"
                        label={t('settings.inviteFriend')}
                        sublabel={t('settings.inviteFriendDesc')}
                        last
                        onPress={() => setShowInviteModal(true)}
                    />
                </SettingGroup>

                {/* ── INFORMACIÓN ── */}
                <SectionTitle>{t('settings.info')}</SectionTitle>
                <SettingGroup>
                    <SettingRow
                        icon="information-circle-outline"
                        label={t('settings.appVersion')}
                        sublabel={`PawMate v${APP_VERSION}`}
                    />
                    <SettingRow
                        icon="document-text-outline"
                        label={t('settings.privacyPolicy')}
                        onPress={() => setShowPolicy(true)}
                    />
                    <SettingRow
                        icon="flag-outline"
                        iconBg="#FFF1F2"
                        label={t('settings.sendReport')}
                        sublabel={t('settings.sendReportDesc')}
                        onPress={() => setShowReportModal(true)}
                    />
                    <SettingRow
                        icon="chatbubble-ellipses-outline"
                        label={t('settings.contactSupport')}
                        sublabel="soporte@pawmate.app"
                        last
                        onPress={() => Linking.openURL('mailto:soporte@pawmate.app')}
                    />
                </SettingGroup>

                {/* ── ZONA DE PELIGRO ── */}
                <SectionTitle danger>{t('settings.dangerZone')}</SectionTitle>
                <SettingGroup>
                    <SettingRow
                        icon="log-out-outline"
                        iconBg="#FEE2E2"
                        label={t('settings.signOut')}
                        onPress={handleSignOut}
                        danger
                    />
                    <SettingRow
                        icon="trash-outline"
                        iconBg="#FEE2E2"
                        label={t('settings.deleteAccount')}
                        sublabel={t('settings.deleteAccountDesc')}
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
                        <TouchableOpacity onPress={() => { setShowPasswordModal(false); setOldPass(''); setNewPass(''); setConfirmPass(''); }}>
                            <Icon name="close" size={24} color={theme.text} />
                        </TouchableOpacity>
                        <Text style={[s.modalTitle, { color: theme.text }]}>{t('settings.passwordTitle')}</Text>
                        <View style={{ width: 28 }} />
                    </View>
                    <ScrollView contentContainerStyle={{ padding: 24 }}>
                        <View style={[s.infoBanner, { backgroundColor: theme.primaryBg }]}>
                            <Icon name="shield-checkmark-outline" size={18} color={theme.primary} />
                            <Text style={[s.infoBannerText, { color: theme.primary }]}>
                                {t('settings.passwordDesc')}
                            </Text>
                        </View>

                        {/* Campo 1: Contraseña actual */}
                        <Text style={[s.fieldLabel, { color: theme.textSecondary }]}>{t('settings.currentPassword')}</Text>
                        <View style={[s.passwordInputRow, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                            <TextInput
                                style={[s.passwordInput, { color: theme.text }]}
                                secureTextEntry={!showOld}
                                value={oldPass}
                                onChangeText={setOldPass}
                                placeholder={t('settings.currentPasswordPlaceholder')}
                                placeholderTextColor={theme.textSecondary}
                            />
                            <TouchableOpacity onPress={() => setShowOld(v => !v)}>
                                <Icon name={showOld ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {/* Campo 2: Nueva contraseña */}
                        <Text style={[s.fieldLabel, { color: theme.textSecondary, marginTop: 20 }]}>{t('settings.newPassword')}</Text>
                        <View style={[s.passwordInputRow, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                            <TextInput
                                style={[s.passwordInput, { color: theme.text }]}
                                secureTextEntry={!showNew}
                                value={newPass}
                                onChangeText={setNewPass}
                                placeholder={t('settings.newPasswordPlaceholder')}
                                placeholderTextColor={theme.textSecondary}
                            />
                            <TouchableOpacity onPress={() => setShowNew(v => !v)}>
                                <Icon name={showNew ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        {/* Barra de fuerza */}
                        {newPass.length > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
                                {[1, 2, 3, 4].map(i => (
                                    <View key={i} style={[s.strengthBar, {
                                        backgroundColor: newPass.length >= i * 2
                                            ? (newPass.length >= 8 ? '#22C55E' : '#F59E0B')
                                            : theme.border,
                                    }]} />
                                ))}
                                <Text style={[s.strengthLabel, { color: newPass.length < 4 ? '#EF4444' : newPass.length < 8 ? '#F59E0B' : '#22C55E' }]}>
                                    {newPass.length < 4 ? t('settings.strengthWeak') : newPass.length < 8 ? t('settings.strengthMedium') : t('settings.strengthStrong')}
                                </Text>
                            </View>
                        )}

                        {/* Campo 3: Confirmar contraseña */}
                        <Text style={[s.fieldLabel, { color: theme.textSecondary, marginTop: 20 }]}>{t('settings.confirmNewPassword')}</Text>
                        <View style={[s.passwordInputRow, { backgroundColor: theme.cardBackground, borderColor: confirmPass.length > 0 ? (confirmPass === newPass ? '#22C55E' : '#EF4444') : theme.border }]}>
                            <TextInput
                                style={[s.passwordInput, { color: theme.text }]}
                                secureTextEntry={!showConfirm}
                                value={confirmPass}
                                onChangeText={setConfirmPass}
                                placeholder={t('settings.confirmNewPasswordPlaceholder')}
                                placeholderTextColor={theme.textSecondary}
                            />
                            <TouchableOpacity onPress={() => setShowConfirm(v => !v)}>
                                <Icon name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        {confirmPass.length > 0 && confirmPass !== newPass && (
                            <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 6, fontWeight: '600' }}>
                                {t('settings.passwordsMismatchWarn')}
                            </Text>
                        )}
                        {confirmPass.length > 0 && confirmPass === newPass && newPass.length >= 6 && (
                            <Text style={{ color: '#22C55E', fontSize: 12, marginTop: 6, fontWeight: '600' }}>
                                {t('settings.passwordsMatchOk')}
                            </Text>
                        )}

                        <TouchableOpacity
                            style={[s.primaryBtn, { backgroundColor: theme.primary, marginTop: 32, opacity: changingPass ? 0.7 : 1 }]}
                            onPress={handleChangePassword}
                            disabled={changingPass}
                        >
                            {changingPass
                                ? <ActivityIndicator color="#FFF" />
                                : <Text style={s.primaryBtnText}>{t('settings.changePasswordBtn')}</Text>
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
                            <Icon name="close" size={24} color={theme.text} />
                        </TouchableOpacity>
                        <Text style={[s.modalTitle, { color: theme.text }]}>
                            {editingContact !== null ? t('settings.editContact') : t('settings.newEmergencyContact')}
                        </Text>
                        <View style={{ width: 28 }} />
                    </View>
                    <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
                        <View style={[s.infoBanner, { backgroundColor: '#FEE2E2' }]}>
                            <Icon name="alert-circle-outline" size={18} color="#EF4444" />
                            <Text style={[s.infoBannerText, { color: '#EF4444' }]}>
                                {t('settings.emergencyContactDesc')}
                            </Text>
                        </View>
                        <Text style={[s.fieldLabel, { color: theme.textSecondary }]}>{t('settings.contactName')}</Text>
                        <View style={[s.passwordInputRow, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                            <TextInput
                                style={[s.passwordInput, { color: theme.text }]}
                                value={contactName}
                                onChangeText={setContactName}
                                placeholder={t('settings.contactNamePlaceholder')}
                                placeholderTextColor={theme.textSecondary}
                            />
                        </View>
                        <Text style={[s.fieldLabel, { color: theme.textSecondary }]}>{t('settings.contactPhone')}</Text>
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
                                : <Text style={s.primaryBtnText}>{t('settings.saveContact')}</Text>
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
                            <Icon name="close" size={24} color={theme.text} />
                        </TouchableOpacity>
                        <Text style={[s.modalTitle, { color: theme.text }]}>{t('settings.policyTitle')}</Text>
                        <View style={{ width: 28 }} />
                    </View>
                    <ScrollView contentContainerStyle={{ padding: 20 }}>
                        <Text style={[s.policyText, { color: theme.text }]}>{POLICY_TEXT}</Text>
                    </ScrollView>
                </View>
            </Modal>

            {/* ════════════════════════════════════════
                MODAL: INVITAR AMIGO
            ════════════════════════════════════════ */}
            <Modal visible={showInviteModal} animationType="slide" transparent>
                <View style={[s.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)', flex: 1, justifyContent: 'center', padding: 20 }]}>
                    <View style={[{ backgroundColor: theme.cardBackground, borderRadius: 24, padding: 24, shadowOpacity: 0.15, shadowRadius: 20, elevation: 10, position: 'relative' }]}>
                        <TouchableOpacity style={{ position: 'absolute', top: 16, right: 16, zIndex: 10, padding: 8 }} onPress={() => setShowInviteModal(false)}>
                            <Icon name="close" size={24} color={theme.textSecondary} />
                        </TouchableOpacity>
                        <Text style={{ fontSize: 22, fontWeight: '800', marginBottom: 8, textAlign: 'center', color: theme.text }}>{t('settings.inviteTitle')}</Text>
                        <Text style={{ fontSize: 13, marginBottom: 20, textAlign: 'center', lineHeight: 18, color: theme.textSecondary }}>
                            {t('settings.inviteDesc')}
                        </Text>
                        
                        <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, height: 50, marginBottom: 20, backgroundColor: theme.background, borderColor: theme.border }}>
                            <Icon name="mail-outline" size={20} color={theme.textSecondary} style={{ marginRight: 10 }} />
                            <TextInput
                                style={{ flex: 1, fontSize: 15, color: theme.text }}
                                placeholder="amigo@email.com"
                                placeholderTextColor={theme.textSecondary}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                value={inviteEmail}
                                onChangeText={setInviteEmail}
                            />
                        </View>

                        <TouchableOpacity 
                            style={{ height: 50, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.primary }} 
                            onPress={handleInviteFriend} 
                            disabled={sendingInvite}
                        >
                            {sendingInvite ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }}>{t('settings.sendMagicLink')}</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ════════════════════════════════════════
                MODAL: DEVICE CONTACTS PICKER
            ════════════════════════════════════════ */}
            <Modal visible={showPhonePicker} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowPhonePicker(false)}>
                <View style={{ flex: 1, backgroundColor: theme.background }}>
                    <View style={[s.modalHeader, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                        <TouchableOpacity onPress={() => setShowPhonePicker(false)}>
                            <Icon name="close" size={24} color={theme.text} />
                        </TouchableOpacity>
                        <Text style={[s.modalTitle, { color: theme.text }]}>{t('settings.chooseContact')}</Text>
                        <View style={{ width: 28 }} />
                    </View>
                    <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                        {loadingDeviceContacts ? (
                            <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
                        ) : deviceContacts.map((c, i) => (
                            <TouchableOpacity
                                key={i}
                                style={[s.settingRow, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}
                                onPress={() => {
                                    setShowPhonePicker(false);
                                    setContactName(c.name);
                                    setContactPhone(c.phoneNumbers[0].number);
                                    setEditingContact(null);
                                    setShowContactModal(true);
                                }}
                            >
                                <View style={[s.settingIconWrap, { backgroundColor: '#FEE2E2' }]}>
                                    <Icon name="person" size={18} color="#EF4444" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[s.settingLabel, { color: theme.text }]}>{c.name}</Text>
                                    <Text style={[s.settingSublabel, { color: theme.textSecondary }]}>{c.phoneNumbers[0].number}</Text>
                                </View>
                                <Icon name="chevron-forward" size={16} color={theme.textSecondary} />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </Modal>

            {/* ════════════════════════════════════════
                MODAL: ENVIAR REPORTE
            ════════════════════════════════════════ */}
            <Modal visible={showReportModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowReportModal(false)}>
                <View style={{ flex: 1, backgroundColor: theme.background }}>
                    <View style={[s.modalHeader, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                        <TouchableOpacity onPress={() => { setShowReportModal(false); setReportText(''); setReportReason(''); setReportImages([]); }}>
                            <Icon name="close" size={24} color={theme.text} />
                        </TouchableOpacity>
                        <Text style={[s.modalTitle, { color: theme.text }]}>{t('settings.reportTitle')}</Text>
                        <View style={{ width: 28 }} />
                    </View>
                    <ScrollView contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
                        <View style={[s.infoBanner, { backgroundColor: '#FFF1F2' }]}>
                            <Icon name="flag-outline" size={18} color="#E11D48" />
                            <Text style={[s.infoBannerText, { color: '#E11D48' }]}>
                                {t('settings.reportDesc')}
                            </Text>
                        </View>

                        <Text style={[s.fieldLabel, { color: theme.textSecondary }]}>{t('settings.reportReason')}</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                            {[t('settings.reportReasonBug'), t('settings.reportReasonContent'), t('settings.reportReasonUser'), t('settings.reportReasonSuggestion'), t('settings.reportReasonOther')].map((reason) => (
                                <TouchableOpacity
                                    key={reason}
                                    style={{
                                        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                                        backgroundColor: reportReason === reason ? theme.primary : theme.cardBackground,
                                        borderWidth: 1, borderColor: reportReason === reason ? theme.primary : theme.border,
                                    }}
                                    onPress={() => setReportReason(reason)}
                                >
                                    <Text style={{ color: reportReason === reason ? '#FFF' : theme.text, fontSize: 13, fontWeight: '600' }}>{reason}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={[s.fieldLabel, { color: theme.textSecondary }]}>{t('settings.reportProblem')}</Text>
                        <View style={[s.passwordInputRow, { backgroundColor: theme.cardBackground, borderColor: theme.border, alignItems: 'flex-start', paddingVertical: 14, minHeight: 130 }]}>
                            <TextInput
                                style={[s.passwordInput, { color: theme.text, textAlignVertical: 'top', minHeight: 100 }]}
                                value={reportText}
                                onChangeText={setReportText}
                                placeholder={t('settings.reportProblemPlaceholder')}
                                placeholderTextColor={theme.textSecondary}
                                multiline
                                numberOfLines={5}
                            />
                        </View>
                        <Text style={{ color: theme.textSecondary, fontSize: 11, marginTop: 6 }}>
                            {reportText.length} {t('settings.charCount')}
                        </Text>

                        <Text style={[s.fieldLabel, { color: theme.textSecondary, marginTop: 20 }]}>{t('settings.reportPhotos')}</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
                            {reportImages.map((uri, i) => (
                                <View key={i} style={{ position: 'relative' }}>
                                    <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: 12 }} />
                                    <TouchableOpacity
                                        style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#EF4444', borderRadius: 12, width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}
                                        onPress={() => handleRemoveReportImage(i)}
                                    >
                                        <Icon name="close" size={14} color="#FFF" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                            {reportImages.length < 4 && (
                                <TouchableOpacity
                                    style={{ width: 80, height: 80, borderRadius: 12, borderWidth: 2, borderColor: theme.border, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: theme.cardBackground }}
                                    onPress={handleAddReportImage}
                                >
                                    <Icon name="camera-outline" size={24} color={theme.textSecondary} />
                                    <Text style={{ fontSize: 10, color: theme.textSecondary, marginTop: 2 }}>{t('common.add')}</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        <Text style={{ color: theme.textSecondary, fontSize: 11 }}>
                            {t('settings.maxImages')}
                        </Text>

                        <TouchableOpacity
                            style={[s.primaryBtn, { backgroundColor: '#E11D48', marginTop: 28, opacity: sendingReport ? 0.7 : 1 }]}
                            onPress={handleSendReport}
                            disabled={sendingReport}
                        >
                            {sendingReport
                                ? <ActivityIndicator color="#FFF" />
                                : <Text style={s.primaryBtnText}>{t('settings.sendReport2')}</Text>
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
