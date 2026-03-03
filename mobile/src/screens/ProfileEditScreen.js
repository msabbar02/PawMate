import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { db, auth } from '../config/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

const ProfileEditScreen = ({ navigation }) => {
    const { theme } = useContext(ThemeContext);
    const { user, userData } = useContext(AuthContext);
    const styles = getStyles(theme);

    const [name, setName] = useState(userData?.name ?? '');
    const [surname, setSurname] = useState(userData?.surname ?? '');
    const [city, setCity] = useState(userData?.address?.city ?? '');
    const [province, setProvince] = useState(userData?.address?.province ?? '');
    const [street, setStreet] = useState(userData?.address?.street ?? '');
    const [door, setDoor] = useState(userData?.address?.door ?? '');
    const [floor, setFloor] = useState(userData?.address?.floor ?? '');
    const [avatar, setAvatar] = useState(userData?.avatar ?? '');
    const [saving, setSaving] = useState(false);

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permiso', 'Necesitamos acceso a la galería para cambiar la foto.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });
        if (!result.canceled && result.assets[0]?.uri) {
            setAvatar(result.assets[0].uri);
        }
    };

    const handleSave = async () => {
        if (!name.trim() || !surname.trim()) {
            Alert.alert('Error', 'Nombre y apellido son obligatorios.');
            return;
        }
        setSaving(true);
        try {
            const updateData = {
                name: name.trim(),
                surname: surname.trim(),
                address: {
                    city: city.trim(),
                    province: province.trim(),
                    street: street.trim(),
                    door: door.trim(),
                    floor: floor.trim(),
                },
            };
            if (avatar) {
                updateData.avatar = avatar;
            }
            await updateDoc(doc(db, 'users', user.uid), updateData);
            Alert.alert('Guardado', 'Tu perfil se ha actualizado correctamente.', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'No se pudo guardar. Intenta de nuevo.');
        } finally {
            setSaving(false);
        }
    };

    const handleSignOut = () => {
        Alert.alert(
            'Cerrar sesión',
            '¿Seguro que quieres salir?',
            [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Salir', style: 'destructive', onPress: () => signOut(auth) }
            ]
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Editar perfil</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <TouchableOpacity style={styles.avatarWrap} onPress={pickImage}>
                    <Image
                        source={{ uri: avatar || 'https://via.placeholder.com/100' }}
                        style={styles.avatar}
                    />
                    <View style={styles.avatarBadge}>
                        <Ionicons name="camera" size={18} color="#FFF" />
                    </View>
                </TouchableOpacity>

                <Text style={styles.label}>Nombre</Text>
                <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nombre" placeholderTextColor={theme.textSecondary} />

                <Text style={styles.label}>Apellido</Text>
                <TextInput style={styles.input} value={surname} onChangeText={setSurname} placeholder="Apellido" placeholderTextColor={theme.textSecondary} />

                <Text style={styles.sectionTitle}>Dirección</Text>
                <Text style={styles.label}>Ciudad</Text>
                <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="Ciudad" placeholderTextColor={theme.textSecondary} />
                <Text style={styles.label}>Provincia</Text>
                <TextInput style={styles.input} value={province} onChangeText={setProvince} placeholder="Provincia" placeholderTextColor={theme.textSecondary} />
                <Text style={styles.label}>Calle</Text>
                <TextInput style={styles.input} value={street} onChangeText={setStreet} placeholder="Calle" placeholderTextColor={theme.textSecondary} />
                <View style={styles.row}>
                    <View style={[styles.input, { flex: 1, marginRight: 10 }]}>
                        <TextInput value={door} onChangeText={setDoor} placeholder="Puerta" placeholderTextColor={theme.textSecondary} style={{ color: theme.text, fontSize: 16 }} />
                    </View>
                    <View style={[styles.input, { flex: 1 }]}>
                        <TextInput value={floor} onChangeText={setFloor} placeholder="Piso" placeholderTextColor={theme.textSecondary} style={{ color: theme.text, fontSize: 16 }} />
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Guardar cambios</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
                    <Ionicons name="log-out-outline" size={22} color={theme.error} />
                    <Text style={styles.signOutText}>Cerrar sesión</Text>
                </TouchableOpacity>

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
};

const getStyles = (theme) => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 50,
        paddingHorizontal: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
        backgroundColor: theme.background,
    },
    backBtn: { padding: 5 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: theme.text },
    scroll: { padding: 20 },
    avatarWrap: { alignSelf: 'center', marginBottom: 24, position: 'relative' },
    avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: theme.cardBackground },
    avatarBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: theme.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: theme.text, marginTop: 16, marginBottom: 12 },
    label: { fontSize: 14, fontWeight: '600', color: theme.textSecondary, marginBottom: 6 },
    input: {
        backgroundColor: theme.cardBackground,
        borderRadius: 12,
        padding: 14,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: theme.border,
        fontSize: 16,
        color: theme.text,
    },
    row: { flexDirection: 'row' },
    saveBtn: {
        backgroundColor: theme.primary,
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        marginTop: 24,
    },
    saveBtnText: { color: '#FFF', fontSize: 17, fontWeight: 'bold' },
    signOutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
        paddingVertical: 14,
        gap: 8,
    },
    signOutText: { fontSize: 16, fontWeight: '600', color: theme.error },
});

export default ProfileEditScreen;
