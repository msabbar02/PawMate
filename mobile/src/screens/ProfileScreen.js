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
import { doc, updateDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { uploadImageToStorage } from '../utils/storageHelpers';

const ROLE_LABEL = {
    normal: { label: 'Usuario', icon: '👤', color: COLORS.textLight },
    owner: { label: 'Dueño Verificado ✓', icon: '🐾', color: COLORS.primary },
    caregiver: { label: 'Cuidador Verificado 🛡️', icon: '🛡️', color: COLORS.secondary },
};

export default function ProfileScreen({ navigation }) {
    const { userData, user } = useContext(AuthContext);

    const [fullName, setFullName] = useState(userData?.fullName || '');
    const [saving, setSaving] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [photoUri, setPhotoUri] = useState(userData?.photoURL || null);

    const role = ROLE_LABEL[userData?.role] || ROLE_LABEL.normal;

    // ── Change Photo ──────────────────────────────────
    const handleChangePhoto = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true, aspect: [1, 1], quality: 0.8,
        });
        if (result.canceled) return;

        const localUri = result.assets[0].uri;
        setPhotoUri(localUri);
        setUploadingPhoto(true);
        try {
            const path = `avatars/${user.uid}.jpg`;
            const url = await uploadImageToStorage(localUri, path);
            await updateDoc(doc(db, 'users', user.uid), { photoURL: url });
        } catch (e) {
            Alert.alert('Error', 'No se pudo subir la foto.');
        } finally {
            setUploadingPhoto(false);
        }
    };

    // ── Save Profile ──────────────────────────────────
    const handleSave = async () => {
        if (!fullName.trim()) return Alert.alert('Error', 'El nombre no puede estar vacío.');
        setSaving(true);
        try {
            await updateDoc(doc(db, 'users', user.uid), {
                fullName: fullName.trim(),
            });
            Alert.alert('¡Guardado! ✅', 'Tu perfil ha sido actualizado.');
        } catch (e) {
            Alert.alert('Error', 'No se pudo guardar el perfil.');
        } finally {
            setSaving(false);
        }
    };

    // ── Sign Out ──────────────────────────────────────
    const handleSignOut = () => {
        Alert.alert(
            'Cerrar sesión',
            '¿Seguro que quieres salir?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Salir', style: 'destructive',
                    onPress: () => signOut(auth).catch(() => {}),
                },
            ]
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar style="dark" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Mi Perfil</Text>
                <TouchableOpacity onPress={handleSave} disabled={saving}>
                    {saving
                        ? <ActivityIndicator color={COLORS.primary} />
                        : <Text style={styles.saveText}>Guardar</Text>
                    }
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
                {/* Avatar */}
                <View style={styles.avatarSection}>
                    <TouchableOpacity style={styles.avatarWrapper} onPress={handleChangePhoto} disabled={uploadingPhoto}>
                        {photoUri
                            ? <Image source={{ uri: photoUri }} style={styles.avatar} />
                            : (
                                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                    <Text style={{ fontSize: 48 }}>🐾</Text>
                                </View>
                            )
                        }
                        <View style={styles.avatarEditBadge}>
                            {uploadingPhoto
                                ? <ActivityIndicator size="small" color="#FFF" />
                                : <Ionicons name="camera" size={16} color="#FFF" />
                            }
                        </View>
                    </TouchableOpacity>

                    {/* Role badge */}
                    <View style={[styles.roleBadge, { backgroundColor: role.color + '18' }]}>
                        <Text style={[styles.roleBadgeText, { color: role.color }]}>{role.label}</Text>
                    </View>
                </View>

                {/* Form */}
                <View style={styles.form}>
                    <Text style={styles.fieldLabel}>NOMBRE COMPLETO</Text>
                    <TextInput
                        style={styles.input}
                        value={fullName}
                        onChangeText={setFullName}
                        placeholder="Tu nombre"
                        placeholderTextColor={COLORS.textLight}
                    />

                    <Text style={styles.fieldLabel}>EMAIL</Text>
                    <View style={styles.inputReadonly}>
                        <Text style={styles.inputReadonlyText}>{user?.email || '—'}</Text>
                        <Ionicons name="lock-closed-outline" size={14} color={COLORS.textLight} />
                    </View>

                    {/* Verification status */}
                    {userData?.verificationStatus === 'pending' && (
                        <View style={styles.verifyBanner}>
                            <Ionicons name="time-outline" size={16} color={COLORS.warning} />
                            <Text style={styles.verifyBannerText}>Verificación en revisión (24-48h)</Text>
                        </View>
                    )}

                    {userData?.role === 'normal' && userData?.verificationStatus !== 'pending' && (
                        <TouchableOpacity
                            style={styles.verifyBtn}
                            onPress={() => navigation.navigate('Verify')}
                        >
                            <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.primary} />
                            <Text style={styles.verifyBtnText}>Verificar mi cuenta</Text>
                            <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Account actions */}
                <View style={styles.actions}>
                    <TouchableOpacity style={styles.actionRow} onPress={handleSignOut}>
                        <View style={[styles.actionIcon, { backgroundColor: '#FEE2E2' }]}>
                            <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
                        </View>
                        <Text style={[styles.actionLabel, { color: COLORS.danger }]}>Cerrar sesión</Text>
                        <Ionicons name="chevron-forward" size={16} color={COLORS.danger} />
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 36, paddingBottom: 16,
        backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
    saveText: { color: COLORS.primary, fontWeight: '800', fontSize: 16 },

    // Avatar
    avatarSection: { alignItems: 'center', paddingVertical: 32, backgroundColor: '#FFF' },
    avatarWrapper: { position: 'relative', marginBottom: 16 },
    avatar: { width: 110, height: 110, borderRadius: 55 },
    avatarPlaceholder: { backgroundColor: COLORS.primaryBg, justifyContent: 'center', alignItems: 'center' },
    avatarEditBadge: {
        position: 'absolute', bottom: 4, right: 4,
        width: 30, height: 30, borderRadius: 15,
        backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
        borderWidth: 2, borderColor: '#FFF',
    },
    roleBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
    roleBadgeText: { fontSize: 13, fontWeight: '700' },

    // Form
    form: { padding: 20 },
    fieldLabel: {
        fontSize: 11, fontWeight: '700', color: COLORS.textLight,
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 18,
    },
    input: {
        backgroundColor: '#FFF', borderWidth: 1.5, borderColor: COLORS.border,
        borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13,
        fontSize: 15, color: COLORS.text,
    },
    inputReadonly: {
        backgroundColor: COLORS.surface, borderRadius: 14,
        paddingHorizontal: 16, paddingVertical: 13,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    inputReadonlyText: { fontSize: 15, color: COLORS.textLight },
    verifyBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20,
        backgroundColor: COLORS.warningLight, padding: 14, borderRadius: 14,
    },
    verifyBannerText: { flex: 1, fontSize: 14, color: COLORS.warning, fontWeight: '600' },
    verifyBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20,
        backgroundColor: COLORS.primaryBg, padding: 16, borderRadius: 16,
        borderWidth: 1.5, borderColor: COLORS.primary + '30',
    },
    verifyBtnText: { flex: 1, fontSize: 15, fontWeight: '700', color: COLORS.primary },

    // Actions
    actions: { paddingHorizontal: 20, paddingTop: 10 },
    actionRow: {
        flexDirection: 'row', alignItems: 'center', gap: 14,
        backgroundColor: '#FFF', padding: 16, borderRadius: 16, marginBottom: 10,
        shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
    },
    actionIcon: { width: 38, height: 38, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    actionLabel: { flex: 1, fontSize: 15, fontWeight: '700' },
});
