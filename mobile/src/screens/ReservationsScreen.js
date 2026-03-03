import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { notifyReservationStatus, API_BASE_URL } from '../config/api';
import { Ionicons } from '@expo/vector-icons';
// import { useStripe, PlatformPay } from '@stripe/stripe-react-native';

const ReservationsScreen = ({ navigation }) => {
    const { theme } = useContext(ThemeContext);
    const { user, userData } = useContext(AuthContext);
    const styles = getStyles(theme);

    const [reservations, setReservations] = useState([]);
    const [loading, setLoading] = useState(true);
    // const { confirmPlatformPayPayment, isPlatformPaySupported } = useStripe();
    const isPlatformPaySupported = async () => false;
    const confirmPlatformPayPayment = async () => ({ error: { message: 'Deshabilitado en Expo Go' } });

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
            await notifyReservationStatus(id);
            Alert.alert('Aceptado', 'Reserva confirmada. Se ha notificado al dueño por email y puedes generar el QR.');
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'No se pudo aceptar la reserva.');
        }
    };

    const handleReject = async (id) => {
        try {
            await updateDoc(doc(db, 'reservations', id), { status: 'rejected' });
            await notifyReservationStatus(id);
            Alert.alert('Rechazada', 'Se ha notificado al dueño por email.');
        } catch (error) {
            console.error(error);
        }
    };

    const handlePaymentSelection = (item) => {
        Alert.alert(
            'Seleccionar Método de Pago',
            '¿Cómo deseas pagar esta reserva?',
            [
                { text: 'Efectivo', onPress: () => processCashPayment(item) },
                { text: 'Apple / Google Pay', onPress: () => processStripePayment(item) },
                { text: 'Cancelar', style: 'cancel' }
            ]
        );
    };

    const processCashPayment = async (item) => {
        try {
            await updateDoc(doc(db, 'reservations', item.id), { paymentMethod: 'cash', paymentStatus: 'paid' });
            Alert.alert('Éxito', 'Pago registrado en efectivo. Ya puedes escanear el QR.');
        } catch (error) {
            Alert.alert('Error', 'No se pudo registrar el pago.');
        }
    };

    const processStripePayment = async (item) => {
        try {
            const isSupported = await isPlatformPaySupported();
            if (!isSupported) {
                Alert.alert('Error', 'Google Pay / Apple Pay no está soportado en este dispositivo.');
                return;
            }

            const amount = item.price || 15; // Placeholder si no tiene precio guardado

            const response = await fetch(`${API_BASE_URL}/api/payments/payment-intent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount, currency: 'eur' })
            });

            const data = await response.json();

            if (!data.clientSecret) {
                Alert.alert('Error', 'No se pudo generar la intención de pago.');
                return;
            }

            const { error, paymentIntent } = await confirmPlatformPayPayment(data.clientSecret, {
                googlePay: {
                    testEnv: true,
                    merchantName: 'PawMate',
                    merchantCountryCode: 'ES',
                    currencyCode: 'EUR',
                    billingAddressConfig: {
                        format: PlatformPay.BillingAddressFormat.Min,
                        isPhoneNumberRequired: false,
                        isRequired: false,
                    },
                },
                applePay: {
                    merchantCountryCode: 'ES',
                    currencyCode: 'EUR',
                    cartItems: [
                        {
                            label: 'Servicio PawMate',
                            amount: amount.toString(),
                            paymentType: PlatformPay.PaymentType.Immediate,
                        },
                    ],
                }
            });

            if (error) {
                Alert.alert('Pago cancelado', error.message);
                return;
            }

            if (paymentIntent && paymentIntent.status === 'Succeeded') {
                await updateDoc(doc(db, 'reservations', item.id), {
                    paymentMethod: 'stripe',
                    paymentStatus: 'paid',
                    paymentId: paymentIntent.id
                });
                Alert.alert('Éxito', 'Pago procesado correctamente. Ya puedes escanear el QR.');
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Ocurrió un error procesando el pago.');
        }
    };

    const handleCancelReservation = (item) => {
        Alert.alert(
            'Cancelar Reserva',
            '¿Estás seguro de que deseas cancelar esta reserva?',
            [
                { text: 'No', style: 'cancel' },
                { text: 'Sí, Cancelar', onPress: () => processCancellation(item), style: 'destructive' }
            ]
        );
    };

    const processCancellation = async (item) => {
        try {
            if (item.paymentStatus === 'paid' && item.paymentMethod === 'stripe' && item.paymentId) {
                // Process refund via backend
                const response = await fetch(`${API_BASE_URL}/api/payments/refund`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ paymentIntentId: item.paymentId })
                });
                const data = await response.json();
                if (!data.success) {
                    Alert.alert('Error', 'No se pudo procesar el reembolso.');
                    return;
                }
                Alert.alert('Cancelada', 'Reserva cancelada y reembolso procesado correctamente.');
                await updateDoc(doc(db, 'reservations', item.id), { status: 'cancelled', paymentStatus: 'refunded' });
            } else {
                Alert.alert('Cancelada', 'La reserva ha sido cancelada.');
                await updateDoc(doc(db, 'reservations', item.id), { status: 'cancelled' });
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'No se pudo cancelar la reserva.');
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
                    item.status === 'cancelled' && { backgroundColor: '#f44336' },
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
                {item.ownerMessage ? (
                    <View style={styles.messageBox}>
                        <Text style={styles.messageLabel}>Mensaje del cliente:</Text>
                        <Text style={styles.messageText}>{item.ownerMessage}</Text>
                    </View>
                ) : null}

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

                {/* QR Generation/Scanning Flow or Payment */}
                {isAccepted && isCaregiver && (
                    <TouchableOpacity
                        style={styles.qrBtnPrimary}
                        onPress={() => navigation.navigate('QRGenerator', { reservationId: item.id, type: 'start' })}
                    >
                        <Ionicons name="qr-code" size={20} color="#FFF" style={{ marginRight: 8 }} />
                        <Text style={styles.btnText}>Generar QR Inicio</Text>
                    </TouchableOpacity>
                )}

                {isAccepted && !isCaregiver && item.paymentStatus !== 'paid' && (
                    <TouchableOpacity
                        style={[styles.qrBtnPrimary, { backgroundColor: '#000' }]}
                        onPress={() => handlePaymentSelection(item)}
                    >
                        <Ionicons name="card" size={20} color="#FFF" style={{ marginRight: 8 }} />
                        <Text style={styles.btnText}>Realizar Pago</Text>
                    </TouchableOpacity>
                )}

                {isAccepted && !isCaregiver && item.paymentStatus === 'paid' && (
                    <TouchableOpacity
                        style={styles.qrBtnSecondary}
                        onPress={() => navigation.navigate('QRScanner', { expectedId: item.id, purpose: 'start' })}
                    >
                        <Ionicons name="scan" size={20} color={theme.primary} style={{ marginRight: 8 }} />
                        <Text style={[styles.btnText, { color: theme.primary }]}>Escanear QR para Iniciar</Text>
                    </TouchableOpacity>
                )}

                {/* Cancel option for accepted reservations */}
                {(isAccepted || isPending) && (
                    <TouchableOpacity
                        style={[styles.qrBtnSecondary, { borderColor: '#f44336', marginTop: 10 }]}
                        onPress={() => handleCancelReservation(item)}
                    >
                        <Ionicons name="close-circle" size={20} color="#f44336" style={{ marginRight: 8 }} />
                        <Text style={[styles.btnText, { color: '#f44336' }]}>Cancelar Reserva</Text>
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
    messageBox: { backgroundColor: theme.background, padding: 12, borderRadius: 10, marginTop: 10, marginBottom: 5, borderLeftWidth: 4, borderLeftColor: theme.primary },
    messageLabel: { fontSize: 12, fontWeight: '600', color: theme.textSecondary, marginBottom: 4 },
    messageText: { fontSize: 14, color: theme.text },
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
