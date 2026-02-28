import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Image, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker'; // Ensure you have this installed
import { ThemeContext } from '../context/ThemeContext';

const CATEGORIES = ['Accesorios', 'Comida', 'Juguetes', 'Salud', 'Higiene', 'Ropa', 'Otros'];

const CreateStoreItemScreen = ({ navigation }) => {
    const { theme } = React.useContext(ThemeContext);
    const styles = getStyles(theme);

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
                            <Ionicons name="camera-outline" size={32} color={theme.primary} />
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
                        placeholderTextColor={theme.textSecondary}
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
                            placeholderTextColor={theme.textSecondary}
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
                            dropdownIconColor={theme.primary}
                        >
                            {CATEGORIES.map(cat => (
                                <Picker.Item label={cat} value={cat} key={cat} color={Platform.OS === 'ios' ? theme.text : (theme.isDark ? theme.text : '#000')} />
                            ))}
                        </Picker>
                    </View>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Descripción <Text style={styles.required}>*</Text></Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Describe el producto, sus características, tiempo de uso, etc."
                        placeholderTextColor={theme.textSecondary}
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
                    <Text style={[styles.helperText, { textAlign: 'center', color: theme.error, marginTop: 10 }]}>
                        Faltan fotos (Mínimo 3)
                    </Text>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const getStyles = (theme) => StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 50,
        paddingBottom: 15,
        paddingHorizontal: 20,
        backgroundColor: theme.background,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
    },
    backButton: {
        padding: 5,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.text,
    },
    container: {
        flex: 1,
        backgroundColor: theme.background,
    },
    scrollContent: {
        padding: 20,
    },
    sectionLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.text,
        marginBottom: 10,
    },
    required: {
        color: theme.primary,
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
        backgroundColor: theme.cardBackground,
    },
    removeImageBtn: {
        position: 'absolute',
        top: -10,
        right: -10,
        backgroundColor: theme.background,
        borderRadius: 12,
    },
    addImageBtn: {
        width: 100,
        height: 100,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: theme.primary,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.primary + '1A', // Using 10% opacity via hex
    },
    addImageText: {
        color: theme.primary,
        fontSize: 12,
        marginTop: 5,
        fontWeight: 'bold',
    },
    helperText: {
        color: theme.textSecondary,
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
        color: theme.text,
        marginBottom: 8,
    },
    input: {
        backgroundColor: theme.cardBackground,
        borderRadius: 10,
        padding: 15,
        color: theme.text,
        borderWidth: 1,
        borderColor: theme.border,
        fontSize: 16,
    },
    textArea: {
        height: 120,
    },
    pickerContainer: {
        backgroundColor: theme.cardBackground,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: theme.border,
        overflow: 'hidden',
    },
    picker: {
        color: theme.text,
        height: 55,
    },
    stateSelector: {
        flexDirection: 'row',
        backgroundColor: theme.cardBackground,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: theme.border,
        overflow: 'hidden',
        height: 55,
    },
    stateBtn: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    stateBtnActive: {
        backgroundColor: theme.primary,
    },
    stateBtnText: {
        color: theme.textSecondary,
        fontWeight: '500',
    },
    stateBtnTextActive: {
        color: '#FFF', // Keeping white for active button text explicitly
        fontWeight: 'bold',
    },
    submitButton: {
        backgroundColor: theme.primary,
        borderRadius: 12,
        padding: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        shadowColor: theme.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
        elevation: 5,
    },
    submitButtonDisabled: {
        backgroundColor: theme.border,
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
