import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Image, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker'; // Ensure you have this installed

const CATEGORIES = ['Accesorios', 'Comida', 'Juguetes', 'Salud', 'Higiene', 'Ropa', 'Otros'];

const CreateStoreItemScreen = ({ navigation }) => {
    const [title, setTitle] = useState('');
    const [price, setPrice] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState(CATEGORIES[0]);
    const [isNew, setIsNew] = useState(true); // true = Nuevo, false = Segunda mano
    const [images, setImages] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permiso denegado', 'Necesitamos permisos para acceder a tus fotos.');
            return;
        }

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsMultipleSelection: true,
            selectionLimit: 5 - images.length, // Max 5 total
            quality: 0.8,
        });

        if (!result.canceled) {
            const newImages = result.assets.map(asset => asset.uri);
            setImages(prev => [...prev, ...newImages].slice(0, 5)); // Cap at 5
        }
    };

    const removeImage = (indexToRemove) => {
        setImages(images.filter((_, index) => index !== indexToRemove));
    };

    const handleSubmit = () => {
        // Validations
        if (!title.trim() || !price.trim() || !description.trim()) {
            Alert.alert('Error', 'Por favor completa todos los campos de texto.');
            return;
        }

        if (isNaN(parseFloat(price))) {
            Alert.alert('Error', 'El precio debe ser un número válido.');
            return;
        }

        if (images.length < 3) {
            Alert.alert('Fotos insuficientes', 'Debes subir al menos 3 fotos del producto.');
            return;
        }

        setIsSubmitting(true);

        // Simulamos subida (aquí irá Firebase Storage + Firestore)
        setTimeout(() => {
            setIsSubmitting(false);
            Alert.alert('¡Éxito!', 'Producto publicado en la tienda.', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        }, 1500);
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : null}
        >
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#FFF" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Publicar Producto</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>

                {/* Images Section */}
                <Text style={styles.sectionLabel}>Fotos (Mínimo 3, Máx 5) <Text style={styles.required}>*</Text></Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesScroll}>
                    {images.map((uri, index) => (
                        <View key={index} style={styles.imageContainer}>
                            <Image source={{ uri }} style={styles.pickedImage} />
                            <TouchableOpacity style={styles.removeImageBtn} onPress={() => removeImage(index)}>
                                <Ionicons name="close-circle" size={24} color="#EF4444" />
                            </TouchableOpacity>
                        </View>
                    ))}
                    {images.length < 5 && (
                        <TouchableOpacity style={styles.addImageBtn} onPress={pickImage}>
                            <Ionicons name="camera-outline" size={32} color="#1a7a4c" />
                            <Text style={styles.addImageText}>Añadir</Text>
                        </TouchableOpacity>
                    )}
                </ScrollView>
                <Text style={styles.helperText}>{images.length}/5 fotos seleccionadas</Text>

                {/* Form Section */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Título <Text style={styles.required}>*</Text></Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Ej. Correa extensible 5m"
                        placeholderTextColor="#666"
                        value={title}
                        onChangeText={setTitle}
                        maxLength={50}
                    />
                </View>

                <View style={styles.rowGroup}>
                    <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
                        <Text style={styles.label}>Precio (€) <Text style={styles.required}>*</Text></Text>
                        <TextInput
                            style={styles.input}
                            placeholder="0.00"
                            placeholderTextColor="#666"
                            keyboardType="decimal-pad"
                            value={price}
                            onChangeText={setPrice}
                        />
                    </View>

                    <View style={[styles.inputGroup, { flex: 1 }]}>
                        <Text style={styles.label}>Estado <Text style={styles.required}>*</Text></Text>
                        <View style={styles.stateSelector}>
                            <TouchableOpacity
                                style={[styles.stateBtn, isNew && styles.stateBtnActive]}
                                onPress={() => setIsNew(true)}
                            >
                                <Text style={[styles.stateBtnText, isNew && styles.stateBtnTextActive]}>Nuevo</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.stateBtn, !isNew && styles.stateBtnActive]}
                                onPress={() => setIsNew(false)}
                            >
                                <Text style={[styles.stateBtnText, !isNew && styles.stateBtnTextActive]}>Usado</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Categoría <Text style={styles.required}>*</Text></Text>
                    <View style={styles.pickerContainer}>
                        <Picker
                            selectedValue={category}
                            onValueChange={(itemValue) => setCategory(itemValue)}
                            style={styles.picker}
                            dropdownIconColor="#1a7a4c"
                        >
                            {CATEGORIES.map(cat => (
                                <Picker.Item label={cat} value={cat} key={cat} color={Platform.OS === 'ios' ? '#FFF' : '#000'} />
                            ))}
                        </Picker>
                    </View>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Descripción <Text style={styles.required}>*</Text></Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Describe el producto, sus características, tiempo de uso, etc."
                        placeholderTextColor="#666"
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                        value={description}
                        onChangeText={setDescription}
                    />
                </View>

                <TouchableOpacity
                    style={[
                        styles.submitButton,
                        (isSubmitting || images.length < 3) && styles.submitButtonDisabled
                    ]}
                    onPress={handleSubmit}
                    disabled={isSubmitting || images.length < 3}
                >
                    {isSubmitting ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <Text style={styles.submitButtonText}>Publicar Producto</Text>
                    )}
                </TouchableOpacity>
                {images.length < 3 && (
                    <Text style={[styles.helperText, { textAlign: 'center', color: '#EF4444', marginTop: 10 }]}>
                        Faltan fotos (Mínimo 3)
                    </Text>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 50,
        paddingBottom: 15,
        paddingHorizontal: 20,
        backgroundColor: '#101820',
        borderBottomWidth: 1,
        borderBottomColor: '#1c2a35',
    },
    backButton: {
        padding: 5,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFF',
    },
    container: {
        flex: 1,
        backgroundColor: '#101820',
    },
    scrollContent: {
        padding: 20,
    },
    sectionLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFF',
        marginBottom: 10,
    },
    required: {
        color: '#1a7a4c',
    },
    imagesScroll: {
        flexDirection: 'row',
        marginBottom: 5,
    },
    imageContainer: {
        marginRight: 10,
        position: 'relative',
    },
    pickedImage: {
        width: 100,
        height: 100,
        borderRadius: 10,
        backgroundColor: '#1c2a35',
    },
    removeImageBtn: {
        position: 'absolute',
        top: -10,
        right: -10,
        backgroundColor: '#101820',
        borderRadius: 12,
    },
    addImageBtn: {
        width: 100,
        height: 100,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#1a7a4c',
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(26, 122, 76, 0.1)',
    },
    addImageText: {
        color: '#1a7a4c',
        fontSize: 12,
        marginTop: 5,
        fontWeight: 'bold',
    },
    helperText: {
        color: '#888',
        fontSize: 12,
        marginBottom: 20,
    },
    inputGroup: {
        marginBottom: 20,
    },
    rowGroup: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: '#FFF',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#1c2a35',
        borderRadius: 10,
        padding: 15,
        color: '#FFF',
        borderWidth: 1,
        borderColor: '#334155',
        fontSize: 16,
    },
    textArea: {
        height: 120,
    },
    pickerContainer: {
        backgroundColor: '#1c2a35',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#334155',
        overflow: 'hidden',
    },
    picker: {
        color: '#FFF',
        height: 55,
    },
    stateSelector: {
        flexDirection: 'row',
        backgroundColor: '#1c2a35',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#334155',
        overflow: 'hidden',
        height: 55,
    },
    stateBtn: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    stateBtnActive: {
        backgroundColor: '#1a7a4c',
    },
    stateBtnText: {
        color: '#888',
        fontWeight: '500',
    },
    stateBtnTextActive: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    submitButton: {
        backgroundColor: '#1a7a4c',
        borderRadius: 12,
        padding: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        shadowColor: '#1a7a4c',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
    },
    submitButtonDisabled: {
        backgroundColor: '#2d3748',
        shadowOpacity: 0,
        elevation: 0,
    },
    submitButtonText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    },
});

export default CreateStoreItemScreen;
