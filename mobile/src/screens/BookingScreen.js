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
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { auth, db } from '../config/firebase';
import {
    collection, query, where, onSnapshot, addDoc,
    doc, updateDoc, serverTimestamp, getDocs, getDoc, orderBy, increment, deleteDoc,
} from 'firebase/firestore';
import { createNotification, generateUniqueId } from '../utils/notificationHelpers';
import { useSafeStripe } from '../config/stripe';

const SERVER_URL = 'http://localhost:3000';

// ─────────────────────────────────────────────────
// STATUS CONFIG
// ─────────────────────────────────────────────────
const STATUS = {
    pendiente:  { label: 'Pendiente',   bg: '#FEF3C7', color: '#D97706', icon: 'time-outline' },
    aceptada:   { label: 'Aceptada',    bg: '#DCFCE7', color: '#16A34A', icon: 'checkmark-circle-outline' },
    activa:     { label: 'Activa',      bg: '#ECFDF5', color: '#1a7a4c', icon: 'radio-button-on-outline' },
    cancelada:  { label: 'Cancelada',   bg: '#F3F4F6', color: '#9CA3AF', icon: 'close-circle-outline' },
    completada: { label: 'Completada',  bg: '#E0F2FE', color: '#0891b2', icon: 'ribbon-outline' },
};

const SERVICE_TYPES = [
    { value: 'walking', label: '🚶 Paseo',     icon: 'walk-outline' },
    { value: 'hotel',   label: '🏨 Hotel',     icon: 'home-outline' },
    { value: 'daycare', label: '☀️ Guardería', icon: 'sunny-outline' },
];

const MAX_WALK  = 5;
const MAX_HOTEL = 3;

