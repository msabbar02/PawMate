import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';

const BookingRequestScreen = ({ route, navigation }) => {
    const { theme } = useContext(ThemeContext);
    const { user } = useContext(AuthContext);
    const styles = getStyles(theme);

    const { caregiverId, caregiverName } = route.params;

    const [pets, setPets] = useState([]);
    const [selectedPetId, setSelectedPetId] = useState('');
    const [loadingPets, setLoadingPets] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [bookingType, setBookingType] = useState('paseo'); // 'paseo' or 'guarderia'

    // Dates
    const [startDate, setStartDate] = useState(new Date());
    const [endDate, setEndDate] = useState(new Date());
    const [showStartDatePicker, setShowStartDatePicker] = useState(false);
    const [showEndDatePicker, setShowEndDatePicker] = useState(false);

    useEffect(() => {
        const fetchPets = async () => {
            if (!user) return;
            try {
                const q = query(collection(db, 'pets'), where('ownerId', '==', user.uid));
                const querySnapshot = await getDocs(q);
                const fetchedPets = [];
                querySnapshot.forEach((doc) => {
                    fetchedPets.push({ id: doc.id, ...doc.data() });
                });
                setPets(fetchedPets);
                if (fetchedPets.length > 0) {
                    setSelectedPetId(fetchedPets[0].id);
                }
            } catch (error) {
                console.error("Error fetching pets", error);
            } finally {
                setLoadingPets(false);
            }
        };

        fetchPets();
    }, [user]);

    const handleStartDateChange = (event, selectedDate) => {
        setShowStartDatePicker(Platform.OS === 'ios');
        if (selectedDate) setStartDate(selectedDate);
    };

    const handleEndDateChange = (event, selectedDate) => {
        setShowEndDatePicker(Platform.OS === 'ios');
        if (selectedDate) setEndDate(selectedDate);
    };

    const handleBook = async () => {
        if (!selectedPetId) {
            Alert.alert('Error', 'Debes añadir y seleccionar una mascota primero.');
            return;
        }

        setIsSubmitting(true);
        try {
            const pet = pets.find(p => p.id === selectedPetId);

            const bookingData = {
                ownerId: user.uid,
                caregiverId,
                caregiverName,
                petId: selectedPetId,
                petName: pet?.name || 'Mascota',
                type: bookingType,
                status: 'pending', // pending -> accepted -> active -> completed -> reviewed
                startDate: startDate.toISOString(),
                endDate: bookingType === 'guarderia' ? endDate.toISOString() : null,
                createdAt: serverTimestamp()
            };

            await addDoc(collection(db, 'reservations'), bookingData);

            Alert.alert(
                '¡Solicitud Enviada con Éxito!',
                `Hemos notificado a ${caregiverName} sobre tu solicitud para ${pet?.name || 'tu mascota'}. Te avisaremos en cuanto el cuidador confirme la reserva.`,
                [
                    { text: 'Aceptar', onPress: () => navigation.goBack() }
                ]
            );

        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'No se pudo enviar la solicitud.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>✕</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Solicitar Reserva</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={styles.title}>Reservar con {caregiverName}</Text>

                <View style={styles.section}>
                    <Text style={styles.label}>Selecciona tu Mascota</Text>
                    {loadingPets ? (
                        <ActivityIndicator color={theme.primary} />
                    ) : pets.length === 0 ? (
                        <Text style={styles.errorText}>No tienes mascotas registradas. Ve a tu perfil y añade una primero.</Text>
                    ) : (
                        <View style={styles.pickerContainer}>
                            <Picker
                                selectedValue={selectedPetId}
                                onValueChange={(itemValue) => setSelectedPetId(itemValue)}
                                style={styles.picker}
                                dropdownIconColor={theme.primary}
                            >
                                {pets.map(p => (
                                    <Picker.Item key={p.id} label={p.name} value={p.id} color={Platform.OS === 'ios' ? theme.text : '#000'} />
                                ))}
                            </Picker>
                        </View>
                    )}
                </View>

                <View style={styles.section}>
                    <Text style={styles.label}>Tipo de Servicio</Text>
                    <View style={styles.typeSelector}>
                        <TouchableOpacity
                            style={[styles.typeButton, bookingType === 'paseo' && styles.typeButtonActive]}
                            onPress={() => setBookingType('paseo')}
                        >
                            <Text style={[styles.typeText, bookingType === 'paseo' && styles.typeTextActive]}>Paseo (Horas)</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.typeButton, bookingType === 'guarderia' && styles.typeButtonActive]}
                            onPress={() => setBookingType('guarderia')}
                        >
                            <Text style={[styles.typeText, bookingType === 'guarderia' && styles.typeTextActive]}>Guardería (Días)</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.label}>Fecha y Hora de Inicio</Text>
                    <TouchableOpacity style={styles.datePickerButton} onPress={() => setShowStartDatePicker(true)}>
                        <Text style={styles.dateText}>{startDate.toLocaleString()}</Text>
                    </TouchableOpacity>
                    {showStartDatePicker && (
                        <DateTimePicker
                            value={startDate}
                            mode="datetime"
                            is24Hour={true}
                            display="default"
                            onChange={handleStartDateChange}
                            minimumDate={new Date()}
                        />
                    )}
                </View>

                {bookingType === 'guarderia' && (
                    <View style={styles.section}>
                        <Text style={styles.label}>Fecha y Hora de Fin</Text>
                        <TouchableOpacity style={styles.datePickerButton} onPress={() => setShowEndDatePicker(true)}>
                            <Text style={styles.dateText}>{endDate.toLocaleString()}</Text>
                        </TouchableOpacity>
                        {showEndDatePicker && (
                            <DateTimePicker
                                value={endDate}
                                mode="datetime"
                                is24Hour={true}
                                display="default"
                                onChange={handleEndDateChange}
                                minimumDate={startDate}
                            />
                        )}
                    </View>
                )}

                <TouchableOpacity
                    style={[styles.submitButton, (isSubmitting || pets.length === 0) && { opacity: 0.6 }]}
                    disabled={isSubmitting || pets.length === 0}
                    onPress={handleBook}
                >
                    {isSubmitting ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <Text style={styles.submitButtonText}>Confirmar y Enviar Solicitud</Text>
                    )}
                </TouchableOpacity>

            </ScrollView>
        </View>
    );
};

