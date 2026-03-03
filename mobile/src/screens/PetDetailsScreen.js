import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { db } from '../config/firebase';
import { doc, onSnapshot, collection, query, where, orderBy, deleteDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Polyline, Marker, PROVIDER_DEFAULT } from 'react-native-maps';

const PetDetailsScreen = ({ route, navigation }) => {
    const { theme } = useContext(ThemeContext);
    const { user } = useContext(AuthContext);
    const styles = getStyles(theme);

    const petId = route.params?.petId || route.params?.pet?.id;
    const [pet, setPet] = useState(route.params?.pet || null);
    const [loading, setLoading] = useState(!route.params?.pet);

    const [walks, setWalks] = useState([]);

    useEffect(() => {
        if (!petId) return;
        const unsub = onSnapshot(doc(db, 'pets', petId), (snap) => {
            if (snap.exists()) setPet({ id: snap.id, ...snap.data() });
            setLoading(false);
        }, () => setLoading(false));
        return () => unsub();
    }, [petId]);

    useEffect(() => {
        if (!petId) return;
        const q = query(
            collection(db, 'walks'),
            where('petId', '==', petId),
            orderBy('date', 'desc')
        );
        const unsubWalks = onSnapshot(q, (snap) => {
            const fetchedWalks = [];
            snap.forEach(doc => {
                fetchedWalks.push({ id: doc.id, ...doc.data() });
            });
            setWalks(fetchedWalks);
        });
        return () => unsubWalks();
    }, [petId]);

    const handleDeleteWalk = (walkId) => {
        Alert.alert(
            "Eliminar paseo",
            "¿Estás seguro de que quieres eliminar este registro?",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Eliminar", style: "destructive", onPress: async () => {
                        try {
                            await deleteDoc(doc(db, 'walks', walkId));
                        } catch (error) {
                            console.error("Error deleting walk:", error);
                        }
                    }
                }
            ]
        );
    };

    const handlePublishWalk = () => {
        Alert.alert(
            "¡Publicado!",
            "Tus amigos ya pueden ver el paseo de tu mascota en la comunidad.",
            [{ text: "OK" }]
        );
    };

    if (loading && !pet) {
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }
    if (!pet) {
        return (
            <View style={[styles.container, styles.centered]}>
                <Text style={styles.errorText}>Mascota no encontrada</Text>
                <TouchableOpacity style={styles.backBtnAlt} onPress={() => navigation.goBack()}>
                    <Text style={styles.backBtnAltText}>Volver</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Perfil de mascota</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Card principal */}
                <View style={styles.mainCard}>
                    <View style={styles.photoWrap}>
                        {pet.image || pet.photo ? (
                            <Image source={{ uri: pet.image || pet.photo }} style={styles.photo} />
                        ) : (
                            <View style={[styles.photo, styles.photoPlaceholder]}>
                                <Ionicons name="paw" size={48} color={theme.border} />
                            </View>
                        )}
                    </View>
                    <Text style={styles.petName}>{pet.name}</Text>
                    <Text style={styles.petType}>{pet.type} · {pet.breed}</Text>
                    <View style={styles.statsRow}>
                        <View style={styles.statChip}>
                            <Text style={styles.statChipValue}>{pet.weight ?? '–'}</Text>
                            <Text style={styles.statChipLabel}>kg</Text>
                        </View>
                        {pet.dob ? (
                            <View style={styles.statChip}>
                                <Text style={styles.statChipLabel}>Nac.</Text>
                                <Text style={styles.statChipValue}>{pet.dob}</Text>
                            </View>
                        ) : null}
                    </View>

                    <View style={styles.cardActions}>
                        <TouchableOpacity
                            style={styles.btnPrimary}
                            onPress={() => navigation.navigate('EditPet', { petId: pet.id })}
                        >
                            <Ionicons name="create-outline" size={20} color="#FFF" />
                            <Text style={styles.btnPrimaryText}>Editar</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.walkCta}
                            onPress={() => navigation.navigate('WalkTracking', { petId: pet.id, petName: pet.name })}
                        >
                            <Ionicons name="walk" size={24} color="#FFF" />
                            <Text style={styles.walkCtaText}>Iniciar paseo</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Salud y cuidados */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Salud y cuidados</Text>
                        {pet.allergies ? (
                            <View style={styles.infoRow}>
                                <Ionicons name="warning-outline" size={20} color={theme.primary} />
                                <View style={styles.infoTextWrap}>
                                    <Text style={styles.infoLabel}>Alergias</Text>
                                    <Text style={styles.infoValue}>{pet.allergies}</Text>
                                </View>
                            </View>
                        ) : null}
                        {pet.illnesses ? (
                            <View style={styles.infoRow}>
                                <Ionicons name="medical-outline" size={20} color={theme.primary} />
                                <View style={styles.infoTextWrap}>
                                    <Text style={styles.infoLabel}>Enfermedades</Text>
                                    <Text style={styles.infoValue}>{pet.illnesses}</Text>
                                </View>
                            </View>
                        ) : null}
                        {pet.vaccinations ? (
                            <View style={styles.infoRow}>
                                <Ionicons name="shield-checkmark-outline" size={20} color={theme.primary} />
                                <View style={styles.infoTextWrap}>
                                    <Text style={styles.infoLabel}>Vacunas</Text>
                                    <Text style={styles.infoValue}>{pet.vaccinations}</Text>
                                </View>
                            </View>
                        ) : null}
                        {pet.foodSchedule ? (
                            <View style={styles.infoRow}>
                                <Ionicons name="restaurant-outline" size={20} color={theme.primary} />
                                <View style={styles.infoTextWrap}>
                                    <Text style={styles.infoLabel}>Horario de comida</Text>
                                    <Text style={styles.infoValue}>{pet.foodSchedule}</Text>
                                </View>
                            </View>
                        ) : null}
                        {!pet.allergies && !pet.illnesses && !pet.vaccinations && !pet.foodSchedule && (
                            <Text style={styles.noData}>Sin datos de salud registrados. Edita la mascota para añadirlos.</Text>
                        )}
                    </View>

                    {/* Historial de Paseos */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Historial de Paseos</Text>
                        {walks.length === 0 ? (
                            <Text style={styles.noData}>No hay paseos registrados todavía.</Text>
                        ) : (
                            walks.map(walk => (
                                <View key={walk.id} style={styles.walkCard}>
                                    {walk.routeCoords && walk.routeCoords.length > 0 && (
                                        <View style={styles.miniMapWrap} pointerEvents="none">
                                            <MapView
                                                provider={PROVIDER_DEFAULT}
                                                style={styles.miniMap}
                                                initialRegion={{
                                                    latitude: walk.routeCoords[0].latitude,
                                                    longitude: walk.routeCoords[0].longitude,
                                                    latitudeDelta: 0.015,
                                                    longitudeDelta: 0.015,
                                                }}
                                                scrollEnabled={false}
                                                zoomEnabled={false}
                                                pitchEnabled={false}
                                                rotateEnabled={false}
                                            >
                                                <Polyline
                                                    coordinates={walk.routeCoords}
                                                    strokeColor={theme.primary}
                                                    strokeWidth={4}
                                                />
                                                <Marker coordinate={walk.routeCoords[0]}>
                                                    <View style={styles.markerDot} />
                                                </Marker>
                                                <Marker coordinate={walk.routeCoords[walk.routeCoords.length - 1]}>
                                                    <View style={[styles.markerDot, { backgroundColor: '#f44336' }]} />
                                                </Marker>
                                            </MapView>
                                        </View>
                                    )}
                                    <View style={styles.walkInfo}>
                                        <Text style={styles.walkStats}>{walk.distanceKm} km • {walk.durationMins} min</Text>
                                        <Text style={styles.walkDate}>
                                            {walk.date && typeof walk.date.toDate === 'function' ? walk.date.toDate().toLocaleDateString() : 'Reciente'}
                                        </Text>
                                    </View>
                                    <View style={styles.walkActions}>
                                        <TouchableOpacity style={styles.walkBtnOutline} onPress={() => handleDeleteWalk(walk.id)}>
                                            <Text style={styles.walkBtnOutlineText}>Eliminar</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.walkBtnSolid} onPress={handlePublishWalk}>
                                            <Text style={styles.walkBtnSolidText}>Publicar</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                </View>
                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
};

const getStyles = (theme) => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    centered: { justifyContent: 'center', alignItems: 'center' },
    errorText: { fontSize: 16, color: theme.textSecondary, marginBottom: 16 },
    backBtnAlt: { paddingVertical: 12, paddingHorizontal: 24, backgroundColor: theme.primary, borderRadius: 12 },
    backBtnAltText: { color: '#FFF', fontWeight: '600' },
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
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: theme.text },
    scrollContent: { padding: 20 },
    mainCard: {
        backgroundColor: theme.cardBackground,
        borderRadius: 20,
        padding: 24,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: theme.border,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    photoWrap: { marginBottom: 16 },
    photo: { width: 120, height: 120, borderRadius: 60 },
    photoPlaceholder: { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' },
    petName: { fontSize: 24, fontWeight: 'bold', color: theme.text, marginBottom: 4 },
    petType: { fontSize: 15, color: theme.textSecondary, marginBottom: 12 },
    statsRow: { flexDirection: 'row', gap: 16, marginBottom: 20 },
    statChip: {
        backgroundColor: theme.background,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
        alignItems: 'center',
    },
    statChipLabel: { fontSize: 12, color: theme.textSecondary },
    statChipValue: { fontSize: 16, fontWeight: 'bold', color: theme.text },
    cardActions: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    btnPrimary: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 14,
        backgroundColor: theme.primary,
        gap: 8,
    },
    btnPrimaryText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
    walkCta: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        paddingVertical: 14,
        borderRadius: 14,
        backgroundColor: theme.primary,
        gap: 10,
    },
    walkCtaText: { fontSize: 16, fontWeight: 'bold', color: '#FFF' },
    section: { marginBottom: 8 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 14 },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: theme.cardBackground,
        padding: 14,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: theme.border,
    },
    infoTextWrap: { marginLeft: 12, flex: 1 },
    infoLabel: { fontSize: 12, color: theme.textSecondary, marginBottom: 2 },
    infoValue: { fontSize: 15, color: theme.text, fontWeight: '500' },
    noData: { fontSize: 14, color: theme.textSecondary, fontStyle: 'italic', marginTop: 8 },
    walkCard: {
        backgroundColor: theme.cardBackground,
        borderRadius: 20,
        padding: 18,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: theme.border,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
    },
    miniMapWrap: {
        height: 140,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 16,
        backgroundColor: theme.background,
    },
    miniMap: {
        width: '100%',
        height: '100%',
    },
    markerDot: {
        width: 14, height: 14, borderRadius: 7, backgroundColor: '#4caf50',
        borderWidth: 2, borderColor: '#FFF'
    },
    walkInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    walkStats: { fontSize: 18, fontWeight: '800', color: theme.primary },
    walkDate: { fontSize: 13, color: theme.textSecondary, fontWeight: 'bold' },
    walkActions: {
        flexDirection: 'row',
        gap: 12,
    },
    walkBtnOutline: {
        flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1,
        borderColor: '#f44336', alignItems: 'center', justifyContent: 'center'
    },
    walkBtnOutlineText: { color: '#f44336', fontWeight: 'bold', fontSize: 15 },
    walkBtnSolid: {
        flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: theme.primary,
        alignItems: 'center', justifyContent: 'center'
    },
    walkBtnSolidText: { color: '#FFF', fontWeight: 'bold', fontSize: 15 }
});

export default PetDetailsScreen;