export default function BookingScreen() {
    const { userData } = useContext(AuthContext);
    const { theme, isDarkMode } = useContext(ThemeContext);
    const { initPaymentSheet, presentPaymentSheet } = useSafeStripe();

    const [activeTab, setActiveTab]           = useState('reservations');
    const [reservations, setReservations]     = useState([]);
    const [conversations, setConversations]   = useState([]);
    const [loading, setLoading]               = useState(true);
    const [isChatVisible, setIsChatVisible]   = useState(false);
    const [activeConversation, setActiveConversation] = useState(null);
    const [messages, setMessages]             = useState([]);
    const [messageInput, setMessageInput]     = useState('');
    const flatListRef = useRef(null);

    // Detail modal
    const [detailRes, setDetailRes]   = useState(null);

    // QR state
    const [isQrModalVisible, setIsQrModalVisible] = useState(false);
    const [qrBooking, setQrBooking]               = useState(null);
    const [isScannerVisible, setIsScannerVisible] = useState(false);
    const [cameraScanned, setCameraScanned]       = useState(false);
    const [permission, requestPermission]         = useCameraPermissions();

    // Review state
    const [isReviewModalVisible, setIsReviewModalVisible] = useState(false);
    const [reviewTarget, setReviewTarget]   = useState(null);
    const [reviewRating, setReviewRating]   = useState(5);
    const [reviewText, setReviewText]       = useState('');
    const [submittingReview, setSubmittingReview] = useState(false);

    // ─────────────────────────────────────────────────
    // FIREBASE: Fetch reservations
    // ─────────────────────────────────────────────────
    useEffect(() => {
        if (!auth.currentUser) { setLoading(false); return; }
        const isCaregiver = userData?.role === 'caregiver';
        const field = isCaregiver ? 'caregiverUid' : 'ownerUid';
        const q = query(collection(db, 'reservations'), where(field, '==', auth.currentUser.uid));

        const unsub = onSnapshot(q, (snap) => {
            const data = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
            setReservations(data);
            setConversations(data.filter(r => r.status !== 'cancelada'));
            setLoading(false);
        }, () => setLoading(false));

        return () => unsub();
    }, [userData?.role]);

    // ─────────────────────────────────────────────────
    // FIREBASE: Messages
    // ─────────────────────────────────────────────────
    useEffect(() => {
        if (!activeConversation) return;
        const q = query(
            collection(db, `messages/${activeConversation.id}/thread`),
            orderBy('timestamp', 'asc')
        );
        const unsub = onSnapshot(q, snap =>
            setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        );
        return () => unsub();
    }, [activeConversation]);

    // ─────────────────────────────────────────────────
    // CAPACITY CHECK
    // ─────────────────────────────────────────────────
    const checkCapacity = async (caregiverId, serviceType) => {
        const maxLimit = serviceType === 'walking' ? MAX_WALK : MAX_HOTEL;
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
    // ACCEPT RESERVATION
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
                status: 'aceptada', confirmedAt: serverTimestamp(),
            });
            await createNotification(reservation.ownerUid, {
                type: 'booking_confirmed',
                bookingId: reservation.id,
                title: '¡Reserva aceptada! 🎉',
                body: `${userData?.fullName || 'El cuidador'} aceptó tu reserva. ¡Completa el pago!`,
                icon: 'checkmark-circle-outline',
                iconBg: '#DCFCE7', iconColor: '#16A34A',
            });
            Alert.alert('¡Reserva aceptada! 🎉');
        } catch { Alert.alert('Error', 'No se pudo aceptar la reserva.'); }
    };

    // ─────────────────────────────────────────────────
    // PAYMENT
    // ─────────────────────────────────────────────────
    const handlePayment = async (reservation) => {
        const price = reservation.totalPrice ?? 0;
        if (price <= 0) { Alert.alert('Error', 'El precio de la reserva no es válido.'); return; }

        try {
            const response = await fetch(`${SERVER_URL}/api/payment-intent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: price, currency: 'eur' }),
            });
            const { clientSecret, success } = await response.json();

            if (!success || !clientSecret) {
                Alert.alert('⚠️ Modo demo', `¿Simular pago de €${price.toFixed(2)}?`, [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Simular', onPress: () => confirmPayment(reservation) },
                ]);
                return;
            }

            const { error: initError } = await initPaymentSheet({
                paymentIntentClientSecret: clientSecret,
                merchantDisplayName: 'PawMate', style: 'automatic',
            });
            if (initError) { Alert.alert('Error de pago', initError.message); return; }

            const { error: payError } = await presentPaymentSheet();
            if (payError) {
                if (payError.code !== 'Canceled') Alert.alert('Pago fallido', payError.message);
                return;
            }
            await confirmPayment(reservation);
        } catch {
            Alert.alert('⚠️ Sin conexión', `¿Simular pago de €${price.toFixed(2)}?`, [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Simular', onPress: () => confirmPayment(reservation) },
            ]);
        }
    };

    const confirmPayment = async (reservation) => {
        try {
            const qrCode = generateUniqueId();
            await updateDoc(doc(db, 'reservations', reservation.id), {
                status: 'activa', qrCode, activatedAt: serverTimestamp(),
            });
            await createNotification(reservation.caregiverUid, {
                type: 'booking_active',
                bookingId: reservation.id,
                title: '📱 Reserva activa — escanea el QR',
                body: `${reservation.ownerName} ha pagado. Escanea el QR cuando llegue.`,
                icon: 'qr-code-outline',
                iconBg: '#ECFDF5', iconColor: '#1a7a4c',
            });
            setQrBooking({ ...reservation, status: 'activa', qrCode });
            setIsQrModalVisible(true);
            setDetailRes(null);
        } catch { Alert.alert('Error', 'No se pudo activar la reserva.'); }
    };

    // ─────────────────────────────────────────────────
    // COMPLETE SERVICE
    // ─────────────────────────────────────────────────
    const handleComplete = async (reservation) => {
        Alert.alert('Marcar como completado', '¿Confirmas que el servicio ha finalizado?', [
            { text: 'No', style: 'cancel' },
            {
                text: 'Sí, completado',
                onPress: async () => {
                    try {
                        await updateDoc(doc(db, 'reservations', reservation.id), {
                            status: 'completada', completedAt: serverTimestamp(),
                        });
                        await createNotification(reservation.ownerUid, {
                            type: 'booking_completed',
                            bookingId: reservation.id,
                            title: '✅ Servicio completado',
                            body: `${userData?.fullName || 'El cuidador'} marcó el servicio como completado.`,
                            icon: 'ribbon-outline',
                            iconBg: '#E0F2FE', iconColor: '#0891b2',
                        });
                        setDetailRes(null);
                    } catch { Alert.alert('Error', 'No se pudo completar la reserva.'); }
                },
            },
        ]);
    };

    // ─────────────────────────────────────────────────
    // QR SCANNER
    // ─────────────────────────────────────────────────
    const handleQrScanned = async ({ data }) => {
        if (cameraScanned) return;
        setCameraScanned(true);
        const q = query(
            collection(db, 'reservations'),
            where('caregiverUid', '==', auth.currentUser.uid),
            where('qrCode', '==', data),
            where('status', '==', 'activa')
        );
        try {
            const snap = await getDocs(q);
            if (snap.empty) {
                Alert.alert('QR inválido', 'No se encontró ninguna reserva activa.', [
                    { text: 'OK', onPress: () => setCameraScanned(false) },
                ]);
                return;
            }
            setIsScannerVisible(false);
            Alert.alert('✅ Check-in confirmado', '¡El servicio ya está activo!');
        } catch {
            Alert.alert('Error', 'No se pudo verificar el QR.');
            setCameraScanned(false);
        }
    };

    // ─────────────────────────────────────────────────
    // CANCEL / DELETE
    // ─────────────────────────────────────────────────
    const handleCancelReservation = (reservationId) => {
        Alert.alert('Cancelar reserva', '¿Estás seguro?', [
            { text: 'No', style: 'cancel' },
            {
                text: 'Sí, cancelar', style: 'destructive',
                onPress: async () => {
                    try {
                        await updateDoc(doc(db, 'reservations', reservationId), { status: 'cancelada' });
                        setDetailRes(null);
                    } catch { Alert.alert('Error', 'No se pudo cancelar.'); }
                },
            },
        ]);
    };

    const handleDeleteReservation = (reservationId) => {
        Alert.alert('Eliminar reserva', '¿Eliminar definitivamente?', [
            { text: 'No', style: 'cancel' },
            {
                text: 'Eliminar', style: 'destructive',
                onPress: async () => {
                    try {
                        await deleteDoc(doc(db, 'reservations', reservationId));
                        setDetailRes(null);
                    } catch { Alert.alert('Error', 'No se pudo eliminar.'); }
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
            await updateDoc(doc(db, 'reservations', reviewTarget.id), { reviewedByOwner: true });
            setIsReviewModalVisible(false);
            setReviewTarget(null);
            setReviewText('');
            setReviewRating(5);
            Alert.alert('¡Gracias! 🌟', 'Tu reseña ha sido publicada.');
        } catch { Alert.alert('Error', 'No se pudo enviar la reseña.'); }
        finally { setSubmittingReview(false); }
    };

    // ─────────────────────────────────────────────────
    // SEND MESSAGE
    // ─────────────────────────────────────────────────
    const sendMessage = async () => {
        if (!messageInput.trim() || !activeConversation) return;
        const text = messageInput.trim();
        try {
            await addDoc(collection(db, `messages/${activeConversation.id}/thread`), {
                senderId: auth.currentUser.uid,
                senderName: userData?.fullName || 'Usuario',
                text,
                timestamp: serverTimestamp(),
                read: false,
            });
            setMessageInput('');
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        } catch { Alert.alert('Error', 'No se pudo enviar el mensaje.'); }
    };

    // ─────────────────────────────────────────────────
    // RENDER HELPERS
    // ─────────────────────────────────────────────────
    const DetailRow = ({ icon, label, value }) => (
        <View style={s.detailRow}>
            <View style={[s.detailIconWrap, { backgroundColor: theme.primaryBg }]}>
                <Ionicons name={icon} size={16} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={[s.detailLabel, { color: theme.textSecondary }]}>{label}</Text>
                <Text style={[s.detailValue, { color: theme.text }]}>{value}</Text>
            </View>
        </View>
    );

    // ─────────────────────────────────────────────────
    // RENDER: Reservation Card (compact, tappable)
    // ─────────────────────────────────────────────────
    const renderReservationCard = ({ item: res }) => {
        const st = STATUS[res.status] || STATUS.pendiente;
        const isCaregiver = userData?.role === 'caregiver';
        const serviceLbl = SERVICE_TYPES.find(s => s.value === res.serviceType)?.label || res.serviceType;
        const isCancelled = res.status === 'cancelada';

        return (
            <TouchableOpacity
                style={[
                    s.resCard,
                    { backgroundColor: theme.cardBackground },
                    isCancelled && { opacity: 0.7 },
                ]}
                onPress={() => setDetailRes(res)}
                activeOpacity={0.8}
            >
                <View style={s.resCardHeader}>
                    <View style={[s.resAvatarBox, { backgroundColor: theme.primaryBg }]}>
                        <Ionicons name="person" size={22} color={theme.primary} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[s.resName, { color: theme.text }]}>
                            {isCaregiver ? res.ownerName : res.caregiverName}
                        </Text>
                        <Text style={[s.resService, { color: theme.textSecondary }]}>{serviceLbl}</Text>
                    </View>
                    <View style={[s.statusChip, { backgroundColor: isDarkMode ? theme.primaryBg : st.bg }]}>
                        <Ionicons name={st.icon} size={12} color={isDarkMode ? theme.primary : st.color} />
                        <Text style={[s.statusLabel, { color: isDarkMode ? theme.primary : st.color }]}>{st.label}</Text>
                    </View>
                </View>

                <View style={s.resDatesRow}>
                    <Ionicons name="calendar-outline" size={13} color={theme.textSecondary} />
                    <Text style={[s.resDateText, { color: theme.textSecondary }]}>
                        {res.startDate}{res.endDate && res.endDate !== res.startDate ? ` → ${res.endDate}` : ''}
                    </Text>
                </View>

                {/* Quick actions row (only for non-cancelled) */}
                <View style={s.resQuickActions}>
                    {!isCancelled && (
                        <TouchableOpacity
                            style={[s.quickBtn, { backgroundColor: theme.primaryBg }]}
                            onPress={() => { setActiveConversation(res); setIsChatVisible(true); }}
                        >
                            <Ionicons name="chatbubble-outline" size={14} color={theme.primary} />
                            <Text style={[s.quickBtnText, { color: theme.primary }]}>Chat</Text>
                        </TouchableOpacity>
                    )}
                    {isCancelled && (
                        <TouchableOpacity
                            style={[s.quickBtn, { backgroundColor: '#FEE2E2' }]}
                            onPress={() => handleDeleteReservation(res.id)}
                        >
                            <Ionicons name="trash-outline" size={14} color="#EF4444" />
                            <Text style={[s.quickBtnText, { color: '#EF4444' }]}>Eliminar</Text>
                        </TouchableOpacity>
                    )}
                    <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} style={{ marginLeft: 'auto' }} />
                </View>
            </TouchableOpacity>
        );
    };

    // ─────────────────────────────────────────────────
    // RENDER: Chat Message
    // ─────────────────────────────────────────────────
    const renderMessage = ({ item }) => {
        const isMe = item.senderId === auth.currentUser?.uid;
        return (
            <View style={[s.messageWrap, isMe ? s.bubbleRight : s.bubbleLeft]}>
                <View style={[s.bubble, isMe ? s.bubbleMine : [s.bubbleOther, { backgroundColor: theme.cardBackground }]]}>
                    <Text style={[s.bubbleText, { color: isMe ? '#FFF' : theme.text }]}>{item.text}</Text>
                    {item.timestamp?.toDate && (
                        <Text style={[s.bubbleTime, { color: isMe ? 'rgba(255,255,255,0.7)' : theme.textSecondary }]}>
                            {item.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    )}
                </View>
            </View>
        );
    };

    // ─────────────────────────────────────────────────
    // LOADING
    // ─────────────────────────────────────────────────
    if (loading) {
        return (
            <View style={[s.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    // ─────────────────────────────────────────────────
    // MAIN RENDER
    // ─────────────────────────────────────────────────
    return (
        <View style={[s.container, { backgroundColor: theme.background }]}>
            <StatusBar style={isDarkMode ? 'light' : 'dark'} />

            {/* Header */}
            <View style={[s.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                <Text style={[s.headerTitle, { color: theme.text }]}>Reservas</Text>
                <View style={[s.roleChip, { backgroundColor: theme.primaryBg }]}>
                    <Text style={[s.roleChipText, { color: theme.primary }]}>
                        {userData?.role === 'caregiver' ? '🛡️ Cuidador' : '🐾 Dueño'}
                    </Text>
                </View>
            </View>

            {/* Tab Bar */}
            <View style={[s.tabBar, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                {[
                    { key: 'reservations', label: '📅 Reservas' },
                    { key: 'messages',     label: '💬 Mensajes' },
                ].map(tab => (
                    <TouchableOpacity
                        key={tab.key}
                        style={[s.tab, { backgroundColor: activeTab === tab.key ? theme.primary : theme.primaryBg }]}
                        onPress={() => setActiveTab(tab.key)}
                    >
                        <Text style={[s.tabLabel, { color: activeTab === tab.key ? '#FFF' : theme.textSecondary }]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* RESERVATIONS TAB */}
            {activeTab === 'reservations' && (
                <FlatList
                    data={reservations}
                    keyExtractor={i => i.id}
                    renderItem={renderReservationCard}
                    contentContainerStyle={s.listContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={s.emptyState}>
                            <Text style={{ fontSize: 56 }}>📅</Text>
                            <Text style={[s.emptyTitle, { color: theme.text }]}>Sin reservas</Text>
                            <Text style={[s.emptyDesc, { color: theme.textSecondary }]}>
                                {userData?.role === 'caregiver'
                                    ? 'Cuando los dueños te contacten, sus solicitudes aparecerán aquí.'
                                    : 'Toca un cuidador en el mapa y solicita una reserva.'
                                }
                            </Text>
                        </View>
                    }
                />
            )}

            {/* MESSAGES TAB */}
            {activeTab === 'messages' && (
                <FlatList
                    data={conversations}
                    keyExtractor={i => i.id}
                    contentContainerStyle={s.listContent}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={
                        <View style={s.emptyState}>
                            <Text style={{ fontSize: 56 }}>💬</Text>
                            <Text style={[s.emptyTitle, { color: theme.text }]}>Sin mensajes</Text>
                            <Text style={[s.emptyDesc, { color: theme.textSecondary }]}>Los chats por reserva aparecerán aquí.</Text>
                        </View>
                    }
                    renderItem={({ item: res }) => {
                        const serviceLbl = SERVICE_TYPES.find(s => s.value === res.serviceType)?.label || res.serviceType;
                        const isCaregiver = userData?.role === 'caregiver';
                        return (
                            <TouchableOpacity
                                style={[s.convoRow, { backgroundColor: theme.cardBackground }]}
                                onPress={() => { setActiveConversation(res); setIsChatVisible(true); }}
                            >
                                <View style={[s.convoAvatar, { backgroundColor: theme.primaryBg }]}>
                                    <Ionicons name="person" size={22} color={theme.primary} />
                                </View>
                                <View style={{ flex: 1, marginLeft: 14 }}>
                                    <Text style={[s.convoName, { color: theme.text }]}>
                                        {isCaregiver ? res.ownerName : res.caregiverName}
                                    </Text>
                                    <Text style={[s.convoService, { color: theme.textSecondary }]}>
                                        {serviceLbl} · {res.startDate}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                            </TouchableOpacity>
                        );
                    }}
                />
            )}

            {/* ════════════════════════════════════════
                MODAL: RESERVATION DETAIL
            ════════════════════════════════════════ */}
            <Modal
                visible={!!detailRes}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setDetailRes(null)}
            >
                {detailRes && (() => {
                    const isCaregiver = userData?.role === 'caregiver';
                    const st = STATUS[detailRes.status] || STATUS.pendiente;
                    const serviceLbl = SERVICE_TYPES.find(s => s.value === detailRes.serviceType)?.label || detailRes.serviceType;
                    const isCancelled = detailRes.status === 'cancelada';

                    return (
                        <View style={{ flex: 1, backgroundColor: theme.background }}>
                            {/* Header */}
                            <View style={[s.modalHeader, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                                <TouchableOpacity onPress={() => setDetailRes(null)}>
                                    <Ionicons name="close" size={24} color={theme.text} />
                                </TouchableOpacity>
                                <Text style={[s.modalTitle, { color: theme.text }]}>Detalle de reserva</Text>
                                <View style={{ width: 28 }} />
                            </View>

                            <ScrollView contentContainerStyle={{ padding: 20 }}>
                                {/* Status banner */}
                                <View style={[s.statusBanner, { backgroundColor: isDarkMode ? theme.primaryBg : st.bg }]}>
                                    <Ionicons name={st.icon} size={22} color={isDarkMode ? theme.primary : st.color} />
                                    <Text style={[s.statusBannerText, { color: isDarkMode ? theme.primary : st.color }]}>
                                        {st.label}
                                    </Text>
                                </View>

                                {/* Info card */}
                                <View style={[s.infoCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                                    <DetailRow icon="person-outline"    label="Participante"
                                        value={isCaregiver ? detailRes.ownerName : detailRes.caregiverName} />
                                    <View style={[s.detailDivider, { backgroundColor: theme.border }]} />
                                    <DetailRow icon="paw-outline"       label="Servicio"     value={serviceLbl} />
                                    <View style={[s.detailDivider, { backgroundColor: theme.border }]} />
                                    <DetailRow icon="calendar-outline"  label="Fecha inicio" value={detailRes.startDate || '—'} />
                                    {detailRes.endDate && detailRes.endDate !== detailRes.startDate && <>
                                        <View style={[s.detailDivider, { backgroundColor: theme.border }]} />
                                        <DetailRow icon="calendar-outline" label="Fecha fin" value={detailRes.endDate} />
                                    </>}
                                    {detailRes.totalPrice > 0 && <>
                                        <View style={[s.detailDivider, { backgroundColor: theme.border }]} />
                                        <DetailRow icon="card-outline" label="Precio total" value={`€${detailRes.totalPrice.toFixed(2)}`} />
                                    </>}
                                    {detailRes.petNames?.length > 0 && <>
                                        <View style={[s.detailDivider, { backgroundColor: theme.border }]} />
                                        <DetailRow icon="heart-outline" label="Mascotas" value={detailRes.petNames.join(', ')} />
                                    </>}
                                    {detailRes.notes ? <>
                                        <View style={[s.detailDivider, { backgroundColor: theme.border }]} />
                                        <DetailRow icon="document-text-outline" label="Notas" value={detailRes.notes} />
                                    </> : null}
                                </View>

                                {/* CANCELLED: only show delete */}
                                {isCancelled && (
                                    <TouchableOpacity
                                        style={[s.actionBtn, { backgroundColor: '#FEE2E2', marginTop: 20 }]}
                                        onPress={() => handleDeleteReservation(detailRes.id)}
                                    >
                                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                                        <Text style={[s.actionBtnText, { color: '#EF4444' }]}>Eliminar reserva</Text>
                                    </TouchableOpacity>
                                )}

                                {/* NOT CANCELLED: full action set */}
                                {!isCancelled && (
                                    <View style={{ gap: 12, marginTop: 20 }}>
                                        {/* Chat button */}
                                        <TouchableOpacity
                                            style={[s.actionBtn, { backgroundColor: theme.primaryBg }]}
                                            onPress={() => {
                                                setDetailRes(null);
                                                setActiveConversation(detailRes);
                                                setIsChatVisible(true);
                                            }}
                                        >
                                            <Ionicons name="chatbubble-outline" size={18} color={theme.primary} />
                                            <Text style={[s.actionBtnText, { color: theme.primary }]}>Abrir chat</Text>
                                        </TouchableOpacity>

                                        {/* CAREGIVER: pending → accept/reject */}
                                        {isCaregiver && detailRes.status === 'pendiente' && (
                                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                                <TouchableOpacity
                                                    style={[s.actionBtn, { flex: 1, backgroundColor: theme.primary }]}
                                                    onPress={() => { handleAcceptReservation(detailRes); setDetailRes(null); }}
                                                >
                                                    <Ionicons name="checkmark" size={18} color="#FFF" />
                                                    <Text style={[s.actionBtnText, { color: '#FFF' }]}>Aceptar</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[s.actionBtn, { flex: 1, backgroundColor: '#FEE2E2' }]}
                                                    onPress={() => handleCancelReservation(detailRes.id)}
                                                >
                                                    <Text style={[s.actionBtnText, { color: '#EF4444' }]}>Rechazar</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}

                                        {/* CAREGIVER: aceptada → scan QR */}
                                        {isCaregiver && detailRes.status === 'aceptada' && (
                                            <TouchableOpacity
                                                style={[s.actionBtn, { backgroundColor: '#0891b2' }]}
                                                onPress={() => { setCameraScanned(false); setIsScannerVisible(true); setDetailRes(null); }}
                                            >
                                                <Ionicons name="qr-code-outline" size={18} color="#FFF" />
                                                <Text style={[s.actionBtnText, { color: '#FFF' }]}>Escanear QR del dueño</Text>
                                            </TouchableOpacity>
                                        )}

                                        {/* CAREGIVER: activa → complete */}
                                        {isCaregiver && detailRes.status === 'activa' && (
                                            <TouchableOpacity
                                                style={[s.actionBtn, { backgroundColor: '#16A34A' }]}
                                                onPress={() => handleComplete(detailRes)}
                                            >
                                                <Ionicons name="checkmark-done-outline" size={18} color="#FFF" />
                                                <Text style={[s.actionBtnText, { color: '#FFF' }]}>Marcar como completado</Text>
                                            </TouchableOpacity>
                                        )}

                                        {/* OWNER: pendiente → cancel */}
                                        {!isCaregiver && detailRes.status === 'pendiente' && (
                                            <TouchableOpacity
                                                style={[s.actionBtn, { backgroundColor: '#FEE2E2' }]}
                                                onPress={() => handleCancelReservation(detailRes.id)}
                                            >
                                                <Text style={[s.actionBtnText, { color: '#EF4444' }]}>Cancelar reserva</Text>
                                            </TouchableOpacity>
                                        )}

                                        {/* OWNER: aceptada → pay */}
                                        {!isCaregiver && detailRes.status === 'aceptada' && (
                                            <TouchableOpacity
                                                style={[s.actionBtn, { backgroundColor: '#16A34A' }]}
                                                onPress={() => handlePayment(detailRes)}
                                            >
                                                <Ionicons name="card-outline" size={18} color="#FFF" />
                                                <Text style={[s.actionBtnText, { color: '#FFF' }]}>Pagar y obtener QR</Text>
                                            </TouchableOpacity>
                                        )}

                                        {/* OWNER: activa → show QR */}
                                        {!isCaregiver && detailRes.status === 'activa' && detailRes.qrCode && (
                                            <TouchableOpacity
                                                style={[s.actionBtn, { backgroundColor: theme.primaryBg, borderWidth: 1.5, borderColor: theme.primary }]}
                                                onPress={() => { setQrBooking(detailRes); setIsQrModalVisible(true); setDetailRes(null); }}
                                            >
                                                <Ionicons name="qr-code-outline" size={18} color={theme.primary} />
                                                <Text style={[s.actionBtnText, { color: theme.primary }]}>Ver mi QR</Text>
                                            </TouchableOpacity>
                                        )}

                                        {/* OWNER: completada → review */}
                                        {!isCaregiver && detailRes.status === 'completada' && !detailRes.reviewedByOwner && (
                                            <TouchableOpacity
                                                style={[s.actionBtn, { backgroundColor: '#FEF3C7' }]}
                                                onPress={() => {
                                                    setReviewTarget(detailRes);
                                                    setReviewRating(5);
                                                    setReviewText('');
                                                    setIsReviewModalVisible(true);
                                                    setDetailRes(null);
                                                }}
                                            >
                                                <Ionicons name="star-outline" size={18} color="#D97706" />
                                                <Text style={[s.actionBtnText, { color: '#D97706' }]}>Dejar reseña</Text>
                                            </TouchableOpacity>
                                        )}
                                        {!isCaregiver && detailRes.status === 'completada' && detailRes.reviewedByOwner && (
                                            <View style={[s.actionBtn, { backgroundColor: '#E0F2FE' }]}>
                                                <Ionicons name="star" size={18} color="#0891b2" />
                                                <Text style={[s.actionBtnText, { color: '#0891b2' }]}>Ya has dejado reseña ✅</Text>
                                            </View>
                                        )}
                                    </View>
                                )}
                            </ScrollView>
                        </View>
                    );
                })()}
            </Modal>

            {/* ════════════════════════════════════════
                MODAL: QR CODE
            ════════════════════════════════════════ */}
            <Modal visible={isQrModalVisible} animationType="fade" transparent>
                <View style={s.qrOverlay}>
                    <View style={[s.qrSheet, { backgroundColor: theme.cardBackground }]}>
                        <Text style={[s.qrTitle, { color: theme.text }]}>📱 Tu código QR</Text>
                        <Text style={[s.qrDesc, { color: theme.textSecondary }]}>
                            Muéstraselo al cuidador para activar el servicio
                        </Text>
                        {qrBooking?.qrCode && (
                            <View style={[s.qrBox, { backgroundColor: '#FFF' }]}>
                                <QRCode value={qrBooking.qrCode} size={200} />
                            </View>
                        )}
                        <Text style={[s.qrMeta, { color: theme.textSecondary }]}>
                            {SERVICE_TYPES.find(s => s.value === qrBooking?.serviceType)?.label}
                            {'  ·  '}{qrBooking?.startDate}
                        </Text>
                        <TouchableOpacity style={[s.closeQrBtn, { backgroundColor: theme.primary }]} onPress={() => setIsQrModalVisible(false)}>
                            <Text style={s.closeQrBtnText}>Cerrar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ════════════════════════════════════════
                MODAL: QR SCANNER
            ════════════════════════════════════════ */}
            <Modal visible={isScannerVisible} animationType="slide" presentationStyle="fullScreen">
                <View style={{ flex: 1, backgroundColor: '#000' }}>
                    <View style={s.scannerHeader}>
                        <TouchableOpacity onPress={() => setIsScannerVisible(false)}>
                            <Ionicons name="close" size={28} color="#FFF" />
                        </TouchableOpacity>
                        <Text style={s.scannerTitle}>Escanear QR del dueño</Text>
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
                        <View style={s.permissionBox}>
                            <Ionicons name="camera-outline" size={60} color="#FFF" />
                            <Text style={s.permissionText}>Se necesita acceso a la cámara</Text>
                            <TouchableOpacity style={[s.permissionBtn, { backgroundColor: theme.primary }]} onPress={requestPermission}>
                                <Text style={s.permissionBtnText}>Permitir cámara</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </Modal>

            {/* ════════════════════════════════════════
                MODAL: REVIEW
            ════════════════════════════════════════ */}
            <Modal
                visible={isReviewModalVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setIsReviewModalVisible(false)}
            >
                <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.background }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                    <View style={[s.modalHeader, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                        <TouchableOpacity onPress={() => setIsReviewModalVisible(false)}>
                            <Ionicons name="close" size={24} color={theme.text} />
                        </TouchableOpacity>
                        <Text style={[s.modalTitle, { color: theme.text }]}>Dejar reseña</Text>
                        <View style={{ width: 28 }} />
                    </View>

                    <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text, textAlign: 'center' }}>
                            {reviewTarget?.caregiverName}
                        </Text>
                        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12 }}>
                            {[1, 2, 3, 4, 5].map(star => (
                                <TouchableOpacity key={star} onPress={() => setReviewRating(star)}>
                                    <Ionicons
                                        name={star <= reviewRating ? 'star' : 'star-outline'}
                                        size={38} color={star <= reviewRating ? '#F59E0B' : theme.textSecondary}
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>
                        <Text style={{ textAlign: 'center', color: theme.textSecondary, fontSize: 14 }}>
                            {['', '🙁 Pésimo', '😐 Regular', '🙂 Bueno', '😄 Muy bueno', '🌟 Excelente'][reviewRating]}
                        </Text>
                        <TextInput
                            style={[s.reviewInput, { backgroundColor: theme.cardBackground, color: theme.text, borderColor: theme.border }]}
                            multiline
                            value={reviewText}
                            onChangeText={setReviewText}
                            placeholder="Escribe tu comentario (opcional)..."
                            placeholderTextColor={theme.textSecondary}
                        />
                        <TouchableOpacity
                            style={[s.actionBtn, { backgroundColor: theme.primary, opacity: submittingReview ? 0.7 : 1 }]}
                            onPress={handleSubmitReview}
                            disabled={submittingReview}
                        >
                            {submittingReview
                                ? <ActivityIndicator color="#FFF" />
                                : <>
                                    <Ionicons name="star" size={18} color="#FFF" />
                                    <Text style={[s.actionBtnText, { color: '#FFF' }]}>Publicar reseña</Text>
                                </>
                            }
                        </TouchableOpacity>
                    </ScrollView>
                </KeyboardAvoidingView>
            </Modal>

            {/* ════════════════════════════════════════
                MODAL: CHAT
            ════════════════════════════════════════ */}
            <Modal visible={isChatVisible} animationType="slide" presentationStyle="pageSheet">
                <View style={{ flex: 1, backgroundColor: theme.background }}>
                    <View style={[s.chatHeader, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                        <TouchableOpacity onPress={() => setIsChatVisible(false)}>
                            <Ionicons name="chevron-back" size={24} color={theme.text} />
                        </TouchableOpacity>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={[s.chatTitle, { color: theme.text }]}>
                                {userData?.role === 'caregiver'
                                    ? activeConversation?.ownerName
                                    : activeConversation?.caregiverName}
                            </Text>
                            <Text style={[s.chatSubtitle, { color: theme.textSecondary }]}>
                                {SERVICE_TYPES.find(s => s.value === activeConversation?.serviceType)?.label}
                                {' · '}{activeConversation?.startDate}
                            </Text>
                        </View>
                    </View>
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        keyExtractor={i => i.id}
                        renderItem={renderMessage}
                        contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
                        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                        ListEmptyComponent={
                            <View style={{ alignItems: 'center', marginTop: 60 }}>
                                <Text style={{ fontSize: 44 }}>💬</Text>
                                <Text style={[s.emptyDesc, { color: theme.textSecondary }]}>Empieza la conversación</Text>
                            </View>
                        }
                    />
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                        <View style={[s.chatInputRow, { backgroundColor: theme.cardBackground, borderTopColor: theme.border }]}>
                            <TextInput
                                style={[s.chatInput, { backgroundColor: theme.background, color: theme.text }]}
                                value={messageInput}
                                onChangeText={setMessageInput}
                                placeholder="Escribe un mensaje..."
                                placeholderTextColor={theme.textSecondary}
                                multiline
                            />
                            <TouchableOpacity style={[s.sendBtn, { backgroundColor: theme.primary }]} onPress={sendMessage}>
                                <Ionicons name="send" size={20} color="#FFF" />
                            </TouchableOpacity>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </View>
    );
}

// ─────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────
const s = StyleSheet.create({
    container: { flex: 1 },

    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 64 : 40,
        paddingBottom: 16,
        borderBottomWidth: 1,
    },
    headerTitle: { fontSize: 26, fontWeight: '900' },
    roleChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    roleChipText: { fontSize: 13, fontWeight: '700' },

    tabBar: {
        flexDirection: 'row',
        paddingHorizontal: 16, paddingVertical: 12, gap: 10,
        borderBottomWidth: 1,
    },
    tab:      { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20, flex: 1, alignItems: 'center' },
    tabLabel: { fontSize: 14, fontWeight: '700' },

    listContent: { padding: 16, paddingBottom: 100 },

    // Reservation Card
    resCard: {
        borderRadius: 20, padding: 18, marginBottom: 14,
        shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    },
    resCardHeader:  { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    resAvatarBox:   { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' },
    resName:        { fontSize: 16, fontWeight: '800' },
    resService:     { fontSize: 13, fontWeight: '500', marginTop: 1 },
    statusChip:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
    statusLabel:    { fontSize: 12, fontWeight: '700' },
    resDatesRow:    { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 12 },
    resDateText:    { fontSize: 13, fontWeight: '600' },
    resQuickActions:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
    quickBtn:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12 },
    quickBtnText:   { fontSize: 13, fontWeight: '700' },

    // Detail modal
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 18, paddingTop: Platform.OS === 'ios' ? 56 : 18,
        borderBottomWidth: 1,
    },
    modalTitle:   { fontSize: 17, fontWeight: '800' },
    statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderRadius: 16, marginBottom: 16 },
    statusBannerText: { fontSize: 16, fontWeight: '800' },
    infoCard:     { borderRadius: 20, borderWidth: 1, overflow: 'hidden', marginBottom: 4 },
    detailRow:    { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 12 },
    detailIconWrap: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    detailLabel:  { fontSize: 11, fontWeight: '600', marginBottom: 2 },
    detailValue:  { fontSize: 15, fontWeight: '600' },
    detailDivider:{ height: 1, marginLeft: 60 },
    actionBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, paddingVertical: 15, borderRadius: 16,
    },
    actionBtnText: { fontSize: 15, fontWeight: '800' },

    // Conversations
    convoRow:    { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 18, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
    convoAvatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
    convoName:   { fontSize: 16, fontWeight: '700' },
    convoService:{ fontSize: 12, marginTop: 2 },

    // Empty
    emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 30 },
    emptyTitle: { fontSize: 20, fontWeight: '800', marginTop: 14 },
    emptyDesc:  { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },

    // QR Modal
    qrOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },
    qrSheet:   { borderRadius: 28, padding: 28, alignItems: 'center', width: '85%', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
    qrTitle:   { fontSize: 22, fontWeight: '900', marginBottom: 6 },
    qrDesc:    { fontSize: 14, textAlign: 'center', marginBottom: 22 },
    qrBox:     { borderRadius: 16, padding: 16, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 },
    qrMeta:    { marginTop: 18, fontSize: 13, fontWeight: '600' },
    closeQrBtn:      { marginTop: 22, paddingHorizontal: 36, paddingVertical: 13, borderRadius: 16 },
    closeQrBtnText:  { color: '#FFF', fontWeight: '800', fontSize: 15 },

    // Scanner
    scannerHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 30, paddingBottom: 16,
        backgroundColor: '#000',
    },
    scannerTitle:   { fontSize: 17, fontWeight: '800', color: '#FFF' },
    permissionBox:  { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
    permissionText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
    permissionBtn:  { paddingHorizontal: 28, paddingVertical: 13, borderRadius: 16 },
    permissionBtnText: { color: '#FFF', fontWeight: '800', fontSize: 15 },

    // Review
    reviewInput: { borderWidth: 1.5, borderRadius: 16, padding: 14, fontSize: 15, minHeight: 100, textAlignVertical: 'top' },

    // Chat
    chatHeader: {
        flexDirection: 'row', alignItems: 'center',
        padding: 18, paddingTop: Platform.OS === 'ios' ? 56 : 18,
        borderBottomWidth: 1,
    },
    chatTitle:    { fontSize: 17, fontWeight: '800' },
    chatSubtitle: { fontSize: 12, marginTop: 1 },
    messageWrap:  { marginBottom: 10 },
    bubbleLeft:   { alignItems: 'flex-start' },
    bubbleRight:  { alignItems: 'flex-end' },
    bubble:       { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
    bubbleMine:   { backgroundColor: '#1a7a4c', borderBottomRightRadius: 4 },
    bubbleOther:  { borderBottomLeftRadius: 4, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 5 },
    bubbleText:   { fontSize: 15, lineHeight: 21 },
    bubbleTime:   { fontSize: 10, marginTop: 4, textAlign: 'right' },
    chatInputRow: {
        flexDirection: 'row', alignItems: 'flex-end', gap: 10,
        padding: 12, paddingBottom: Platform.OS === 'ios' ? 30 : 12,
        borderTopWidth: 1,
    },
    chatInput: { flex: 1, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 100 },
    sendBtn:   { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
});
