import React, { useState, useEffect, useRef, useContext } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity,
    Image, ActivityIndicator, Platform, Modal, Animated
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { COLORS } from '../constants/colors';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { supabase } from '../config/supabase';

const DARK_MAP_STYLE = [
    { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
    { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
    { featureType: 'administrative.land_parcel', elementType: 'labels.text.fill', stylers: [{ color: '#64779e' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#98a5be' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2c6675' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4e6d70' }] },
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

export default function HomeScreen({ navigation }) {
    const { userData, user, refreshUserData } = useContext(AuthContext);
    const { theme, isDarkMode, isLeftHanded } = useContext(ThemeContext);

    const [location, setLocation] = useState(null);
    const [cityName, setCityName] = useState('');
    const [weatherData, setWeatherData] = useState({ temp: '--', icon: 'partly-sunny' });
    const [unreadNotifCount, setUnreadNotifCount] = useState(0);
    const [panelOpen, setPanelOpen] = useState(true);
    const panelAnim = useRef(new Animated.Value(1)).current; // 1=open, 0=closed
    const [onlineCaregivers, setOnlineCaregivers] = useState([]);
    const [groupWalkers, setGroupWalkers] = useState([]);
    const [isGroupWalking, setIsGroupWalking] = useState(false);
    const [selectedCaregiver, setSelectedCaregiver] = useState(null);
    const [mapMode, setMapMode] = useState('caregivers'); // 'caregivers' | 'pack'
    const realtimeRefs = useRef([]);

    const mapRef = useRef(null);

    useEffect(() => {
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;

            const currentLoc = await Location.getCurrentPositionAsync({});
            const { latitude, longitude } = currentLoc.coords;
            setLocation({ latitude, longitude });

            mapRef.current?.animateToRegion({
                latitude, longitude, latitudeDelta: 0.015, longitudeDelta: 0.015,
            }, 1200);

            try {
                const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
                if (geo.length > 0) setCityName(geo[0].city || geo[0].subregion || geo[0].region || '');
            } catch { /* ignore */ }

            fetchWeather(latitude, longitude);
            fetchOnlineCaregivers();
            fetchGroupWalkers();
        })();
        return () => { realtimeRefs.current.forEach(c => supabase.removeChannel(c)); };
    }, []);

    const fetchOnlineCaregivers = async () => {
        try {
            const { data } = await supabase.from('users')
                .select('id,fullName,avatar,photoURL,latitude,longitude,isOnline')
                .eq('role', 'caregiver').eq('isOnline', true)
                .not('latitude', 'is', null).not('longitude', 'is', null);
            setOnlineCaregivers(data || []);
        } catch { /* ignore */ }
    };

    const fetchGroupWalkers = async () => {
        try {
            const { data } = await supabase.from('users')
                .select('id,fullName,avatar,photoURL,latitude,longitude')
                .eq('isGroupWalking', true)
                .not('latitude', 'is', null).not('longitude', 'is', null);
            setGroupWalkers(data || []);
        } catch { /* ignore */ }
    };

    // Realtime channels
    useEffect(() => {
        const cgChannel = supabase.channel('caregivers-online')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, ({ new: row }) => {
                if (row.role !== 'caregiver') return;
                setOnlineCaregivers(prev => {
                    if (row.isOnline && row.latitude) {
                        const exists = prev.find(c => c.id === row.id);
                        return exists ? prev.map(c => c.id === row.id ? row : c) : [...prev, row];
                    } else {
                        return prev.filter(c => c.id !== row.id);
                    }
                });
            }).subscribe();

        const packChannel = supabase.channel('group-walkers')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, ({ new: row }) => {
                setGroupWalkers(prev => {
                    if (row.isGroupWalking && row.latitude) {
                        const exists = prev.find(u => u.id === row.id);
                        return exists ? prev.map(u => u.id === row.id ? row : u) : [...prev, row];
                    } else {
                        return prev.filter(u => u.id !== row.id);
                    }
                });
            }).subscribe();

        realtimeRefs.current = [cgChannel, packChannel];
        return () => { supabase.removeChannel(cgChannel); supabase.removeChannel(packChannel); };
    }, []);


    const fetchWeather = async (lat, lon) => {
        try {
            const resp = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
            const dict = await resp.json();
            if (dict?.current_weather) {
                const temp = dict.current_weather.temperature;
                const code = dict.current_weather.weathercode;
                let iconName = 'partly-sunny';
                if (code === 0 || code === 1) iconName = 'sunny';
                else if (code >= 51 && code <= 67) iconName = 'rainy';
                else if (code >= 71) iconName = 'snow';
                setWeatherData({ temp: Math.round(temp), icon: iconName });
            }
        } catch { /* ignore */ }
    };

    useEffect(() => {
        if (!user?.id) return;
        const fetchUnread = async () => {
            const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true })
                .eq('userId', user.id).eq('read', false);
            setUnreadNotifCount(count || 0);
        };
        fetchUnread();
        
        const channel = supabase.channel('home_unread_notifs')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `userId=eq.${user.id}` }, fetchUnread)
            .subscribe();
            
        return () => { supabase.removeChannel(channel); };
    }, [user?.id]);

    const centerOnUser = async () => {
        if (!location) return;
        try {
            const loc = await Location.getCurrentPositionAsync({});
            const { latitude, longitude } = loc.coords;
            setLocation({ latitude, longitude });
            mapRef.current?.animateToRegion({ latitude, longitude, latitudeDelta: 0.015, longitudeDelta: 0.015 }, 1000);
        } catch { /* ignore */ }
    };

    const handleToggleGroupWalk = async () => {
        const newVal = !isGroupWalking;
        setIsGroupWalking(newVal);
        setMapMode(newVal ? 'pack' : 'caregivers');
        if (!user?.id) return;
        const update = { isGroupWalking: newVal };
        if (newVal && location) { update.latitude = location.latitude; update.longitude = location.longitude; }
        await supabase.from('users').update(update).eq('id', user.id);
    };

    const handleToggleOnline = async () => {
        const newVal = !userData?.isOnline;
        const update = { isOnline: newVal };
        if (newVal && location) { update.latitude = location.latitude; update.longitude = location.longitude; }
        await supabase.from('users').update(update).eq('id', user.id);
        if (refreshUserData) refreshUserData();
    };

    const togglePanel = () => {
        const toVal = panelOpen ? 0 : 1;
        setPanelOpen(!panelOpen);
        Animated.spring(panelAnim, { toValue: toVal, useNativeDriver: false, tension: 80, friction: 12 }).start();
    };

    const isCaregiver = userData?.role === 'caregiver';

    const handleStartWalk = () => {
        navigation.navigate('Mascotas');
    };

    const firstName = userData?.fullName?.split(' ')[0] || userData?.email?.split('@')[0] || 'amigo';
    const userPhoto = userData?.avatar || userData?.photoURL || user?.photoURL || null;
    const userInitials = (userData?.fullName || userData?.email || 'U').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar style={isDarkMode ? 'light' : 'dark'} />

        {/* SECCIÓN DEL MAPA - crece cuando el panel está cerrado */}
            <Animated.View style={[styles.mapSection, {
                flex: panelAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 0.65] })
            }]}>
                {location ? (
                    <MapView
                        ref={mapRef}
                        provider={PROVIDER_GOOGLE}
                        style={styles.map}
                        showsUserLocation
                        showsMyLocationButton={false}
                        showsCompass={false}
                        customMapStyle={isDarkMode ? DARK_MAP_STYLE : []}
                    >
                        {mapMode === 'caregivers' && !isCaregiver && onlineCaregivers.map(cg => (
                            <Marker key={cg.id} coordinate={{ latitude: Number(cg.latitude), longitude: Number(cg.longitude) }} onPress={() => setSelectedCaregiver(cg)}>
                                <View style={{ width: 46, height: 46, borderRadius: 23, borderWidth: 3, borderColor: '#22c55e', overflow: 'hidden', backgroundColor: '#FFF', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5, elevation: 6 }}>
                                    <Image source={{ uri: cg.avatar || cg.photoURL || 'https://via.placeholder.com/40' }} style={{ width: '100%', height: '100%' }} />
                                </View>
                            </Marker>
                        ))}
                        {mapMode === 'pack' && groupWalkers.filter(u => u.id !== user?.id).map(u => (
                            <Marker key={u.id} coordinate={{ latitude: Number(u.latitude), longitude: Number(u.longitude) }}>
                                <View style={{ alignItems: 'center' }}>
                                    <View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: '#f97316', overflow: 'hidden', backgroundColor: '#FFF' }}>
                                        <Image source={{ uri: u.avatar || u.photoURL || 'https://via.placeholder.com/40' }} style={{ width: '100%', height: '100%' }} />
                                    </View>
                                    <Text style={{ fontSize: 9, fontWeight: '700', color: '#f97316', marginTop: 2 }}>🐾 Manada</Text>
                                </View>
                            </Marker>
                        ))}
                    </MapView>
                ) : (
                    <View style={[styles.map, styles.mapLoading, { backgroundColor: isDarkMode ? '#1d2c4d' : '#f8fafc' }]}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                        <Text style={[styles.mapLoadingText, { color: theme.textSecondary }]}>Adquiriendo señal GPS...</Text>
                    </View>
                )}

                {/* HEADER PÍLDORA FLOTANTE ENCIMA DEL MAPA */}
                <View style={styles.topBar}>
                    <View style={[styles.topBarRow, { backgroundColor: isDarkMode ? theme.cardBackground : 'rgba(255, 255, 255, 0.95)' }]}>
                        <TouchableOpacity style={styles.userAvatarBox} onPress={() => navigation.navigate('Profile')}>
                            {userPhoto
                                ? <Image source={{ uri: userPhoto }} style={styles.userAvatarImg} />
                                : <Text style={{ fontSize: 16, fontWeight: '800', color: '#FFF' }}>{userInitials}</Text>
                            }
                        </TouchableOpacity>

                        <View style={styles.greetingWrap}>
                            <Text style={[styles.greetHello, { color: theme.text }]} numberOfLines={1}>¡Hola, {firstName}!</Text>
                            <View style={styles.weatherRow}>
                                <Ionicons name={weatherData.icon} size={13} color="#f59e0b" />
                                <Text style={styles.weatherText}>{weatherData.temp}°C</Text>
                                {cityName ? (
                                    <>
                                        <Text style={styles.weatherDot}>·</Text>
                                        <Ionicons name="location" size={12} color="#f43f5e" />
                                        <Text style={styles.cityText}>{cityName}</Text>
                                    </>
                                ) : null}
                            </View>
                        </View>

                        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: isDarkMode ? '#334155' : '#f1f5f9' }]} onPress={() => navigation.navigate('Notifications')}>
                            <Ionicons name="notifications-outline" size={20} color={theme.text} />
                            {unreadNotifCount > 0 && (
                                <View style={styles.notifDot}>
                                    <Text style={styles.notifDotText}>{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* BOTÓN GPS */}
                <TouchableOpacity style={[styles.gpsBtn, isLeftHanded ? { left: 16 } : { right: 16 }]} onPress={centerOnUser}>
                    <Ionicons name="locate" size={20} color={COLORS.primary} />
                </TouchableOpacity>

                {/* CURVA INFERIOR DEL MAPA */}
                {panelOpen && <View style={[styles.mapCurveBottom, { backgroundColor: theme.background }]} />}
            </Animated.View>

            {/* SECCIÓN INFERIOR: Dashboard y Cards */}
            <Animated.View style={[styles.bottomSection, { backgroundColor: theme.background, flex: panelAnim.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.35] }) }]}>
                
                {/* DRAG HANDLE */}
                <TouchableOpacity onPress={togglePanel} style={{ alignItems: 'center', paddingVertical: 10 }}>
                    <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border }} />
                </TouchableOpacity>

                {panelOpen && (
                  <>
                {/* ACTION BAR */}
                <View style={[styles.actionBar, { backgroundColor: isDarkMode ? theme.cardBackground : '#FFF', marginTop: 4, position: 'relative', top: 0, left: 16, right: 16 }]}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Messages')}>
                        <View style={[styles.actionIconBox, { backgroundColor: 'rgba(14, 165, 233, 0.1)' }]}>
                            <Ionicons name="chatbubbles" size={22} color="#0ea5e9" />
                        </View>
                        <Text style={[styles.actionBtnText, { color: theme.text }]}>Mensajes</Text>
                    </TouchableOpacity>
                    <View style={[styles.actionDivider, { backgroundColor: theme.border }]} />
                    <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Reservas')}>
                        <View style={[styles.actionIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                            <Ionicons name="calendar" size={22} color="#f59e0b" />
                        </View>
                        <Text style={[styles.actionBtnText, { color: theme.text }]}>Reservas</Text>
                    </TouchableOpacity>
                </View>

                {/* ROLE-BASED CTA BUTTONS */}
                <View style={{ flexDirection: 'row', gap: 10, marginHorizontal: 16, marginTop: 12, marginBottom: 12 }}>
                    {!isCaregiver && (
                        <TouchableOpacity 
                            style={{ flex: 1, backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: COLORS.primary, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 }}
                            onPress={handleStartWalk}
                        >
                            <Ionicons name="walk" size={22} color="#FFF" style={{ marginRight: 8 }} />
                            <Text style={{ color: '#FFF', fontSize: 15, fontWeight: '800' }}>Iniciar Paseo</Text>
                        </TouchableOpacity>
                    )}
                    {!isCaregiver && (
                        <TouchableOpacity 
                            style={{ flex: 1, backgroundColor: isGroupWalking ? '#f97316' : '#fff7ed', paddingVertical: 14, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#f97316', elevation: isGroupWalking ? 4 : 0 }}
                            onPress={handleToggleGroupWalk}
                        >
                            <Text style={{ fontSize: 16, marginRight: 6 }}>🐾</Text>
                            <Text style={{ color: isGroupWalking ? '#FFF' : '#f97316', fontSize: 13, fontWeight: '800' }}>{isGroupWalking ? 'En Manada' : 'Modo Manada'}</Text>
                        </TouchableOpacity>
                    )}
                    {isCaregiver && (
                        <TouchableOpacity
                            style={{ flex: 1, backgroundColor: userData?.isOnline ? '#22c55e' : (isDarkMode ? '#1e293b' : '#f0fdf4'), paddingVertical: 14, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#22c55e', elevation: userData?.isOnline ? 4 : 0 }}
                            onPress={handleToggleOnline}
                        >
                            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: userData?.isOnline ? '#FFF' : '#22c55e', marginRight: 8 }} />
                            <Text style={{ color: userData?.isOnline ? '#FFF' : '#22c55e', fontSize: 14, fontWeight: '800' }}>{userData?.isOnline ? 'Online ✓' : 'Activar Online'}</Text>
                        </TouchableOpacity>
                    )}
                </View>
                  </>
                )}


                {/* MODAL CALLOUT CUIDADOR */}
                <Modal visible={!!selectedCaregiver} animationType="fade" transparent>
                    <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} activeOpacity={1} onPress={() => setSelectedCaregiver(null)}>
                        <View style={{ backgroundColor: theme.cardBackground, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 28, paddingBottom: Platform.OS === 'ios' ? 44 : 28 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                                <View style={{ width: 60, height: 60, borderRadius: 30, borderWidth: 3, borderColor: '#22c55e', overflow: 'hidden', marginRight: 16 }}>
                                    <Image source={{ uri: selectedCaregiver?.avatar || selectedCaregiver?.photoURL || 'https://via.placeholder.com/60' }} style={{ width: '100%', height: '100%' }} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>{selectedCaregiver?.fullName || 'Cuidador'}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                        <Ionicons name="star" size={14} color="#f59e0b" />
                                        <Text style={{ fontSize: 13, color: theme.textSecondary, marginLeft: 4 }}>{selectedCaregiver?.rating ? Number(selectedCaregiver.rating).toFixed(1) : 'Nuevo'}</Text>
                                        <View style={{ marginLeft: 10, backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                                            <Text style={{ fontSize: 11, color: '#16a34a', fontWeight: '700' }}>🟢 Online</Text>
                                        </View>
                                    </View>
                                </View>
                            </View>
                            <TouchableOpacity
                                style={{ backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: 16, alignItems: 'center' }}
                                onPress={() => { setSelectedCaregiver(null); navigation.navigate('CaregiverProfile', { caregiverId: selectedCaregiver?.id }); }}
                            >
                                <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '800' }}>Ver Perfil</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </Modal>
            </Animated.View>

        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    
    // Header Info (Pill)
    topBar: { position: 'absolute', top: Platform.OS === 'ios' ? 50 : 30, left: 16, right: 16, zIndex: 10 },
    topBarRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 28, paddingVertical: 10, paddingHorizontal: 10, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 8 },
    userAvatarBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    userAvatarImg: { width: '100%', height: '100%', borderRadius: 22 },
    greetingWrap: { flex: 1, marginLeft: 2 },
    greetHello: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
    weatherRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
    weatherText: { fontSize: 12, fontWeight: '700', color: COLORS.textLight },
    weatherDot: { fontSize: 14, color: '#CBD5E1', marginTop: -2 },
    cityText: { fontSize: 12, fontWeight: '600', color: COLORS.textLight },
    iconBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 2 },
    notifDot: { position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.danger, borderWidth: 2, borderColor: '#FFF', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 2 },
    notifDotText: { color: '#FFF', fontSize: 9, fontWeight: '900' },

    // Map section
    mapSection: { flex: 0.5, position: 'relative' },
    map: { flex: 1 },
    mapLoading: { justifyContent: 'center', alignItems: 'center' },
    mapLoadingText: { marginTop: 10, fontWeight: '700' },
    mapCurveBottom: { position: 'absolute', bottom: -1, left: 0, right: 0, height: 24, borderTopLeftRadius: 30, borderTopRightRadius: 30 },
    
    mapPin: { width: 46, height: 46, borderRadius: 23, borderWidth: 3.5, borderColor: '#FFF', backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8, elevation: 10 },
    pinAvatar: { width: 38, height: 38, borderRadius: 19 },
    pinOnlineDot: { position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: 7, borderWidth: 2.5, borderColor: '#FFF' },

    gpsBtn: { position: 'absolute', bottom: 50, width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, elevation: 5 },

    // Dashboard Section
    bottomSection: { flex: 0.5, position: 'relative' },
    
    // Quick Action Bar (Floating)
    actionBar: { position: 'absolute', top: -38, left: 24, right: 24, flexDirection: 'row', borderRadius: 24, padding: 8, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12, zIndex: 20 },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 10 },
    actionIconBox: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    actionBtnText: { fontSize: 16, fontWeight: '800' },
    actionDivider: { width: 1, height: '60%', alignSelf: 'center', opacity: 0.5 },

    // Dashboard content
    dashboardContent: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 30 },
    headerDashboard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    sectionTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },

    // Bento Grid
    bentoGrid: { flexDirection: 'row', gap: 15, height: 210 },
    bentoCol: { flex: 1, justifyContent: 'space-between' },
    bentoCard: { borderRadius: 26, padding: 20, position: 'relative', overflow: 'hidden' },
    bentoLarge: { flex: 1, justifyContent: 'space-between' },
    bentoSmall: { flex: 1, justifyContent: 'center' },
    
    bentoIconBadge: { width: 46, height: 46, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    bentoTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
    bentoSub: { fontSize: 14, fontWeight: '600', marginTop: 4 },
    bentoArrow: { position: 'absolute', bottom: 20, right: 20 },

    // Activity Logs
    logCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, marginBottom: 10 },
    logIconBox: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    logInfo: { flex: 1 },
    logTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
    logSub: { fontSize: 13 },
});
