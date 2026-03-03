import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import CustomMultiSelect from '../components/CustomMultiSelect';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

const PET_TYPES = ['Perro', 'Gato', 'Pájaro', 'Otro'];
const BREEDS = {
    Perro: ['Labrador', 'Beagle', 'Bulldog', 'Poodle', 'Pastor Alemán', 'Otro'],
    Gato: ['Persa', 'Siamés', 'Maine Coon', 'Esfinge', 'Siberiano', 'Otro'],
    Pájaro: ['Canario', 'Loro', 'Periquito', 'Cacatúa', 'Otro'],
};

const COMMON_ALLERGIES = ['Ninguna', 'Polen', 'Alimentos', 'Polvo', 'Otra (Especificar)'];
const COMMON_ILLNESSES = ['Ninguna', 'Diabetes', 'Artritis', 'Asma', 'Otra (Especificar)'];

const CreatePetScreen = ({ navigation }) => {
    const { theme } = React.useContext(ThemeContext);
    const { user } = React.useContext(AuthContext);
    const styles = getStyles(theme);

    const [isLoading, setIsLoading] = useState(false);

    const [image, setImage] = useState(null);
    const [name, setName] = useState('');
    const [type, setType] = useState('Perro');
    const [otherType, setOtherType] = useState('');
    const [breed, setBreed] = useState('Labrador');
    const [otherBreed, setOtherBreed] = useState('');
    const [weight, setWeight] = useState('');
    const [allergies, setAllergies] = useState([]);
    const [illnesses, setIllnesses] = useState([]);

    // Date of Birth state
    const [dob, setDob] = useState(new Date());
    const [showDobPicker, setShowDobPicker] = useState(false);

    const [vaccinations, setVaccinations] = useState('');
    const [foodSchedule, setFoodSchedule] = useState('');

    const pickImage = async (useCamera = false) => {
        let result;
        const options = {
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 1,
        };

        if (useCamera) {
            const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
            if (!permissionResult.granted) {
                Alert.alert("Permission to access camera is required!");
                return;
            }
            result = await ImagePicker.launchCameraAsync(options);
        } else {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permissionResult.granted) {
                Alert.alert("Permission to access gallery is required!");
                return;
            }
            result = await ImagePicker.launchImageLibraryAsync(options);
        }

        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    const handleImagePress = () => {
        Alert.alert(
            "Upload Photo",
            "Choose a source for your pet's photo",
            [
                { text: "Camera", onPress: () => pickImage(true) },
                { text: "Gallery", onPress: () => pickImage(false) },
                { text: "Cancel", style: "cancel" }
            ]
        );
    };

    const handleSave = async () => {
        // Validation
        if (!name || !weight) {
            Alert.alert('Error', 'Por favor ingresa al menos el nombre y peso de la mascota.');
            return;
        }

        if (!user) {
            Alert.alert('Error', 'Debes iniciar sesión para registrar una mascota.');
            return;
        }

        setIsLoading(true);

        try {
            const petData = {
                ownerId: user.uid,
                image: image || null,
                name,
                type: type === 'Otro' ? otherType : type,
                breed: breed === 'Otro' ? otherBreed : breed,
                weight: parseFloat(weight),
                allergies,
                illnesses,
                dob: dob.toISOString().split('T')[0],
                vaccinations,
                foodSchedule,
                createdAt: serverTimestamp()
            };

            await addDoc(collection(db, 'pets'), petData);

            Alert.alert('Éxito', '¡Mascota registrada exitosamente!', [
                {
                    text: 'OK',
                    onPress: () => {
                        navigation.goBack();
                    }
                }
            ]);
        } catch (error) {
            console.error("Error al registrar mascota: ", error);
            Alert.alert('Error', 'Hubo un problema al registrar la mascota.');
        } finally {
            setIsLoading(false);
        }
    };

    const onDobChange = (event, selectedDate) => {
        const currentDate = selectedDate || dob;
        setShowDobPicker(Platform.OS === 'ios');
        setDob(currentDate);
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Registrar Mascota</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* Photo Upload */}
                <View style={styles.imageContainer}>
                    <TouchableOpacity onPress={handleImagePress} style={styles.imagePicker}>
                        {image ? (
                            <Image source={{ uri: image }} style={styles.image} />
                        ) : (
                            <Text style={styles.imagePlaceholderText}>📷 Añadir Foto</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Basics section */}
                <Text style={styles.sectionTitle}>Datos Básicos</Text>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Nombre de la Mascota *</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Ej: Max"
                        placeholderTextColor={theme.textSecondary}
                        value={name}
                        onChangeText={setName}
                    />
                </View>

                <View style={styles.row}>
                    <View style={[styles.inputContainer, { flex: 1, marginRight: 10 }]}>
                        <Text style={styles.label}>Tipo de Animal *</Text>
                        <View style={styles.pickerContainer}>
                            <Picker
                                selectedValue={type}
                                style={styles.picker}
                                dropdownIconColor={theme.primary}
                                onValueChange={(itemValue) => {
                                    setType(itemValue);
                                    if (itemValue !== 'Otro') {
                                        setBreed(BREEDS[itemValue][0]);
                                    } else {
                                        setBreed('Otro');
                                    }
                                }}
                            >
                                {PET_TYPES.map(t => <Picker.Item key={t} label={t} value={t} color={Platform.OS === 'ios' ? theme.text : (theme.isDark ? theme.text : '#000')} />)}
                            </Picker>
                        </View>
                    </View>

                    {type === 'Otro' ? (
                        <View style={[styles.inputContainer, { flex: 1 }]}>
                            <Text style={styles.label}>Especificar Tipo</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Ej: Hámster"
                                placeholderTextColor={theme.textSecondary}
                                value={otherType}
                                onChangeText={setOtherType}
                            />
                        </View>
                    ) : (
                        <View style={[styles.inputContainer, { flex: 1 }]}>
                            <Text style={styles.label}>Raza *</Text>
                            <View style={styles.pickerContainer}>
                                <Picker
                                    selectedValue={breed}
                                    style={styles.picker}
                                    dropdownIconColor={theme.primary}
                                    onValueChange={(itemValue) => setBreed(itemValue)}
                                >
                                    {BREEDS[type]?.map(b => <Picker.Item key={b} label={b} value={b} color={Platform.OS === 'ios' ? theme.text : (theme.isDark ? theme.text : '#000')} />)}
                                </Picker>
                            </View>
                        </View>
                    )}
                </View>

                {breed === 'Otro' && type !== 'Otro' && (
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Especificar Raza</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Ej: Mezcla"
                            placeholderTextColor={theme.textSecondary}
                            value={otherBreed}
                            onChangeText={setOtherBreed}
                        />
                    </View>
                )}

                <View style={styles.row}>
                    <View style={[styles.inputContainer, { flex: 1, marginRight: 10 }]}>
                        <Text style={styles.label}>Peso (kg) *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Ej: 12.5"
                            placeholderTextColor={theme.textSecondary}
                            keyboardType="numeric"
                            value={weight}
                            onChangeText={setWeight}
                        />
                    </View>
                    <View style={[styles.inputContainer, { flex: 1 }]}>
                        <Text style={styles.label}>Fecha de Nacimiento</Text>
                        <TouchableOpacity
                            style={styles.datePickerButton}
                            onPress={() => setShowDobPicker(true)}
                        >
                            <Text style={styles.datePickerText}>{dob.toLocaleDateString()}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {showDobPicker && (
                    <DateTimePicker
                        value={dob}
                        mode="date"
                        display="default"
                        onChange={onDobChange}
                        maximumDate={new Date()}
                    />
                )}

                {/* Health section */}
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

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Vacunas (Fechas / Nombres)</Text>
                    <TextInput
                        style={[styles.input, { height: 60 }]}
                        placeholder="Ej: Rabia (12/03/24), Parvo..."
                        placeholderTextColor={theme.textSecondary}
                        multiline
                        value={vaccinations}
                        onChangeText={setVaccinations}
                    />
                </View>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Horario de Comida</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Ej: 2 veces - 08:00 y 20:00"
                        placeholderTextColor={theme.textSecondary}
                        value={foodSchedule}
                        onChangeText={setFoodSchedule}
                    />
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                    style={[styles.button, isLoading && { opacity: 0.7 }]}
                    onPress={handleSave}
                    disabled={isLoading}
                >
                    <Text style={styles.buttonText}>
                        {isLoading ? 'Guardando...' : 'Registrar Mascota'}
                    </Text>
                </TouchableOpacity>

            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const getStyles = (theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 50,
        paddingBottom: 20,
        paddingHorizontal: 20,
        backgroundColor: theme.background,
    },
    backButton: {
        marginRight: 15,
    },
    backButtonText: {
        color: theme.text,
        fontSize: 24,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: theme.primary,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    imageContainer: {
        alignItems: 'center',
        marginVertical: 20,
    },
    imagePicker: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: theme.cardBackground,
        borderWidth: 2,
        borderColor: theme.primary,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    imagePlaceholderText: {
        color: theme.textSecondary,
        fontSize: 14,
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
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    inputContainer: {
        marginBottom: 15,
    },
    label: {
        color: theme.textSecondary,
        fontSize: 14,
        marginBottom: 5,
        marginLeft: 5,
    },
    input: {
        backgroundColor: theme.cardBackground,
        color: theme.text,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.border,
    },
    pickerContainer: {
        backgroundColor: theme.cardBackground,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.border,
        overflow: 'hidden',
    },
    picker: {
        color: theme.text,
        height: Platform.OS === 'ios' ? 120 : 50, // iOS picker height adjustment
    },
    datePickerButton: {
        backgroundColor: theme.cardBackground,
        padding: 14,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.border,
        alignItems: 'center',
    },
    datePickerText: {
        color: theme.text,
        fontSize: 16,
    },
    button: {
        backgroundColor: theme.primary,
        paddingVertical: 15,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 20,
        shadowColor: theme.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
    },
    buttonText: {
        color: '#fff', // Keep white since primary is typically dark green
        fontSize: 18,
        fontWeight: 'bold',
    },
});

export default CreatePetScreen;