const getStyles = (theme) => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
        flexDirection: 'row', alignItems: 'center', paddingTop: 50, paddingBottom: 15, paddingHorizontal: 20,
        backgroundColor: theme.background, borderBottomWidth: 1, borderBottomColor: theme.border
    },
    backButton: { marginRight: 15 },
    backButtonText: { fontSize: 28, color: theme.text, fontWeight: 'bold' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: theme.text },
    scrollContent: { padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', color: theme.primary, marginBottom: 25 },
    section: { marginBottom: 25 },
    label: { fontSize: 16, fontWeight: 'bold', color: theme.text, marginBottom: 10 },
    pickerContainer: {
        backgroundColor: theme.cardBackground, borderRadius: 10, borderWidth: 1, borderColor: theme.border, overflow: 'hidden'
    },
    picker: { height: Platform.OS === 'ios' ? 120 : 50, color: theme.text },
    typeSelector: { flexDirection: 'row', justifyContent: 'space-between' },
    typeButton: {
        flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: theme.cardBackground,
        borderWidth: 1, borderColor: theme.border, borderRadius: 10, marginHorizontal: 5
    },
    typeButtonActive: { backgroundColor: theme.primary, borderColor: theme.primary },
    typeText: { fontSize: 14, fontWeight: 'bold', color: theme.textSecondary },
    typeTextActive: { color: '#FFF' },
    datePickerButton: {
        backgroundColor: theme.cardBackground, padding: 15, borderRadius: 10, borderWidth: 1, borderColor: theme.border, alignItems: 'center'
    },
    dateText: { fontSize: 16, color: theme.text, fontWeight: 'bold' },
    submitButton: { backgroundColor: theme.primary, paddingVertical: 15, borderRadius: 10, alignItems: 'center', marginTop: 20 },
    submitButtonText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
    errorText: { color: '#f44336', fontSize: 14, fontStyle: 'italic' }
});

export default BookingRequestScreen;
