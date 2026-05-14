import React, { useState, useContext, useEffect, useCallback } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity, ScrollView,
    Image, Alert, ActivityIndicator, TextInput, Switch,
    Platform, Linking, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { supabase } from '../config/supabase';
import { uploadImageToStorage, uploadReportImage } from '../utils/storageHelpers';
import * as Contacts from 'expo-contacts';
import { useFocusEffect } from '@react-navigation/native';

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
    const { userData, user, refreshUserData, signOut } = useContext(AuthContext);
    const { theme, toggleTheme, isDarkMode, isLeftHanded, toggleHandedness } = useContext(ThemeContext);

    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [photoUri, setPhotoUri]             = useState(userData?.photoURL || null);

    // Modal de cambio de contraseña.
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [oldPass, setOldPass]       = useState('');
    const [newPass, setNewPass]       = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [changingPass, setChangingPass]             = useState(false);
    const [showOld, setShowOld]       = useState(false);
    const [showNew, setShowNew]       = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    // Modal de reporte de problemas.
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportReason, setReportReason]       = useState('');
    const [reportText, setReportText]           = useState('');
    const [reportImages, setReportImages]       = useState([]);
    const [sendingReport, setSendingReport]     = useState(false);

    // Contactos de emergencia.
    const [emergencyContacts, setEmergencyContacts]         = useState(userData?.emergencyContacts || []);
    const [showContactModal, setShowContactModal]           = useState(false);
    const [editingContact, setEditingContact]               = useState(null); // null = nuevo contacto
    const [contactName, setContactName]                     = useState('');
    const [contactPhone, setContactPhone]                   = useState('');
    const [savingContact, setSavingContact]                 = useState(false);
    
    // Selector de contactos del dispositivo.
    const [showPhonePicker, setShowPhonePicker]             = useState(false);
    const [deviceContacts, setDeviceContacts]               = useState([]);
    const [loadingDeviceContacts, setLoadingDeviceContacts] = useState(false);

    // Modal de política de privacidad.
    const [showPolicy, setShowPolicy] = useState(false);

    // Estado local de notificaciones.
    const [notifsEnabled, setNotifsEnabled] = useState(userData?.notificationsEnabled !== false);

    // Estadísticas.
    const [petCount, setPetCount]   = useState(0);


    const ROLE_CONFIG = {
        normal:    { label: 'Usuario',             emoji: '', color: '#6B7280' },
        owner:     { label: 'Dueño Verificado',    emoji: '', color: theme.primary },
        caregiver: { label: 'Cuidador Verificado', emoji: '', color: '#0891b2' },
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

        // Suscripción Realtime para refrescar el conteo de mascotas.
        const channel = supabase
            .channel(`settings_pets_sync_${Date.now()}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pets', filter: `ownerId=eq.${user.id}` }, () => {
                fetchStats();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [user?.id]);

    // Refresca el conteo de mascotas cada vez que la pantalla recupera el foco.
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

    /**
     * Abre la galería, sube la foto y actualiza el perfil.
     */
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
            Alert.alert('Error', 'No se pudo subir la foto.');
        } finally {
            setUploadingPhoto(false);
        }
    };

    /**
     * Cambia la contraseña del usuario previa verificación de la actual.
     */
    const handleChangePassword = async () => {
        if (!oldPass) return Alert.alert('Error', 'Introduce tu contraseña actual.');
        if (newPass.length < 6) return Alert.alert('Error', 'La nueva contraseña debe tener al menos 6 caracteres.');
        if (newPass === oldPass) return Alert.alert('Error', 'La nueva contraseña no puede ser igual a la actual.');
        if (newPass !== confirmPass) return Alert.alert('Error', 'Las contraseñas no coinciden.');
        setChangingPass(true);
        try {
            const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: oldPass });
            if (signInError) throw new Error('wrong-password');
            const { error: updateError } = await supabase.auth.updateUser({ password: newPass });
            if (updateError) throw updateError;
            setShowPasswordModal(false);
            setOldPass(''); setNewPass(''); setConfirmPass('');
            Alert.alert('Contraseña actualizada');
        } catch (e) {
            Alert.alert('Error', e.message === 'wrong-password'
                ? 'La contraseña actual es incorrecta.'
                : 'No se pudo cambiar la contraseña.');
        } finally { setChangingPass(false); }
    };

    /**
     * Gestiona el envío de reportes de problema al equipo de soporte.
     */
    const handleAddReportImage = async () => {
        if (reportImages.length >= 4) return Alert.alert('Límite', 'Máximo 4 imágenes por reporte.');
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
        if (!reportText.trim()) return Alert.alert('Error', 'Describe el problema antes de enviar.');
        setSendingReport(true);
        try {
            // Sube las imágenes adjuntas al reporte.
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
            Alert.alert('Reporte enviado', 'Gracias por tu feedback. Lo revisaremos pronto.');
        } catch (e) {
            console.error('Report error:', e);
            Alert.alert('Error', 'No se pudo enviar el reporte. Inténtalo de nuevo.');
        } finally {
            setSendingReport(false);
        }
    };

    /**
     * Gestiona los contactos de emergencia: crear, editar, eliminar e
     * importar desde los contactos del dispositivo.
     */
    const handleAddContactOption = () => {
        Alert.alert('Añadir Contacto', '¿Cómo deseas añadir un contacto de emergencia?', [
            { text: 'Añadir Manualmente', onPress: openAddContact },
            { text: 'Importar del Móvil', onPress: importContactFromDevice },
            { text: 'Cancelar', style: 'cancel' }
        ]);
    };

    const importContactFromDevice = async () => {
        setLoadingDeviceContacts(true);
        try {
            const { status } = await Contacts.requestPermissionsAsync();
            if (status !== 'granted') return Alert.alert('Permiso denegado', 'Necesitas permitir el acceso a los contactos.');
            const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers] });
            const valid = data.filter(c => c.name && c.phoneNumbers && c.phoneNumbers.length > 0);
            setDeviceContacts(valid.sort((a,b) => a.name.localeCompare(b.name)));
            setShowPhonePicker(true);
        } catch (e) {
            Alert.alert('Error', 'No se pudieron recuperar los contactos.');
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
            await supabase.from('users').update({ emergencyContacts: newContacts }).eq('id', user.id);
            setEmergencyContacts(newContacts);
            setShowContactModal(false);
            await refreshUserData();
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
                        await supabase.from('users').update({ emergencyContacts: newContacts }).eq('id', user.id);
                        setEmergencyContacts(newContacts);
                        await refreshUserData();
                    } catch { Alert.alert('Error', 'No se pudo eliminar.'); }
                },
            },
        ]);
    };

    /**
     * Cierra la sesión del usuario tras confirmación.
     */
    const handleSignOut = () => {
        Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Salir', style: 'destructive', onPress: () => signOut().catch(() => {}) },
        ]);
    };

    const handleDeleteAccount = () => {
        Alert.alert('Eliminar cuenta', 'Esta acción es IRREVERSIBLE.', [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Eliminar', style: 'destructive',
                onPress: async () => {
                    try {
                        await supabase.from('users').delete().eq('id', user.id);
                        await signOut();
                    } catch {
                        Alert.alert('Error', 'Vuelve a iniciar sesión antes de eliminar tu cuenta.');
                    }
                },
            },
        ]);
    };

    // Componentes auxiliares del render.
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

    // Render principal.
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
                                : <Ionicons name="camera" size={14} color="#FFF" />
                            }
                        </View>
                    </TouchableOpacity>

                    <Text style={[s.heroName, { color: theme.text }]}>{userData?.fullName || 'Tu nombre'}</Text>
                    <Text style={[s.heroEmail, { color: theme.textSecondary }]}>{user?.email || ''}</Text>
                    <View style={[s.rolePill, { backgroundColor: role.color + '15', marginBottom: 16 }]}>
                        <Text style={{ fontSize: 12 }}>{role.emoji}</Text>
                        <Text style={[s.rolePillText, { color: role.color }]}>{role.label}</Text>
                    </View>

                    {/* Badge for caregivers */}
                    {userData?.role === 'caregiver' && (() => {
                        const TIERS = [
                            { min: 0,  label: 'Bronce', emoji: '', color: '#CD7F32', bg: '#FDF2E9' },
                            { min: 5,  label: 'Plata',  emoji: '', color: '#9CA3AF', bg: '#F3F4F6' },
                            { min: 20, label: 'Oro',    emoji: '', color: '#F5A623', bg: '#FEF3C7' },
                        ];
                        const done = userData?.completedServices || 0;
                        let b = TIERS[0];
                        for (const t of TIERS) { if (done >= t.min) b = t; }
                        return (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12, backgroundColor: b.bg, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14 }}>
                                <Text style={{ fontSize: 18 }}>{b.emoji}</Text>
                                <Text style={{ fontSize: 13, fontWeight: '800', color: b.color }}>Cuidador {b.label}</Text>
                                <Text style={{ fontSize: 11, color: b.color + '99' }}> · {done} servicios</Text>
                            </View>
                        );
                    })()}

                    <View style={[s.statsStrip, { borderTopColor: theme.border }]}>
                        <View style={s.statItem}>
                            <Text style={[s.statNum, { color: theme.text }]}>{petCount}</Text>
                            <Text style={[s.statLabel, { color: theme.textSecondary }]}>Mascotas</Text>
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
                    <TouchableOpacity style={[s.infoNote, { backgroundColor: theme.primaryBg }]} onPress={() => navigation.navigate('Profile')}>
                        <Ionicons name="pencil" size={14} color={theme.primary} />
                        <Text style={[s.infoNoteText, { color: theme.primary }]}>
                            Modificar mis datos en Perfil
                        </Text>
                        <Ionicons name="chevron-forward" size={16} color={theme.primary} />
                    </TouchableOpacity>
                </View>

                {/* ── APARIENCIA ── */}
                <SectionTitle>APARIENCIA</SectionTitle>
                <SettingGroup>
                    <SettingRow
                        icon={isDarkMode ? 'moon' : 'sunny-outline'}
                        iconBg={isDarkMode ? theme.primaryBg : '#FEF9C3'}
                        label={isDarkMode ? 'Modo oscuro' : 'Modo claro'}
                        sublabel="Cambia el aspecto de la app"
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
                        label="Modo zurdo"
                        sublabel="Mueve los botones al lado izquierdo"
                        last
                        right={
                            <Switch
                                value={isLeftHanded}
                                onValueChange={toggleHandedness}
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
                            onPress={handleAddContactOption}
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
                        last={userData?.role !== 'normal' && userData?.verificationStatus !== 'pending'}
                    />
                    {userData?.role === 'normal' && userData?.verificationStatus !== 'pending' && (
                        <SettingRow
                            icon="shield-checkmark-outline"
                            iconBg={theme.primaryBg}
                            label="Verificar mi cuenta"
                            sublabel="Conviértete en Dueño o Cuidador"
                            onPress={() => navigation.navigate('Verify')}
                            last
                        />
                    )}
                    {userData?.verificationStatus === 'pending' && (
                        <SettingRow
                            icon="time-outline"
                            iconBg={isDarkMode ? theme.primaryBg : '#FEF3C7'}
                            label="Verificación en revisión"
                            sublabel="Te avisaremos en 24-48h"
                            last
                        />
                    )}
                </SettingGroup>

                {/* ── CUIDADOR: ESTADO ONLINE ── */}
                {userData?.role === 'caregiver' && (
                    <>
                        <SectionTitle>CUIDADOR</SectionTitle>
                        <SettingGroup>
                            <SettingRow
                                icon="radio-outline"
                                iconBg="#dcfce7"
                                label="Estado Online"
                                sublabel="Aparece en el mapa para los dueños"
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
                        icon="flag-outline"
                        iconBg="#FFF1F2"
                        label="Enviar reporte"
                        sublabel="Ayuda a mejorar PawMate"
                        onPress={() => setShowReportModal(true)}
                    />
                    <SettingRow
                        icon="chatbubble-ellipses-outline"
                        label="Contactar soporte"
                        sublabel="soporte@apppawmate.com"
                        last
                        onPress={() => Linking.openURL('mailto:soporte@apppawmate.com')}
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
                        <TouchableOpacity onPress={() => { setShowPasswordModal(false); setOldPass(''); setNewPass(''); setConfirmPass(''); }}>
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

                        {/* Campo 1: Contraseña actual */}
                        <Text style={[s.fieldLabel, { color: theme.textSecondary }]}>CONTRASEÑA ACTUAL</Text>
                        <View style={[s.passwordInputRow, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                            <TextInput
                                style={[s.passwordInput, { color: theme.text }]}
                                secureTextEntry={!showOld}
                                value={oldPass}
                                onChangeText={setOldPass}
                                placeholder="Tu contraseña actual"
                                placeholderTextColor={theme.textSecondary}
                            />
                            <TouchableOpacity onPress={() => setShowOld(v => !v)}>
                                <Ionicons name={showOld ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {/* Campo 2: Nueva contraseña */}
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
                                    {newPass.length < 4 ? 'Débil' : newPass.length < 8 ? 'Media' : 'Fuerte'}
                                </Text>
                            </View>
                        )}

                        {/* Campo 3: Confirmar contraseña */}
                        <Text style={[s.fieldLabel, { color: theme.textSecondary, marginTop: 20 }]}>CONFIRMAR CONTRASEÑA</Text>
                        <View style={[s.passwordInputRow, { backgroundColor: theme.cardBackground, borderColor: confirmPass.length > 0 ? (confirmPass === newPass ? '#22C55E' : '#EF4444') : theme.border }]}>
                            <TextInput
                                style={[s.passwordInput, { color: theme.text }]}
                                secureTextEntry={!showConfirm}
                                value={confirmPass}
                                onChangeText={setConfirmPass}
                                placeholder="Repite la nueva contraseña"
                                placeholderTextColor={theme.textSecondary}
                            />
                            <TouchableOpacity onPress={() => setShowConfirm(v => !v)}>
                                <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        {confirmPass.length > 0 && confirmPass !== newPass && (
                            <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 6, fontWeight: '600' }}>
                                Las contraseñas no coinciden
                            </Text>
                        )}
                        {confirmPass.length > 0 && confirmPass === newPass && newPass.length >= 6 && (
                            <Text style={{ color: '#22C55E', fontSize: 12, marginTop: 6, fontWeight: '600' }}>
                                Las contraseñas coinciden
                            </Text>
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

            {/* ════════════════════════════════════════
                MODAL: DEVICE CONTACTS PICKER
            ════════════════════════════════════════ */}
            <Modal visible={showPhonePicker} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowPhonePicker(false)}>
                <View style={{ flex: 1, backgroundColor: theme.background }}>
                    <View style={[s.modalHeader, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                        <TouchableOpacity onPress={() => setShowPhonePicker(false)}>
                            <Ionicons name="close" size={24} color={theme.text} />
                        </TouchableOpacity>
                        <Text style={[s.modalTitle, { color: theme.text }]}>Elegir Contacto</Text>
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
                                    <Ionicons name="person" size={18} color="#EF4444" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[s.settingLabel, { color: theme.text }]}>{c.name}</Text>
                                    <Text style={[s.settingSublabel, { color: theme.textSecondary }]}>{c.phoneNumbers[0].number}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
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
                            <Ionicons name="close" size={24} color={theme.text} />
                        </TouchableOpacity>
                        <Text style={[s.modalTitle, { color: theme.text }]}>Enviar Reporte</Text>
                        <View style={{ width: 28 }} />
                    </View>
                    <ScrollView contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
                        <View style={[s.infoBanner, { backgroundColor: '#FFF1F2' }]}>
                            <Ionicons name="flag-outline" size={18} color="#E11D48" />
                            <Text style={[s.infoBannerText, { color: '#E11D48' }]}>
                                Tu reporte nos ayuda a mejorar PawMate. Puedes adjuntar capturas o fotos.
                            </Text>
                        </View>

                        <Text style={[s.fieldLabel, { color: theme.textSecondary }]}>MOTIVO DEL REPORTE</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                            {['Bug / Error', 'Contenido inapropiado', 'Problema con usuario', 'Sugerencia', 'Otro'].map((reason) => (
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

                        <Text style={[s.fieldLabel, { color: theme.textSecondary }]}>DESCRIBE EL PROBLEMA</Text>
                        <View style={[s.passwordInputRow, { backgroundColor: theme.cardBackground, borderColor: theme.border, alignItems: 'flex-start', paddingVertical: 14, minHeight: 130 }]}>
                            <TextInput
                                style={[s.passwordInput, { color: theme.text, textAlignVertical: 'top', minHeight: 100 }]}
                                value={reportText}
                                onChangeText={setReportText}
                                placeholder="Explica el problema con detalle...&#10;¿Qué pasó? ¿Cuándo ocurrió?"
                                placeholderTextColor={theme.textSecondary}
                                multiline
                                numberOfLines={5}
                            />
                        </View>
                        <Text style={{ color: theme.textSecondary, fontSize: 11, marginTop: 6 }}>
                            {reportText.length} / 500 caracteres
                        </Text>

                        <Text style={[s.fieldLabel, { color: theme.textSecondary, marginTop: 20 }]}>FOTOS / CAPTURAS (OPCIONAL)</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
                            {reportImages.map((uri, i) => (
                                <View key={i} style={{ position: 'relative' }}>
                                    <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: 12 }} />
                                    <TouchableOpacity
                                        style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#EF4444', borderRadius: 12, width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}
                                        onPress={() => handleRemoveReportImage(i)}
                                    >
                                        <Ionicons name="close" size={14} color="#FFF" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                            {reportImages.length < 4 && (
                                <TouchableOpacity
                                    style={{ width: 80, height: 80, borderRadius: 12, borderWidth: 2, borderColor: theme.border, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: theme.cardBackground }}
                                    onPress={handleAddReportImage}
                                >
                                    <Ionicons name="camera-outline" size={24} color={theme.textSecondary} />
                                    <Text style={{ fontSize: 10, color: theme.textSecondary, marginTop: 2 }}>Añadir</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        <Text style={{ color: theme.textSecondary, fontSize: 11 }}>
                            Máximo 4 imágenes
                        </Text>

                        <TouchableOpacity
                            style={[s.primaryBtn, { backgroundColor: '#E11D48', marginTop: 28, opacity: sendingReport ? 0.7 : 1 }]}
                            onPress={handleSendReport}
                            disabled={sendingReport}
                        >
                            {sendingReport
                                ? <ActivityIndicator color="#FFF" />
                                : <Text style={s.primaryBtnText}>Enviar Reporte</Text>
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
