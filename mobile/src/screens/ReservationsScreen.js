import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Ionicons } from '@expo/vector-icons';

const ReservationsScreen = ({ navigation }) => {
    const { theme } = useContext(ThemeContext);
    const { user, userData } = useContext(AuthContext);
    const styles = getStyles(theme);

    const [reservations, setReservations] = useState([]);
    const [loading, setLoading] = useState(true);

    const isCaregiver = userData?.role === 'caregiver';

    useEffect(() => {
        if (!user) return;

        // Fetch reservations where user is either the owner or the caregiver
        const fieldToQuery = isCaregiver ? 'caregiverId' : 'ownerId';
        const q = query(collection(db, 'reservations'), where(fieldToQuery, '==', user.uid));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const resData = [];
            snapshot.forEach((docSnap) => {
                resData.push({ id: docSnap.id, ...docSnap.data() });
            });
            // Sort by createdAt descending
            resData.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
            setReservations(resData);
            setLoading(false);
        }, (error) => {
            console.error(error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, isCaregiver]);

    const handleAccept = async (id) => {
        // Enforce Caregiver limits (pseudo logic: verify active counts)
        const activeWalks = reservations.filter(r => r.status === 'active' && r.type === 'paseo').length;
        if (activeWalks >= 5) {
            Alert.alert('Límite', 'No puedes aceptar más de 5 paseos activos.');
            return;
        }

        try {
            await updateDoc(doc(db, 'reservations', id), { status: 'accepted' });
            Alert.alert('Aceptado', 'Reserva confirmada. Se ha generado un QR para escanear.');
        } catch (error) {
            console.error(error);
        }
    };

    const handleReject = async (id) => {
        try {
            await updateDoc(doc(db, 'reservations', id), { status: 'rejected' });
        } catch (error) {
            console.error(error);
        }
    };

    const renderReservationCard = ({ item }) => {
        const isPending = item.status === 'pending';
        const isAccepted = item.status === 'accepted';
        const isActive = item.status === 'active';

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{item.type.toUpperCase()}</Text>
                    <View style={[styles.statusBadge,
                    item.status === 'pending' && { backgroundColor: '#ff9800' },
                    item.status === 'accepted' && { backgroundColor: '#4caf50' },
                    item.status === 'active' && { backgroundColor: theme.primary },
                    item.status === 'completed' && { backgroundColor: '#9e9e9e' },
                    item.status === 'rejected' && { backgroundColor: '#f44336' },
                    ]}>
                        <Text style={styles.statusText}>{item.status}</Text>
                    </View>
                </View>

                <View style={styles.detailRow}>
                    <Ionicons name="paw" size={16} color={theme.textSecondary} />
                    <Text style={styles.detailText}>Mascota: {item.petName}</Text>
                </View>
                {!isCaregiver && (
                    <View style={styles.detailRow}>
                        <Ionicons name="person" size={16} color={theme.textSecondary} />
                        <Text style={styles.detailText}>Cuidador: {item.caregiverName}</Text>
                    </View>
                )}
                <View style={styles.detailRow}>
                    <Ionicons name="calendar" size={16} color={theme.textSecondary} />
                    <Text style={styles.detailText}>Inicio: {new Date(item.startDate).toLocaleString()}</Text>
                </View>

                {/* Actions for Caregiver */}
                {isCaregiver && isPending && (
                    <View style={styles.actionRow}>
                        <TouchableOpacity style={[styles.actionBtn, styles.rejectBtn]} onPress={() => handleReject(item.id)}>
                            <Text style={styles.btnText}>Rechazar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionBtn, styles.acceptBtn]} onPress={() => handleAccept(item.id)}>
                            <Text style={styles.btnText}>Aceptar</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* QR Generation/Scanning Flow */}
                {isAccepted && isCaregiver && (
                    <TouchableOpacity
                        style={styles.qrBtnPrimary}
                        onPress={() => navigation.navigate('QRGenerator', { reservationId: item.id, type: 'start' })}
                    >
                        <Ionicons name="qr-code" size={20} color="#FFF" style={{ marginRight: 8 }} />
                        <Text style={styles.btnText}>Generar QR Inicio</Text>
                    </TouchableOpacity>
                )}

                {isAccepted && !isCaregiver && (
                    <TouchableOpacity
                        style={styles.qrBtnSecondary}
                        onPress={() => navigation.navigate('QRScanner', { expectedId: item.id, purpose: 'start' })}
                    >
                        <Ionicons name="scan" size={20} color={theme.primary} style={{ marginRight: 8 }} />
                        <Text style={[styles.btnText, { color: theme.primary }]}>Escanear QR para Iniciar</Text>
                    </TouchableOpacity>
                )}

                {/* End Reservation Actions */}
                {isActive && isCaregiver && (
                    <TouchableOpacity
                        style={styles.qrBtnPrimary}
                        onPress={() => navigation.navigate('QRGenerator', { reservationId: item.id, type: 'end' })}
                    >
                        <Ionicons name="qr-code" size={20} color="#FFF" style={{ marginRight: 8 }} />
                        <Text style={styles.btnText}>Fin: Generar QR Cierre</Text>
                    </TouchableOpacity>
                )}
                {isActive && !isCaregiver && (
                    <TouchableOpacity
                        style={styles.qrBtnSecondary}
                        onPress={() => navigation.navigate('QRScanner', { expectedId: item.id, purpose: 'end' })}
                    >
                        <Ionicons name="scan" size={20} color={theme.primary} style={{ marginRight: 8 }} />
                        <Text style={[styles.btnText, { color: theme.primary }]}>Fin: Escanear y Finalizar</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Reservas</Text>
                <View style={{ width: 24 }} />
            </View>

            {loading ? (
                <View style={styles.centered}><ActivityIndicator size="large" color={theme.primary} /></View>
            ) : reservations.length === 0 ? (
                <View style={styles.centered}>
                    <Ionicons name="calendar-outline" size={60} color={theme.border} />
                    <Text style={styles.emptyText}>No tienes reservas aún.</Text>
                </View>
            ) : (
                <FlatList
                    data={reservations}
                    keyExtractor={(item) => item.id}
                    renderItem={renderReservationCard}
                    contentContainerStyle={styles.listContainer}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </View>
    );
};

const getStyles = (theme) => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 50, paddingBottom: 15, paddingHorizontal: 20, backgroundColor: theme.background,
        borderBottomWidth: 1, borderBottomColor: theme.border
    },
    backButton: { padding: 5 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: theme.text },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    emptyText: { color: theme.textSecondary, fontSize: 16, marginTop: 15, textAlign: 'center' },
    listContainer: { padding: 20 },
    card: {
        backgroundColor: theme.cardBackground, borderRadius: 15, padding: 15, marginBottom: 15,
        borderWidth: 1, borderColor: theme.border, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: theme.text },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    statusText: { color: '#FFF', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
    detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    detailText: { marginLeft: 8, fontSize: 14, color: theme.textSecondary },
    actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
    actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginHorizontal: 5 },
    rejectBtn: { backgroundColor: '#f44336' },
    acceptBtn: { backgroundColor: '#4caf50' },
    btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
    qrBtnPrimary: {
        flexDirection: 'row', backgroundColor: theme.primary, paddingVertical: 12, borderRadius: 10,
        alignItems: 'center', justifyContent: 'center', marginTop: 15
    },
    qrBtnSecondary: {
        flexDirection: 'row', backgroundColor: theme.primary + '11', paddingVertical: 12, borderRadius: 10,
        alignItems: 'center', justifyContent: 'center', marginTop: 15, borderWidth: 1, borderColor: theme.primary
    }
});

export default ReservationsScreen;
