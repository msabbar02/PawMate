import React, { useState, useEffect, useRef, useContext } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity,
    Image, ActivityIndicator, Platform, ScrollView
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { COLORS } from '../constants/colors';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { supabase } from '../config/supabase';

export default function HomeScreen({ navigation }) {
    const { userData, user } = useContext(AuthContext);
    const { theme, isDarkMode, isLeftHanded } = useContext(ThemeContext);

    const [location, setLocation] = useState(null);
    const [cityName, setCityName] = useState('');
    const [weatherData, setWeatherData] = useState({ temp: '--', icon: 'partly-sunny' });
    const [caregivers, setCaregivers] = useState([]);
    const [unreadNotifCount, setUnreadNotifCount] = useState(0);
    const [recentActivity, setRecentActivity] = useState([]);
    const [loadingActivity, setLoadingActivity] = useState(true);

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
            fetchCaregivers();
            fetchRecentActivity();
        })();
    }, []);

    const fetchRecentActivity = async () => {
        if (!user?.id) return;
        setLoadingActivity(true);
        try {
            const { data } = await supabase.from('recent_activity')
                .select('*')
                .eq('userId', user.id)
                .order('created_at', { ascending: false })
                .limit(4);
            setRecentActivity(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingActivity(false);
        }
    };

    const fetchCaregivers = async () => {
        try {
            const { data, error } = await supabase.from('users').select('*').eq('role', 'caregiver')
                .not('latitude', 'is', null).not('longitude', 'is', null);
            if (error) throw error;
            setCaregivers(data || []);
        } catch (e) {
            console.warn("fetchCaregivers error:", e.message);
        }
    };

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

    const firstName = userData?.fullName?.split(' ')[0] || userData?.email?.split('@')[0] || 'amigo';
    const userPhoto = user?.photoURL || userData?.photoURL || null;

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar style={isDarkMode ? 'light' : 'dark'} />

            {/* SECCIÓN DEL MAPA SUPERIOR */}
            <View style={styles.mapSection}>
                {location ? (
                    <MapView
                        ref={mapRef}
                        provider={PROVIDER_GOOGLE}
                        style={styles.map}
                        showsUserLocation
                        showsMyLocationButton={false}
                        showsCompass={false}
                    >
                        {caregivers.map((cg) => (
                            <Marker key={cg.id} coordinate={{ latitude: cg.latitude, longitude: cg.longitude }} onPress={() => navigation.navigate('CaregiverProfile', { caregiver: cg })}>
                                <View style={[styles.mapPin, !cg.isOnline && { opacity: 0.75 }]}>
                                    <Image source={{ uri: cg.avatar || 'https://via.placeholder.com/40' }} style={styles.pinAvatar} />
                                    <View style={[styles.pinOnlineDot, { backgroundColor: cg.isOnline ? '#22c55e' : '#ef4444' }]} />
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
                    <View style={[styles.topBarRow, { backgroundColor: isDarkMode ? theme.surface : 'rgba(255, 255, 255, 0.95)' }]}>
                        <TouchableOpacity style={styles.userAvatarBox} onPress={() => navigation.navigate('Profile')}>
                            {userPhoto
                                ? <Image source={{ uri: userPhoto }} style={styles.userAvatarImg} />
                                : <Ionicons name="person" size={18} color="#FFF" />
                            }
                        </TouchableOpacity>

                        <View style={styles.greetingWrap}>
                            <Text style={[styles.greetHello, { color: theme.text }]} numberOfLines={1}>Hola, {firstName}</Text>
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
                <View style={[styles.mapCurveBottom, { backgroundColor: theme.background }]} />
            </View>

            {/* SECCIÓN INFERIOR: Dashboard y Cards */}
            <View style={[styles.bottomSection, { backgroundColor: theme.background }]}>
                
                {/* ACTION BAR (Se sale del mapa y "abraza" ambos mundos) */}
                <View style={[styles.actionBar, { backgroundColor: isDarkMode ? theme.cardBackground : '#FFF' }]}>
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

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.dashboardContent}>
                    
                    <View style={styles.headerDashboard}>
                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Mis Atajos</Text>
                    </View>

                    {/* BENTO GRID LAYOUT PARA SHORTCUTS */}
                    <View style={styles.bentoGrid}>
                        {/* Tarjeta grande: Mascotas */}
                        <TouchableOpacity 
                            style={[styles.bentoCard, styles.bentoLarge, { backgroundColor: isDarkMode ? '#1e293b' : '#f0fdf4' }]}
                            onPress={() => navigation.navigate('Mascotas')}
                        >
                            <View style={[styles.bentoIconBadge, { backgroundColor: '#22c55e' }]}>
                                <Ionicons name="paw" size={22} color="#FFF" />
                            </View>
                            <View style={{ marginTop: 'auto' }}>
                                <Text style={[styles.bentoTitle, { color: isDarkMode ? '#FFF' : '#166534' }]}>Mascotas</Text>
                                <Text style={[styles.bentoSub, { color: isDarkMode ? '#94a3b8' : '#22c55e' }]}>
                                    {!loadingActivity ? `${recentActivity.length} en total` : 'Cargando...'}
                                </Text>
                            </View>
                            <Ionicons name="arrow-forward-outline" size={18} color={isDarkMode ? '#94a3b8' : '#22c55e'} style={styles.bentoArrow} />
                        </TouchableOpacity>

                        <View style={styles.bentoCol}>
                            {/* Tarjeta pequeña: Ajustes */}
                            <TouchableOpacity 
                                style={[styles.bentoCard, styles.bentoSmall, { backgroundColor: isDarkMode ? '#334155' : '#eff6ff' }]}
                                onPress={() => navigation.navigate('Profile')}
                            >
                                <View style={[styles.bentoIconBadge, { backgroundColor: '#3b82f6' }]}>
                                    <Ionicons name="settings" size={20} color="#FFF" />
                                </View>
                                <View style={{ marginTop: 10 }}>
                                    <Text style={[styles.bentoTitle, { color: isDarkMode ? '#FFF' : '#1e3a8a', fontSize: 16 }]}>Ajustes</Text>
                                </View>
                            </TouchableOpacity>

                            {/* Tarjeta pequeña: Paseos */}
                            <TouchableOpacity 
                                style={[styles.bentoCard, styles.bentoSmall, { backgroundColor: isDarkMode ? '#475569' : '#fdf4ff', marginTop: 15 }]}
                                onPress={() => navigation.navigate('Mascotas')}
                            >
                                <View style={[styles.bentoIconBadge, { backgroundColor: '#d946ef' }]}>
                                    <Ionicons name="walk" size={20} color="#FFF" />
                                </View>
                                <View style={{ marginTop: 10 }}>
                                    <Text style={[styles.bentoTitle, { color: isDarkMode ? '#FFF' : '#701a75', fontSize: 16 }]}>Mis Paseos</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* ACTIVITY LOG SECTION */}
                    <View style={{ marginTop: 30, marginBottom: 15 }}>
                        <Text style={[styles.sectionTitle, { color: theme.text, fontSize: 18 }]}>Registro de Actividad</Text>
                    </View>

                    {recentActivity.length === 0 && !loadingActivity ? (
                        <Text style={{ fontStyle: 'italic', color: theme.textSecondary, marginLeft: 2 }}>No hay actividad reciente aún.</Text>
                    ) : (
                        recentActivity.map((log) => (
                            <View key={log.id} style={[styles.logCard, { backgroundColor: isDarkMode ? theme.surface : '#f8fafc' }]}>
                                <View style={[styles.logIconBox, { backgroundColor: COLORS.primaryBg }]}>
                                    <Ionicons name={log.icon || 'paw'} size={18} color={COLORS.primary} />
                                </View>
                                <View style={styles.logInfo}>
                                    <Text style={[styles.logTitle, { color: theme.text }]}>{log.title}</Text>
                                    {log.description ? <Text style={[styles.logSub, { color: theme.textSecondary }]}>{log.description}</Text> : null}
                                </View>
                            </View>
                        ))
                    )}

                </ScrollView>
            </View>

        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    
    // Header Info (Pill)
    topBar: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 40, left: 16, right: 16, zIndex: 10 },
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
