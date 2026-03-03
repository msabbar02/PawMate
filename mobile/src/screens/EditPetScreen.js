import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import CustomMultiSelect from '../components/CustomMultiSelect';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { db } from '../config/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

const PET_TYPES = ['Perro', 'Gato', 'Pájaro', 'Otro'];
const BREEDS = {
    Perro: ['Labrador', 'Beagle', 'Bulldog', 'Poodle', 'Pastor Alemán', 'Otro'],
    Gato: ['Persa', 'Siamés', 'Maine Coon', 'Esfinge', 'Siberiano', 'Otro'],
    Pájaro: ['Canario', 'Loro', 'Periquito', 'Cacatúa', 'Otro'],
};

const COMMON_ALLERGIES = ['Ninguna', 'Polen', 'Alimentos', 'Polvo', 'Otra (Especificar)'];
const COMMON_ILLNESSES = ['Ninguna', 'Diabetes', 'Artritis', 'Asma', 'Otra (Especificar)'];

const EditPetScreen = ({ route, navigation }) => {
    const { theme } = useContext(ThemeContext);
    const { user } = useContext(AuthContext);
    const styles = getStyles(theme);
    const petId = route.params?.petId;

    const [loading, setLoading] = useState(!!petId);
    const [saving, setSaving] = useState(false);
    const [image, setImage] = useState(null);
    const [name, setName] = useState('');
    const [type, setType] = useState('Perro');
    const [breed, setBreed] = useState('Labrador');
    const [weight, setWeight] = useState('');
    const [allergies, setAllergies] = useState([]);
    const [illnesses, setIllnesses] = useState([]);
    const [vaccinations, setVaccinations] = useState('');
    const [foodSchedule, setFoodSchedule] = useState('');

    useEffect(() => {
        if (!petId) return;
        const load = async () => {
            try {
                const snap = await getDoc(doc(db, 'pets', petId));
                if (snap.exists()) {
                    const d = snap.data();
                    if (d.ownerId !== user?.uid) {
                        Alert.alert('Error', 'No puedes editar esta mascota.');
                        navigation.goBack();
                        return;
                    }
                    setName(d.name || '');
                    setType(d.type || 'Perro');
                    setBreed(d.breed || 'Labrador');
                    setWeight(String(d.weight ?? ''));
                    setAllergies(Array.isArray(d.allergies) ? d.allergies : (d.allergies ? d.allergies.split(',').map(s => s.trim()) : []));
                    setIllnesses(Array.isArray(d.illnesses) ? d.illnesses : (d.illnesses ? d.illnesses.split(',').map(s => s.trim()) : []));
                    setVaccinations(d.vaccinations || '');
                    setFoodSchedule(d.foodSchedule || '');
                    setImage(d.image || d.photo || null);
                } else {
                    Alert.alert('Error', 'Mascota no encontrada.');
                    navigation.goBack();
                }
            } catch (e) {
                console.error(e);
                Alert.alert('Error', 'No se pudo cargar la mascota.');
                navigation.goBack();
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [petId, user?.uid]);

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return;
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });
        if (!result.canceled) setImage(result.assets[0].uri);
    };

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert('Error', 'El nombre es obligatorio.');
            return;
        }
        const w = parseFloat(weight);
        if (isNaN(w) || w <= 0) {
            Alert.alert('Error', 'Peso inválido.');
            return;
        }
        setSaving(true);
        try {
            await updateDoc(doc(db, 'pets', petId), {
                name: name.trim(),
                type,
                breed,
                weight: w,
                allergies,
                illnesses,
                vaccinations: vaccinations.trim() || null,
                foodSchedule: foodSchedule.trim() || null,
                ...(image ? { image } : {}),
                updatedAt: new Date().toISOString(),
            });
            Alert.alert('Guardado', 'Cambios guardados correctamente.', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'No se pudieron guardar los cambios.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Editar mascota</Text>
                <View style={{ width: 40 }} />
            </View>
            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <TouchableOpacity style={styles.photoWrap} onPress={pickImage}>
                    {image ? (
                        <Image source={{ uri: image }} style={styles.photo} />
                    ) : (
                        <View style={[styles.photo, styles.photoPlaceholder]}>
                            <Ionicons name="camera" size={32} color={theme.textSecondary} />
                        </View>
                    )}
                </TouchableOpacity>

                <Text style={styles.label}>Nombre</Text>
                <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nombre" placeholderTextColor={theme.textSecondary} />

                <Text style={styles.label}>Tipo</Text>
                <View style={styles.pickerWrap}>
                    <Picker selectedValue={type} onValueChange={setType} style={styles.picker}>
                        {PET_TYPES.map((t) => <Picker.Item key={t} label={t} value={t} color={Platform.OS === 'ios' ? theme.text : undefined} />)}
                    </Picker>
                </View>

                <Text style={styles.label}>Raza</Text>
                <View style={styles.pickerWrap}>
                    <Picker selectedValue={breed} onValueChange={setBreed} style={styles.picker}>
                        {(BREEDS[type] || BREEDS.Perro).map((b) => <Picker.Item key={b} label={b} value={b} color={Platform.OS === 'ios' ? theme.text : undefined} />)}
                    </Picker>
                </View>

                <Text style={styles.label}>Peso (kg)</Text>
                <TextInput style={styles.input} value={weight} onChangeText={setWeight} placeholder="Ej: 12" keyboardType="decimal-pad" placeholderTextColor={theme.textSecondary} />

                <Text style={styles.sectionTitle}>Salud y Cuidados</Text>

                <CustomMultiSelect
                    label="Alérgenos conocidos"
                    options={COMMON_ALLERGIES.filter(a => a !== 'Otra (Especificar)' && a !== 'Ninguna')}
                    selectedValues={allergies}
                    onSelectionChange={setAllergies}
                    theme={theme}
                />

                <CustomMultiSelect
                    label="Condiciones Médicas / Enfermedades"
                    options={COMMON_ILLNESSES.filter(i => i !== 'Otra (Especificar)' && i !== 'Ninguna')}
                    selectedValues={illnesses}
                    onSelectionChange={setIllnesses}
                    theme={theme}
                />

                <Text style={styles.label}>Vacunas</Text>
                <TextInput style={[styles.input, styles.textArea]} value={vaccinations} onChangeText={setVaccinations} placeholder="Opcional" placeholderTextColor={theme.textSecondary} multiline />

                <Text style={styles.label}>Horario de comida</Text>
                <TextInput style={styles.input} value={foodSchedule} onChangeText={setFoodSchedule} placeholder="Opcional" placeholderTextColor={theme.textSecondary} />

                <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
                    {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Guardar cambios</Text>}
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
    },
    backBtn: { padding: 5 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: theme.text },
    scroll: { padding: 20 },
    photoWrap: { alignSelf: 'center', marginBottom: 20 },
    photo: { width: 100, height: 100, borderRadius: 50 },
    photoPlaceholder: { backgroundColor: theme.cardBackground, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: theme.border },
    label: { fontSize: 14, fontWeight: '600', color: theme.text, marginBottom: 6 },
    input: {
        backgroundColor: theme.cardBackground,
        borderRadius: 12,
        padding: 14,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: theme.border,
        fontSize: 16,
        borderColor: theme.border,
        fontSize: 16,
        color: theme.text,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.text,
        marginBottom: 15,
        marginTop: 5,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
        paddingBottom: 5,
    },
    textArea: { minHeight: 70 },
    pickerWrap: { backgroundColor: theme.cardBackground, borderRadius: 12, marginBottom: 14, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' },
    picker: { color: theme.text, height: 50 },
    saveBtn: { backgroundColor: theme.primary, paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 10 },
    saveBtnText: { color: '#FFF', fontSize: 17, fontWeight: 'bold' },
});

export default EditPetScreen;
