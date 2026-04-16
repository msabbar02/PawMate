import React, { useState, useEffect, useContext } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity, FlatList,
    Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { COLORS } from '../constants/colors';
import { AuthContext } from '../context/AuthContext';
import { supabase } from '../config/supabase';
import { createNotification } from '../utils/notificationHelpers';

// Relative time helper
function relativeTime(ts) {
    if (!ts) return '';
    const time = ts.toMillis ? ts.toMillis() : new Date(ts).getTime();
    const diff = Date.now() - time;
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'Ahora mismo';
    if (m < 60) return `Hace ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `Hace ${h}h`;
    const d = Math.floor(h / 24);
    if (d < 7) return `Hace ${d} día${d > 1 ? 's' : ''}`;
    return `Hace ${Math.floor(d / 7)} sem`;
}

export default function NotificationsScreen({ navigation }) {
    const { userData, user } = useContext(AuthContext);
    const { theme, isDarkMode } = require('react').useContext(require('../context/ThemeContext').ThemeContext);
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [activeNotif, setActiveNotif] = useState(null);

    // ── SUPABASE LISTENER ────────────────────────
    useEffect(() => {
        if (!user?.id) { setLoading(false); return; }
        
        const fetchNotifications = async () => {
            const { data } = await supabase
                .from('notifications')
                .select('*')
                .eq('userId', user.id)
                .order('created_at', { ascending: false });
            if (data) setNotifications(data);
            setLoading(false);
        };
        
        fetchNotifications();

        const channel = supabase
            .channel('notifications_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `userId=eq.${user.id}` }, () => {
                fetchNotifications();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [user?.id]);

    const unreadCount = notifications.filter(n => !n.read).length;
    const allSelected = selectedIds.size > 0 && selectedIds.size === notifications.length;

    const toggleSelect = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectAll = () => {
        if (allSelected) setSelectedIds(new Set());
        else setSelectedIds(new Set(notifications.map(n => n.id)));
    };

    const markSelectedAsRead = async () => {
        const uid = user?.id;
        if (!uid || selectedIds.size === 0) return;
        await supabase.from('notifications').update({ read: true }).in('id', [...selectedIds]);
        setSelectedIds(new Set());
    };

    const markAllAsRead = async () => {
        const uid = user?.id;
        if (!uid) return;
        const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
        if (unreadIds.length > 0) {
            await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
        }
    };

    const openNotif = async (notif) => {
        setActiveNotif(notif);
        if (!notif.read && user?.id) {
            await supabase.from('notifications').update({ read: true }).eq('id', notif.id);
        }
    };

    // ── ACCEPT BOOKING (Caregiver) ─────────────────
    const handleAcceptBooking = async (notif) => {
        const bookingId = notif.data?.bookingId;
        if (!bookingId) return;
        try {
            // Fetch reservation to get real data
            const { data: reservation } = await supabase
                .from('reservations').select('*').eq('id', bookingId).single();
            if (!reservation) { Alert.alert('Error', 'Reserva no encontrada.'); return; }

            // Capacity check
            const serviceType = reservation.serviceType || 'walking';
            const MAX = serviceType === 'walking' ? 5 : 3;
            
            const { count } = await supabase
                .from('reservations')
                .select('*', { count: 'exact', head: true })
                .eq('caregiverId', user?.id)
                .eq('status', 'aceptada')
                .eq('serviceType', serviceType);

            if (count >= MAX) {
                Alert.alert('Sin capacidad', `Ya tienes ${MAX} reservas activas de este tipo.`);
                return;
            }

            await supabase.from('reservations').update({
                status: 'aceptada',
            }).eq('id', bookingId);
            
            await createNotification(reservation.ownerId, {
                type: 'booking_confirmed',
                bookingId,
                title: '¡Reserva aceptada! 🎉',
                body: `${userData?.fullName || 'El cuidador'} aceptó tu reserva. ¡Completa el pago para confirmar!`,
                icon: 'checkmark-circle-outline',
                iconBg: '#DCFCE7',
                iconColor: '#16A34A',
            });
            await supabase.from('notifications').update({ read: true }).eq('id', notif.id);
            Alert.alert('¡Reserva aceptada! 🎉', 'El dueño recibirá una notificación.');
            if (activeNotif?.id === notif.id) setActiveNotif(null);
        } catch {
            Alert.alert('Error', 'No se pudo aceptar la reserva.');
        }
    };

    // ── REJECT BOOKING (Caregiver) ─────────────────
    const handleRejectBooking = async (notif) => {
        const bookingId = notif.data?.bookingId;
        if (!bookingId) return;
        try {
            // Fetch reservation to get ownerId
            const { data: reservation } = await supabase
                .from('reservations').select('ownerId, startDate').eq('id', bookingId).single();

            await supabase.from('reservations').update({ status: 'cancelada' }).eq('id', bookingId);
            
            if (reservation?.ownerId) {
                await createNotification(reservation.ownerId, {
                    type: 'booking_rejected',
                    bookingId,
                    title: 'Reserva rechazada',
                    body: `${userData?.fullName || 'El cuidador'} no pudo aceptar tu reserva para ${reservation.startDate || ''}.`,
                    icon: 'close-circle-outline',
                    iconBg: '#FEE2E2',
                    iconColor: '#EF4444',
                });
            }
            await supabase.from('notifications').update({ read: true }).eq('id', notif.id);
            if (activeNotif?.id === notif.id) setActiveNotif(null);
        } catch {
            Alert.alert('Error', 'No se pudo rechazar la reserva.');
        }
    };

    const isCaregiver = userData?.role === 'caregiver';

    // ── FRIEND REQUESTS ────────────────────────────
    const handleAcceptFriend = async (notif) => {
        // Friend requests not currently supported
        await supabase.from('notifications').update({ read: true }).eq('id', notif.id);
        if (activeNotif?.id === notif.id) setActiveNotif(null);
    };
    const handleRejectFriend = async (notif) => {
        await supabase.from('notifications').update({ read: true }).eq('id', notif.id);
        if (activeNotif?.id === notif.id) setActiveNotif(null);
    };



    const renderBookingActions = (notif) => {
        if (notif.type !== 'booking_request' || !isCaregiver) return null;
        return (
            <View style={styles.bookingActions}>
                <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAcceptBooking(notif)}>
                    <Ionicons name="checkmark" size={15} color="#FFF" />
                    <Text style={styles.acceptBtnText}>Aceptar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.rejectBtn} onPress={() => handleRejectBooking(notif)}>
                    <Text style={styles.rejectBtnText}>Rechazar</Text>
                </TouchableOpacity>
            </View>
        );
    };



    // ── DETAIL VIEW ───────────────────────────────
    if (activeNotif) {
        return (
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <StatusBar style={isDarkMode ? 'light' : 'dark'} />
                <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                    <TouchableOpacity onPress={() => setActiveNotif(null)} style={styles.iconBtn}>
                        <Ionicons name="arrow-back" size={22} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Notificación</Text>
                    <View style={{ width: 38 }} />
                </View>

                <ScrollView contentContainerStyle={styles.detailContent}>
                    <View style={[styles.detailIconBox, { backgroundColor: activeNotif.iconBg || COLORS.primaryBg }]}>
                        <Ionicons name={activeNotif.icon || 'notifications-outline'} size={38} color={activeNotif.iconColor || COLORS.primary} />
                    </View>
                    <Text style={[styles.detailTitle, { color: theme.text }]}>{activeNotif.title}</Text>
                    <Text style={[styles.detailTime, { color: theme.textSecondary }]}>{relativeTime(activeNotif.created_at)}</Text>
                    <View style={[styles.detailBodyCard, { backgroundColor: theme.cardBackground }]}>
                        <Text style={[styles.detailBody, { color: theme.text }]}>{activeNotif.body}</Text>
                    </View>
                    {renderBookingActions(activeNotif)}
                </ScrollView>
            </View>
        );
    }

    // ── LIST VIEW ─────────────────────────────────
    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar style={isDarkMode ? 'light' : 'dark'} />

            {/* Header */}
            <View style={[styles.header, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
                    <Ionicons name="arrow-back" size={22} color={theme.text} />
                </TouchableOpacity>
                <View style={{ alignItems: 'center' }}>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Notificaciones</Text>
                    {unreadCount > 0 && (
                        <Text style={styles.unreadBadgeText}>{unreadCount} sin leer</Text>
                    )}
                </View>
                <TouchableOpacity onPress={markAllAsRead} style={styles.iconBtn}>
                    <Ionicons name="checkmark-done-outline" size={22} color={COLORS.primary} />
                </TouchableOpacity>
            </View>

            {/* Selection toolbar */}
            {selectedIds.size > 0 && (
                <View style={styles.toolbar}>
                    <Text style={styles.toolbarText}>{selectedIds.size} seleccionadas</Text>
                    <TouchableOpacity onPress={markSelectedAsRead} style={styles.toolbarBtn}>
                        <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.primary} />
                        <Text style={styles.toolbarBtnText}>Marcar como leídas</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Select all */}
            <TouchableOpacity style={[styles.selectAllRow, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]} onPress={selectAll}>
                <View style={[styles.checkbox, allSelected && styles.checkboxActive]}>
                    {allSelected && <Ionicons name="checkmark" size={13} color="#FFF" />}
                </View>
                <Text style={[styles.selectAllText, { color: theme.text }]}>
                    {allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
                </Text>
            </TouchableOpacity>

            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={[styles.notifCard, { backgroundColor: theme.cardBackground }, !item.read && [styles.notifCardUnread, { backgroundColor: theme.primaryBg }]]}
                            onPress={() => openNotif(item)}
                            onLongPress={() => toggleSelect(item.id)}
                            activeOpacity={0.82}
                        >
                            {/* Checkbox */}
                            <TouchableOpacity onPress={() => toggleSelect(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <View style={[styles.checkbox, selectedIds.has(item.id) && styles.checkboxActive]}>
                                    {selectedIds.has(item.id) && <Ionicons name="checkmark" size={13} color="#FFF" />}
                                </View>
                            </TouchableOpacity>

                            {/* Icon */}
                            <View style={[styles.notifIconBox, { backgroundColor: item.iconBg || COLORS.primaryBg }]}>
                                <Ionicons name={item.icon || 'notifications-outline'} size={20} color={item.iconColor || COLORS.primary} />
                                {!item.read && <View style={styles.unreadDot} />}
                            </View>

                            {/* Content */}
                            <View style={styles.notifContent}>
                                <View style={styles.notifTopRow}>
                                    <Text
                                        style={[styles.notifTitle, { color: theme.textSecondary }, !item.read && { color: theme.text, fontWeight: '800' }]}
                                        numberOfLines={1}
                                    >
                                        {item.title}
                                    </Text>
                                    <Text style={[styles.notifTime, { color: theme.textSecondary }]}>{relativeTime(item.created_at)}</Text>
                                </View>
                                <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>

                                {item.type === 'booking_request' && isCaregiver && (
                                    <View style={styles.bookingActions}>
                                        <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAcceptBooking(item)}>
                                            <Ionicons name="checkmark" size={13} color="#FFF" />
                                            <Text style={styles.acceptBtnText}>Aceptar</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.rejectBtn} onPress={() => handleRejectBooking(item)}>
                                            <Text style={styles.rejectBtnText}>Rechazar</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {/* Friend request inline actions */}
                                {item.type === 'friend_request' && (
                                    <View style={styles.bookingActions}>
                                        <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAcceptFriend(item)}>
                                            <Ionicons name="checkmark" size={13} color="#FFF" />
                                            <Text style={styles.acceptBtnText}>Aceptar</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.rejectBtn} onPress={() => handleRejectFriend(item)}>
                                            <Text style={styles.rejectBtnText}>Rechazar</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>

                            <Ionicons name="chevron-forward" size={15} color={theme.border} />
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Text style={{ fontSize: 56 }}>🔔</Text>
                             <Text style={[styles.emptyTitle, { color: theme.text }]}>Sin notificaciones</Text>
                             <Text style={[styles.emptyDesc, { color: theme.textSecondary }]}>Cuando recibas alertas aparecerán aquí.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },

    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 64 : 40,
        paddingBottom: 16,
        backgroundColor: '#FFF',
        borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    headerTitle: { fontSize: 20, fontWeight: '900', color: COLORS.text },
    unreadBadgeText: { fontSize: 12, color: COLORS.primary, fontWeight: '700', marginTop: 1 },
    iconBtn: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center',
    },

    toolbar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: COLORS.primaryBg, paddingHorizontal: 20, paddingVertical: 10,
    },
    toolbarText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
    toolbarBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: '#FFF', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    },
    toolbarBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

    selectAllRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 20, paddingVertical: 13,
        backgroundColor: '#FFF',
        borderBottomWidth: 1, borderBottomColor: COLORS.border,
    },
    selectAllText: { fontSize: 14, fontWeight: '600', color: COLORS.text },
    checkbox: {
        width: 22, height: 22, borderRadius: 11,
        borderWidth: 2, borderColor: COLORS.border, backgroundColor: '#FFF',
        justifyContent: 'center', alignItems: 'center',
    },
    checkboxActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },

    list: { padding: 16, paddingBottom: 50 },
    notifCard: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 10,
        backgroundColor: '#FFF', borderRadius: 18, padding: 14, marginBottom: 10,
        shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
    },
    notifCardUnread: {
        backgroundColor: '#F0F7F4',
        borderLeftWidth: 3, borderLeftColor: COLORS.primary,
    },
    notifIconBox: {
        width: 44, height: 44, borderRadius: 14,
        justifyContent: 'center', alignItems: 'center',
        flexShrink: 0, position: 'relative', marginTop: 2,
    },
    unreadDot: {
        position: 'absolute', top: -2, right: -2,
        width: 10, height: 10, borderRadius: 5,
        backgroundColor: COLORS.danger, borderWidth: 2, borderColor: '#FFF',
    },
    notifContent: { flex: 1 },
    notifTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
    notifTitle: { fontSize: 13, fontWeight: '600', color: COLORS.textLight, flex: 1 },
    notifTitleUnread: { color: COLORS.text, fontWeight: '800' },
    notifTime: { fontSize: 11, color: COLORS.textLight, marginLeft: 4, flexShrink: 0 },
    notifBody: { fontSize: 13, color: COLORS.textLight, lineHeight: 18 },

    // Booking actions
    bookingActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
    acceptBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: COLORS.success, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10,
    },
    acceptBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
    rejectBtn: {
        paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10,
        backgroundColor: COLORS.dangerLight,
    },
    rejectBtnText: { color: COLORS.danger, fontWeight: '700', fontSize: 13 },

    // Detail
    detailContent: { padding: 28, alignItems: 'center' },
    detailIconBox: {
        width: 84, height: 84, borderRadius: 28,
        justifyContent: 'center', alignItems: 'center', marginBottom: 22,
    },
    detailTitle: { fontSize: 22, fontWeight: '900', color: COLORS.text, textAlign: 'center', marginBottom: 6 },
    detailTime: { fontSize: 13, color: COLORS.textLight, fontWeight: '500', marginBottom: 26 },
    detailBodyCard: {
        backgroundColor: '#FFF', borderRadius: 22, padding: 22, width: '100%',
        shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
    },
    detailBody: { fontSize: 15, color: COLORS.text, lineHeight: 25 },

    // Empty
    emptyState: { alignItems: 'center', marginTop: 80 },
    emptyTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginTop: 16 },
    emptyDesc: { fontSize: 14, color: COLORS.textLight, textAlign: 'center', marginTop: 8 },
});
