import React, { useState, useContext } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity, ScrollView,
    Image, Alert, ActivityIndicator, TextInput, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '../constants/colors';
import { AuthContext } from '../context/AuthContext';
import { auth, db } from '../config/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

const SPECIES_OPTIONS = [
    { value: 'dog',    label: '🐕 Perro' },
    { value: 'cat',    label: '🐈 Gato' },
    { value: 'bird',   label: '🐦 Ave' },
    { value: 'rabbit', label: '🐇 Conejo' },
    { value: 'other',  label: '🐾 Otro' },
];

const SERVICE_OPTIONS = [
    { value: 'walking', label: '🚶 Paseos' },
    { value: 'hotel',   label: '🏨 Hotel' },
    { value: 'daycare', label: '☀️ Guardería' },
];

export default function VerifyOwnerScreen({ navigation }) {
    const { userData } = useContext(AuthContext);
    const [step, setStep] = useState(1); // 1: choose role, 2: upload docs, 3: success
    const [targetRole, setTargetRole] = useState('owner'); // 'owner' | 'caregiver'
    const [submitting, setSubmitting] = useState(false);

    // Document photos
    const [idFront, setIdFront] = useState(null);
    const [idBack, setIdBack] = useState(null);
    const [selfie, setSelfie] = useState(null);
    const [certDoc, setCertDoc] = useState(null); // caregiver only

    // Caregiver config
    const [acceptedSpecies, setAcceptedSpecies] = useState([]);
    const [serviceTypes, setServiceTypes] = useState([]);
    const [serviceRadius, setServiceRadius] = useState('5');
    const [maxWalk, setMaxWalk] = useState('5');
    const [maxHotel, setMaxHotel] = useState('3');

    // ─────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────
    const pickPhoto = async (setter) => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true, quality: 0.8,
        });
        if (!result.canceled) setter(result.assets[0].uri);
    };

    const toggleMulti = (value, arr, setter) => {
        setter(arr.includes(value)
            ? arr.filter(v => v !== value)
            : [...arr, value]
        );
    };

    // ─────────────────────────────────────────────────
    // SUBMIT
    // ─────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!idFront || !idBack || !selfie) {
            return Alert.alert('Documentos requeridos', 'Sube el DNI (frente y dorso) y el selfie.');
        }
        if (targetRole === 'caregiver') {
            if (acceptedSpecies.length === 0)
                return Alert.alert('Error', 'Selecciona al menos una especie que aceptas.');
            if (serviceTypes.length === 0)
                return Alert.alert('Error', 'Selecciona al menos un tipo de servicio.');
        }

        setSubmitting(true);
        try {
            const updateData = {
                verificationStatus: 'pending',
                verificationRequestedAt: serverTimestamp(),
                pendingRole: targetRole,
                // In production: upload images to Firebase Storage and store URLs
                idFrontUrl: idFront,
                idBackUrl: idBack,
                selfieUrl: selfie,
            };

            if (targetRole === 'caregiver') {
                Object.assign(updateData, {
                    certDocUrl: certDoc,
                    acceptedSpecies,
                    serviceTypes,
                    serviceRadius: parseInt(serviceRadius) || 5,
                    maxConcurrentWalks: parseInt(maxWalk) || 5,
                    maxConcurrentHotel: parseInt(maxHotel) || 3,
                });
            }

            await updateDoc(doc(db, 'users', auth.currentUser.uid), updateData);
            setStep(3);
        } catch (e) {
            Alert.alert('Error', 'No se pudo enviar la solicitud. Inténtalo de nuevo.');
        } finally {
            setSubmitting(false);
        }
    };

    // ─────────────────────────────────────────────────
    // RENDER: Step 1 — Choose Role
    // ─────────────────────────────────────────────────
    const renderStep1 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Elige tu rol en PawMate</Text>
            <Text style={styles.stepDesc}>
                Al verificarte obtienes una insignia ✓ en tu perfil y acceso a funciones avanzadas.
            </Text>

            <TouchableOpacity
                style={[styles.roleCard, targetRole === 'owner' && styles.roleCardActive]}
                onPress={() => setTargetRole('owner')}
            >
                <View style={styles.roleCardIcon}>
                    <Text style={{ fontSize: 36 }}>🐾</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.roleCardTitle}>Dueño Verificado</Text>
                        <View style={styles.verifiedBadge}>
                            <Text style={styles.verifiedBadgeText}>✓ Dueño</Text>
                        </View>
                    </View>
                    <Text style={styles.roleCardDesc}>
                        Accede a reservas, servicios de cuidado y muestra tu insignia ✓ en el perfil.
                    </Text>
                </View>
                <Ionicons
                    name={targetRole === 'owner' ? 'radio-button-on' : 'radio-button-off'}
                    size={24} color={COLORS.primary}
                />
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.roleCard, targetRole === 'caregiver' && styles.roleCardActive]}
                onPress={() => setTargetRole('caregiver')}
            >
                <View style={[styles.roleCardIcon, { backgroundColor: COLORS.secondaryLight }]}>
                    <Text style={{ fontSize: 36 }}>🛡️</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.roleCardTitle}>Cuidador Verificado</Text>
                        <View style={[styles.verifiedBadge, { backgroundColor: COLORS.secondaryLight }]}>
                            <Text style={[styles.verifiedBadgeText, { color: COLORS.secondary }]}>🛡️ Pro</Text>
                        </View>
                    </View>
                    <Text style={styles.roleCardDesc}>
                        Ofrece servicios de paseo, hotel y guardería. Gana dinero cuidando mascotas.
                    </Text>
                </View>
                <Ionicons
                    name={targetRole === 'caregiver' ? 'radio-button-on' : 'radio-button-off'}
                    size={24} color={COLORS.primary}
                />
            </TouchableOpacity>

            <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(2)}>
                <Text style={styles.nextBtnText}>Continuar</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFF" />
            </TouchableOpacity>
        </View>
    );

    // ─────────────────────────────────────────────────
    // RENDER: Step 2 — Documents + Caregiver Config
    // ─────────────────────────────────────────────────
    const renderStep2 = () => (
        <View style={styles.stepContainer}>
            <TouchableOpacity onPress={() => setStep(1)} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={20} color={COLORS.text} />
                <Text style={styles.backBtnText}>Volver</Text>
            </TouchableOpacity>

            <Text style={styles.stepTitle}>Verificación de identidad</Text>
            <Text style={styles.stepDesc}>
                Sube una foto de tu DNI/pasaporte y un selfie. Nuestro equipo revisará tu solicitud en 24-48h.
            </Text>

            {/* Document uploads */}
            <DocUploadItem
                label="📄 DNI / Pasaporte — Frente"
                uri={idFront}
                onPress={() => pickPhoto(setIdFront)}
                required
            />
            <DocUploadItem
                label="📄 DNI / Pasaporte — Dorso"
                uri={idBack}
                onPress={() => pickPhoto(setIdBack)}
                required
            />
            <DocUploadItem
                label="🤳 Selfie con DNI"
                uri={selfie}
                onPress={() => pickPhoto(setSelfie)}
                required
            />

            {/* Caregiver-specific config */}
            {targetRole === 'caregiver' && (
                <>
                    <DocUploadItem
                        label="📋 Certificado / Formación (opcional)"
                        uri={certDoc}
                        onPress={() => pickPhoto(setCertDoc)}
                    />

                    <View style={styles.sectionDivider}>
                        <Text style={styles.sectionLabel}>Configuración de servicios</Text>
                    </View>

                    <Text style={styles.configLabel}>Especies que aceptas</Text>
                    <View style={styles.multiSelect}>
                        {SPECIES_OPTIONS.map(sp => (
                            <TouchableOpacity
                                key={sp.value}
                                style={[styles.selectChip, acceptedSpecies.includes(sp.value) && styles.selectChipActive]}
                                onPress={() => toggleMulti(sp.value, acceptedSpecies, setAcceptedSpecies)}
                            >
                                <Text style={[styles.selectChipText, acceptedSpecies.includes(sp.value) && { color: '#FFF' }]}>
                                    {sp.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={styles.configLabel}>Tipos de servicio</Text>
                    <View style={styles.multiSelect}>
                        {SERVICE_OPTIONS.map(sv => (
                            <TouchableOpacity
                                key={sv.value}
                                style={[styles.selectChip, serviceTypes.includes(sv.value) && styles.selectChipActive]}
                                onPress={() => toggleMulti(sv.value, serviceTypes, setServiceTypes)}
                            >
                                <Text style={[styles.selectChipText, serviceTypes.includes(sv.value) && { color: '#FFF' }]}>
                                    {sv.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={styles.configLabel}>Radio de servicio (km)</Text>
                    <TextInput
                        style={styles.configInput}
                        keyboardType="numeric"
                        value={serviceRadius}
                        onChangeText={setServiceRadius}
                        placeholder="Ej. 5"
                        placeholderTextColor={COLORS.textLight}
                    />

                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.configLabel}>Máx. paseos simultáneos</Text>
                            <TextInput
                                style={styles.configInput}
                                keyboardType="numeric"
                                value={maxWalk}
                                onChangeText={setMaxWalk}
                                placeholder="5"
                                placeholderTextColor={COLORS.textLight}
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.configLabel}>Máx. hotel simultáneo</Text>
                            <TextInput
                                style={styles.configInput}
                                keyboardType="numeric"
                                value={maxHotel}
                                onChangeText={setMaxHotel}
                                placeholder="3"
                                placeholderTextColor={COLORS.textLight}
                            />
                        </View>
                    </View>
                </>
            )}

            <TouchableOpacity
                style={[styles.nextBtn, submitting && { opacity: 0.7 }]}
                onPress={handleSubmit}
                disabled={submitting}
            >
                {submitting ? (
                    <ActivityIndicator color="#FFF" />
                ) : (
                    <>
                        <Text style={styles.nextBtnText}>Enviar solicitud</Text>
                        <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                    </>
                )}
            </TouchableOpacity>
        </View>
    );

    // ─────────────────────────────────────────────────
    // RENDER: Step 3 — Success
    // ─────────────────────────────────────────────────
    const renderStep3 = () => (
        <View style={[styles.stepContainer, { alignItems: 'center', justifyContent: 'center', flex: 1 }]}>
            <Text style={{ fontSize: 80, marginBottom: 20 }}>🎉</Text>
            <Text style={styles.successTitle}>¡Solicitud enviada!</Text>
            <Text style={styles.successDesc}>
                Nuestro equipo revisará tus documentos en las próximas 24-48 horas.
                Recibirás una notificación cuando tu cuenta esté verificada.
            </Text>
            <View style={styles.pendingBadge}>
                <Ionicons name="time-outline" size={16} color={COLORS.warning} />
                <Text style={styles.pendingBadgeText}>En revisión</Text>
            </View>
            {navigation && (
                <TouchableOpacity style={styles.nextBtn} onPress={() => navigation.goBack()}>
                    <Text style={styles.nextBtnText}>Volver al inicio</Text>
                </TouchableOpacity>
            )}
        </View>
    );

    // ─────────────────────────────────────────────────
    // If already pending/verified, show status
    // ─────────────────────────────────────────────────
    if (userData?.verificationStatus === 'pending') {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 30 }]}>
                <StatusBar style="dark" />
                <Text style={{ fontSize: 60 }}>⏳</Text>
                <Text style={[styles.successTitle, { marginTop: 20 }]}>Solicitud en revisión</Text>
                <Text style={styles.successDesc}>
                    Tu documentación ya fue enviada. Nuestro equipo la revisará pronto.
                </Text>
            </View>
        );
    }

    if (userData?.role === 'owner' || userData?.role === 'caregiver') {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 30 }]}>
                <StatusBar style="dark" />
                <Text style={{ fontSize: 60 }}>✅</Text>
                <Text style={[styles.successTitle, { marginTop: 20 }]}>
                    Ya eres {userData.role === 'caregiver' ? 'Cuidador Verificado 🛡️' : 'Dueño Verificado ✓'}
                </Text>
                <Text style={styles.successDesc}>Tu cuenta ya tiene verificación activa.</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar style="dark" />

            {/* Progress bar */}
            <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${(step / 3) * 100}%` }]} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
                {step === 3 && renderStep3()}
            </ScrollView>
        </View>
    );
}

// ─────────────────────────────────────────────────
// Mini component: Document Upload Item
// ─────────────────────────────────────────────────
const DocUploadItem = ({ label, uri, onPress, required }) => (
    <TouchableOpacity style={styles.docItem} onPress={onPress}>
        {uri ? (
            <Image source={{ uri }} style={styles.docThumb} />
        ) : (
            <View style={styles.docPlaceholder}>
                <Ionicons name="cloud-upload-outline" size={24} color={COLORS.primary} />
            </View>
        )}
        <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.docLabel}>{label}</Text>
            <Text style={styles.docStatus}>
                {uri ? '✅ Cargado' : required ? '⚠️ Requerido' : '(opcional)'}
            </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    progressBar: { height: 4, backgroundColor: COLORS.border },
    progressFill: { height: 4, backgroundColor: COLORS.primary, borderRadius: 2 },
    stepContainer: { padding: 24, paddingTop: Platform.OS === 'ios' ? 60 : 30 },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
    backBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.text },
    stepTitle: { fontSize: 26, fontWeight: '900', color: COLORS.text, marginBottom: 10 },
    stepDesc: { fontSize: 14, color: COLORS.textLight, lineHeight: 22, marginBottom: 28 },

    // Role cards
    roleCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#FFF', borderRadius: 20, padding: 18, marginBottom: 14,
        borderWidth: 2, borderColor: COLORS.border,
        shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
    },
    roleCardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryBg },
    roleCardIcon: {
        width: 56, height: 56, borderRadius: 18,
        backgroundColor: COLORS.primaryBg, justifyContent: 'center', alignItems: 'center',
    },
    roleCardTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
    roleCardDesc: { fontSize: 13, color: COLORS.textLight, marginTop: 4, lineHeight: 18 },
    verifiedBadge: {
        backgroundColor: COLORS.primaryBg, paddingHorizontal: 8,
        paddingVertical: 3, borderRadius: 10,
    },
    verifiedBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },

    // Document items
    docItem: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#FFF', borderRadius: 16, padding: 14, marginBottom: 12,
        shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
    },
    docThumb: { width: 52, height: 52, borderRadius: 12 },
    docPlaceholder: {
        width: 52, height: 52, borderRadius: 12,
        backgroundColor: COLORS.primaryBg,
        justifyContent: 'center', alignItems: 'center',
    },
    docLabel: { fontSize: 14, fontWeight: '700', color: COLORS.text },
    docStatus: { fontSize: 12, color: COLORS.textLight, marginTop: 3 },

    // Caregiver config
    sectionDivider: {
        borderTopWidth: 1, borderTopColor: COLORS.border,
        marginVertical: 20, paddingTop: 16,
    },
    sectionLabel: { fontSize: 17, fontWeight: '900', color: COLORS.text },
    configLabel: {
        fontSize: 11, fontWeight: '700', color: COLORS.textLight,
        textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 18, marginBottom: 10,
    },
    multiSelect: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    selectChip: {
        paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
        borderWidth: 2, borderColor: COLORS.border, backgroundColor: '#FFF',
    },
    selectChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
    selectChipText: { fontSize: 13, fontWeight: '700', color: COLORS.text },
    configInput: {
        backgroundColor: '#FFF', borderWidth: 1.5, borderColor: COLORS.border,
        borderRadius: 14, paddingHorizontal: 15, paddingVertical: 12,
        fontSize: 15, color: COLORS.text,
    },

    // CTA button
    nextBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: COLORS.primary, borderRadius: 18,
        paddingVertical: 17, marginTop: 28,
        shadowColor: COLORS.primary, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
    },
    nextBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },

    // Success state
    successTitle: { fontSize: 26, fontWeight: '900', color: COLORS.text, textAlign: 'center', marginBottom: 12 },
    successDesc: { fontSize: 15, color: COLORS.textLight, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
    pendingBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: COLORS.warningLight, paddingHorizontal: 16,
        paddingVertical: 10, borderRadius: 20, marginBottom: 30,
    },
    pendingBadgeText: { color: COLORS.warning, fontWeight: '700', fontSize: 14 },
});
