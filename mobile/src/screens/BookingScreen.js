import React, { useState, useContext, useEffect, useRef } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity, ScrollView, FlatList,
    TextInput, ActivityIndicator, Alert, KeyboardAvoidingView,
    Platform, Modal, Image, Linking,
} from 'react-native';
import Icon from '../components/Icon';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';
import * as Location from 'expo-location';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { supabase } from '../config/supabase';
import { createNotification, generateUniqueId } from '../utils/notificationHelpers';
import { useSafeStripe, SafePlatformPay } from '../config/stripe';
import { useTranslation } from '../context/LanguageContext';
import { API_BASE_URL, notifyRatingRequest } from '../config/api';
import { useNavigation } from '@react-navigation/native';

// ─────────────────────────────────────────────────
// STATUS CONFIG
// ─────────────────────────────────────────────────
const STATUS = {
    pendiente:    { labelKey: 'bookings.pending',    bg: '#FEF3C7', color: '#D97706', icon: 'time-outline' },
    aceptada:     { labelKey: 'bookings.accepted',   bg: '#DCFCE7', color: '#16A34A', icon: 'checkmark-circle-outline' },
    activa:       { labelKey: 'bookings.active',     bg: '#ECFDF5', color: '#1a7a4c', icon: 'radio-button-on-outline' },
    in_progress:  { labelKey: 'bookings.inProgress', bg: '#DBEAFE', color: '#2563EB', icon: 'pulse-outline' },
    cancelada:    { labelKey: 'bookings.cancelled',  bg: '#F3F4F6', color: '#9CA3AF', icon: 'close-circle-outline' },
    completada:   { labelKey: 'bookings.completed',  bg: '#E0F2FE', color: '#0891b2', icon: 'ribbon-outline' },
};

const SERVICE_TYPES = [
    { value: 'walking', labelKey: 'services.walking', emoji: '', icon: 'walk-outline' },
    { value: 'hotel',   labelKey: 'services.hotel',   emoji: '', icon: 'home-outline' },
];

const MAX_WALK  = 5;
const MAX_HOTEL = 3;

