import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, Alert, Modal, TextInput, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ThemeContext } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';

const PetDetailsScreen = ({ route, navigation }) => {
    const { theme } = React.useContext(ThemeContext);
    const styles = getStyles(theme);
    const { pet } = route.params;



    // Modal State
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [reminderTitle, setReminderTitle] = useState('');
    const [reminderTime, setReminderTime] = useState(new Date());
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [selectedDays, setSelectedDays] = useState([]);

    const DAYS = [
        { id: 'L', name: 'L' },
        { id: 'M', name: 'M' },
        { id: 'X', name: 'X' },
        { id: 'J', name: 'J' },
        { id: 'V', name: 'V' },
        { id: 'S', name: 'S' },
        { id: 'D', name: 'D' }
    ];

    // Simulated "Live" tracking location for demo purposes
    const mockLiveLocation = {
        latitude: 40.4168,
        longitude: -3.7038,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
    };

    const handleSetReminder = (type) => {
        setReminderTitle(type);
        setReminderTime(new Date());
        setSelectedDays([]);
        setIsModalVisible(true);
    };

    const toggleDay = (dayId) => {
        if (selectedDays.includes(dayId)) {
            setSelectedDays(selectedDays.filter(d => d !== dayId));
        } else {
            setSelectedDays([...selectedDays, dayId]);
        }
    };

    const handleSaveReminder = () => {
        if (!reminderTitle) {
            Alert.alert('Error', 'Debes escribir un título para el recordatorio.');
            return;
        }
        setIsModalVisible(false);
        const timeStr = reminderTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const daysStr = selectedDays.length === 7 ? 'Todos los días' : (selectedDays.length === 0 ? 'Solo una vez' : 'Días: ' + selectedDays.join(', '));
        Alert.alert('¡Recordatorio Creado!', `${reminderTitle}\n⏰ ${timeStr}\n📅 ${daysStr}`);
        setReminderTitle('');
        setSelectedDays([]);
    };

    return (
        <View style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header Image */}
                <View style={styles.imageContainer}>
                    {pet.image ? (
                        <Image source={{ uri: pet.image }} style={styles.petImage} />
                    ) : (
                        <View style={[styles.petImage, styles.placeholderImage]}>
                            <Ionicons name="paw" size={80} color={theme.border} />
                        </View>
                    )}

                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="arrow-back" size={24} color="#FFF" />
                    </TouchableOpacity>

                    {/* Floating Walk Button */}
                    <TouchableOpacity
                        style={styles.walkButton}
                        onPress={() => navigation.navigate('WalkTracking', { petId: pet.id, petName: pet.name })}
                    >
                        <Ionicons name="walk" size={24} color="#FFF" />
                    </TouchableOpacity>
                </View>

                {/* Primary Info */}
                <View style={styles.infoSection}>
                    <View style={styles.nameHeader}>
                        <Text style={styles.petName}>{pet.name}</Text>
                        <Text style={styles.petType}>{pet.type}</Text>
                    </View>

                    <View style={styles.statsRow}>
                        <View style={styles.statBox}>
                            <Text style={styles.statLabel}>Raza</Text>
                            <Text style={styles.statValue}>{pet.breed}</Text>
                        </View>
                        <View style={styles.statBox}>
                            <Text style={styles.statLabel}>Peso</Text>
                            <Text style={styles.statValue}>{pet.weight} kg</Text>
                        </View>
                    </View>
                </View>

                {/* Secondary Info */}
                <View style={styles.detailsSection}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionTitle}>Salud y Cuidados</Text>
                        <TouchableOpacity onPress={() => handleSetReminder('Nuevo Recordatorio')}>
                            <Ionicons name="add-circle" size={28} color={theme.primary} />
                        </TouchableOpacity>
                    </View>

                    {pet.allergies ? (
                        <View style={styles.detailRow}>
                            <Ionicons name="warning-outline" size={20} color={theme.primary} />
                            <View style={styles.detailTextContainer}>
                                <Text style={styles.detailLabel}>Alergias</Text>
                                <Text style={styles.detailValue}>{pet.allergies}</Text>
                            </View>
                        </View>
                    ) : null}

                    {pet.illnesses ? (
                        <View style={styles.detailRow}>
                            <Ionicons name="medical-outline" size={20} color={theme.primary} />
                            <View style={styles.detailTextContainer}>
                                <Text style={styles.detailLabel}>Enfermedades</Text>
                                <Text style={styles.detailValue}>{pet.illnesses}</Text>
                            </View>
                        </View>
                    ) : null}

                    {pet.vaccinations ? (
                        <TouchableOpacity style={styles.detailRow} onPress={() => handleSetReminder('Vacunas')}>
                            <Ionicons name="shield-checkmark-outline" size={20} color={theme.primary} />
                            <View style={styles.detailTextContainer}>
                                <Text style={styles.detailLabel}>Vacunas (Toca para recordar)</Text>
                                <Text style={styles.detailValue}>{pet.vaccinations}</Text>
                            </View>
                            <Ionicons name="notifications-outline" size={20} color={theme.textSecondary} />
                        </TouchableOpacity>
                    ) : null}

                    {pet.foodSchedule ? (
                        <TouchableOpacity style={styles.detailRow} onPress={() => handleSetReminder('Comida')}>
                            <Ionicons name="restaurant-outline" size={20} color={theme.primary} />
                            <View style={styles.detailTextContainer}>
                                <Text style={styles.detailLabel}>Horario de Comida (Toca para recordar)</Text>
                                <Text style={styles.detailValue}>{pet.foodSchedule}</Text>
                            </View>
                            <Ionicons name="notifications-outline" size={20} color={theme.textSecondary} />
                        </TouchableOpacity>
                    ) : null}
                </View>

                {/* Live Tracking Map Section */}
                <View style={styles.mapSection}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionTitle}>Seguimiento en Vivo</Text>
                        <View style={styles.liveBadge}><Text style={styles.liveText}>● LIVE</Text></View>
                    </View>
                    <Text style={styles.mapDescription}>Actualmente paseando con cuidador.</Text>
                    <View style={styles.mapContainerInner}>
                        <MapView
                            provider={PROVIDER_DEFAULT}
                            style={styles.map}
                            initialRegion={mockLiveLocation}
                            scrollEnabled={false}
                            zoomEnabled={false}
                        >
                            <Marker coordinate={mockLiveLocation} title={pet.name}>
                                <View style={styles.markerAvatar}>
                                    <Ionicons name="paw" size={16} color="#FFF" />
                                </View>
                            </Marker>
                        </MapView>
                    </View>
                </View>


            </ScrollView>

            <Modal
                visible={isModalVisible}
                transparent={true}
                animationType="slide"
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <Text style={styles.modalTitle}>Crear Recordatorio</Text>

                        <Text style={styles.modalLabel}>Título</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Ej: Pastilla, Paseo..."
                            placeholderTextColor={theme.textSecondary}
                            value={reminderTitle}
                            onChangeText={setReminderTitle}
                        />

                        <Text style={styles.modalLabel}>Hora</Text>
                        <TouchableOpacity style={styles.timePickerButton} onPress={() => setShowTimePicker(true)}>
                            <Text style={styles.timePickerText}>{reminderTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                            <Ionicons name="time-outline" size={20} color={theme.textSecondary} />
                        </TouchableOpacity>

                        {showTimePicker && (
                            <DateTimePicker
                                value={reminderTime}
                                mode="time"
                                is24Hour={true}
                                display="default"
                                onChange={(event, selectedDate) => {
                                    setShowTimePicker(Platform.OS === 'ios');
                                    if (selectedDate) setReminderTime(selectedDate);
                                }}
                            />
                        )}

                        <Text style={styles.modalLabel}>Repetir los días:</Text>
                        <View style={styles.daysContainer}>
                            {DAYS.map((day) => {
                                const isSelected = selectedDays.includes(day.id);
                                return (
                                    <TouchableOpacity
                                        key={day.id}
                                        style={[styles.dayCircle, isSelected && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                                        onPress={() => toggleDay(day.id)}
                                    >
                                        <Text style={[styles.dayText, isSelected && { color: '#FFF' }]}>{day.name}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <View style={styles.modalActions}>
                            <TouchableOpacity style={styles.modalCancel} onPress={() => setIsModalVisible(false)}>
                                <Text style={styles.modalCancelText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.modalSave} onPress={handleSaveReminder}>
                                <Text style={styles.modalSaveText}>Guardar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const getStyles = (theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background,
    },
    imageContainer: {
        width: '100%',
        height: 350,
        position: 'relative',
    },
    petImage: {
        width: '100%',
        height: '100%',
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
    },
    placeholderImage: {
        backgroundColor: theme.cardBackground,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backButton: {
        position: 'absolute',
        top: 50,
        left: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    walkButton: {
        position: 'absolute',
        top: 50,
        right: 20,
        backgroundColor: theme.primary,
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 5
    },
    infoSection: {
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
    },
    nameHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 20,
    },
    petName: {
        fontSize: 32,
        fontWeight: 'bold',
        color: theme.primary,
    },
    petType: {
        fontSize: 18,
        color: theme.textSecondary,
        fontWeight: '600',
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: theme.cardBackground,
        borderRadius: 15,
        padding: 15,
        borderWidth: 1,
        borderColor: theme.border,
    },
    statBox: {
        flex: 1,
        alignItems: 'center',
    },
    statLabel: {
        fontSize: 14,
        color: theme.textSecondary,
        marginBottom: 5,
    },
    statValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.text,
    },
    detailsSection: {
        padding: 20,
        paddingBottom: 40,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.text,
        marginBottom: 20,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: theme.cardBackground,
        padding: 15,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: theme.border,
    },
    detailTextContainer: {
        marginLeft: 15,
        flex: 1,
    },
    detailLabel: {
        fontSize: 14,
        color: theme.textSecondary,
        marginBottom: 2,
    },
    detailValue: {
        fontSize: 16,
        color: theme.text,
        fontWeight: '500',
    },
    mapSection: {
        padding: 20,
        paddingTop: 0,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    liveBadge: {
        backgroundColor: '#ffebee',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#f44336',
    },
    liveText: {
        color: '#f44336',
        fontSize: 10,
        fontWeight: 'bold',
    },
    mapDescription: {
        fontSize: 14,
        color: theme.textSecondary,
        marginBottom: 15,
    },
    mapContainerInner: {
        height: 180,
        borderRadius: 15,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: theme.border,
    },
    map: {
        width: '100%',
        height: '100%',
    },
    markerAvatar: {
        backgroundColor: theme.primary,
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFF',
    },
    historySection: {
        padding: 20,
        paddingBottom: 40,
    },
    historyCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.cardBackground,
        padding: 15,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: theme.border,
    },
    historyIconBox: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: theme.primary + '20',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    historyInfo: {
        flex: 1,
    },
    historyType: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.text,
        marginBottom: 2,
    },
    historyDate: {
        fontSize: 12,
        color: theme.textSecondary,
        marginBottom: 4,
    },
    historyStats: {
        fontSize: 14,
        color: theme.primary,
        fontWeight: '500',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        width: '100%',
        backgroundColor: theme.background,
        borderRadius: 20,
        padding: 25,
        elevation: 10,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: theme.text,
        marginBottom: 20,
        textAlign: 'center',
    },
    modalLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.textSecondary,
        marginBottom: 10,
        marginTop: 10,
    },
    modalInput: {
        backgroundColor: theme.cardBackground,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 10,
        padding: 15,
        fontSize: 16,
        color: theme.text,
    },
    timePickerButton: {
        backgroundColor: theme.cardBackground,
        borderWidth: 1,
        borderColor: theme.border,
        borderRadius: 10,
        padding: 15,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    timePickerText: {
        fontSize: 16,
        color: theme.text,
        fontWeight: '500',
    },
    daysContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 5,
        marginBottom: 15,
    },
    dayCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: theme.border,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.cardBackground,
    },
    dayText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: theme.textSecondary,
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 20,
    },
    modalCancel: {
        flex: 1,
        padding: 15,
        alignItems: 'center',
        borderRadius: 10,
        backgroundColor: theme.cardBackground,
        marginRight: 10,
        borderWidth: 1,
        borderColor: theme.border,
    },
    modalCancelText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.textSecondary,
    },
    modalSave: {
        flex: 1,
        padding: 15,
        alignItems: 'center',
        borderRadius: 10,
        backgroundColor: theme.primary,
        marginLeft: 10,
    },
    modalSaveText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFF',
    }
});

export default PetDetailsScreen;
