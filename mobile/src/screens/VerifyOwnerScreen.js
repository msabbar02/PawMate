import React, { useState, useContext } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity, ScrollView,
    Image, Alert, ActivityIndicator, TextInput, Platform,
} from 'react-native';
import Icon from '../components/Icon';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '../constants/colors';
import { AuthContext } from '../context/AuthContext';
import { supabase } from '../config/supabase';
import { uploadVerificationDoc } from '../utils/storageHelpers';
import { useTranslation } from '../context/LanguageContext';

export default function VerifyOwnerScreen({ navigation }) {
    const { user, userData } = useContext(AuthContext);
    const { t } = useTranslation();

    const SPECIES_OPTIONS = [
        { value: 'dog',    label: t('verify.speciesDog') },
        { value: 'cat',    label: t('verify.speciesCat') },
    ];

    const SERVICE_OPTIONS = [
        { value: 'walking', label: t('verify.serviceWalking') },
        { value: 'hotel',   label: t('verify.serviceHotel') },
    ];
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
            return Alert.alert(t('verify.docsRequired'), t('verify.docsRequiredMsg'));
        }
        if (targetRole === 'caregiver') {
            if (acceptedSpecies.length === 0)
                return Alert.alert(t('common.error'), t('verify.speciesRequired'));
            if (serviceTypes.length === 0)
                return Alert.alert(t('common.error'), t('verify.serviceRequired'));
        }

        setSubmitting(true);
        try {
            const uid = user?.id;
            const ts = Date.now();

            // Upload all docs to Supabase Storage in parallel
            const [frontUrl, backUrl, selfieUrl, certUrl] = await Promise.all([
                uploadVerificationDoc(idFront, `verification/${uid}/${ts}_front.jpg`),
                uploadVerificationDoc(idBack, `verification/${uid}/${ts}_back.jpg`),
                uploadVerificationDoc(selfie, `verification/${uid}/${ts}_selfie.jpg`),
                certDoc ? uploadVerificationDoc(certDoc, `verification/${uid}/${ts}_cert.jpg`) : Promise.resolve(null),
            ]);

            const updateData = {
                verificationStatus: 'pending',
                verificationRequestedAt: new Date().toISOString(),
                pendingRole: targetRole,
                idFrontUrl: frontUrl,
                idBackUrl: backUrl,
                selfieUrl: selfieUrl,
            };

            if (targetRole === 'caregiver') {
                Object.assign(updateData, {
                    certDocUrl: certUrl,
                    acceptedSpecies,
                    serviceTypes,
                    serviceRadius: parseInt(serviceRadius) || 5,
                    maxConcurrentWalks: parseInt(maxWalk) || 5,
                    maxConcurrentHotel: parseInt(maxHotel) || 3,
                });
            }

            if (uid) {
                await supabase.from('users').update(updateData).eq('id', uid);
            }
            setStep(3);
        } catch (e) {
            console.error('Verification submit error:', e);
            Alert.alert(t('common.error'), t('verify.submitError'));
        } finally {
            setSubmitting(false);
        }
    };

    // ─────────────────────────────────────────────────
    // RENDER: Step 1 — Choose Role
    // ─────────────────────────────────────────────────
    const renderStep1 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>{t('verify.chooseRole')}</Text>
            <Text style={styles.stepDesc}>
                {t('verify.chooseRoleDesc')}
            </Text>

            <TouchableOpacity
                style={[styles.roleCard, targetRole === 'owner' && styles.roleCardActive]}
                onPress={() => setTargetRole('owner')}
            >
                <View style={styles.roleCardIcon}>
                    <Text style={{ fontSize: 36 }}></Text>
                </View>
                <View style={{ flex: 1, marginLeft: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.roleCardTitle}>{t('verify.ownerVerified')}</Text>
                        <View style={styles.verifiedBadge}>
                            <Text style={styles.verifiedBadgeText}>{t('verify.ownerTag')}</Text>
                        </View>
                    </View>
                    <Text style={styles.roleCardDesc}>
                        {t('verify.ownerDesc')}
                    </Text>
                </View>
                <Icon
                    name={targetRole === 'owner' ? 'radio-button-on' : 'radio-button-off'}
                    size={24} color={COLORS.primary}
                />
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.roleCard, targetRole === 'caregiver' && styles.roleCardActive]}
                onPress={() => setTargetRole('caregiver')}
            >
                <View style={[styles.roleCardIcon, { backgroundColor: COLORS.secondaryLight }]}>
                    <Text style={{ fontSize: 36 }}></Text>
                </View>
                <View style={{ flex: 1, marginLeft: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.roleCardTitle}>{t('verify.caregiverVerified')}</Text>
                        <View style={[styles.verifiedBadge, { backgroundColor: COLORS.secondaryLight }]}>
                            <Text style={[styles.verifiedBadgeText, { color: COLORS.secondary }]}>{t('verify.caregiverTag')}</Text>
                        </View>
                    </View>
                    <Text style={styles.roleCardDesc}>
                        {t('verify.caregiverDesc')}
                    </Text>
                </View>
                <Icon
                    name={targetRole === 'caregiver' ? 'radio-button-on' : 'radio-button-off'}
                    size={24} color={COLORS.primary}
                />
            </TouchableOpacity>

            <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(2)}>
                <Text style={styles.nextBtnText}>{t('verify.continue')}</Text>
                <Icon name="arrow-forward" size={20} color="#FFF" />
            </TouchableOpacity>
        </View>
    );

    // ─────────────────────────────────────────────────
    // RENDER: Step 2 — Documents + Caregiver Config
    // ─────────────────────────────────────────────────
    const renderStep2 = () => (
        <View style={styles.stepContainer}>
            <TouchableOpacity onPress={() => setStep(1)} style={styles.backBtn}>
                <Icon name="arrow-back" size={20} color={COLORS.text} />
                <Text style={styles.backBtnText}>{t('common.back')}</Text>
            </TouchableOpacity>

            <Text style={styles.stepTitle}>{t('verify.identityVerification')}</Text>
            <Text style={styles.stepDesc}>
                {t('verify.identityDesc')}
            </Text>

            {/* Document uploads */}
            <DocUploadItem
                label={t('verify.dniFront')}
                uri={idFront}
                onPress={() => pickPhoto(setIdFront)}
                required
            />
            <DocUploadItem
                label={t('verify.dniBack')}
                uri={idBack}
                onPress={() => pickPhoto(setIdBack)}
                required
            />
            <DocUploadItem
                label={t('verify.selfie')}
                uri={selfie}
                onPress={() => pickPhoto(setSelfie)}
                required
            />

            {/* Caregiver-specific config */}
            {targetRole === 'caregiver' && (
                <>
                    <DocUploadItem
                        label={t('verify.certificate')}
                        uri={certDoc}
                        onPress={() => pickPhoto(setCertDoc)}
                    />

                    <View style={styles.sectionDivider}>
                        <Text style={styles.sectionLabel}>{t('verify.serviceConfig')}</Text>
                    </View>

                    <Text style={styles.configLabel}>{t('verify.speciesAccepted')}</Text>
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

                    <Text style={styles.configLabel}>{t('verify.serviceTypes')}</Text>
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

                    <Text style={styles.configLabel}>{t('verify.serviceRadius')}</Text>
                    <TextInput
                        style={styles.configInput}
                        keyboardType="numeric"
                        value={serviceRadius}
                        onChangeText={setServiceRadius}
                        placeholder={t('verify.radiusPlaceholder')}
                        placeholderTextColor={COLORS.textLight}
                    />

                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.configLabel}>{t('verify.maxWalks')}</Text>
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
                            <Text style={styles.configLabel}>{t('verify.maxHotel')}</Text>
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
                        <Text style={styles.nextBtnText}>{t('verify.submitRequest')}</Text>
                        <Icon name="checkmark-circle" size={20} color="#FFF" />
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
            <Text style={{ fontSize: 80, marginBottom: 20 }}></Text>
            <Text style={styles.successTitle}>{t('verify.requestSent')}</Text>
            <Text style={styles.successDesc}>
                {t('verify.requestSentMsg')}
            </Text>
            <View style={styles.pendingBadge}>
                <Icon name="time-outline" size={16} color={COLORS.warning} />
                <Text style={styles.pendingBadgeText}>{t('verify.inReview')}</Text>
            </View>
            {navigation && (
                <TouchableOpacity style={styles.nextBtn} onPress={() => navigation.goBack()}>
                    <Text style={styles.nextBtnText}>{t('verify.backToHome')}</Text>
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
                <Text style={[styles.successTitle, { marginTop: 20 }]}>{t('verify.pending')}</Text>
                <Text style={styles.successDesc}>
                    {t('verify.pendingMsg')}
                </Text>
            </View>
        );
    }

    if (userData?.role === 'owner' || userData?.role === 'caregiver') {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 30 }]}>
                <StatusBar style="dark" />
                <Text style={{ fontSize: 60 }}></Text>
                <Text style={[styles.successTitle, { marginTop: 20 }]}>
                    {userData.role === 'caregiver' ? t('verify.alreadyCaregiver') : t('verify.alreadyOwner')}
                </Text>
                <Text style={styles.successDesc}>{t('verify.alreadyVerified')}</Text>
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
const DocUploadItem = ({ label, uri, onPress, required }) => {
    const { t } = useTranslation();
    return (
        <TouchableOpacity style={styles.docItem} onPress={onPress}>
            {uri ? (
                <Image source={{ uri }} style={styles.docThumb} />
            ) : (
                <View style={styles.docPlaceholder}>
                    <Icon name="cloud-upload-outline" size={24} color={COLORS.primary} />
                </View>
            )}
            <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.docLabel}>{label}</Text>
                <Text style={styles.docStatus}>
                    {uri ? t('verify.docUploaded') : required ? t('verify.docRequired') : t('common.optional')}
                </Text>
            </View>
            <Icon name="chevron-forward" size={18} color={COLORS.textLight} />
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.surface },
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
