import React, { useState, useContext, useEffect, useRef } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity, ScrollView, FlatList,
    TextInput, ActivityIndicator, Alert, KeyboardAvoidingView,
    Platform, Modal, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';
import { COLORS } from '../constants/colors';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { auth, db } from '../config/firebase';
import {
    collection, query, where, onSnapshot, addDoc,
    doc, updateDoc, serverTimestamp, getDocs, getDoc, orderBy, increment,
} from 'firebase/firestore';
import { createNotification, generateUniqueId } from '../utils/notificationHelpers';
import { useSafeStripe } from '../config/stripe';

// Server URL — update with your actual server URL when deployed
const SERVER_URL = 'http://localhost:3000';

// ─────────────────────────────────────────────────
// STATUS CONFIG
// ─────────────────────────────────────────────────
const STATUS = {
    pendiente:  { label: 'Pendiente',   bg: COLORS.warningLight,   color: COLORS.warning,   icon: 'time-outline' },
    aceptada:   { label: 'Aceptada',    bg: COLORS.successLight,   color: COLORS.success,   icon: 'checkmark-circle-outline' },
    activa:     { label: 'Activa',      bg: COLORS.primaryBg,      color: COLORS.primary,   icon: 'radio-button-on-outline' },
    cancelada:  { label: 'Cancelada',   bg: '#F3F4F6',             color: COLORS.textLight, icon: 'close-circle-outline' },
    completada: { label: 'Completada',  bg: COLORS.secondaryLight, color: COLORS.secondary, icon: 'ribbon-outline' },
};

const SERVICE_TYPES = [
    { value: 'walking', label: '🚶 Paseo', icon: 'walk-outline' },
    { value: 'hotel',   label: '🏨 Hotel', icon: 'home-outline' },
    { value: 'daycare', label: '☀️ Guardería', icon: 'sunny-outline' },
];

// ─────────────────────────────────────────────────
// CAPACITY LIMITS
// ─────────────────────────────────────────────────
const MAX_WALK = 5;
const MAX_HOTEL = 3;