export default function BookingScreen() {
    const { user, userData } = useContext(AuthContext);
    const { theme, isDarkMode } = useContext(ThemeContext);
    const { t } = useTranslation();
    const { initPaymentSheet, presentPaymentSheet, confirmPlatformPayPayment, isPlatformPaySupported } = useSafeStripe();
    const navigation = useNavigation();

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
    // FETCH RESERVATIONS
    // ─────────────────────────────────────────────────
    useEffect(() => {
        if (!user?.id) { setLoading(false); return; }
        const isCaregiver = userData?.role === 'caregiver';
        const field = isCaregiver ? 'caregiverId' : 'ownerId';
        
        const fetchReservations = async () => {
            const { data } = await supabase.from('reservations').select('*').eq(field, user.id).order('created_at', { ascending: false });
            if (data) {
                // Enrich with latest avatars from users table
                const otherIds = [...new Set(data.map(r => isCaregiver ? r.ownerId : r.caregiverId).filter(Boolean))];
                let avatarMap = {};
                if (otherIds.length > 0) {
                    const { data: users } = await supabase.from('users').select('id,avatar,photoURL').in('id', otherIds);
                    if (users) {
                        users.forEach(u => { avatarMap[u.id] = u.avatar || u.photoURL || null; });
                    }
                }
                // Enrich with latest pet names (so renames propagate)
                const allPetIds = [...new Set(data.flatMap(r => Array.isArray(r.petIds) ? r.petIds : (r.petId ? [r.petId] : [])).filter(Boolean))];
                let petNameMap = {};
                if (allPetIds.length > 0) {
                    const { data: petsRows } = await supabase.from('pets').select('id,name').in('id', allPetIds);
                    if (petsRows) petsRows.forEach(p => { petNameMap[p.id] = p.name; });
                }
                const enriched = data.map(r => {
                    const otherId = isCaregiver ? r.ownerId : r.caregiverId;
                    const freshAvatar = avatarMap[otherId] || null;
                    const ids = Array.isArray(r.petIds) ? r.petIds : (r.petId ? [r.petId] : []);
                    const freshNames = ids.map(id => petNameMap[id]).filter(Boolean);
                    const out = { ...r, petNames: freshNames.length > 0 ? freshNames : r.petNames };
                    if (isCaregiver) {
                        return { ...out, ownerAvatar: freshAvatar || r.ownerAvatar };
                    } else {
                        return { ...out, caregiverAvatar: freshAvatar || r.caregiverAvatar };
                    }
                });
                setReservations(enriched);
                setConversations(enriched.filter(r => r.status !== 'cancelada'));
            }
            setLoading(false);
        };
        fetchReservations();
        
        const channelName = `reservations_bs_${user.id}_${Date.now()}`;
        const channel = supabase.channel(channelName)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations', filter: `${field}=eq.${user.id}` }, fetchReservations)
            .subscribe();
            
        return () => { supabase.removeChannel(channel); };
    }, [userData?.role, user?.id]);

    // ─────────────────────────────────────────────────
    // FETCH MESSAGES
    // ─────────────────────────────────────────────────
    useEffect(() => {
        if (!activeConversation) return;
        const fetchMessages = async () => {
             const { data } = await supabase.from('messages').select('*').eq('conversationId', activeConversation.id).order('created_at', { ascending: true });
             if (data) setMessages(data);
             // Mark unread messages as read
             await supabase.from('messages')
                 .update({ read: true })
                 .eq('conversationId', activeConversation.id)
                 .eq('receiverId', user?.id)
                 .eq('read', false);
        };
        fetchMessages();
        
        const msgChannelName = `messages_bs_${activeConversation.id}_${Date.now()}`;
        const channel = supabase.channel(msgChannelName)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversationId=eq.${activeConversation.id}` }, fetchMessages)
            .subscribe();
            
        return () => { supabase.removeChannel(channel); };
    }, [activeConversation]);

    // ─────────────────────────────────────────────────
    // CAPACITY CHECK
    // ─────────────────────────────────────────────────
    const checkCapacity = async (caregiverId, serviceType) => {
        const maxLimit = serviceType === 'walking' ? MAX_WALK : MAX_HOTEL;
        const { count } = await supabase.from('reservations')
            .select('*', { count: 'exact', head: true })
            .eq('caregiverId', caregiverId)
            .in('status', ['aceptada', 'activa'])
            .eq('serviceType', serviceType);
        return (count || 0) < maxLimit;
    };

    // ─────────────────────────────────────────────────
    // ACCEPT RESERVATION
    // ─────────────────────────────────────────────────
    const handleAcceptReservation = async (reservation) => {
        if (!user?.id) return;
        try {
            const hasCapacity = await checkCapacity(user.id, reservation.serviceType);
            if (!hasCapacity) {
                const limit = reservation.serviceType === 'walking' ? MAX_WALK : MAX_HOTEL;
                Alert.alert(t('bookings.noCapacity'), t('bookings.noCapacityMsg').replace('{count}', limit));
                return;
            }
            await supabase.from('reservations').update({
                status: 'aceptada'
            }).eq('id', reservation.id);
            await createNotification(reservation.ownerId, {
                type: 'booking_confirmed',
                bookingId: reservation.id,
                title: t('bookings.notifAcceptedTitle'),
                body: t('bookings.notifAcceptedBody', { name: userData?.fullName || t('bookings.caregiverFallback') }),
                icon: 'checkmark-circle-outline',
                iconBg: '#DCFCE7', iconColor: '#16A34A',
            });
            Alert.alert(t('bookings.bookingAccepted'));
        } catch { Alert.alert(t('common.error'), t('bookings.acceptError')); }
    };

    // ─────────────────────────────────────────────────
    // PAYMENT
    // ─────────────────────────────────────────────────
    const handlePayment = async (reservation) => {
        const price = reservation.totalPrice ?? 0;
        if (price <= 0) { Alert.alert(t('common.error'), t('bookings.invalidPrice')); return; }

        try {
            // Check if Google Pay / Apple Pay is available
            const platformPayAvailable = await isPlatformPaySupported();

            // Get payment intent from server
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            const response = await fetch(`${API_BASE_URL}/api/payments/payment-intent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ amount: price, currency: 'eur', reservationId: reservation.id }),
            });
            const { clientSecret, success } = await response.json();

            if (!success || !clientSecret) {
                Alert.alert(t('bookings.demoMode'), t('bookings.simulatePayment').replace('{price}', price.toFixed(2)), [
                    { text: t('common.cancel'), style: 'cancel' },
                    { text: t('bookings.simulate'), onPress: () => confirmPayment(reservation) },
                ]);
                return;
            }

            if (platformPayAvailable) {
                // Use Google Pay / Apple Pay
                const { error } = await confirmPlatformPayPayment(clientSecret, {
                    googlePay: {
                        testEnv: true,
                        merchantName: 'PawMate',
                        merchantCountryCode: 'ES',
                        currencyCode: 'EUR',
                        billingAddressConfig: {
                            format: SafePlatformPay.BillingAddressFormat?.Min ?? 0,
                        },
                    },
                    applePay: {
                        cartItems: [
                            {
                                label: 'PawMate - Reserva',
                                amount: price.toFixed(2),
                                paymentType: SafePlatformPay.PaymentType?.Immediate ?? 0,
                            },
                        ],
                        merchantCountryCode: 'ES',
                        currencyCode: 'EUR',
                    },
                });

                if (error) {
                    if (error.code !== 'Canceled') Alert.alert(t('bookings.payFailed'), error.message);
                    return;
                }
                await confirmPayment(reservation);
            } else {
                // Fallback: device doesn't support Google Pay / Apple Pay
                Alert.alert(
                    t('bookings.payFailed'),
                    t('bookings.payUnavailableMsg').replace('{method}', Platform.OS === 'ios' ? 'Apple Pay' : 'Google Pay').replace('{price}', price.toFixed(2)),
                    [
                        { text: t('common.cancel'), style: 'cancel' },
                        { text: t('bookings.simulate'), onPress: () => confirmPayment(reservation) },
                    ]
                );
            }
        } catch {
            Alert.alert(t('bookings.noConnection'), t('bookings.simulatePayment').replace('{price}', price.toFixed(2)), [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('bookings.simulate'), onPress: () => confirmPayment(reservation) },
            ]);
        }
    };

    const confirmPayment = async (reservation) => {
        try {
            const qrCode = generateUniqueId();
            await supabase.from('reservations').update({
                status: 'activa', qrCode, paymentStatus: 'paid'
            }).eq('id', reservation.id);
            await createNotification(reservation.caregiverId, {
                type: 'booking_active',
                bookingId: reservation.id,
                title: t('bookings.notifActiveTitle'),
                body: t('bookings.notifActiveBody', { name: reservation.ownerName || t('bookings.ownerFallback') }),
                icon: 'qr-code-outline',
                iconBg: '#ECFDF5', iconColor: '#1a7a4c',
            });
            setQrBooking({ ...reservation, status: 'activa', qrCode });
            setIsQrModalVisible(true);
            setDetailRes(null);
        } catch { Alert.alert(t('common.error'), t('bookings.activateError')); }
    };

    // ─────────────────────────────────────────────────
    // COMPLETE SERVICE
    // ─────────────────────────────────────────────────
    const handleComplete = async (reservation) => {
        Alert.alert(t('bookings.completeConfirm'), t('bookings.completeMsg'), [
            { text: t('common.no'), style: 'cancel' },
            {
                text: t('bookings.yesCompleted'),
                onPress: async () => {
                    try {
                        await supabase.from('reservations').update({
                            status: 'completada'
                        }).eq('id', reservation.id);
                        notifyRatingRequest(reservation.id);
                        await createNotification(reservation.ownerId, {
                            type: 'booking_completed',
                            bookingId: reservation.id,
                            title: t('bookings.notifCompletedTitle'),
                            body: t('bookings.notifCompletedBody', { name: userData?.fullName || t('bookings.caregiverFallback') }),
                            icon: 'ribbon-outline',
                            iconBg: '#E0F2FE', iconColor: '#0891b2',
                        });
                        setDetailRes(null);
                    } catch { Alert.alert(t('common.error'), t('bookings.completeError')); }
                },
            },
        ]);
    };

    // ─────────────────────────────────────────────────
    // QR SCANNER
    // ─────────────────────────────────────────────────
    const handleQrScanned = async ({ data: qrData }) => {
        if (cameraScanned || !user?.id) return;
        setCameraScanned(true);
        try {
            // Try to find an 'activa' reservation first (check-in → in_progress)
            let { data } = await supabase.from('reservations')
                .select('*')
                .eq('caregiverId', user.id)
                .eq('qrCode', qrData)
                .eq('status', 'activa')
                .limit(1);

            if (data && data.length > 0) {
                const res = data[0];
                await supabase.from('reservations').update({ status: 'in_progress' }).eq('id', res.id);
                await createNotification(res.ownerId, {
                    type: 'checkin_confirmed',
                    bookingId: res.id,
                    title: t('bookings.notifCheckinTitle'),
                    body: t('bookings.notifCheckinBody', { name: userData?.fullName || t('bookings.caregiverFallback') }),
                    icon: 'checkmark-circle-outline',
                    iconBg: '#DCFCE7', iconColor: '#16A34A',
                });
                setIsScannerVisible(false);
                Alert.alert(t('bookings.checkInConfirm'), t('bookings.checkInMsg'));
                return;
            }

            // Try to find an 'in_progress' reservation (check-out → completed)
            ({ data } = await supabase.from('reservations')
                .select('*')
                .eq('caregiverId', user.id)
                .eq('qrCode', qrData)
                .eq('status', 'in_progress')
                .limit(1));

            if (data && data.length > 0) {
                const res = data[0];
                await supabase.from('reservations').update({ status: 'completada', completedAt: new Date().toISOString() }).eq('id', res.id);

                // Refetch caregiver row to ensure latest counters
                const { data: cgRow } = await supabase.from('users').select('completedServices, totalWalks, petsCaredIds').eq('id', user.id).maybeSingle();
                const newCompleted = (cgRow?.completedServices || 0) + 1;
                const cgPatch = { completedServices: newCompleted };
                if (res.serviceType === 'walking') {
                    cgPatch.totalWalks = (cgRow?.totalWalks || 0) + 1;
                }
                // Track unique pets cared by caregiver
                if (Array.isArray(res.petIds) && res.petIds.length > 0) {
                    const existing = Array.isArray(cgRow?.petsCaredIds) ? cgRow.petsCaredIds : [];
                    cgPatch.petsCaredIds = [...new Set([...existing, ...res.petIds])];
                }
                await supabase.from('users').update(cgPatch).eq('id', user.id);

                // Increment owner totalWalks (only for walking service)
                if (res.serviceType === 'walking' && res.ownerId) {
                    const { data: ownerRow } = await supabase.from('users').select('totalWalks, saveWalks').eq('id', res.ownerId).maybeSingle();
                    if (ownerRow?.saveWalks !== false) {
                        await supabase.from('users').update({
                            totalWalks: (ownerRow?.totalWalks || 0) + 1,
                        }).eq('id', res.ownerId);
                    }
                    // Increment per-pet walk count
                    if (Array.isArray(res.petIds) && res.petIds.length > 0) {
                        for (const pid of res.petIds) {
                            const { data: petRow } = await supabase.from('pets').select('totalWalks').eq('id', pid).maybeSingle();
                            await supabase.from('pets').update({ totalWalks: (petRow?.totalWalks || 0) + 1 }).eq('id', pid);
                        }
                    }
                }
                // Release payment: mark as paymentReleased for backend processing
                await supabase.from('reservations').update({ paymentReleased: true, paymentReleasedAt: new Date().toISOString() }).eq('id', res.id).catch(() => {});
                await createNotification(res.ownerId, {
                    type: 'booking_completed',
                    bookingId: res.id,
                    title: t('bookings.notifServiceDoneTitle'),
                    body: t('bookings.notifServiceDoneBody', { name: userData?.fullName || t('bookings.caregiverFallback') }),
                    icon: 'ribbon-outline',
                    iconBg: '#E0F2FE', iconColor: '#0891b2',
                });
                setIsScannerVisible(false);
                Alert.alert(t('bookings.serviceCompleted'), t('bookings.serviceCompletedMsg'));
                return;
            }

            Alert.alert(t('bookings.invalidQR'), t('bookings.invalidQRMsg'), [
                { text: 'OK', onPress: () => setCameraScanned(false) },
            ]);
        } catch (e) {
            console.error('QR scan error:', e);
            Alert.alert(t('common.error'), t('bookings.qrError'));
        } finally {
            setCameraScanned(false);
        }
    };

    // ─────────────────────────────────────────────────
    // CANCEL / DELETE
    // ─────────────────────────────────────────────────
    const handleCancelReservation = (reservation) => {
        // 24h cancellation rule: if less than 24h before start, 50% penalty
        const resObj = typeof reservation === 'object' ? reservation : reservations.find(r => r.id === reservation);
        const resId = resObj?.id || reservation;
        const startDate = resObj?.startDate ? new Date(resObj.startDate) : null;
        const now = new Date();
        const hoursUntilStart = startDate ? (startDate - now) / (1000 * 60 * 60) : 999;
        const hasPenalty = hoursUntilStart < 24 && resObj?.totalPrice > 0 && !['pendiente', 'completada'].includes(resObj?.status);
        const penaltyAmount = hasPenalty ? (resObj.totalPrice * 0.5).toFixed(2) : 0;

        const message = hasPenalty
            ? t('bookings.penaltyMsg').replace('{amount}', penaltyAmount)
            : t('bookings.cancelMsg');

        Alert.alert(t('bookings.cancelConfirm'), message, [
            { text: t('common.no'), style: 'cancel' },
            {
                text: hasPenalty ? t('bookings.cancelWithPenalty').replace('{amount}', penaltyAmount) : t('bookings.yesCancel'),
                style: 'destructive',
                onPress: async () => {
                    try {
                        await supabase.from('reservations').update({
                            status: 'cancelada',
                            ...(hasPenalty ? { penaltyAmount: Number(penaltyAmount) } : {}),
                        }).eq('id', resId);
                        // Notify the other party
                        const notifyId = userData?.role === 'caregiver' ? resObj?.ownerId : resObj?.caregiverId;
                        if (notifyId) {
                            await createNotification(notifyId, {
                                type: 'booking_cancelled',
                                bookingId: resId,
                                title: t('bookings.notifCancelledTitle'),
                                body: t('bookings.notifCancelledBody', { name: userData?.fullName || t('bookings.userFallback'), penalty: hasPenalty ? ` ${t('bookings.penaltyLabel')}: €${penaltyAmount}` : '' }),
                                icon: 'close-circle-outline',
                                iconBg: '#FEE2E2', iconColor: '#EF4444',
                            });
                        }
                        setDetailRes(null);
                    } catch { Alert.alert(t('common.error'), t('bookings.cancelError')); }
                },
            },
        ]);
    };

    const handleDeleteReservation = (reservationId) => {
        Alert.alert(t('bookings.deleteConfirm'), t('bookings.deleteForever'), [
            { text: t('common.no'), style: 'cancel' },
            {
                text: t('common.delete'), style: 'destructive',
                onPress: async () => {
                    try {
                        await supabase.from('reservations').delete().eq('id', reservationId);
                        setDetailRes(null);
                    } catch { Alert.alert(t('common.error'), t('bookings.deleteError')); }
                },
            },
        ]);
    };

    // ─────────────────────────────────────────────────
    // TRACK PET (Owner → see caregiver's location)
    // ─────────────────────────────────────────────────
    const handleTrackPet = async (reservation) => {
        try {
            const { data: caregiver } = await supabase
                .from('users')
                .select('latitude, longitude, fullName, isOnline')
                .eq('id', reservation.caregiverId)
                .single();

            if (!caregiver?.latitude || !caregiver?.longitude) {
                Alert.alert(t('bookings.locationUnavailable'), t('bookings.caregiverNotTracking'));
                return;
            }

            const petNames = reservation.petNames?.join(', ') || t('species.pet');
            Alert.alert(
                t('bookings.petLocation').replace('{pets}', petNames),
                t('bookings.caregiverStatus').replace('{name}', caregiver.fullName || t('roles.caregiver')).replace('{status}', caregiver.isOnline ? t('common.online') : 'offline'),
                [
                    { text: t('common.cancel'), style: 'cancel' },
                    {
                        text: t('bookings.openMap'),
                        onPress: () => {
                            const url = Platform.OS === 'ios'
                                ? `maps:0,0?q=${caregiver.latitude},${caregiver.longitude}`
                                : `geo:${caregiver.latitude},${caregiver.longitude}?q=${caregiver.latitude},${caregiver.longitude}(${caregiver.fullName || 'Cuidador'})`;
                            Linking.openURL(url).catch(() => {
                                Linking.openURL(`https://www.google.com/maps?q=${caregiver.latitude},${caregiver.longitude}`);
                            });
                        },
                    },
                ]
            );
        } catch {
            Alert.alert(t('common.error'), t('bookings.locationError'));
        }
    };

    // ─────────────────────────────────────────────────
    // TOGGLE WALK (Caregiver activates/deactivates walk tracking)
    // ─────────────────────────────────────────────────
    const handleToggleWalk = async (reservation) => {
        try {
            const newVal = !reservation.walkActive;
            const update = { walkActive: newVal };

            if (newVal) {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert(t('bookings.permissionNeeded'), t('bookings.locationPermissionMsg'));
                    return;
                }
                const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
                // Also update caregiver location in users table
                await supabase.from('users').update({
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                    isOnline: true,
                }).eq('id', user.id);
            }

            await supabase.from('reservations').update(update).eq('id', reservation.id);

            // Notify owner
            if (reservation.ownerId) {
                const petNames = reservation.petNames?.join(', ') || 'tu mascota';
                await createNotification(reservation.ownerId, {
                    type: newVal ? 'walk_started' : 'walk_ended',
                    bookingId: reservation.id,
                    title: newVal ? ' Paseo iniciado' : ' Paseo finalizado',
                    body: newVal
                        ? `${userData?.fullName || 'El cuidador'} ha iniciado el paseo con ${petNames}. ¡Puedes seguir su ubicación!`
                        : `${userData?.fullName || 'El cuidador'} ha finalizado el paseo con ${petNames}.`,
                    icon: newVal ? 'walk-outline' : 'home-outline',
                    iconBg: newVal ? '#DCFCE7' : '#E0F2FE',
                    iconColor: newVal ? '#16A34A' : '#0891b2',
                });
            }
        } catch {
            Alert.alert(t('common.error'), t('bookings.walkUpdateError'));
        }
    };

    // ─────────────────────────────────────────────────
    // SUBMIT REVIEW
    // ─────────────────────────────────────────────────
    const handleSubmitReview = async () => {
        if (!reviewTarget || !user?.id) return;
        setSubmittingReview(true);
        try {
            await supabase.from('reviews').insert({
                reviewerId: user.id,
                reviewerName: userData?.fullName || 'Usuario',
                revieweeId: reviewTarget.caregiverId,
                revieweeName: reviewTarget.caregiverName,
                rating: reviewRating,
                comment: reviewText.trim(),
            });
            const { data: cgData } = await supabase.from('users').select('reviewCount, rating').eq('id', reviewTarget.caregiverId).single();
            if (cgData) {
                const count = (cgData.reviewCount || 0) + 1;
                const avgRating = ((cgData.rating || 0) * (count - 1) + reviewRating) / count;
                await supabase.from('users').update({
                    rating: Math.round(avgRating * 10) / 10,
                    reviewCount: count,
                }).eq('id', reviewTarget.caregiverId);
            }
            await supabase.from('reservations').update({ reviewedByOwner: true }).eq('id', reviewTarget.id);
            setIsReviewModalVisible(false);
            setReviewTarget(null);
            setReviewText('');
            setReviewRating(5);
            Alert.alert(t('bookings.reviewThanks'), t('bookings.reviewThanksMsg'));
        } catch { Alert.alert(t('common.error'), t('bookings.reviewError')); }
        finally { setSubmittingReview(false); }
    };

    // ─────────────────────────────────────────────────
    // OPEN CHAT (find or create conversation)
    // ─────────────────────────────────────────────────
    const openChat = async (reservation) => {
        const ownId = reservation.ownerId;
        const cgId = reservation.caregiverId;
        try {
            let { data: existing } = await supabase
                .from('conversations')
                .select('*')
                .eq('ownerId', ownId)
                .eq('caregiverId', cgId)
                .limit(1);

            let convo;
            if (existing && existing.length > 0) {
                convo = existing[0];
            } else {
                const { data: newConvo } = await supabase
                    .from('conversations')
                    .insert({
                        ownerId: ownId,
                        caregiverId: cgId,
                        ownerName: reservation.ownerName,
                        caregiverName: reservation.caregiverName,
                    })
                    .select()
                    .single();
                convo = newConvo;
            }
            if (convo) {
                // Attach reservation info for display
                convo._serviceType = reservation.serviceType;
                convo._startDate = reservation.startDate;
                setActiveConversation(convo);
                setIsChatVisible(true);
            }
        } catch (e) {
            console.error('Error opening chat:', e);
            Alert.alert(t('common.error'), t('bookings.chatError'));
        }
    };

    // ─────────────────────────────────────────────────
    // SEND MESSAGE
    // ─────────────────────────────────────────────────
    const sendMessage = async () => {
        if (!messageInput.trim() || !activeConversation || !user?.id) return;
        const text = messageInput.trim();
        const receiverId = userData?.role === 'caregiver'
            ? activeConversation.ownerId
            : activeConversation.caregiverId;
        try {
            await supabase.from('messages').insert({
                conversationId: activeConversation.id,
                senderId: user.id,
                receiverId,
                senderName: userData?.fullName || 'Usuario',
                text,
                read: false,
            });
            // Update conversation's lastMessage
            await supabase.from('conversations').update({
                lastMessage: text,
                lastMessageAt: new Date().toISOString(),
            }).eq('id', activeConversation.id);

            // Notify the receiver about the new message
            await createNotification(receiverId, {
                type: 'new_message',
                title: ' Nuevo mensaje',
                body: `${userData?.fullName || 'Alguien'}: ${text.substring(0, 80)}`,
                icon: 'chatbubble-outline',
                iconBg: '#DBEAFE',
                iconColor: '#2563EB',
                conversationId: activeConversation.id,
            });

            setMessageInput('');
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        } catch { Alert.alert(t('common.error'), t('bookings.messageError')); }
    };

    // ─────────────────────────────────────────────────
    // RENDER HELPERS
    // ─────────────────────────────────────────────────
    const DetailRow = ({ icon, label, value }) => (
        <View style={s.detailRow}>
            <View style={[s.detailIconWrap, { backgroundColor: theme.primaryBg }]}>
                <Icon name={icon} size={16} color={theme.primary} />
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
        const svc = SERVICE_TYPES.find(sv => sv.value === res.serviceType);
        const serviceLbl = svc ? `${svc.emoji} ${t(svc.labelKey)}` : res.serviceType;
        const isCancelled = res.status === 'cancelada';
        const otherName = isCaregiver ? res.ownerName : res.caregiverName;
        const otherAvatar = isCaregiver ? res.ownerAvatar : res.caregiverAvatar;
        const initials = (otherName || 'U').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

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
                    {otherAvatar ? (
                        <Image source={{ uri: otherAvatar }} style={s.resAvatarImg} />
                    ) : (
                        <View style={[s.resAvatarBox, { backgroundColor: theme.primaryBg }]}>
                            <Text style={{ fontSize: 16, fontWeight: '800', color: theme.primary }}>{initials}</Text>
                        </View>
                    )}
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[s.resName, { color: theme.text }]}>
                            {otherName}
                        </Text>
                        <Text style={[s.resService, { color: theme.textSecondary }]}>{serviceLbl}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <View style={[s.statusChip, { backgroundColor: isDarkMode ? theme.primaryBg : st.bg }]}>
                            <Icon name={st.icon} size={12} color={isDarkMode ? theme.primary : st.color} />
                            <Text style={[s.statusLabel, { color: isDarkMode ? theme.primary : st.color }]}>{t(st.labelKey)}</Text>
                        </View>
                        {res.totalPrice > 0 && (
                            <Text style={{ fontSize: 16, fontWeight: '900', color: theme.primary, marginTop: 6 }}>€{res.totalPrice.toFixed(2)}</Text>
                        )}
                    </View>
                </View>

                <View style={s.resDatesRow}>
                    <Icon name="calendar-outline" size={13} color={theme.textSecondary} />
                    <Text style={[s.resDateText, { color: theme.textSecondary }]}>
                        {res.startDate}{res.endDate && res.endDate !== res.startDate ? ` → ${res.endDate}` : ''}
                    </Text>
                    {res.petNames?.length > 0 && (
                        <>
                            <Text style={{ color: theme.textSecondary, marginHorizontal: 4 }}>·</Text>
                            <Icon name="paw-outline" size={13} color={theme.textSecondary} />
                            <Text style={[s.resDateText, { color: theme.textSecondary }]}>{res.petNames.join(', ')}</Text>
                        </>
                    )}
                </View>

                {/* Quick actions row (only for non-cancelled) */}
                <View style={s.resQuickActions}>
                    {!isCancelled && (
                        <TouchableOpacity
                            style={[s.quickBtn, { backgroundColor: theme.primaryBg }]}
                            onPress={() => openChat(res)}
                        >
                            <Icon name="chatbubble-outline" size={14} color={theme.primary} />
                            <Text style={[s.quickBtnText, { color: theme.primary }]}>Chat</Text>
                        </TouchableOpacity>
                    )}
                    {/* Track button for owners with active/in_progress reservations */}
                    {!isCaregiver && (res.status === 'activa' || res.status === 'in_progress') && (
                        <TouchableOpacity
                            style={[s.quickBtn, { backgroundColor: '#E0F2FE' }]}
                            onPress={() => handleTrackPet(res)}
                        >
                            <Icon name="locate-outline" size={14} color="#0891b2" />
                            <Text style={[s.quickBtnText, { color: '#0891b2' }]}>Track</Text>
                        </TouchableOpacity>
                    )}
                    {/* Activate walk for caregivers with active/in_progress reservations */}
                    {isCaregiver && (res.status === 'activa' || res.status === 'in_progress') && (
                        <TouchableOpacity
                            style={[s.quickBtn, { backgroundColor: res.walkActive ? '#DCFCE7' : '#FEF3C7' }]}
                            onPress={() => handleToggleWalk(res)}
                        >
                            <Icon name={res.walkActive ? 'pause-circle-outline' : 'play-circle-outline'} size={14} color={res.walkActive ? '#16A34A' : '#D97706'} />
                            <Text style={[s.quickBtnText, { color: res.walkActive ? '#16A34A' : '#D97706' }]}>
                                {res.walkActive ? t('bookings.pause') : t('bookings.activateWalk')}
                            </Text>
                        </TouchableOpacity>
                    )}
                    {(isCancelled || res.status === 'completada') && (
                        <TouchableOpacity
                            style={[s.quickBtn, { backgroundColor: '#FEE2E2' }]}
                            onPress={() => handleDeleteReservation(res.id)}
                        >
                            <Icon name="trash-outline" size={14} color="#EF4444" />
                            <Text style={[s.quickBtnText, { color: '#EF4444' }]}>{t('bookings.deleteBtn')}</Text>
                        </TouchableOpacity>
                    )}
                    <Icon name="chevron-forward" size={16} color={theme.textSecondary} style={{ marginLeft: 'auto' }} />
                </View>
            </TouchableOpacity>
        );
    };

    // ─────────────────────────────────────────────────
    // RENDER: Chat Message
    // ─────────────────────────────────────────────────
    const renderMessage = ({ item }) => {
        const isMe = item.senderId === user?.id;
        return (
            <View style={[s.messageWrap, isMe ? s.bubbleRight : s.bubbleLeft]}>
                <View style={[s.bubble, isMe ? s.bubbleMine : [s.bubbleOther, { backgroundColor: theme.cardBackground }]]}>
                    <Text style={[s.bubbleText, { color: isMe ? '#FFF' : theme.text }]}>{item.text}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4 }}>
                        {item.created_at && (
                            <Text style={[s.bubbleTime, { color: isMe ? 'rgba(255,255,255,0.7)' : theme.textSecondary, marginTop: 0 }]}>
                                {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        )}
                        {isMe && (
                            <Icon
                                name={item.read ? 'checkmark-done' : 'checkmark'}
                                size={14}
                                color={item.read ? '#34d399' : 'rgba(255,255,255,0.5)'}
                            />
                        )}
                    </View>
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
                <Text style={[s.headerTitle, { color: theme.text }]}>{t('bookings.title')}</Text>
                <View style={[s.roleChip, { backgroundColor: theme.primaryBg }]}>
                    <Text style={[s.roleChipText, { color: theme.primary }]}>
                        {userData?.role === 'caregiver' ? ' ' + t('roles.caregiver') : ' ' + t('roles.owner')}
                    </Text>
                </View>
            </View>

            {/* Tab Bar */}
            <View style={[s.tabBar, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                {[
                    { key: 'reservations', label: t('bookings.reservationsTab') },
                    { key: 'messages',     label: t('bookings.messagesTab') },
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
                            <Text style={{ fontSize: 56 }}></Text>
                            <Text style={[s.emptyTitle, { color: theme.text }]}>{t('bookings.noBookings')}</Text>
                            <Text style={[s.emptyDesc, { color: theme.textSecondary }]}>
                                {userData?.role === 'caregiver'
                                    ? t('bookings.noBookingsCaregiver')
                                    : t('bookings.noBookingsOwner')
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
                            <Text style={{ fontSize: 56 }}></Text>
                            <Text style={[s.emptyTitle, { color: theme.text }]}>{t('bookings.noMessages')}</Text>
                            <Text style={[s.emptyDesc, { color: theme.textSecondary }]}>{t('bookings.noMessagesDesc')}</Text>
                        </View>
                    }
                    renderItem={({ item: res }) => {
                        const serviceLbl = (() => { const sv = SERVICE_TYPES.find(s => s.value === res.serviceType); return sv ? `${sv.emoji} ${t(sv.labelKey)}` : res.serviceType; })();
                        const isCaregiver = userData?.role === 'caregiver';
                        const cName = isCaregiver ? res.ownerName : res.caregiverName;
                        const cAvatar = isCaregiver ? res.ownerAvatar : res.caregiverAvatar;
                        const cInitials = (cName || 'U').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
                        return (
                            <TouchableOpacity
                                style={[s.convoRow, { backgroundColor: theme.cardBackground }]}
                                onPress={() => openChat(res)}
                            >
                                {cAvatar ? (
                                    <Image source={{ uri: cAvatar }} style={{ width: 48, height: 48, borderRadius: 24 }} />
                                ) : (
                                    <View style={[s.convoAvatar, { backgroundColor: theme.primaryBg }]}>
                                        <Text style={{ fontSize: 16, fontWeight: '800', color: theme.primary }}>{cInitials}</Text>
                                    </View>
                                )}
                                <View style={{ flex: 1, marginLeft: 14 }}>
                                    <Text style={[s.convoName, { color: theme.text }]}>{cName}</Text>
                                    <Text style={[s.convoService, { color: theme.textSecondary }]}>
                                        {serviceLbl} · {res.startDate}
                                    </Text>
                                </View>
                                <Icon name="chevron-forward" size={18} color={theme.textSecondary} />
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
                    const serviceLbl = (() => { const sv = SERVICE_TYPES.find(s => s.value === detailRes.serviceType); return sv ? `${sv.emoji} ${t(sv.labelKey)}` : detailRes.serviceType; })();
                    const isCancelled = detailRes.status === 'cancelada';
                    const otherName = isCaregiver ? detailRes.ownerName : detailRes.caregiverName;
                    const otherAvatar = isCaregiver ? detailRes.ownerAvatar : detailRes.caregiverAvatar;
                    const initials = (otherName || 'U').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

                    return (
                        <View style={{ flex: 1, backgroundColor: theme.background }}>
                            {/* Header */}
                            <View style={[s.modalHeader, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                                <TouchableOpacity onPress={() => setDetailRes(null)}>
                                    <Icon name="close" size={24} color={theme.text} />
                                </TouchableOpacity>
                                <Text style={[s.modalTitle, { color: theme.text }]}>{t('bookings.detailTitle')}</Text>
                                <View style={{ width: 28 }} />
                            </View>

                            <ScrollView contentContainerStyle={{ padding: 20 }}>
                                {/* User hero card */}
                                <View style={[s.infoCard, { backgroundColor: theme.cardBackground, borderColor: theme.border, padding: 20, marginBottom: 16 }]}>
                                    <TouchableOpacity
                                        activeOpacity={isCaregiver ? 1 : 0.7}
                                        disabled={isCaregiver}
                                        onPress={async () => {
                                            if (isCaregiver) return;
                                            // Navigate to caregiver's profile
                                            const cgId = detailRes.caregiverId;
                                            if (!cgId) return;
                                            const { data: cg } = await supabase
                                                .from('users')
                                                .select('*')
                                                .eq('id', cgId)
                                                .maybeSingle();
                                            if (cg) {
                                                setDetailRes(null);
                                                navigation.navigate('CaregiverProfile', { caregiver: cg });
                                            }
                                        }}
                                        style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}
                                    >
                                        {otherAvatar ? (
                                            <Image source={{ uri: otherAvatar }} style={{ width: 56, height: 56, borderRadius: 28 }} />
                                        ) : (
                                            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: theme.primaryBg, justifyContent: 'center', alignItems: 'center' }}>
                                                <Text style={{ fontSize: 20, fontWeight: '800', color: theme.primary }}>{initials}</Text>
                                            </View>
                                        )}
                                        <View style={{ flex: 1, marginLeft: 14 }}>
                                            <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>{otherName}</Text>
                                            <Text style={{ fontSize: 14, color: theme.textSecondary, marginTop: 2 }}>{serviceLbl}</Text>
                                        </View>
                                        {detailRes.totalPrice > 0 && (
                                            <View style={{ alignItems: 'center' }}>
                                                <Text style={{ fontSize: 22, fontWeight: '900', color: theme.primary }}>€{detailRes.totalPrice.toFixed(2)}</Text>
                                            </View>
                                        )}
                                        {!isCaregiver && (
                                            <Icon name="chevron-forward" size={18} color={theme.textSecondary} style={{ marginLeft: 4 }} />
                                        )}
                                    </TouchableOpacity>
                                    <View style={[s.statusBanner, { backgroundColor: isDarkMode ? theme.primaryBg : st.bg, marginBottom: 0 }]}>
                                        <Icon name={st.icon} size={18} color={isDarkMode ? theme.primary : st.color} />
                                        <Text style={[s.statusBannerText, { color: isDarkMode ? theme.primary : st.color, fontSize: 14 }]}>{t(st.labelKey)}</Text>
                                    </View>
                                </View>

                                {/* Info card */}
                                <View style={[s.infoCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
                                    <DetailRow icon="person-outline"    label={t('bookings.participant')}
                                        value={isCaregiver ? detailRes.ownerName : detailRes.caregiverName} />
                                    <View style={[s.detailDivider, { backgroundColor: theme.border }]} />
                                    <DetailRow icon="paw-outline"       label={t('bookings.service')}     value={serviceLbl} />
                                    <View style={[s.detailDivider, { backgroundColor: theme.border }]} />
                                    <DetailRow icon="calendar-outline"  label={t('bookings.startDate')} value={detailRes.startDate || '—'} />
                                    {detailRes.serviceType === 'walking' && detailRes.walkHours ? (
                                        <>
                                            <View style={[s.detailDivider, { backgroundColor: theme.border }]} />
                                            <DetailRow icon="time-outline" label={t('createBooking.walkDuration')} value={`${detailRes.walkHours} ${detailRes.walkHours === 1 ? t('createBooking.hour') : t('createBooking.hours')}`} />
                                        </>
                                    ) : null}
                                    {detailRes.startTime && (
                                        <>
                                            <View style={[s.detailDivider, { backgroundColor: theme.border }]} />
                                            <DetailRow icon="time-outline" label={t('createBooking.startTime')} value={detailRes.startTime} />
                                        </>
                                    )}
                                    {detailRes.endDate && detailRes.endDate !== detailRes.startDate && <>
                                        <View style={[s.detailDivider, { backgroundColor: theme.border }]} />
                                        <DetailRow icon="calendar-outline" label={t('bookings.endDate')} value={detailRes.endDate} />
                                    </>}
                                    {detailRes.serviceType === 'hotel' && detailRes.endTime ? (
                                        <>
                                            <View style={[s.detailDivider, { backgroundColor: theme.border }]} />
                                            <DetailRow icon="time-outline" label={t('createBooking.endTime')} value={detailRes.endTime} />
                                        </>
                                    ) : null}
                                    {detailRes.totalPrice > 0 && <>
                                        <View style={[s.detailDivider, { backgroundColor: theme.border }]} />
                                        <DetailRow icon="card-outline" label={t('bookings.totalPrice')} value={`€${detailRes.totalPrice.toFixed(2)}`} />
                                    </>}
                                    {detailRes.petNames?.length > 0 && <>
                                        <View style={[s.detailDivider, { backgroundColor: theme.border }]} />
                                        <DetailRow icon="heart-outline" label={t('bookings.petsLabel')} value={detailRes.petNames.join(', ')} />
                                    </>}
                                    {detailRes.notes ? <>
                                        <View style={[s.detailDivider, { backgroundColor: theme.border }]} />
                                        <DetailRow icon="document-text-outline" label={t('bookings.notes')} value={detailRes.notes} />
                                    </> : null}
                                </View>

                                {/* CANCELLED or COMPLETED: show delete */}
                                {(isCancelled || detailRes.status === 'completada') && (
                                    <TouchableOpacity
                                        style={[s.actionBtn, { backgroundColor: '#FEE2E2', marginTop: 20 }]}
                                        onPress={() => handleDeleteReservation(detailRes.id)}
                                    >
                                        <Icon name="trash-outline" size={18} color="#EF4444" />
                                        <Text style={[s.actionBtnText, { color: '#EF4444' }]}>{t('bookings.deleteBooking')}</Text>
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
                                                openChat(detailRes);
                                            }}
                                        >
                                            <Icon name="chatbubble-outline" size={18} color={theme.primary} />
                                            <Text style={[s.actionBtnText, { color: theme.primary }]}>{t('bookings.openChat')}</Text>
                                        </TouchableOpacity>

                                        {/* CAREGIVER: pending → accept/reject */}
                                        {isCaregiver && detailRes.status === 'pendiente' && (
                                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                                <TouchableOpacity
                                                    style={[s.actionBtn, { flex: 1, backgroundColor: theme.primary }]}
                                                    onPress={() => { handleAcceptReservation(detailRes); setDetailRes(null); }}
                                                >
                                                    <Icon name="checkmark" size={18} color="#FFF" />
                                                    <Text style={[s.actionBtnText, { color: '#FFF' }]}>{t('common.accept')}</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[s.actionBtn, { flex: 1, backgroundColor: '#FEE2E2' }]}
                                                    onPress={() => handleCancelReservation(detailRes)}
                                                >
                                                    <Text style={[s.actionBtnText, { color: '#EF4444' }]}>{t('common.reject')}</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}

                                        {/* CAREGIVER: activa → scan QR for check-in */}
                                        {isCaregiver && detailRes.status === 'activa' && (
                                            <TouchableOpacity
                                                style={[s.actionBtn, { backgroundColor: '#0891b2' }]}
                                                onPress={() => { setCameraScanned(false); setIsScannerVisible(true); setDetailRes(null); }}
                                            >
                                                <Icon name="qr-code-outline" size={18} color="#FFF" />
                                                <Text style={[s.actionBtnText, { color: '#FFF' }]}>{t('bookings.scanCheckIn')}</Text>
                                            </TouchableOpacity>
                                        )}

                                        {/* CAREGIVER: in_progress → scan QR for check-out */}
                                        {isCaregiver && detailRes.status === 'in_progress' && (
                                            <TouchableOpacity
                                                style={[s.actionBtn, { backgroundColor: '#16A34A' }]}
                                                onPress={() => { setCameraScanned(false); setIsScannerVisible(true); setDetailRes(null); }}
                                            >
                                                <Icon name="qr-code-outline" size={18} color="#FFF" />
                                                <Text style={[s.actionBtnText, { color: '#FFF' }]}>{t('bookings.scanCheckOut')}</Text>
                                            </TouchableOpacity>
                                        )}

                                        {/* OWNER: pendiente → cancel */}
                                        {!isCaregiver && detailRes.status === 'pendiente' && (
                                            <TouchableOpacity
                                                style={[s.actionBtn, { backgroundColor: '#FEE2E2' }]}
                                                onPress={() => handleCancelReservation(detailRes)}
                                            >
                                                <Text style={[s.actionBtnText, { color: '#EF4444' }]}>{t('bookings.cancelBooking')}</Text>
                                            </TouchableOpacity>
                                        )}

                                        {/* OWNER: aceptada → pay */}
                                        {!isCaregiver && detailRes.status === 'aceptada' && (
                                            <TouchableOpacity
                                                style={[s.actionBtn, { backgroundColor: '#16A34A' }]}
                                                onPress={() => handlePayment(detailRes)}
                                            >
                                                <Icon name={Platform.OS === 'ios' ? 'logo-apple' : 'logo-google'} size={18} color="#FFF" />
                                                <Text style={[s.actionBtnText, { color: '#FFF' }]}>
                                                    {Platform.OS === 'ios' ? t('bookings.payApple') : t('bookings.payGoogle')}
                                                </Text>
                                            </TouchableOpacity>
                                        )}

                                        {/* OWNER: activa → show QR */}
                                        {!isCaregiver && (detailRes.status === 'activa' || detailRes.status === 'in_progress') && detailRes.qrCode && (
                                            <TouchableOpacity
                                                style={[s.actionBtn, { backgroundColor: theme.primaryBg, borderWidth: 1.5, borderColor: theme.primary }]}
                                                onPress={() => { setQrBooking(detailRes); setIsQrModalVisible(true); setDetailRes(null); }}
                                            >
                                                <Icon name="qr-code-outline" size={18} color={theme.primary} />
                                                <Text style={[s.actionBtnText, { color: theme.primary }]}>{t('bookings.viewQR')}</Text>
                                            </TouchableOpacity>
                                        )}

                                        {/* OWNER: in_progress → track location */}
                                        {!isCaregiver && detailRes.status === 'in_progress' && (
                                            <TouchableOpacity
                                                style={[s.actionBtn, { backgroundColor: '#DBEAFE' }]}
                                                onPress={() => { handleTrackPet(detailRes); }}
                                            >
                                                <Icon name="locate-outline" size={18} color="#2563EB" />
                                                <Text style={[s.actionBtnText, { color: '#2563EB' }]}>{t('bookings.trackLocation')}</Text>
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
                                                <Icon name="star-outline" size={18} color="#D97706" />
                                                <Text style={[s.actionBtnText, { color: '#D97706' }]}>{t('bookings.leaveReview')}</Text>
                                            </TouchableOpacity>
                                        )}
                                        {!isCaregiver && detailRes.status === 'completada' && detailRes.reviewedByOwner && (
                                            <View style={[s.actionBtn, { backgroundColor: '#E0F2FE' }]}>
                                                <Icon name="star" size={18} color="#0891b2" />
                                                <Text style={[s.actionBtnText, { color: '#0891b2' }]}>{t('bookings.reviewDone')}</Text>
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
                        <Text style={[s.qrTitle, { color: theme.text }]}>{t('bookings.qrTitle')}</Text>
                        <Text style={[s.qrDesc, { color: theme.textSecondary }]}>
                            {t('bookings.qrDesc')}
                        </Text>
                        {qrBooking?.qrCode && (
                            <View style={[s.qrBox, { backgroundColor: '#FFF' }]}>
                                <QRCode value={qrBooking.qrCode} size={200} />
                            </View>
                        )}
                        <Text style={[s.qrMeta, { color: theme.textSecondary }]}>
                            {(() => { const sv = SERVICE_TYPES.find(s => s.value === qrBooking?.serviceType); return sv ? `${sv.emoji} ${t(sv.labelKey)}` : ''; })()}
                            {'  ·  '}{qrBooking?.startDate}
                        </Text>
                        <TouchableOpacity style={[s.closeQrBtn, { backgroundColor: theme.primary }]} onPress={() => setIsQrModalVisible(false)}>
                            <Text style={s.closeQrBtnText}>{t('common.close')}</Text>
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
                            <Icon name="close" size={28} color="#FFF" />
                        </TouchableOpacity>
                        <Text style={s.scannerTitle}>{t('bookings.scannerTitle')}</Text>
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
                            <Icon name="camera-outline" size={60} color="#FFF" />
                            <Text style={s.permissionText}>{t('bookings.cameraNeeded')}</Text>
                            <TouchableOpacity style={[s.permissionBtn, { backgroundColor: theme.primary }]} onPress={requestPermission}>
                                <Text style={s.permissionBtnText}>{t('bookings.allowCamera')}</Text>
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
                            <Icon name="close" size={24} color={theme.text} />
                        </TouchableOpacity>
                        <Text style={[s.modalTitle, { color: theme.text }]}>{t('bookings.leaveReview')}</Text>
                        <View style={{ width: 28 }} />
                    </View>

                    <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: theme.text, textAlign: 'center' }}>
                            {reviewTarget?.caregiverName}
                        </Text>
                        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12 }}>
                            {[1, 2, 3, 4, 5].map(star => (
                                <TouchableOpacity key={star} onPress={() => setReviewRating(star)}>
                                    <Icon
                                        name={star <= reviewRating ? 'star' : 'star-outline'}
                                        size={38} color={star <= reviewRating ? '#F59E0B' : theme.textSecondary}
                                    />
                                </TouchableOpacity>
                            ))}
                        </View>
                        <Text style={{ textAlign: 'center', color: theme.textSecondary, fontSize: 14 }}>
                            {['', t('bookings.reviewBad'), t('bookings.reviewOk'), t('bookings.reviewGood'), t('bookings.reviewGreat'), t('bookings.reviewExcellent')][reviewRating]}
                        </Text>
                        <TextInput
                            style={[s.reviewInput, { backgroundColor: theme.cardBackground, color: theme.text, borderColor: theme.border }]}
                            multiline
                            value={reviewText}
                            onChangeText={setReviewText}
                            placeholder={t('bookings.reviewPlaceholder')}
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
                                    <Icon name="star" size={18} color="#FFF" />
                                    <Text style={[s.actionBtnText, { color: '#FFF' }]}>{t('bookings.publishReview')}</Text>
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
                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
                <View style={{ flex: 1, backgroundColor: theme.background }}>
                    <View style={[s.chatHeader, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                        <TouchableOpacity onPress={() => setIsChatVisible(false)}>
                            <Icon name="chevron-back" size={24} color={theme.text} />
                        </TouchableOpacity>
                        {(() => {
                            const chatName = userData?.role === 'caregiver' ? activeConversation?.ownerName : activeConversation?.caregiverName;
                            const chatAvatar = userData?.role === 'caregiver' ? activeConversation?.ownerAvatar : activeConversation?.caregiverAvatar;
                            const chatInitials = (chatName || 'U').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
                            return (
                                <>
                                    {chatAvatar ? (
                                        <Image source={{ uri: chatAvatar }} style={{ width: 38, height: 38, borderRadius: 19, marginLeft: 8 }} />
                                    ) : (
                                        <View style={{ width: 38, height: 38, borderRadius: 19, marginLeft: 8, backgroundColor: theme.primaryBg, justifyContent: 'center', alignItems: 'center' }}>
                                            <Text style={{ fontSize: 14, fontWeight: '800', color: theme.primary }}>{chatInitials}</Text>
                                        </View>
                                    )}
                                </>
                            );
                        })()}
                        <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={[s.chatTitle, { color: theme.text }]}>
                                {userData?.role === 'caregiver'
                                    ? activeConversation?.ownerName
                                    : activeConversation?.caregiverName}
                            </Text>
                            <Text style={[s.chatSubtitle, { color: theme.textSecondary }]}>
                                {(() => { const sv = SERVICE_TYPES.find(s => s.value === activeConversation?._serviceType); return sv ? `${sv.emoji} ${t(sv.labelKey)}` : ''; })()}
                                {activeConversation?._startDate ? ` · ${activeConversation._startDate}` : ''}
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
                                <Text style={{ fontSize: 44 }}></Text>
                                <Text style={[s.emptyDesc, { color: theme.textSecondary }]}>{t('bookings.startConversation')}</Text>
                            </View>
                        }
                    />
                    <View style={[s.chatInputRow, { backgroundColor: theme.cardBackground, borderTopColor: theme.border }]}>
                        <TextInput
                            style={[s.chatInput, { backgroundColor: theme.background, color: theme.text }]}
                            value={messageInput}
                            onChangeText={setMessageInput}
                            placeholder={t('bookings.typeMessage')}
                            placeholderTextColor={theme.textSecondary}
                            multiline
                        />
                        <TouchableOpacity style={[s.sendBtn, { backgroundColor: theme.primary }]} onPress={sendMessage}>
                            <Icon name="send" size={20} color="#FFF" />
                        </TouchableOpacity>
                    </View>
                </View>
                </KeyboardAvoidingView>
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
    resAvatarImg:   { width: 46, height: 46, borderRadius: 23 },
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
    convoAvatarImg: { width: 48, height: 48, borderRadius: 24 },
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
