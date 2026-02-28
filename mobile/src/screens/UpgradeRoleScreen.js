import React, { useState, useContext } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const UpgradeRoleScreen = ({ navigation }) => {
    const { theme } = useContext(ThemeContext);
    const { user, userData } = useContext(AuthContext);
    const styles = getStyles(theme);

    const [selectedRole, setSelectedRole] = useState(null); // 'owner' or 'caregiver'
    const [isLoading, setIsLoading] = useState(false);

    // Form data
    const [dni, setDni] = useState('');
    const [iban, setIban] = useState('');
    const [price, setPrice] = useState('');
    const [description, setDescription] = useState('');

    const currentRole = userData?.role || 'user';

    const handleUpgrade = async () => {
        if (!selectedRole) {
            Alert.alert('Error', 'Selecciona a qué rol quieres subir.');
            return;
        }

        if (!dni || !iban) {
            Alert.alert('Error', 'Por favor rellena el DNI y el IBAN que son obligatorios.');
            return;
        }

        if (selectedRole === 'caregiver' && (!price || !description)) {
            Alert.alert('Error', 'Para ser cuidador debes poner un precio y una descripción.');
            return;
        }

        setIsLoading(true);

        try {
            const docRef = doc(db, 'users', user.uid);
            const updatePayload = {
                role: selectedRole,
                dni,
                iban,
            };

            if (selectedRole === 'caregiver') {
                updatePayload.pricePerHour = parseFloat(price);
                updatePayload.description = description;
                updatePayload.isOnline = true; // Auto online when verified Caregiver
            }

            await updateDoc(docRef, updatePayload);

            Alert.alert('¡Felicidades!', 'Tu cuenta ha sido actualizada con éxito.', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);

        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'No se pudo actualizar la cuenta.');
        } finally {
            setIsLoading(false);
        }
    };

    if (currentRole === 'owner' || currentRole === 'caregiver') {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
                <Ionicons name="checkmark-circle" size={80} color={theme.primary} />
                <Text style={[styles.title, { textAlign: 'center', marginTop: 20 }]}>
                    Ya eres {currentRole === 'owner' ? 'Dueño' : 'Cuidador'}
                </Text>
                <Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 10 }}>
                    Ya tienes todas las funcionalidades para tu rol.
                </Text>
                <TouchableOpacity style={[styles.submitButton, { marginTop: 40, width: '100%' }]} onPress={() => navigation.goBack()}>
                    <Text style={styles.submitButtonText}>Volver</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Mejorar Cuenta</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={styles.description}>
                    Para poder ofrecer servicios de cuidado de mascotas o contratar a paseadores,
                    necesitamos verificar tu identidad de forma segura.
                </Text>

                <View style={styles.roleSelectorRow}>
                    <TouchableOpacity
                        style={[styles.roleOption, selectedRole === 'owner' && styles.roleOptionSelected]}
                        onPress={() => setSelectedRole('owner')}
                    >
                        <Ionicons name="person" size={32} color={selectedRole === 'owner' ? '#FFF' : theme.primary} />
                        <Text style={[styles.roleTitle, selectedRole === 'owner' && styles.roleTitleSelected]}>Dueño</Text>
                        <Text style={[styles.roleSubtitle, selectedRole === 'owner' && styles.roleTitleSelected]}>Quiero contratar cuidadores y seguimiento GPS</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.roleOption, selectedRole === 'caregiver' && styles.roleOptionSelected]}
                        onPress={() => setSelectedRole('caregiver')}
                    >
                        <Ionicons name="briefcase" size={32} color={selectedRole === 'caregiver' ? '#FFF' : theme.primary} />
                        <Text style={[styles.roleTitle, selectedRole === 'caregiver' && styles.roleTitleSelected]}>Cuidador</Text>
                        <Text style={[styles.roleSubtitle, selectedRole === 'caregiver' && styles.roleTitleSelected]}>Quiero ofrecer mis servicios y ganar dinero</Text>
                    </TouchableOpacity>
                </View>

                {selectedRole && (
                    <View style={styles.formContainer}>
                        <Text style={styles.formSectionTitle}>Datos Fiscales (Obligatorios)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="DNI / NIE / Pasaporte"
                            placeholderTextColor={theme.textSecondary}
                            value={dni}
                            onChangeText={setDni}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="IBAN Bancario (Para pagos seguros)"
                            placeholderTextColor={theme.textSecondary}
                            value={iban}
                            onChangeText={setIban}
                        />

                        {selectedRole === 'caregiver' && (
                            <>
                                <Text style={[styles.formSectionTitle, { marginTop: 20 }]}>Perfil Profesional</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Precio por Paseo/Hora (€)"
                                    placeholderTextColor={theme.textSecondary}
                                    keyboardType="numeric"
                                    value={price}
                                    onChangeText={setPrice}
                                />
                                <TextInput
                                    style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
                                    placeholder="Descripción: Habla sobre tu experiencia..."
                                    placeholderTextColor={theme.textSecondary}
                                    multiline
                                    value={description}
                                    onChangeText={setDescription}
                                />
                            </>
                        )}

                        <TouchableOpacity
                            style={[styles.submitButton, isLoading && { opacity: 0.7 }]}
                            onPress={handleUpgrade}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#FFF" />
                            ) : (
                                <Text style={styles.submitButtonText}>Verificar y Mejorar Cuenta</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}
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
        justifyContent: 'space-between',
        paddingTop: 50,
        paddingBottom: 20,
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
    scrollContent: {
        padding: 20,
    },
    description: {
        fontSize: 16,
        color: theme.textSecondary,
        marginBottom: 25,
        textAlign: 'center',
    },
    roleSelectorRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 30,
    },
    roleOption: {
        flex: 1,
        backgroundColor: theme.cardBackground,
        padding: 20,
        borderRadius: 15,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: theme.border,
        marginHorizontal: 5,
    },
    roleOptionSelected: {
        backgroundColor: theme.primary,
        borderColor: theme.primary,
    },
    roleTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.text,
        marginTop: 10,
        marginBottom: 5,
    },
    roleTitleSelected: {
        color: '#FFF',
    },
    roleSubtitle: {
        fontSize: 12,
        color: theme.textSecondary,
        textAlign: 'center',
    },
    formContainer: {
        backgroundColor: theme.cardBackground,
        padding: 20,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: theme.border,
    },
    formSectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.text,
        marginBottom: 15,
    },
    input: {
        backgroundColor: theme.background,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 10,
        padding: 15,
        color: theme.text,
        marginBottom: 15,
        fontSize: 16,
    },
    submitButton: {
        backgroundColor: theme.primary,
        paddingVertical: 15,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 10,
    },
    submitButtonText: {
        color: '#FFF',
        fontSize: 18,
        fontWeight: 'bold',
    }
});

export default UpgradeRoleScreen;