export default function BookingScreen() {
    const { userData } = useContext(AuthContext);
    const { theme, isDarkMode } = useContext(ThemeContext);
    const { initPaymentSheet, presentPaymentSheet } = useSafeStripe();
    const [activeTab, setActiveTab] = useState('reservations'); // 'reservations' | 'messages'
    const [reservations, setReservations] = useState([]);
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isNewResModalVisible, setIsNewResModalVisible] = useState(false);
    const [isChatVisible, setIsChatVisible] = useState(false);
    const [activeConversation, setActiveConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [messageInput, setMessageInput] = useState('');
    const flatListRef = useRef(null);

    // QR state
    const [isQrModalVisible, setIsQrModalVisible] = useState(false);
    const [qrBooking, setQrBooking] = useState(null);
    const [isScannerVisible, setIsScannerVisible] = useState(false);
    const [cameraScanned, setCameraScanned] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();

    // Review state
    const [isReviewModalVisible, setIsReviewModalVisible] = useState(false);
    const [reviewTarget, setReviewTarget] = useState(null); // the reservation being reviewed
    const [reviewRating, setReviewRating] = useState(5);
    const [reviewText, setReviewText] = useState('');
    const [submittingReview, setSubmittingReview] = useState(false);

    // New reservation form state
    const [newResForm, setNewResForm] = useState({
        serviceType: 'walking',
        startDate: '',
        endDate: '',
        notes: '',
        caregiverId: '',
        caregiverName: '',
    });

    // ─────────────────────────────────────────────────
    // FIREBASE: Fetch reservations
    // ─────────────────────────────────────────────────
    useEffect(() => {
        if (!auth.currentUser) { setLoading(false); return; }

        const isCaregiver = userData?.role === 'caregiver';
        const field = isCaregiver ? 'caregiverUid' : 'ownerUid';

        const q = query(
            collection(db, 'reservations'),
            where(field, '==', auth.currentUser.uid)
        );

        const unsub = onSnapshot(q, (snap) => {
            const data = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => {
                    const ta = a.createdAt?.toMillis?.() ?? 0;
                    const tb = b.createdAt?.toMillis?.() ?? 0;
                    return tb - ta;
                });
            setReservations(data);
            setLoading(false);
            setConversations(data.filter(r => r.status !== 'cancelada'));
        }, (err) => { console.warn('Reservations query error:', err); setLoading(false); });

        return () => unsub();
    }, [userData?.role]);

    // ─────────────────────────────────────────────────
    // FIREBASE: Fetch messages for conversation
    // ─────────────────────────────────────────────────
    useEffect(() => {
        if (!activeConversation) return;
        const q = query(
            collection(db, `messages/${activeConversation.id}/thread`),
            orderBy('timestamp', 'asc')
        );
        const unsub = onSnapshot(q, (snap) => {
            setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, [activeConversation]);

    // ─────────────────────────────────────────────────
    // CAPACITY CHECK
    // ─────────────────────────────────────────────────
    const checkCapacity = async (caregiverId, serviceType) => {
        const isWalk = serviceType === 'walking';
        const maxLimit = isWalk ? MAX_WALK : MAX_HOTEL;
        const q = query(
            collection(db, 'reservations'),
            where('caregiverUid', '==', caregiverId),
            where('status', '==', 'aceptada'),
            where('serviceType', '==', serviceType)
        );
        const snap = await getDocs(q);
        return snap.size < maxLimit;
    };

    // ─────────────────────────────────────────────────
    // ACCEPT RESERVATION (Caregiver action)
    // ─────────────────────────────────────────────────
    const handleAcceptReservation = async (reservation) => {
        try {
            const hasCapacity = await checkCapacity(auth.currentUser.uid, reservation.serviceType);
            if (!hasCapacity) {
                const limit = reservation.serviceType === 'walking' ? MAX_WALK : MAX_HOTEL;
                Alert.alert('Sin capacidad', `Ya tienes ${limit} reservas activas de este tipo.`);
                return;
            }
            await updateDoc(doc(db, 'reservations', reservation.id), {
                status: 'aceptada',
                confirmedAt: serverTimestamp(),
            });
            await createNotification(reservation.ownerUid, {
                type: 'booking_confirmed',
                bookingId: reservation.id,
                title: '¡Reserva aceptada! 🎉',
                body: `${userData?.fullName || 'El cuidador'} aceptó tu reserva. ¡Completa el pago para confirmar!`,
                icon: 'checkmark-circle-outline',
                iconBg: COLORS.successLight,
                iconColor: COLORS.success,
            });
            Alert.alert('¡Reserva aceptada! 🎉', 'El dueño recibirá una notificación.');
        } catch (e) {
            Alert.alert('Error', 'No se pudo aceptar la reserva.');
        }
    };

    // ─────────────────────────────────────────────────
    // PAYMENT + QR (Owner action on aceptada)
    // ─────────────────────────────────────────────────
    const handlePayment = async (reservation) => {
        const price = reservation.totalPrice ?? 0;
        if (price <= 0) {
            Alert.alert('Error', 'El precio de la reserva no es válido.');
            return;
        }

        try {
            // 1. Get a PaymentIntent from the server
            const response = await fetch(`${SERVER_URL}/api/payment-intent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: price, currency: 'eur' }),
            });
            const { clientSecret, success, message } = await response.json();

            if (!success || !clientSecret) {
                // Server not available — fallback to simulated payment
                Alert.alert(
                    '⚠️ Modo demo',
                    `El servidor de pagos no está disponible.\n\n¿Simular pago de €${price.toFixed(2)}?`,
                    [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Simular', onPress: () => confirmPayment(reservation) },
                    ]
                );
                return;
            }

            // 2. Initialize Stripe PaymentSheet
            const { error: initError } = await initPaymentSheet({
                paymentIntentClientSecret: clientSecret,
                merchantDisplayName: 'PawMate',
                style: 'automatic',
            });
            if (initError) {
                Alert.alert('Error de pago', initError.message);
                return;
            }

            // 3. Present Stripe PaymentSheet
            const { error: payError } = await presentPaymentSheet();
            if (payError) {
                if (payError.code !== 'Canceled') {
                    Alert.alert('Pago fallido', payError.message);
                }
                return;
            }

            // 4. Payment succeeded — activate reservation
            await confirmPayment(reservation);

        } catch (e) {
            console.warn('handlePayment error:', e.message);
            // Network error — offer demo payment
            Alert.alert(
                '⚠️ Sin conexión',
                `No se pudo contactar con el servidor de pagos.\n\n¿Simular pago de €${price.toFixed(2)}?`,
                [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Simular', onPress: () => confirmPayment(reservation) },
                ]
            );
        }
    };

    // Shared logic: activate reservation + send QR notification
    const confirmPayment = async (reservation) => {
        try {
            const qrCode = generateUniqueId();
            await updateDoc(doc(db, 'reservations', reservation.id), {
                status: 'activa',
                qrCode,
                activatedAt: serverTimestamp(),
            });
            await createNotification(reservation.caregiverUid, {
                type: 'booking_active',
                bookingId: reservation.id,
                title: '📱 Reserva activa — escanea el QR',
                body: `${reservation.ownerName} ha pagado. Escanea el QR cuando llegue.`,
                icon: 'qr-code-outline',
                iconBg: COLORS.primaryBg,
                iconColor: COLORS.primary,
            });
            setQrBooking({ ...reservation, status: 'activa', qrCode });
            setIsQrModalVisible(true);
        } catch {
            Alert.alert('Error', 'No se pudo activar la reserva.');
        }
    };

    // ─────────────────────────────────────────────────
    // COMPLETE SERVICE (Caregiver action on activa)
    // ─────────────────────────────────────────────────
    const handleComplete = async (reservation) => {
        Alert.alert('Marcar como completado', '¿Confirmas que el servicio ha finalizado?', [
            { text: 'No', style: 'cancel' },
            {
                text: 'Sí, completado',
                onPress: async () => {
                    try {
                        await updateDoc(doc(db, 'reservations', reservation.id), {
                            status: 'completada',
                            completedAt: serverTimestamp(),
                        });
                        await createNotification(reservation.ownerUid, {
                            type: 'booking_completed',
                            bookingId: reservation.id,
                            title: '✅ Servicio completado',
                            body: `${userData?.fullName || 'El cuidador'} ha marcado el servicio como completado. ¡Esperamos que todo saliera bien!`,
                            icon: 'ribbon-outline',
                            iconBg: COLORS.secondaryLight,
                            iconColor: COLORS.secondary,
                        });
                    } catch {
                        Alert.alert('Error', 'No se pudo completar la reserva.');
                    }
                },
            },
        ]);
    };

    // ─────────────────────────────────────────────────
    // QR SCAN HANDLER (Caregiver scans owner's QR)
    // ─────────────────────────────────────────────────
    const handleQrScanned = async ({ data }) => {
        if (cameraScanned) return;
        setCameraScanned(true);
        // Find reservation with this qrCode where I'm the caregiver
        const q = query(
            collection(db, 'reservations'),
            where('caregiverUid', '==', auth.currentUser.uid),
            where('qrCode', '==', data),
            where('status', '==', 'activa')
        );
        try {
            const snap = await getDocs(q);
            if (snap.empty) {
                Alert.alert('QR inválido', 'No se encontró ninguna reserva activa con ese código.', [
                    { text: 'OK', onPress: () => setCameraScanned(false) },
                ]);
                return;
            }
            // Already activa — just close scanner and confirm
            setIsScannerVisible(false);
            Alert.alert('✅ Check-in confirmado', 'El servicio ya está activo. ¡Disfruta del paseo!');
        } catch {
            Alert.alert('Error', 'No se pudo verificar el QR.');
            setCameraScanned(false);
        }
    };

    const handleCancelReservation = async (reservationId) => {
        Alert.alert('Cancelar reserva', '¿Estás seguro?', [
            { text: 'No', style: 'cancel' },
            {
                text: 'Sí, cancelar', style: 'destructive',
                onPress: async () => {
                    try {
                        await updateDoc(doc(db, 'reservations', reservationId), {
                            status: 'cancelada',
                        });
                    } catch { Alert.alert('Error', 'No se pudo cancelar.'); }
                },
            },
        ]);
    };

    // ─────────────────────────────────────────────────
    // SUBMIT REVIEW
    // ─────────────────────────────────────────────────
    const handleSubmitReview = async () => {
        if (!reviewTarget || !auth.currentUser) return;
        setSubmittingReview(true);
        try {
            // Save review document
            await addDoc(collection(db, 'reviews'), {
                reviewerUid: auth.currentUser.uid,
                reviewerName: userData?.fullName || 'Usuario',
                caregiverUid: reviewTarget.caregiverUid,
                caregiverName: reviewTarget.caregiverName,
                bookingId: reviewTarget.id,
                rating: reviewRating,
                comment: reviewText.trim(),
                createdAt: serverTimestamp(),
            });

            // Update caregiver's rating in Firestore (rolling average)
            const cgRef = doc(db, 'users', reviewTarget.caregiverUid);
            const cgSnap = await getDoc(cgRef);
            if (cgSnap.exists()) {
                const cgData = cgSnap.data();
                const count = (cgData.reviewCount || 0) + 1;
                const avgRating = ((cgData.rating || 0) * (count - 1) + reviewRating) / count;
                await updateDoc(cgRef, {
                    rating: Math.round(avgRating * 10) / 10,
                    reviewCount: count,
                });
            }

            // Mark reservation as reviewed so button disappears
            await updateDoc(doc(db, 'reservations', reviewTarget.id), {
                reviewedByOwner: true,
            });

            setIsReviewModalVisible(false);
            setReviewTarget(null);
            setReviewText('');
            setReviewRating(5);
            Alert.alert('¡Gracias! 🌟', 'Tu reseña ha sido publicada.');
        } catch (e) {
            Alert.alert('Error', 'No se pudo enviar la reseña.');
        } finally {
            setSubmittingReview(false);
        }
    };

    // ─────────────────────────────────────────────────
    // CREATE NEW RESERVATION
    // ─────────────────────────────────────────────────
    const handleCreateReservation = async () => {
        if (!newResForm.caregiverId.trim()) {
            return Alert.alert('Error', 'Introduce el ID del cuidador');
        }
        if (!newResForm.startDate.trim()) {
            return Alert.alert('Error', 'Introduce la fecha de inicio (YYYY-MM-DD)');
        }

        try {
            // Verify caregiver exists
            const caregiverDoc = await getDoc(doc(db, 'users', newResForm.caregiverId));
            if (!caregiverDoc.exists() || caregiverDoc.data().role !== 'caregiver') {
                return Alert.alert('Error', 'Ese ID de cuidador no existe o no está verificado.');
            }

            const caregiverData = caregiverDoc.data();

            await addDoc(collection(db, 'reservations'), {
                ownerUid: auth.currentUser.uid,
                ownerName: userData?.fullName || auth.currentUser.email,
                caregiverUid: newResForm.caregiverId,
                caregiverName: caregiverData.fullName || 'Cuidador',
                serviceType: newResForm.serviceType,
                startDate: newResForm.startDate,
                endDate: newResForm.endDate || newResForm.startDate,
                notes: newResForm.notes,
                status: 'pendiente',
                totalPrice: 0,
                createdAt: serverTimestamp(),
            });

            setIsNewResModalVisible(false);
            setNewResForm({ serviceType: 'walking', startDate: '', endDate: '', notes: '', caregiverId: '', caregiverName: '' });
            Alert.alert('Solicitud enviada', 'Tu reserva está pendiente de confirmación del cuidador.');
        } catch (e) {
            Alert.alert('Error', 'No se pudo crear la reserva.');
        }
    };

    // ─────────────────────────────────────────────────
    // SEND MESSAGE
    // ─────────────────────────────────────────────────
    const sendMessage = async () => {
        if (!messageInput.trim() || !activeConversation) return;
        const text = messageInput.trim();
        setMessageInput('');
        try {
            await addDoc(collection(db, `messages/${activeConversation.id}/thread`), {
                senderId: auth.currentUser.uid,
                senderName: userData?.fullName || 'Usuario',
                text,
                timestamp: serverTimestamp(),
                read: false,
            });
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        } catch { Alert.alert('Error', 'No se pudo enviar el mensaje.'); }
    };

    // ─────────────────────────────────────────────────
    // RENDER: Reservation Card
    // ─────────────────────────────────────────────────
    const renderReservationCard = ({ item: res }) => {
        const st = STATUS[res.status] || STATUS.pendiente;
        const isCaregiver = userData?.role === 'caregiver';
        const serviceLbl = SERVICE_TYPES.find(s => s.value === res.serviceType)?.label || res.serviceType;

        return (
            <View style={styles.resCard}>
                {/* Header */}
                <View style={styles.resCardHeader}>
                    <View style={styles.resAvatarBox}>
                        <Ionicons name="person" size={22} color={COLORS.primary} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.resName}>
                            {isCaregiver ? res.ownerName : res.caregiverName}
                        </Text>
                        <Text style={styles.resService}>{serviceLbl}</Text>
                    </View>
                    <View style={[styles.statusChip, { backgroundColor: st.bg }]}>
                        <Ionicons name={st.icon} size={12} color={st.color} />
                        <Text style={[styles.statusLabel, { color: st.color }]}>{st.label}</Text>
                    </View>
                </View>

                {/* Dates */}
                <View style={styles.resDatesRow}>
                    <View style={styles.resDateItem}>
                        <Ionicons name="calendar-outline" size={14} color={COLORS.textLight} />
                        <Text style={styles.resDateText}>
                            {res.startDate}{res.endDate && res.endDate !== res.startDate ? ` → ${res.endDate}` : ''}
                        </Text>
                    </View>
                </View>

                {res.notes ? <Text style={styles.resNotes}>{res.notes}</Text> : null}

                {/* Actions */}
                <View style={styles.resActions}>
                    <TouchableOpacity
                        style={styles.msgBtn}
                        onPress={() => { setActiveConversation(res); setIsChatVisible(true); }}
                    >
                        <Ionicons name="chatbubble-outline" size={16} color={COLORS.secondary} />
                        <Text style={styles.msgBtnText}>Mensaje</Text>
                    </TouchableOpacity>

                    {/* CAREGIVER: pending → accept / reject */}
                    {isCaregiver && res.status === 'pendiente' && (
                        <>
                            <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAcceptReservation(res)}>
                                <Ionicons name="checkmark" size={16} color="#FFF" />
                                <Text style={styles.acceptBtnText}>Aceptar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancelReservation(res.id)}>
                                <Text style={styles.cancelBtnText}>Rechazar</Text>
                            </TouchableOpacity>
                        </>
                    )}

                    {/* CAREGIVER: aceptada → scan QR */}
                    {isCaregiver && res.status === 'aceptada' && (
                        <TouchableOpacity style={styles.qrScanBtn} onPress={() => {
                            setCameraScanned(false);
                            setIsScannerVisible(true);
                        }}>
                            <Ionicons name="qr-code-outline" size={16} color="#FFF" />
                            <Text style={styles.acceptBtnText}>Escanear QR</Text>
                        </TouchableOpacity>
                    )}

                    {/* CAREGIVER: activa → complete */}
                    {isCaregiver && res.status === 'activa' && (
                        <TouchableOpacity style={styles.completeBtn} onPress={() => handleComplete(res)}>
                            <Ionicons name="checkmark-done-outline" size={16} color="#FFF" />
                            <Text style={styles.acceptBtnText}>Completado</Text>
                        </TouchableOpacity>
                    )}

                    {/* OWNER: pendiente → cancel */}
                    {!isCaregiver && res.status === 'pendiente' && (
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancelReservation(res.id)}>
                            <Text style={styles.cancelBtnText}>Cancelar</Text>
                        </TouchableOpacity>
                    )}

                    {/* OWNER: aceptada → pay */}
                    {!isCaregiver && res.status === 'aceptada' && (
                        <TouchableOpacity style={styles.payBtn} onPress={() => handlePayment(res)}>
                            <Ionicons name="card-outline" size={16} color="#FFF" />
                            <Text style={styles.acceptBtnText}>Pagar y obtener QR</Text>
                        </TouchableOpacity>
                    )}

                    {/* OWNER: activa → show QR */}
                    {!isCaregiver && res.status === 'activa' && res.qrCode && (
                        <TouchableOpacity style={styles.qrBtn} onPress={() => {
                            setQrBooking(res);
                            setIsQrModalVisible(true);
                        }}>
                            <Ionicons name="qr-code-outline" size={16} color={COLORS.primary} />
                            <Text style={styles.qrBtnText}>Ver QR</Text>
                        </TouchableOpacity>
                    )}

                    {/* OWNER: completada → leave review */}
                    {!isCaregiver && res.status === 'completada' && !res.reviewedByOwner && (
                        <TouchableOpacity
                            style={[styles.qrBtn, { backgroundColor: COLORS.primaryBg, borderColor: COLORS.primary }]}
                            onPress={() => {
                                setReviewTarget(res);
                                setReviewRating(5);
                                setReviewText('');
                                setIsReviewModalVisible(true);
                            }}
                        >
                            <Ionicons name="star-outline" size={16} color={COLORS.primary} />
                            <Text style={styles.qrBtnText}>Dejar reseña</Text>
                        </TouchableOpacity>
                    )}
                    {!isCaregiver && res.status === 'completada' && res.reviewedByOwner && (
                        <View style={styles.reviewedBadge}>
                            <Ionicons name="star" size={14} color={COLORS.secondary} />
                            <Text style={styles.reviewedText}>Reseñado</Text>
                        </View>
                    )}
                </View>
            </View>
        );
    };

    // ─────────────────────────────────────────────────
    // RENDER: Chat Message
    // ─────────────────────────────────────────────────
    const renderMessage = ({ item }) => {
        const isMe = item.senderId === auth.currentUser?.uid;
        return (
            <View style={[styles.messageBubbleWrap, isMe ? styles.bubbleRight : styles.bubbleLeft]}>
                <View style={[styles.messageBubble, isMe ? styles.bubbleMine : styles.bubbleOther]}>
                    <Text style={[styles.bubbleText, isMe && { color: '#FFF' }]}>{item.text}</Text>
                    {item.timestamp?.toDate && (
                        <Text style={[styles.bubbleTime, isMe && { color: 'rgba(255,255,255,0.7)' }]}>
                            {item.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    )}
                </View>
            </View>
        );
    };

    // ─────────────────────────────────────────────────
    // MAIN RENDER
    // ─────────────────────────────────────────────────
    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar style={isDarkMode ? 'light' : 'dark'} />

            {/* Header */}
            <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                <Text style={styles.headerTitle}>Reservas</Text>
                <View style={styles.roleChip}>
                    <Text style={styles.roleChipText}>
                        {userData?.role === 'caregiver' ? '🛡️ Cuidador' : '🐾 Dueño'}
                    </Text>
                </View>
            </View>

            {/* Tab Bar */}
            <View style={styles.tabBar}>
                {[
                    { key: 'reservations', label: '📅 Reservas' },
                    { key: 'messages',     label: '💬 Mensajes' },
                ].map(tab => (
                    <TouchableOpacity
                        key={tab.key}
                        style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                        onPress={() => setActiveTab(tab.key)}
                    >
                        <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* ── RESERVATIONS TAB ── */}
            {activeTab === 'reservations' && (
                <>
                    <FlatList
                        data={reservations}
                        keyExtractor={item => item.id}
                        renderItem={renderReservationCard}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <Text style={{ fontSize: 56 }}>📅</Text>
                                <Text style={styles.emptyTitle}>Sin reservas</Text>
                                <Text style={styles.emptyDesc}>
                                    {userData?.role === 'caregiver'
                                        ? 'Cuando los dueños te contacten, sus solicitudes aparecerán aquí.'
                                        : 'Busca un cuidador verificado en el mapa y solicita una reserva.'}
                                </Text>
                            </View>
                        }
                    />

                </>
            )}

            {/* ── MESSAGES TAB ── */}
            {activeTab === 'messages' && (
                <FlatList
                    data={conversations}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Text style={{ fontSize: 56 }}>💬</Text>
                            <Text style={styles.emptyTitle}>Sin mensajes</Text>
                            <Text style={styles.emptyDesc}>Los chats por reserva aparecerán aquí.</Text>
                        </View>
                    }
                    renderItem={({ item: res }) => {
                        const serviceLbl = SERVICE_TYPES.find(s => s.value === res.serviceType)?.label || res.serviceType;
                        const isCaregiver = userData?.role === 'caregiver';
                        return (
                            <TouchableOpacity
                                style={styles.convoRow}
                                onPress={() => { setActiveConversation(res); setIsChatVisible(true); }}
                            >
                                <View style={styles.convoAvatar}>
                                    <Ionicons name="person" size={22} color={COLORS.primary} />
                                </View>
                                <View style={{ flex: 1, marginLeft: 14 }}>
                                    <Text style={styles.convoName}>
                                        {isCaregiver ? res.ownerName : res.caregiverName}
                                    </Text>
                                    <Text style={styles.convoService}>{serviceLbl} · {res.startDate}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
                            </TouchableOpacity>
                        );
                    }}
                />
            )}

            {/* ── MODAL: NUEVA RESERVA ── */}
            <Modal visible={isNewResModalVisible} animationType="slide" presentationStyle="formSheet">
                <KeyboardAvoidingView
                    style={{ flex: 1, backgroundColor: '#F9FAFB' }}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Nueva Reserva</Text>
                        <TouchableOpacity onPress={() => setIsNewResModalVisible(false)}>
                            <Ionicons name="close" size={24} color={COLORS.text} />
                        </TouchableOpacity>
                    </View>
                    <ScrollView style={styles.modalBody}>

                        <Text style={styles.formLabel}>Tipo de servicio</Text>
                        <View style={styles.serviceGrid}>
                            {SERVICE_TYPES.map(st => (
                                <TouchableOpacity
                                    key={st.value}
                                    style={[styles.serviceChip, newResForm.serviceType === st.value && styles.serviceChipActive]}
                                    onPress={() => setNewResForm(f => ({ ...f, serviceType: st.value }))}
                                >
                                    <Text style={styles.serviceChipText}>{st.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.formLabel}>ID del Cuidador</Text>
                        <TextInput
                            style={styles.formInput}
                            value={newResForm.caregiverId}
                            onChangeText={t => setNewResForm(f => ({ ...f, caregiverId: t }))}
                            placeholder="UID del cuidador verificado"
                            placeholderTextColor={COLORS.textLight}
                        />

                        <Text style={styles.formLabel}>Fecha inicio (YYYY-MM-DD)</Text>
                        <TextInput
                            style={styles.formInput}
                            value={newResForm.startDate}
                            onChangeText={t => setNewResForm(f => ({ ...f, startDate: t }))}
                            placeholder="Ej. 2026-03-15"
                            placeholderTextColor={COLORS.textLight}
                        />

                        <Text style={styles.formLabel}>Fecha fin (opcional)</Text>
                        <TextInput
                            style={styles.formInput}
                            value={newResForm.endDate}
                            onChangeText={t => setNewResForm(f => ({ ...f, endDate: t }))}
                            placeholder="Ej. 2026-03-16"
                            placeholderTextColor={COLORS.textLight}
                        />

                        <Text style={styles.formLabel}>Notas para el cuidador</Text>
                        <TextInput
                            style={[styles.formInput, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]}
                            multiline
                            value={newResForm.notes}
                            onChangeText={t => setNewResForm(f => ({ ...f, notes: t }))}
                            placeholder="Alergias, rutinas, instrucciones especiales..."
                            placeholderTextColor={COLORS.textLight}
                        />

                        <TouchableOpacity style={styles.submitBtn} onPress={handleCreateReservation}>
                            <Text style={styles.submitBtnText}>Enviar Solicitud</Text>
                        </TouchableOpacity>
                        <View style={{ height: 60 }} />
                    </ScrollView>
                </KeyboardAvoidingView>
            </Modal>

            {/* ── MODAL: QR CODE ── */}
            <Modal visible={isQrModalVisible} animationType="fade" transparent>
                <View style={styles.qrOverlay}>
                    <View style={styles.qrSheet}>
                        <Text style={styles.qrTitle}>📱 Tu código QR</Text>
                        <Text style={styles.qrDesc}>
                            Muéstraselo al cuidador para activar el servicio
                        </Text>
                        {qrBooking?.qrCode ? (
                            <View style={styles.qrBox}>
                                <QRCode value={qrBooking.qrCode} size={200} />
                            </View>
                        ) : null}
                        <Text style={styles.qrMeta}>
                            {SERVICE_TYPES.find(s => s.value === qrBooking?.serviceType)?.label}
                            {'  ·  '}{qrBooking?.startDate}
                        </Text>
                        <TouchableOpacity style={styles.closeQrBtn} onPress={() => setIsQrModalVisible(false)}>
                            <Text style={styles.closeQrBtnText}>Cerrar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ── MODAL: QR SCANNER ── */}
            <Modal visible={isScannerVisible} animationType="slide" presentationStyle="fullScreen">
                <View style={{ flex: 1, backgroundColor: '#000' }}>
                    <View style={styles.scannerHeader}>
                        <TouchableOpacity onPress={() => setIsScannerVisible(false)}>
                            <Ionicons name="close" size={28} color="#FFF" />
                        </TouchableOpacity>
                        <Text style={styles.scannerTitle}>Escanear QR del dueño</Text>
                        <View style={{ width: 28 }} />
                    </View>
                    {permission?.granted ? (
                        <CameraView
                            style={{ flex: 1 }}
                            facing="back"
                            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                            onBarcodeScanned={cameraScanned ? undefined : handleQrScanned}
                        />
                    ) : (
                        <View style={styles.permissionBox}>
                            <Ionicons name="camera-outline" size={60} color="#FFF" />
                            <Text style={styles.permissionText}>Se necesita acceso a la cámara</Text>
                            <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
                                <Text style={styles.permissionBtnText}>Permitir cámara</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </Modal>

            {/* ── MODAL: REVIEW ── */}
            <Modal
                visible={isReviewModalVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setIsReviewModalVisible(false)}
            >
                <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#F9FAFB' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                    <View style={styles.chatHeader}>
                        <TouchableOpacity onPress={() => setIsReviewModalVisible(false)}>
                            <Ionicons name="close" size={24} color={COLORS.text} />
                        </TouchableOpacity>
                        <Text style={[styles.chatTitle, { marginLeft: 12 }]}>Dejar reseña</Text>
                        <View style={{ width: 28 }} />
                    </View>

                    <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
                        {/* Caregiver name */}
                        <Text style={{ fontSize: 16, fontWeight: '700', color: COLORS.text, textAlign: 'center' }}>
                            {reviewTarget?.caregiverName}
                        </Text>

                        {/* Star picker */}
                        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12 }}>
                            {[1, 2, 3, 4, 5].map(star => (
                                <TouchableOpacity key={star} onPress={() => setReviewRating(star)}>
                                    <Ionicons
                                        name={star <= reviewRating ? 'star' : 'star-outline'}
                                        size={38} color={star <= reviewRating ? '#F59E0B' : COLORS.textLight}
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>
                        <Text style={{ textAlign: 'center', color: COLORS.textLight, fontSize: 14 }}>
                            {['', '🙁 Pésimo', '😐 Regular', '🙂 Bueno', '😄 Muy bueno', '🌟 Excelente'][reviewRating]}
                        </Text>

                        {/* Comment */}
                        <TextInput
                            style={[styles.filterInput, { minHeight: 100, textAlignVertical: 'top' }]}
                            multiline
                            value={reviewText}
                            onChangeText={setReviewText}
                            placeholder="Escribe tu comentario (opcional)..."
                            placeholderTextColor={COLORS.textLight}
                        />

                        <TouchableOpacity
                            style={[styles.acceptBtn, submittingReview && { opacity: 0.7 }]}
                            onPress={handleSubmitReview}
                            disabled={submittingReview}
                        >
                            {submittingReview
                                ? <ActivityIndicator color="#FFF" />
                                : <>
                                    <Ionicons name="star" size={18} color="#FFF" />
                                    <Text style={styles.acceptBtnText}>Publicar reseña</Text>
                                  </>
                            }
                        </TouchableOpacity>
                    </ScrollView>
                </KeyboardAvoidingView>
            </Modal>

            {/* ── MODAL: CHAT ── */}
            <Modal visible={isChatVisible} animationType="slide" presentationStyle="pageSheet">
                <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
                    {/* Chat Header */}
                    <View style={styles.chatHeader}>
                        <TouchableOpacity onPress={() => setIsChatVisible(false)}>
                            <Ionicons name="chevron-back" size={24} color={COLORS.text} />
                        </TouchableOpacity>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={styles.chatTitle}>
                                {userData?.role === 'caregiver'
                                    ? activeConversation?.ownerName
                                    : activeConversation?.caregiverName}
                            </Text>
                            <Text style={styles.chatSubtitle}>
                                {SERVICE_TYPES.find(s => s.value === activeConversation?.serviceType)?.label}
                                {' · '}{activeConversation?.startDate}
                            </Text>
                        </View>
                    </View>

                    {/* Messages */}
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        keyExtractor={item => item.id}
                        renderItem={renderMessage}
                        contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
                        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                        ListEmptyComponent={
                            <View style={{ alignItems: 'center', marginTop: 60 }}>
                                <Text style={{ fontSize: 44 }}>💬</Text>
                                <Text style={styles.emptyDesc}>Empieza la conversación</Text>
                            </View>
                        }
                    />

                    {/* Input */}
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                        <View style={styles.chatInputRow}>
                            <TextInput
                                style={styles.chatInput}
                                value={messageInput}
                                onChangeText={setMessageInput}
                                placeholder="Escribe un mensaje..."
                                placeholderTextColor={COLORS.textLight}
                                multiline
                            />
                            <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
                                <Ionicons name="send" size={20} color="#FFF" />
                            </TouchableOpacity>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 64 : 40, paddingBottom: 16,
        backgroundColor: '#FFF',
        borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    headerTitle: { fontSize: 26, fontWeight: '900', color: COLORS.text },
    roleChip: {
        backgroundColor: COLORS.primaryBg, paddingHorizontal: 12,
        paddingVertical: 6, borderRadius: 20,
    },
    roleChipText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
    tabBar: {
        flexDirection: 'row', backgroundColor: '#FFF',
        paddingHorizontal: 20, paddingVertical: 12, gap: 10,
        borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    tab: {
        paddingHorizontal: 18, paddingVertical: 9,
        borderRadius: 20, backgroundColor: COLORS.surface,
    },
    tabActive: { backgroundColor: COLORS.primary },
    tabLabel: { fontSize: 14, fontWeight: '700', color: COLORS.textLight },
    tabLabelActive: { color: '#FFF' },
    listContent: { padding: 16, paddingBottom: 100 },

    // Reservation Card
    resCard: {
        backgroundColor: '#FFF', borderRadius: 20, padding: 18, marginBottom: 14,
        shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    },
    resCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    resAvatarBox: {
        width: 46, height: 46, borderRadius: 23,
        backgroundColor: COLORS.primaryBg, justifyContent: 'center', alignItems: 'center',
    },
    resName: { fontSize: 16, fontWeight: '800', color: COLORS.text },
    resService: { fontSize: 13, color: COLORS.textLight, fontWeight: '500', marginTop: 1 },
    statusChip: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    },
    statusLabel: { fontSize: 12, fontWeight: '700' },
    resDatesRow: { flexDirection: 'row', marginBottom: 8 },
    resDateItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    resDateText: { fontSize: 13, color: COLORS.textLight, fontWeight: '600' },
    resNotes: {
        fontSize: 13, color: COLORS.text, backgroundColor: COLORS.surface,
        borderRadius: 10, padding: 10, marginBottom: 12, lineHeight: 18,
    },
    resActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
    msgBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: COLORS.secondaryLight, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
    },
    msgBtnText: { color: COLORS.secondary, fontWeight: '700', fontSize: 13 },
    acceptBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
    },
    acceptBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
    cancelBtn: {
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
        backgroundColor: COLORS.dangerLight,
    },
    cancelBtnText: { color: COLORS.danger, fontWeight: '700', fontSize: 13 },

    // Conversation
    convoRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#FFF', padding: 16, borderRadius: 18,
        marginBottom: 10,
        shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
    },
    convoAvatar: {
        width: 48, height: 48, borderRadius: 24,
        backgroundColor: COLORS.primaryBg, justifyContent: 'center', alignItems: 'center',
    },
    convoName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
    convoService: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },

    // Empty
    emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 30 },
    emptyTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginTop: 14 },
    emptyDesc: { fontSize: 14, color: COLORS.textLight, textAlign: 'center', marginTop: 8, lineHeight: 20 },

    // FAB
    fab: {
        position: 'absolute', bottom: 30, right: 24,
        width: 58, height: 58, borderRadius: 29,
        backgroundColor: COLORS.primary,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: COLORS.primary, shadowOpacity: 0.4,
        shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8,
    },

    // New Reservation Modal
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 22, paddingTop: Platform.OS === 'ios' ? 56 : 22,
        backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    modalTitle: { fontSize: 22, fontWeight: '900', color: COLORS.text },
    modalBody: { padding: 20 },
    formLabel: {
        fontSize: 11, fontWeight: '700', color: COLORS.textLight,
        textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 18, marginBottom: 8,
    },
    formInput: {
        backgroundColor: '#FFF', borderWidth: 1.5, borderColor: COLORS.border,
        borderRadius: 14, paddingHorizontal: 15, paddingVertical: 12,
        fontSize: 15, color: COLORS.text,
    },
    serviceGrid: { flexDirection: 'row', gap: 10 },
    serviceChip: {
        flex: 1, paddingVertical: 12, borderRadius: 14,
        borderWidth: 2, borderColor: COLORS.border,
        backgroundColor: '#FFF', alignItems: 'center',
    },
    serviceChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryBg },
    serviceChipText: { fontSize: 13, fontWeight: '700', color: COLORS.text },
    submitBtn: {
        backgroundColor: COLORS.primary, borderRadius: 16,
        paddingVertical: 16, alignItems: 'center', marginTop: 28,
    },
    submitBtnText: { color: '#FFF', fontWeight: '800', fontSize: 16 },

    // Chat
    chatHeader: {
        flexDirection: 'row', alignItems: 'center',
        padding: 18, paddingTop: Platform.OS === 'ios' ? 56 : 18,
        backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    chatTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
    chatSubtitle: { fontSize: 12, color: COLORS.textLight, marginTop: 1 },
    messageBubbleWrap: { marginBottom: 10 },
    bubbleLeft: { alignItems: 'flex-start' },
    bubbleRight: { alignItems: 'flex-end' },
    messageBubble: {
        maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10,
    },
    bubbleMine: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
    bubbleOther: { backgroundColor: '#FFF', borderBottomLeftRadius: 4, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 5 },
    bubbleText: { fontSize: 15, color: COLORS.text, lineHeight: 21 },
    bubbleTime: { fontSize: 10, color: COLORS.textLight, marginTop: 4, textAlign: 'right' },
    chatInputRow: {
        flexDirection: 'row', alignItems: 'flex-end', gap: 10,
        padding: 12, paddingBottom: Platform.OS === 'ios' ? 30 : 12,
        backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: COLORS.border,
    },
    chatInput: {
        flex: 1, backgroundColor: COLORS.surface, borderRadius: 22,
        paddingHorizontal: 16, paddingVertical: 10,
        fontSize: 15, color: COLORS.text, maxHeight: 100,
    },
    sendBtn: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
    },

    // New action buttons
    payBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: COLORS.success, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
    },
    qrBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: COLORS.primaryBg, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
        borderWidth: 1.5, borderColor: COLORS.primary,
    },
    qrBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
    qrScanBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: COLORS.secondary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
    },
    completeBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: COLORS.success, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
    },

    // QR Modal
    qrOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },
    qrSheet: {
        backgroundColor: '#FFF', borderRadius: 28, padding: 28,
        alignItems: 'center', width: '85%',
        shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 10,
    },
    qrTitle: { fontSize: 22, fontWeight: '900', color: COLORS.text, marginBottom: 6 },
    qrDesc: { fontSize: 14, color: COLORS.textLight, textAlign: 'center', marginBottom: 22 },
    qrBox: {
        backgroundColor: '#FFF', borderRadius: 16, padding: 16,
        shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, elevation: 3,
    },
    qrMeta: { marginTop: 18, fontSize: 13, color: COLORS.textLight, fontWeight: '600' },
    closeQrBtn: {
        marginTop: 22, backgroundColor: COLORS.primary,
        paddingHorizontal: 36, paddingVertical: 13, borderRadius: 16,
    },
    closeQrBtnText: { color: '#FFF', fontWeight: '800', fontSize: 15 },

    // Scanner
    scannerHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 30, paddingBottom: 16,
        backgroundColor: '#000',
    },
    scannerTitle: { fontSize: 17, fontWeight: '800', color: '#FFF' },
    permissionBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
    permissionText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
    permissionBtn: {
        backgroundColor: COLORS.primary, paddingHorizontal: 28, paddingVertical: 13, borderRadius: 16,
    },
    permissionBtnText: { color: '#FFF', fontWeight: '800', fontSize: 15 },

    // Review
    reviewedBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: COLORS.secondaryLight,
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
        alignSelf: 'flex-start', marginTop: 4,
    },
    reviewedText: { fontSize: 13, fontWeight: '700', color: COLORS.secondary },
});
