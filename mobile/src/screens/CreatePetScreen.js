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

const PET_TYPES = ['Perro', 'Gato', 'Pájaro', 'Otro'];
const BREEDS = {
    Perro: ['Labrador', 'Beagle', 'Bulldog', 'Poodle', 'Pastor Alemán', 'Otro'],
    Gato: ['Persa', 'Siamés', 'Maine Coon', 'Esfinge', 'Siberiano', 'Otro'],
    Pájaro: ['Canario', 'Loro', 'Periquito', 'Cacatúa', 'Otro'],
};

const CreatePetScreen = ({ navigation }) => {
    const [image, setImage] = useState(null);
    const [name, setName] = useState('');
    const [type, setType] = useState('Perro');
    const [otherType, setOtherType] = useState('');
    const [breed, setBreed] = useState('Labrador');
    const [otherBreed, setOtherBreed] = useState('');
    const [weight, setWeight] = useState('');
    const [allergies, setAllergies] = useState('');
    const [illnesses, setIllnesses] = useState('');

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

    const handleSave = () => {
        // Validation
        if (!name || !weight) {
            Alert.alert('Error', 'Por favor ingresa al menos el nombre y peso de la mascota.');
            return;
        }

        const petData = {
            image,
            name,
            type: type === 'Otro' ? otherType : type,
            breed: breed === 'Otro' ? otherBreed : breed,
            weight,
            allergies,
            illnesses,
            dob: dob.toISOString().split('T')[0],
            vaccinations,
            foodSchedule
        };

        console.log('Guardando mascota (Firebase pronto):', petData);
        Alert.alert('Éxito', '¡Mascota registrada exitosamente!', [
            {
                text: 'OK',
                onPress: () => {
                    // Cierra la pantalla de registrar mascota
                    navigation.goBack();
                }
            }
        ]);
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
                        placeholderTextColor="#888"
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
                                dropdownIconColor="#fff"
                                onValueChange={(itemValue) => {
                                    setType(itemValue);
                                    if (itemValue !== 'Otro') {
                                        setBreed(BREEDS[itemValue][0]);
                                    } else {
                                        setBreed('Otro');
                                    }
                                }}
                            >
                                {PET_TYPES.map(t => <Picker.Item key={t} label={t} value={t} color="#fff" />)}
                            </Picker>
                        </View>
                    </View>

                    {type === 'Otro' ? (
                        <View style={[styles.inputContainer, { flex: 1 }]}>
                            <Text style={styles.label}>Especificar Tipo</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Ej: Hámster"
                                placeholderTextColor="#888"
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
                                    dropdownIconColor="#fff"
                                    onValueChange={(itemValue) => setBreed(itemValue)}
                                >
                                    {BREEDS[type]?.map(b => <Picker.Item key={b} label={b} value={b} color="#fff" />)}
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
                            placeholderTextColor="#888"
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
                            placeholderTextColor="#888"
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

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Alergias (Opcional)</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Ej: Pollo, Polen..."
                        placeholderTextColor="#888"
                        value={allergies}
                        onChangeText={setAllergies}
                    />
                </View>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Enfermedades (Opcional)</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Ej: Ninguna"
                        placeholderTextColor="#888"
                        value={illnesses}
                        onChangeText={setIllnesses}
                    />
                </View>

                <View style={styles.inputContainer}>
                    <Text style={styles.label}>Vacunas (Fechas / Nombres)</Text>
                    <TextInput
                        style={[styles.input, { height: 60 }]}
                        placeholder="Ej: Rabia (12/03/24), Parvo..."
                        placeholderTextColor="#888"
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
                        placeholderTextColor="#888"
                        value={foodSchedule}
                        onChangeText={setFoodSchedule}
                    />
                </View>

                {/* Submit Button */}
                <TouchableOpacity style={styles.button} onPress={handleSave}>
                    <Text style={styles.buttonText}>Registrar Mascota</Text>
                </TouchableOpacity>

            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#101820',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 50,
        paddingBottom: 20,
        paddingHorizontal: 20,
        backgroundColor: '#101820',
    },
    backButton: {
        marginRight: 15,
    },
    backButtonText: {
        color: '#fff',
        fontSize: 24,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1a7a4c',
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
        backgroundColor: '#1c2a35',
        borderWidth: 2,
        borderColor: '#1a7a4c',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    imagePlaceholderText: {
        color: '#888',
        fontSize: 14,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 15,
        marginTop: 5,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
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
        color: '#ccc',
        fontSize: 14,
        marginBottom: 5,
        marginLeft: 5,
    },
    input: {
        backgroundColor: '#1c2a35',
        color: '#fff',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#333',
    },
    pickerContainer: {
        backgroundColor: '#1c2a35',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#333',
        overflow: 'hidden',
    },
    picker: {
        color: '#fff',
        height: Platform.OS === 'ios' ? 120 : 50, // iOS picker height adjustment
    },
    datePickerButton: {
        backgroundColor: '#1c2a35',
        padding: 14,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#333',
        alignItems: 'center',
    },
    datePickerText: {
        color: '#fff',
        fontSize: 16,
    },
    button: {
        backgroundColor: '#1a7a4c',
        paddingVertical: 15,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 20,
        shadowColor: '#1a7a4c',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});

export default CreatePetScreen;
