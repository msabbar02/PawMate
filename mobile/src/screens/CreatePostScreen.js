import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../context/ThemeContext';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';

// Mock list of user groups
const MOCK_GROUPS = [
    { id: 'global', name: '🌍 Global (Público)' },
    { id: 'golden_club', name: '🐕 Club Golden Retriever (Privado)' },
    { id: 'paseos_madrid', name: '🌲 Paseos Madrid Centro (Público)' }
];

const CreatePostScreen = ({ navigation }) => {
    const { theme } = useContext(ThemeContext);
    const styles = getStyles(theme);

    const [mediaUri, setMediaUri] = useState(null);
    const [mediaType, setMediaType] = useState(null); // 'image' or 'video'
    const [postText, setPostText] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('global');
    const [isPublishing, setIsPublishing] = useState(false);

    const pickMedia = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.All,
            allowsEditing: true,
            aspect: [1, 1], // Square for Instagram style
            quality: 0.8,
            videoMaxDuration: 60, // Limit videos to 60s
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            setMediaUri(result.assets[0].uri);
            setMediaType(result.assets[0].type || 'image');
        }
    };

    const takePhoto = async () => {
        let permissions = await ImagePicker.requestCameraPermissionsAsync();
        if (permissions.status !== 'granted') {
            Alert.alert('Permiso denegado', 'Necesitamos acceso a la cámara para tomar fotos.');
            return;
        }

        let result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            setMediaUri(result.assets[0].uri);
            setMediaType('image');
        }
    };

    const handlePublish = () => {
        if (!mediaUri && postText.trim().length === 0) {
            Alert.alert('Error', 'Debes añadir al menos una foto/video o escribir algo.');
            return;
        }

        setIsPublishing(true);

        // Simulate network request
        setTimeout(() => {
            setIsPublishing(false);
            Alert.alert(
                '¡Publicado!',
                `Tu post se ha compartido en ${selectedGroup === 'global' ? 'el Feed Global' : 'tu grupo'}.`,
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
        }, 1500);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="close" size={28} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Nueva Publicación</Text>
                <TouchableOpacity onPress={handlePublish} disabled={isPublishing}>
                    <Text style={[styles.publishButton, isPublishing && { opacity: 0.5 }]}>
                        {isPublishing ? '...' : 'Compartir'}
                    </Text>
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>

                    {/* Media Preview */}
                    <View style={styles.mediaContainer}>
                        {mediaUri ? (
                            <View>
                                {mediaType === 'video' ? (
                                    <View style={styles.videoPlaceholderRow}>
                                        <Ionicons name="videocam" size={40} color="#FFF" />
                                        <Text style={{ color: '#FFF', marginTop: 10 }}>Video seleccionado</Text>
                                    </View>
                                ) : (
                                    <Image source={{ uri: mediaUri }} style={styles.mediaPreview} />
                                )}
                                <TouchableOpacity style={styles.removeMediaBtn} onPress={() => setMediaUri(null)}>
                                    <Ionicons name="close-circle" size={24} color="#FFF" />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.addMediaButtonsRow}>
                                <TouchableOpacity style={styles.addMediaOption} onPress={pickMedia}>
                                    <Ionicons name="images-outline" size={40} color={theme.primary} />
                                    <Text style={styles.addMediaText}>Galería</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.addMediaOption} onPress={takePhoto}>
                                    <Ionicons name="camera-outline" size={40} color={theme.primary} />
                                    <Text style={styles.addMediaText}>Cámara</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    {/* Text Input */}
                    <TextInput
                        style={styles.textInput}
                        placeholder="Escribe un pie de foto o comentario..."
                        placeholderTextColor={theme.textSecondary}
                        multiline
                        maxLength={500}
                        value={postText}
                        onChangeText={setPostText}
                        textAlignVertical="top"
                    />

                    {/* Group Selector */}
                    <View style={styles.sectionContainer}>
                        <Text style={styles.sectionLabel}>¿Dónde quieres publicar?</Text>
                        <View style={styles.pickerContainer}>
                            <Picker
                                selectedValue={selectedGroup}
                                onValueChange={(val) => setSelectedGroup(val)}
                                style={styles.picker}
                                dropdownIconColor={theme.primary}
                            >
                                {MOCK_GROUPS.map(g => (
                                    <Picker.Item key={g.id} label={g.name} value={g.id} color={Platform.OS === 'ios' ? theme.text : '#000'} />
                                ))}
                            </Picker>
                        </View>
                    </View>

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const getStyles = (theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.text,
    },
    publishButton: {
        color: theme.primary,
        fontWeight: 'bold',
        fontSize: 16,
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: 20,
    },
    mediaContainer: {
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
    },
    mediaPreview: {
        width: '100%',
        aspectRatio: 1,
        backgroundColor: theme.cardBackground,
    },
    videoPlaceholderRow: {
        width: '100%',
        aspectRatio: 1,
        backgroundColor: '#000',
        alignItems: 'center',
        justifyContent: 'center',
    },
    removeMediaBtn: {
        position: 'absolute',
        top: 15,
        right: 15,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 20,
        padding: 2,
    },
    addMediaButtonsRow: {
        flexDirection: 'row',
        paddingVertical: 40,
        justifyContent: 'space-around',
        backgroundColor: theme.cardBackground,
    },
    addMediaOption: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    addMediaText: {
        marginTop: 10,
        color: theme.primary,
        fontWeight: 'bold',
    },
    textInput: {
        padding: 20,
        fontSize: 16,
        color: theme.text,
        minHeight: 120,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
        backgroundColor: theme.background,
    },
    sectionContainer: {
        padding: 20,
    },
    sectionLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.text,
        marginBottom: 10,
    },
    pickerContainer: {
        backgroundColor: theme.cardBackground,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: theme.border,
        overflow: 'hidden',
    },
    picker: {
        height: Platform.OS === 'ios' ? 120 : 50,
        color: theme.text,
    }
});

export default CreatePostScreen;
