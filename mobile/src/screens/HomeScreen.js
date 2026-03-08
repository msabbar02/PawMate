import React, { useState, useEffect, useRef, useContext } from 'react';
import {
    StyleSheet, View, Text, TouchableOpacity,
    Switch, Animated, Image, Alert,
    ActivityIndicator, Platform, Modal, ScrollView, TextInput,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { COLORS } from '../constants/colors';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import { auth, db } from '../config/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { createNotification } from '../utils/notificationHelpers';

const MY_PET = { species: 'Perro' };

const SERVICE_LABELS = { walking: '🚶 Paseos', hotel: '🏨 Hotel', daycare: '☀️ Guardería' };

// ─────────────────────────────────────────────────
// TRUST PILL
// ─────────────────────────────────────────────────
const TrustPill = ({ icon, label }) => (
    <View style={styles.trustPill}>
        <Ionicons name={icon} size={13} color={COLORS.primary} />
        <Text style={styles.trustPillText}>{label}</Text>
    </View>
);

export default function HomeScreen({ navigation }) {
    const { userData, user } = useContext(AuthContext);
    const { theme, isDarkMode } = useContext(ThemeContext);

    // ── State ──────────────────────────────────────
    const [location, setLocation] = useState(null);
    const [cityName, setCityName] = useState('');
    const [weatherData, setWeatherData] = useState({ temp: '--', icon: 'partly-sunny' });
    const [isSocialMode, setIsSocialMode] = useState(false);
    const [isWalking, setIsWalking] = useState(false);
    const [isDogModalVisible, setIsDogModalVisible] = useState(false);
    const [myDogs, setMyDogs] = useState([]);
    const [isLoadingDogs, setIsLoadingDogs] = useState(false);
    const [selectedDogToWalk, setSelectedDogToWalk] = useState(null);
    const [caregivers, setCaregivers] = useState([]);
    const [nearbyOwners, setNearbyOwners] = useState([]);
    const [isSheetCollapsed, setIsSheetCollapsed] = useState(false);

    // Caregiver panel
    const [selectedCaregiver, setSelectedCaregiver] = useState(null);
    const [isCaregiverPanelVisible, setIsCaregiverPanelVisible] = useState(false);

    // Filters
    const [filterVisible, setFilterVisible] = useState(false);
    const [filterOnline, setFilterOnline] = useState(false);
    const [filterMinRating, setFilterMinRating] = useState(0);
    const [filterService, setFilterService] = useState(null);

    // Booking modal
    const [isBookingModalVisible, setIsBookingModalVisible] = useState(false);
    const [userPets, setUserPets] = useState([]);
    const [isLoadingPets, setIsLoadingPets] = useState(false);
    const [bookingForm, setBookingForm] = useState({
        serviceType: 'walking', selectedPetIds: [], startDate: '', endDate: '', hours: 1, notes: '',
    });
    const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);

    // Unread notifications count for notif dot
    const [unreadNotifCount, setUnreadNotifCount] = useState(0);

    const mapRef = useRef(null);
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const sheetContentAnim = useRef(new Animated.Value(1)).current;

    // ── GPS + Init ─────────────────────────────────
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
            fetchCaregivers(latitude, longitude);
        })();
    }, []);

    // ── Unread Notifications Listener ──────────────
    useEffect(() => {
        if (!user?.uid) return;
        const q = query(
            collection(db, 'notifications', user.uid, 'items'),
            where('read', '==', false)
        );
        const unsub = onSnapshot(q, snap => setUnreadNotifCount(snap.size));
        return () => unsub();
    }, [user?.uid]);

    // ── SOS Pulse ──────────────────────────────────
    useEffect(() => {
        let animation;
        if (isWalking) {
            animation = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.25, duration: 900, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
                ])
            );
            animation.start();
        } else {
            pulseAnim.setValue(1);
        }
        return () => animation?.stop();
    }, [isWalking]);

    // ── Weather ────────────────────────────────────
    const fetchWeather = async (lat, lon) => {
        try {
            const resp = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
            );
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

    // ── Real Caregivers from Firestore ─────────────
    const fetchCaregivers = async (myLat, myLon) => {
        try {
            const q = query(
                collection(db, 'users'),
                where('role', '==', 'caregiver')
            );
            const snap = await getDocs(q);
            const cgList = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(cg => cg.latitude != null && cg.longitude != null); // only caregivers with GPS
            setCaregivers(cgList);
        } catch (e) {
            console.warn('fetchCaregivers error:', e.message);
        }
    };

    // ── Filtered caregivers ────────────────────────
    const filteredCaregivers = caregivers.filter(cg => {
        if (filterOnline && !cg.isOnline) return false;
        if (filterMinRating > 0 && cg.rating < filterMinRating) return false;
        if (filterService && !cg.services.includes(filterService)) return false;
        return true;
    });

    const filtersActive = filterOnline || filterMinRating > 0 || filterService !== null;

    // ── Walk Flow ──────────────────────────────────
    const handleStartWalkClick = async () => {
        if (isWalking) {
            setIsWalking(false);
            setSelectedDogToWalk(null);
            return;
        }
        setIsDogModalVisible(true);
        setIsLoadingDogs(true);
        try {
            if (!auth.currentUser) throw new Error('No auth');
            const q = query(
                collection(db, 'pets'),
                where('ownerId', '==', auth.currentUser.uid),
                where('species', '==', 'dog')
            );
            const snapshot = await getDocs(q);
            setMyDogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch { /* ignore */ } finally {
            setIsLoadingDogs(false);
        }
    };

    const proceedWithWalk = (dog) => {
        setIsDogModalVisible(false);
        setSelectedDogToWalk(dog);
        setIsWalking(true);
        Alert.alert('¡Paseo iniciado! 🐾', `Empezaste a pasear con ${dog.name}.`);
    };

    // ── Booking Modal ──────────────────────────────
    const openBookingModal = async (caregiver) => {
        setIsCaregiverPanelVisible(false);
        const initialServiceType = caregiver.services?.[0] || 'walking';
        setBookingForm({
            serviceType: initialServiceType, selectedPetIds: [], startDate: '', endDate: '', hours: 1, notes: '',
        });
        setIsBookingModalVisible(true);
        setIsLoadingPets(true);
        try {
            if (!auth.currentUser) throw new Error('no auth');
            const q = query(collection(db, 'pets'), where('ownerId', '==', auth.currentUser.uid));
            const snap = await getDocs(q);
            setUserPets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch { setUserPets([]); }
        finally { setIsLoadingPets(false); }
    };

    const handleSubmitBooking = async () => {
        if (!bookingForm.selectedPetIds.length) {
            return Alert.alert('Selecciona una mascota', 'Elige al menos una mascota para la reserva.');
        }
        if (!bookingForm.startDate.trim()) {
            return Alert.alert('Fecha requerida', 'Introduce la fecha de inicio.');
        }
        if (!selectedCaregiver) return;

        setIsSubmittingBooking(true);
        try {
            const selectedPets = userPets.filter(p => bookingForm.selectedPetIds.includes(p.id));
            const petNames = selectedPets.map(p => p.name);
            const totalPrice = (selectedCaregiver.price || 0) * selectedPets.length * bookingForm.hours;
            const SERVICE_LABELS_ES = { walking: 'Paseo', hotel: 'Hotel', daycare: 'Guardería' };
            const serviceLabel = SERVICE_LABELS_ES[bookingForm.serviceType] || bookingForm.serviceType;

            const resRef = await addDoc(collection(db, 'reservations'), {
                ownerUid: auth.currentUser.uid,
                ownerName: userData?.fullName || auth.currentUser.email,
                ownerPhotoURL: userData?.photoURL || user?.photoURL || null,
                caregiverUid: selectedCaregiver.id,
                caregiverName: selectedCaregiver.name,
                caregiverPhotoURL: selectedCaregiver.avatar || null,
                serviceType: bookingForm.serviceType,
                petIds: bookingForm.selectedPetIds,
                petNames,
                startDate: bookingForm.startDate,
                endDate: bookingForm.endDate || bookingForm.startDate,
                hours: bookingForm.hours,
                pricePerHour: selectedCaregiver.price || 0,
                totalPrice,
                notes: bookingForm.notes,
                status: 'pendiente',
                qrCode: null,
                createdAt: serverTimestamp(),
                confirmedAt: null,
                activatedAt: null,
                completedAt: null,
            });

            await createNotification(selectedCaregiver.id, {
                type: 'booking_request',
                title: 'Nueva solicitud de reserva 📅',
                body: `${userData?.fullName || 'Un dueño'} quiere reservar ${serviceLabel} para ${petNames.join(', ')} el ${bookingForm.startDate}.`,
                bookingId: resRef.id,
                bookingData: {
                    serviceType: bookingForm.serviceType,
                    petNames,
                    startDate: bookingForm.startDate,
                    totalPrice,
                    ownerUid: auth.currentUser.uid,
                    ownerName: userData?.fullName || auth.currentUser.email,
                    caregiverName: selectedCaregiver.name,
                },
                icon: 'calendar-outline',
                iconBg: '#fef3c7',
                iconColor: '#d97706',
            });

            setIsBookingModalVisible(false);
            Alert.alert('¡Solicitud enviada! 🐾', `Tu reserva de ${serviceLabel} está pendiente de confirmación.`);
        } catch (e) {
            Alert.alert('Error', 'No se pudo enviar la solicitud. Inténtalo de nuevo.');
        } finally {
            setIsSubmittingBooking(false);
        }
    };

    const centerOnUser = async () => {
        try {
            const loc = await Location.getCurrentPositionAsync({});
            const { latitude, longitude } = loc.coords;
            setLocation({ latitude, longitude });
            mapRef.current?.animateToRegion({
                latitude, longitude, latitudeDelta: 0.015, longitudeDelta: 0.015,
            }, 1000);
        } catch {
            Alert.alert('Error', 'No se pudo obtener tu ubicación.');
        }
    };

    const handleSOSPress = () => {
        if (!isWalking) {
            Alert.alert('SOS', 'El botón SOS se activa cuando hay un paseo en curso.');
            return;
        }
        Alert.alert('🆘 ALERTA SOS', '¿Enviar coordenadas GPS a contacto de emergencia?', [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'ENVIAR', onPress: () => Alert.alert('Enviado', 'Coordenadas enviadas.'), style: 'destructive' },
        ]);
    };

    const toggleSheet = () => {
        const newCollapsed = !isSheetCollapsed;
        setIsSheetCollapsed(newCollapsed);
        Animated.timing(sheetContentAnim, {
            toValue: newCollapsed ? 0 : 1,
            duration: 300,
            useNativeDriver: false,
        }).start();
    };

    // ── Helpers ────────────────────────────────────
    const firstName = userData?.fullName?.split(' ')[0] || userData?.email?.split('@')[0] || 'amigo';
    const userPhoto = user?.photoURL || userData?.photoURL || null;

    // ── Render ─────────────────────────────────────
    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar style={isDarkMode ? 'light' : 'dark'} />

            {/* MAP */}
            {location ? (
                <MapView
                    ref={mapRef}
                    provider={PROVIDER_GOOGLE}
                    style={styles.map}
                    customMapStyle={mapStyleNight}
                    showsUserLocation
                    showsMyLocationButton={false}
                    showsCompass={false}
                >
                    {/* Caregiver Markers */}
                    {filteredCaregivers.map((cg) => {
                        const isMatch = cg.accepts.includes(MY_PET.species);
                        return (
                            <Marker
                                key={cg.id}
                                coordinate={{ latitude: cg.latitude, longitude: cg.longitude }}
                                onPress={() => { setSelectedCaregiver(cg); setIsCaregiverPanelVisible(true); }}
                            >
                                <View style={[
                                    styles.mapPin,
                                    { borderColor: isMatch ? COLORS.primaryLight : '#777' },
                                    !cg.isOnline && { opacity: 0.75 },
                                ]}>
                                    <Image source={{ uri: cg.avatar }} style={styles.pinAvatar} />
                                    {/* Online / offline dot */}
                                    <View style={[
                                        styles.pinOnlineDot,
                                        { backgroundColor: cg.isOnline ? '#22c55e' : '#ef4444' },
                                    ]} />
                                </View>
                            </Marker>
                        );
                    })}

                    {/* Owner Markers (Social Mode) */}
                    {isSocialMode && nearbyOwners.map((owner) => (
                        <Marker
                            key={owner.id}
                            coordinate={{ latitude: owner.latitude, longitude: owner.longitude }}
                            onPress={() => Alert.alert('¡Hola!', `Acabas de saludar a ${owner.name} 👋`)}
                        >
                            <View style={[styles.mapPin, { borderColor: COLORS.secondary }]}>
                                <Image source={{ uri: owner.avatar }} style={styles.pinAvatar} />
                                <View style={[styles.pinOnlineDot, { backgroundColor: COLORS.secondary }]} />
                            </View>
                        </Marker>
                    ))}
                </MapView>
            ) : (
                <View style={[styles.map, styles.mapLoading]}>
                    <ActivityIndicator size="large" color={COLORS.primaryLight} />
                    <Text style={styles.mapLoadingText}>Adquiriendo señal GPS...</Text>
                </View>
            )}

            {/* ── TOP BAR ──────────────────────────── */}
            <View style={[styles.topBar, { backgroundColor: theme.cardBackground }]}>
                <View style={styles.topBarRow}>
                    {/* User photo - navigate to Settings */}
                    <TouchableOpacity style={styles.userAvatarBox} onPress={() => navigation.navigate('Settings')}>
                        {userPhoto
                            ? <Image source={{ uri: userPhoto }} style={styles.userAvatarImg} />
                            : <Ionicons name="person" size={18} color="#FFF" />
                        }
                    </TouchableOpacity>

                    {/* Greeting + city */}
                    <View style={styles.greetingWrap}>
                        <Text style={styles.greetHello} numberOfLines={1}>Hola, {firstName} 👋</Text>
                        <View style={styles.weatherRow}>
                            <Ionicons name={weatherData.icon} size={12} color={COLORS.primaryLight} />
                            <Text style={styles.weatherText}>{weatherData.temp}°C</Text>
                            {cityName ? (
                                <>
                                    <Text style={styles.weatherDot}>·</Text>
                                    <Ionicons name="location-outline" size={11} color={COLORS.primaryLight} />
                                    <Text style={styles.cityText}>{cityName}</Text>
                                </>
                            ) : null}
                            {isSocialMode && (
                                <View style={styles.communityChip}>
                                    <Text style={styles.communityChipText}>Comunidad</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Filter button */}
                    <TouchableOpacity style={[styles.iconBtn, { backgroundColor: isDarkMode ? '#1a3626' : '#e8f5ee' }]} onPress={() => setFilterVisible(true)}>
                        <Ionicons name="options-outline" size={20} color={theme.text} />
                        {filtersActive && <View style={styles.filterActiveDot} />}
                    </TouchableOpacity>

                    {/* Notifications */}
                    <TouchableOpacity style={[styles.iconBtn, { backgroundColor: isDarkMode ? '#1a3626' : '#e8f5ee' }]} onPress={() => navigation.navigate('Notifications')}>
                        <Ionicons name="notifications-outline" size={20} color={theme.text} />
                        {unreadNotifCount > 0 && (
                            <View style={styles.notifDot}>
                                <Text style={styles.notifDotText}>
                                    {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── GPS BUTTON ────────────────────────── */}
            <TouchableOpacity style={styles.gpsBtn} onPress={centerOnUser}>
                <Ionicons name="locate" size={22} color={COLORS.primary} />
            </TouchableOpacity>

            {/* ── BOTTOM SHEET ──────────────────────── */}
            <View style={[styles.bottomSheet, { backgroundColor: theme.cardBackground }]}>
                {/* Collapsible handle */}
                <TouchableOpacity style={styles.sheetHandleBtn} onPress={toggleSheet} activeOpacity={0.7}>
                    <View style={styles.sheetHandle} />
                    <Ionicons
                        name={isSheetCollapsed ? 'chevron-up' : 'chevron-down'}
                        size={16} color={COLORS.textLight}
                        style={{ marginTop: 2 }}
                    />
                </TouchableOpacity>

                {/* Collapsible content */}
                <Animated.View style={{
                    overflow: 'hidden',
                    maxHeight: sheetContentAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 420] }),
                    opacity: sheetContentAnim,
                }}>
                    <Text style={styles.sheetTitle}>
                        {isSocialMode ? '🌍 Dueños cercanos' : '¿Qué quieres hacer?'}
                    </Text>

                    {/* ── WALK BUTTON ── */}
                    <TouchableOpacity
                        style={[styles.walkBtn, isWalking ? styles.walkBtnActive : styles.walkBtnDefault]}
                        onPress={handleStartWalkClick}
                        activeOpacity={0.88}
                    >
                        <View style={[styles.walkIconCircle, {
                            backgroundColor: isWalking ? 'rgba(255,255,255,0.2)' : COLORS.primaryBg,
                        }]}>
                            <Ionicons
                                name={isWalking ? 'stop-circle' : 'walk'}
                                size={30}
                                color={isWalking ? '#FFF' : COLORS.primary}
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.walkBtnTitle, isWalking && { color: '#FFF' }]}>
                                {isWalking ? 'Finalizar Paseo' : 'Iniciar Paseo'}
                            </Text>
                            <Text style={[styles.walkBtnSub, isWalking && { color: 'rgba(255,255,255,0.75)' }]}>
                                {isWalking && selectedDogToWalk
                                    ? `Paseando a ${selectedDogToWalk.name}`
                                    : 'Seguimiento GPS · kcal en tiempo real'}
                            </Text>
                        </View>
                        <Ionicons
                            name={isWalking ? 'stop-circle-outline' : 'arrow-forward-circle'}
                            size={30}
                            color={isWalking ? '#FFF' : COLORS.primary}
                        />
                    </TouchableOpacity>

                    {/* SOS row — only while walking */}
                    {isWalking && (
                        <TouchableOpacity style={styles.sosRow} onPress={handleSOSPress} activeOpacity={0.8}>
                            <Animated.View style={[styles.sosIconWrap, { transform: [{ scale: pulseAnim }] }]}>
                                <Ionicons name="alert-circle" size={20} color={COLORS.danger} />
                            </Animated.View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.sosRowTitle}>SOS Emergencia</Text>
                                <Text style={styles.sosRowSub}>Enviar ubicación GPS a contacto</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={COLORS.danger} />
                        </TouchableOpacity>
                    )}

                    {/* Social Mode Toggle */}
                    <View style={styles.socialRow}>
                        <View>
                            <Text style={styles.socialTitle}>Modo Comunidad</Text>
                            <Text style={styles.socialSub}>Ver dueños de mascotas cerca</Text>
                        </View>
                        <Switch
                            value={isSocialMode}
                            onValueChange={setIsSocialMode}
                            trackColor={{ true: COLORS.secondary, false: COLORS.border }}
                            thumbColor="#FFF"
                        />
                    </View>

                    {/* Trust Banner */}
                    <View style={styles.trustBanner}>
                        <TrustPill icon="shield-checkmark" label="Cuidadores verificados" />
                        <TrustPill icon="shield-outline" label="Seguro incluido" />
                        <TrustPill icon="location" label="GPS en tiempo real" />
                    </View>
                </Animated.View>
            </View>

            {/* ── MODAL: DOG SELECTION ───────────────── */}
            <Modal visible={isDogModalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.dogSheet}>
                        <View style={styles.sheetHandle} />
                        <Text style={styles.dogSheetTitle}>¿A quién vas a pasear?</Text>

                        {isLoadingDogs ? (
                            <ActivityIndicator size="large" color={COLORS.primary} style={{ marginVertical: 30 }} />
                        ) : myDogs.length === 0 ? (
                            <View style={styles.emptyDog}>
                                <Text style={{ fontSize: 44 }}>🐕</Text>
                                <Text style={styles.emptyDogText}>
                                    No tienes perros registrados. Añade uno en "Mis Mascotas".
                                </Text>
                            </View>
                        ) : (
                            myDogs.map(dog => (
                                <TouchableOpacity key={dog.id} style={styles.dogRow} onPress={() => proceedWithWalk(dog)}>
                                    {dog.image
                                        ? <Image source={{ uri: dog.image }} style={styles.dogRowImg} />
                                        : <View style={styles.dogRowPlaceholder}><Text style={{ fontSize: 22 }}>🐕</Text></View>
                                    }
                                    <Text style={styles.dogRowName}>{dog.name}</Text>
                                    <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
                                </TouchableOpacity>
                            ))
                        )}

                        <TouchableOpacity style={styles.cancelDogBtn} onPress={() => setIsDogModalVisible(false)}>
                            <Text style={styles.cancelDogText}>Cancelar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ── MODAL: CAREGIVER PANEL ─────────────── */}
            <Modal visible={isCaregiverPanelVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.caregiverSheet}>
                        <View style={styles.sheetHandle} />

                        {selectedCaregiver && (
                            <>
                                {/* Avatar + name + status */}
                                <View style={styles.cgHeaderRow}>
                                    <View style={styles.cgAvatarWrap}>
                                        <Image source={{ uri: selectedCaregiver.avatar }} style={styles.cgAvatar} />
                                        <View style={[
                                            styles.cgOnlineDot,
                                            { backgroundColor: selectedCaregiver.isOnline ? '#22c55e' : '#ef4444' },
                                        ]} />
                                    </View>

                                    <View style={{ flex: 1, marginLeft: 14 }}>
                                        <Text style={styles.cgName}>{selectedCaregiver.name}</Text>

                                        {/* Online / offline */}
                                        <View style={styles.cgStatusRow}>
                                            <View style={[
                                                styles.cgStatusDot,
                                                { backgroundColor: selectedCaregiver.isOnline ? '#22c55e' : '#ef4444' },
                                            ]} />
                                            <Text style={[
                                                styles.cgStatusText,
                                                { color: selectedCaregiver.isOnline ? '#22c55e' : '#ef4444' },
                                            ]}>
                                                {selectedCaregiver.isOnline
                                                    ? 'En línea'
                                                    : `Offline · ${selectedCaregiver.lastSeen}`}
                                            </Text>
                                        </View>

                                        {/* Stars */}
                                        <View style={styles.cgRatingRow}>
                                            {[1, 2, 3, 4, 5].map(s => (
                                                <Ionicons
                                                    key={s}
                                                    name={s <= Math.round(selectedCaregiver.rating) ? 'star' : 'star-outline'}
                                                    size={13} color={COLORS.warning}
                                                />
                                            ))}
                                            <Text style={styles.cgRatingText}>
                                                {selectedCaregiver.rating} ({selectedCaregiver.reviews} reseñas)
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Price */}
                                    <View style={styles.priceBox}>
                                        <Text style={styles.priceValue}>{selectedCaregiver.price}€</Text>
                                        <Text style={styles.priceUnit}>/hora</Text>
                                    </View>
                                </View>

                                {/* Services */}
                                <View style={styles.cgServicesRow}>
                                    {selectedCaregiver.services?.map(s => (
                                        <View key={s} style={styles.serviceTag}>
                                            <Text style={styles.serviceTagText}>{SERVICE_LABELS[s] || s}</Text>
                                        </View>
                                    ))}
                                </View>

                                {/* Accepts your pet banner */}
                                {selectedCaregiver.accepts?.includes(MY_PET.species) && (
                                    <View style={styles.acceptsBanner}>
                                        <Ionicons name="checkmark-circle" size={15} color={COLORS.primary} />
                                        <Text style={styles.acceptsBannerText}>Acepta tu mascota</Text>
                                    </View>
                                )}

                                {/* Divider */}
                                <View style={styles.divider} />

                                {/* Reserve button */}
                                <TouchableOpacity
                                    style={[
                                        styles.reserveBtn,
                                        !selectedCaregiver.isOnline && styles.reserveBtnOffline,
                                    ]}
                                    onPress={() => openBookingModal(selectedCaregiver)}
                                    activeOpacity={0.88}
                                >
                                    <Ionicons name="calendar-outline" size={20} color="#FFF" />
                                    <Text style={styles.reserveBtnText}>
                                        {selectedCaregiver.isOnline ? 'Reservar ahora' : 'Reservar (offline)'}
                                    </Text>
                                </TouchableOpacity>

                                {/* Close */}
                                <TouchableOpacity
                                    style={styles.cgCloseBtn}
                                    onPress={() => setIsCaregiverPanelVisible(false)}
                                >
                                    <Text style={styles.cgCloseBtnText}>Cerrar</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            </Modal>

            {/* ── MODAL: BOOKING REQUEST ─────────────── */}
            <Modal visible={isBookingModalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.bookingSheet}>
                        <View style={styles.sheetHandle} />
                        <Text style={styles.bookingSheetTitle}>Nueva Reserva</Text>

                        {selectedCaregiver && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                {/* Caregiver mini header */}
                                <View style={styles.bkCaregiverRow}>
                                    <Image source={{ uri: selectedCaregiver.avatar }} style={styles.bkCaregiverAvatar} />
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={styles.bkCaregiverName}>{selectedCaregiver.name}</Text>
                                        <Text style={styles.bkCaregiverPrice}>{selectedCaregiver.price}€/hora</Text>
                                    </View>
                                </View>

                                {/* Service type */}
                                <Text style={styles.bkLabel}>Tipo de servicio</Text>
                                <View style={styles.bkServiceRow}>
                                    {(selectedCaregiver.services || []).map(svc => (
                                        <TouchableOpacity
                                            key={svc}
                                            style={[styles.bkServiceChip, bookingForm.serviceType === svc && styles.bkServiceChipActive]}
                                            onPress={() => setBookingForm(f => ({ ...f, serviceType: svc, selectedPetIds: [] }))}
                                        >
                                            <Text style={[styles.bkServiceChipText, bookingForm.serviceType === svc && { color: '#FFF' }]}>
                                                {SERVICE_LABELS[svc] || svc}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {/* Pet selection */}
                                <Text style={styles.bkLabel}>
                                    {bookingForm.serviceType === 'walking' ? 'Elige tus perros' : 'Elige tus mascotas'}
                                </Text>
                                {isLoadingPets ? (
                                    <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: 10 }} />
                                ) : userPets.length === 0 ? (
                                    <Text style={styles.bkEmptyPets}>No tienes mascotas registradas. Añade una en "Mis Mascotas".</Text>
                                ) : (
                                    userPets
                                        .filter(p => bookingForm.serviceType !== 'walking' || (p.species?.toLowerCase() === 'perro' || p.species?.toLowerCase() === 'dog'))
                                        .map(pet => {
                                            const selected = bookingForm.selectedPetIds.includes(pet.id);
                                            return (
                                                <TouchableOpacity
                                                    key={pet.id}
                                                    style={[styles.bkPetRow, selected && styles.bkPetRowSelected]}
                                                    onPress={() => {
                                                        setBookingForm(f => ({
                                                            ...f,
                                                            selectedPetIds: selected
                                                                ? f.selectedPetIds.filter(id => id !== pet.id)
                                                                : [...f.selectedPetIds, pet.id],
                                                        }));
                                                    }}
                                                >
                                                    {pet.image
                                                        ? <Image source={{ uri: pet.image }} style={styles.bkPetImg} />
                                                        : <View style={styles.bkPetImgPlaceholder}><Text style={{ fontSize: 20 }}>🐾</Text></View>
                                                    }
                                                    <Text style={[styles.bkPetName, selected && { color: COLORS.primary }]}>{pet.name}</Text>
                                                    <View style={[styles.bkCheckbox, selected && styles.bkCheckboxActive]}>
                                                        {selected && <Ionicons name="checkmark" size={13} color="#FFF" />}
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        })
                                )}

                                {/* Date */}
                                <Text style={styles.bkLabel}>Fecha de inicio</Text>
                                <TextInput
                                    style={styles.bkInput}
                                    value={bookingForm.startDate}
                                    onChangeText={t => setBookingForm(f => ({ ...f, startDate: t }))}
                                    placeholder="YYYY-MM-DD  (ej. 2026-03-20)"
                                    placeholderTextColor={COLORS.textLight}
                                />
                                {bookingForm.serviceType !== 'walking' && (
                                    <>
                                        <Text style={styles.bkLabel}>Fecha de fin</Text>
                                        <TextInput
                                            style={styles.bkInput}
                                            value={bookingForm.endDate}
                                            onChangeText={t => setBookingForm(f => ({ ...f, endDate: t }))}
                                            placeholder="YYYY-MM-DD  (opcional)"
                                            placeholderTextColor={COLORS.textLight}
                                        />
                                    </>
                                )}

                                {/* Hours / nights */}
                                <Text style={styles.bkLabel}>
                                    {bookingForm.serviceType === 'hotel' ? 'Noches' : 'Horas'}
                                </Text>
                                <View style={styles.bkCounterRow}>
                                    <TouchableOpacity
                                        style={styles.bkCounterBtn}
                                        onPress={() => setBookingForm(f => ({ ...f, hours: Math.max(1, f.hours - 1) }))}
                                    >
                                        <Ionicons name="remove" size={20} color={COLORS.primary} />
                                    </TouchableOpacity>
                                    <Text style={styles.bkCounterVal}>{bookingForm.hours}</Text>
                                    <TouchableOpacity
                                        style={styles.bkCounterBtn}
                                        onPress={() => setBookingForm(f => ({ ...f, hours: f.hours + 1 }))}
                                    >
                                        <Ionicons name="add" size={20} color={COLORS.primary} />
                                    </TouchableOpacity>
                                </View>

                                {/* Price summary */}
                                {bookingForm.selectedPetIds.length > 0 && (
                                    <View style={styles.bkPriceSummary}>
                                        <Text style={styles.bkPriceSummaryLabel}>Total estimado</Text>
                                        <Text style={styles.bkPriceSummaryValue}>
                                            {(selectedCaregiver.price * bookingForm.selectedPetIds.length * bookingForm.hours).toFixed(0)}€
                                        </Text>
                                        <Text style={styles.bkPriceSummaryDetail}>
                                            {selectedCaregiver.price}€ × {bookingForm.selectedPetIds.length} mascota{bookingForm.selectedPetIds.length > 1 ? 's' : ''} × {bookingForm.hours} {bookingForm.serviceType === 'hotel' ? 'noche' : 'hora'}{bookingForm.hours > 1 ? 's' : ''}
                                        </Text>
                                    </View>
                                )}

                                {/* Notes */}
                                <Text style={styles.bkLabel}>Notas (opcional)</Text>
                                <TextInput
                                    style={[styles.bkInput, { height: 72, textAlignVertical: 'top', paddingTop: 10 }]}
                                    multiline
                                    value={bookingForm.notes}
                                    onChangeText={t => setBookingForm(f => ({ ...f, notes: t }))}
                                    placeholder="Alergias, rutinas, instrucciones especiales..."
                                    placeholderTextColor={COLORS.textLight}
                                />

                                {/* Submit */}
                                <TouchableOpacity
                                    style={[styles.bkSubmitBtn, isSubmittingBooking && { opacity: 0.7 }]}
                                    onPress={handleSubmitBooking}
                                    disabled={isSubmittingBooking}
                                >
                                    {isSubmittingBooking
                                        ? <ActivityIndicator color="#FFF" />
                                        : <>
                                            <Ionicons name="send-outline" size={18} color="#FFF" />
                                            <Text style={styles.bkSubmitBtnText}>Enviar solicitud</Text>
                                          </>
                                    }
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.bkCancelBtn} onPress={() => setIsBookingModalVisible(false)}>
                                    <Text style={styles.bkCancelBtnText}>Cancelar</Text>
                                </TouchableOpacity>
                                <View style={{ height: 20 }} />
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            {/* ── MODAL: FILTERS ─────────────────────── */}
            <Modal visible={filterVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.filterSheet, { backgroundColor: theme.cardBackground }]}>
                        <View style={styles.sheetHandle} />
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={styles.filterTitle}>Filtros</Text>
                            <TouchableOpacity onPress={() => setFilterVisible(false)} style={{ padding: 6 }}>
                                <Ionicons name="close-circle" size={28} color={COLORS.textLight} />
                            </TouchableOpacity>
                        </View>

                        {/* Online only */}
                        <View style={styles.filterSwitchRow}>
                            <View>
                                <Text style={styles.filterLabel}>Solo disponibles (en línea)</Text>
                                <Text style={styles.filterLabelSub}>Ocultar cuidadores offline</Text>
                            </View>
                            <Switch
                                value={filterOnline}
                                onValueChange={setFilterOnline}
                                trackColor={{ true: COLORS.primary, false: COLORS.border }}
                                thumbColor="#FFF"
                            />
                        </View>

                        {/* Min rating */}
                        <Text style={styles.filterSectionLabel}>Valoración mínima</Text>
                        <View style={styles.filterChips}>
                            {[
                                { v: 0,   l: 'Todas' },
                                { v: 4,   l: '4+ ⭐' },
                                { v: 4.5, l: '4.5+ ⭐' },
                                { v: 4.8, l: '4.8+ ⭐' },
                            ].map(({ v, l }) => (
                                <TouchableOpacity
                                    key={String(v)}
                                    style={[styles.filterChip, filterMinRating === v && styles.filterChipActive]}
                                    onPress={() => setFilterMinRating(v)}
                                >
                                    <Text style={[styles.filterChipText, filterMinRating === v && { color: '#FFF' }]}>{l}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Service type */}
                        <Text style={styles.filterSectionLabel}>Tipo de servicio</Text>
                        <View style={styles.filterChips}>
                            {[
                                { v: null,       l: 'Todos' },
                                { v: 'walking',  l: '🚶 Paseo' },
                                { v: 'hotel',    l: '🏨 Hotel' },
                                { v: 'daycare',  l: '☀️ Guardería' },
                            ].map(({ v, l }) => (
                                <TouchableOpacity
                                    key={String(v)}
                                    style={[styles.filterChip, filterService === v && styles.filterChipActive]}
                                    onPress={() => setFilterService(v)}
                                >
                                    <Text style={[styles.filterChipText, filterService === v && { color: '#FFF' }]}>{l}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity style={styles.applyFilterBtn} onPress={() => setFilterVisible(false)}>
                            <Text style={styles.applyFilterBtnText}>Aplicar filtros</Text>
                        </TouchableOpacity>

                        {filtersActive && (
                            <TouchableOpacity
                                style={styles.clearFilterBtn}
                                onPress={() => { setFilterOnline(false); setFilterMinRating(0); setFilterService(null); }}
                            >
                                <Text style={styles.clearFilterBtnText}>Limpiar filtros</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

// ─────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1d2c4d' },
    map: { ...StyleSheet.absoluteFillObject },
    mapLoading: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#1d2c4d' },
    mapLoadingText: { marginTop: 10, color: '#8ec3b9', fontWeight: '600' },

    // Map markers
    mapPin: {
        width: 48, height: 48, borderRadius: 24,
        borderWidth: 3, backgroundColor: '#FFF',
        justifyContent: 'center', alignItems: 'center',
        shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 6, elevation: 8,
    },
    pinAvatar: { width: 40, height: 40, borderRadius: 20 },
    pinOnlineDot: {
        position: 'absolute', bottom: -1, right: -1,
        width: 14, height: 14, borderRadius: 7,
        borderWidth: 2.5, borderColor: '#FFF',
    },

    // TOP BAR
    topBar: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 56 : 36,
        left: 16, right: 16,
    },
    topBarRow: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: 'rgba(255,255,255,0.96)',
        borderRadius: 22, paddingVertical: 10, paddingHorizontal: 14,
        shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 14, elevation: 7,
    },
    userAvatarBox: {
        width: 42, height: 42, borderRadius: 21,
        backgroundColor: COLORS.primary,
        justifyContent: 'center', alignItems: 'center',
        overflow: 'hidden',
    },
    userAvatarImg: { width: 42, height: 42, borderRadius: 21 },
    greetingWrap: { flex: 1 },
    greetHello: { fontSize: 15, fontWeight: '800', color: COLORS.text },
    weatherRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    weatherText: { fontSize: 12, fontWeight: '700', color: COLORS.textLight },
    weatherDot: { fontSize: 12, color: COLORS.textLight },
    cityText: { fontSize: 12, fontWeight: '600', color: COLORS.textLight },
    communityChip: {
        backgroundColor: COLORS.secondaryLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
    },
    communityChipText: { fontSize: 11, fontWeight: '700', color: COLORS.secondary },
    iconBtn: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: COLORS.surface,
        justifyContent: 'center', alignItems: 'center',
        position: 'relative',
    },
    filterActiveDot: {
        position: 'absolute', top: 6, right: 6,
        width: 8, height: 8, borderRadius: 4,
        backgroundColor: COLORS.primary, borderWidth: 1.5, borderColor: '#FFF',
    },
    notifDot: {
        position: 'absolute', top: 4, right: 4,
        minWidth: 16, height: 16, borderRadius: 8,
        backgroundColor: COLORS.danger, borderWidth: 1.5, borderColor: '#FFF',
        justifyContent: 'center', alignItems: 'center', paddingHorizontal: 2,
    },
    notifDotText: {
        color: '#FFF', fontSize: 9, fontWeight: '800',
    },

    // GPS
    gpsBtn: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 124 : 104,
        right: 18,
        width: 48, height: 48, borderRadius: 24,
        backgroundColor: '#FFF',
        justifyContent: 'center', alignItems: 'center',
        shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 5,
    },

    // BOTTOM SHEET
    bottomSheet: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: '#FFF',
        borderTopLeftRadius: 30, borderTopRightRadius: 30,
        paddingHorizontal: 20,
        paddingBottom: Platform.OS === 'ios' ? 38 : 22,
        shadowColor: '#000', shadowOpacity: 0.18,
        shadowRadius: 20, shadowOffset: { width: 0, height: -4 }, elevation: 12,
    },
    sheetHandleBtn: { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
    sheetHandle: {
        width: 40, height: 5, backgroundColor: COLORS.border,
        borderRadius: 3, alignSelf: 'center',
    },
    sheetTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginBottom: 14, marginTop: 8 },

    // Walk Button
    walkBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 14,
        borderRadius: 22, paddingVertical: 14, paddingHorizontal: 18,
        marginBottom: 12,
    },
    walkBtnDefault: {
        backgroundColor: '#FFF',
        borderWidth: 2, borderColor: COLORS.primary,
        shadowColor: COLORS.primary, shadowOpacity: 0.15, shadowRadius: 8, elevation: 3,
    },
    walkBtnActive: {
        backgroundColor: COLORS.danger,
        shadowColor: COLORS.danger, shadowOpacity: 0.35, shadowRadius: 10, elevation: 5,
    },
    walkIconCircle: {
        width: 52, height: 52, borderRadius: 16,
        justifyContent: 'center', alignItems: 'center',
    },
    walkBtnTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
    walkBtnSub: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },

    // SOS row
    sosRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: COLORS.dangerLight, borderRadius: 18,
        paddingVertical: 12, paddingHorizontal: 16, marginBottom: 12,
        borderWidth: 1.5, borderColor: '#fca5a5',
    },
    sosIconWrap: { justifyContent: 'center', alignItems: 'center' },
    sosRowTitle: { fontSize: 14, fontWeight: '800', color: COLORS.danger },
    sosRowSub: { fontSize: 12, color: '#b91c1c', marginTop: 1 },

    // Social toggle
    socialRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginTop: 4, paddingTop: 14, borderTopWidth: 1, borderTopColor: COLORS.border,
    },
    socialTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text },
    socialSub: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },

    // Trust banner
    trustBanner: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
    trustPill: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: COLORS.primaryBg, borderRadius: 20,
        paddingHorizontal: 8, paddingVertical: 5,
    },
    trustPillText: { fontSize: 10, fontWeight: '700', color: COLORS.primary },

    // Modal shared
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },

    // Dog Sheet
    dogSheet: {
        backgroundColor: COLORS.surface,
        borderTopLeftRadius: 30, borderTopRightRadius: 30,
        padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    },
    dogSheetTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text, textAlign: 'center', marginBottom: 20 },
    emptyDog: { alignItems: 'center', marginVertical: 20, gap: 10 },
    emptyDogText: { textAlign: 'center', color: COLORS.textLight, fontSize: 14, paddingHorizontal: 20, lineHeight: 20 },
    dogRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#FFF', padding: 14, borderRadius: 18, marginBottom: 10,
        shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    },
    dogRowImg: { width: 46, height: 46, borderRadius: 23 },
    dogRowPlaceholder: {
        width: 46, height: 46, borderRadius: 23,
        backgroundColor: COLORS.primaryBg, justifyContent: 'center', alignItems: 'center',
    },
    dogRowName: { flex: 1, marginLeft: 14, fontSize: 16, fontWeight: '800', color: COLORS.text },
    cancelDogBtn: { marginTop: 8, paddingVertical: 14, alignItems: 'center' },
    cancelDogText: { color: COLORS.textLight, fontSize: 16, fontWeight: '700' },

    // Caregiver Sheet
    caregiverSheet: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 30, borderTopRightRadius: 30,
        padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    },
    cgHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, marginTop: 8 },
    cgAvatarWrap: { position: 'relative' },
    cgAvatar: { width: 64, height: 64, borderRadius: 22 },
    cgOnlineDot: {
        position: 'absolute', bottom: 1, right: 1,
        width: 16, height: 16, borderRadius: 8,
        borderWidth: 2.5, borderColor: '#FFF',
    },
    cgName: { fontSize: 18, fontWeight: '900', color: COLORS.text, marginBottom: 4 },
    cgStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
    cgStatusDot: { width: 8, height: 8, borderRadius: 4 },
    cgStatusText: { fontSize: 13, fontWeight: '700' },
    cgRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    cgRatingText: { fontSize: 12, color: COLORS.textLight, fontWeight: '600', marginLeft: 4 },
    priceBox: { alignItems: 'center', backgroundColor: COLORS.primaryBg, borderRadius: 14, padding: 10, marginLeft: 8 },
    priceValue: { fontSize: 20, fontWeight: '900', color: COLORS.primary },
    priceUnit: { fontSize: 11, color: COLORS.textLight, fontWeight: '600' },
    cgServicesRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    serviceTag: {
        backgroundColor: COLORS.surface, borderRadius: 20,
        paddingHorizontal: 12, paddingVertical: 6,
        borderWidth: 1, borderColor: COLORS.border,
    },
    serviceTagText: { fontSize: 12, fontWeight: '700', color: COLORS.text },
    acceptsBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: COLORS.primaryBg, borderRadius: 14,
        paddingHorizontal: 12, paddingVertical: 8, marginBottom: 14,
    },
    acceptsBannerText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
    divider: { height: 1, backgroundColor: COLORS.border, marginBottom: 16 },
    reserveBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        backgroundColor: COLORS.primary, borderRadius: 18,
        paddingVertical: 16, marginBottom: 10,
        shadowColor: COLORS.primary, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
    },
    reserveBtnOffline: { backgroundColor: COLORS.textLight },
    reserveBtnText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
    cgCloseBtn: { paddingVertical: 12, alignItems: 'center' },
    cgCloseBtnText: { color: COLORS.textLight, fontSize: 15, fontWeight: '600' },

    // Filter Sheet
    filterSheet: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 30, borderTopRightRadius: 30,
        padding: 24, paddingBottom: Platform.OS === 'ios' ? 44 : 28,
    },
    filterTitle: { fontSize: 22, fontWeight: '900', color: COLORS.text, marginBottom: 20, marginTop: 8 },
    filterSwitchRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: COLORS.surface, borderRadius: 18,
        paddingHorizontal: 16, paddingVertical: 14, marginBottom: 20,
    },
    filterLabel: { fontSize: 15, fontWeight: '700', color: COLORS.text },
    filterLabelSub: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
    filterSectionLabel: {
        fontSize: 11, fontWeight: '700', color: COLORS.textLight,
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10,
    },
    filterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
    filterChip: {
        paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20,
        borderWidth: 2, borderColor: COLORS.border, backgroundColor: '#FFF',
    },
    filterChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
    filterChipText: { fontSize: 13, fontWeight: '700', color: COLORS.text },
    applyFilterBtn: {
        backgroundColor: COLORS.primary, borderRadius: 18,
        paddingVertical: 16, alignItems: 'center',
        shadowColor: COLORS.primary, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
    },
    applyFilterBtnText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
    clearFilterBtn: { paddingVertical: 14, alignItems: 'center' },
    clearFilterBtnText: { color: COLORS.danger, fontWeight: '700', fontSize: 14 },

    // Booking Sheet
    bookingSheet: {
        backgroundColor: '#FFF',
        borderTopLeftRadius: 30, borderTopRightRadius: 30,
        padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        maxHeight: '92%',
    },
    bookingSheetTitle: { fontSize: 22, fontWeight: '900', color: COLORS.text, marginBottom: 16, marginTop: 8 },
    bkCaregiverRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: COLORS.surface, borderRadius: 18,
        padding: 14, marginBottom: 18,
    },
    bkCaregiverAvatar: { width: 48, height: 48, borderRadius: 16 },
    bkCaregiverName: { fontSize: 15, fontWeight: '800', color: COLORS.text },
    bkCaregiverPrice: { fontSize: 13, color: COLORS.primary, fontWeight: '700', marginTop: 2 },
    bkLabel: {
        fontSize: 11, fontWeight: '700', color: COLORS.textLight,
        textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 14, marginBottom: 8,
    },
    bkServiceRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    bkServiceChip: {
        paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20,
        borderWidth: 2, borderColor: COLORS.border, backgroundColor: '#FFF',
    },
    bkServiceChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
    bkServiceChipText: { fontSize: 13, fontWeight: '700', color: COLORS.text },
    bkEmptyPets: {
        fontSize: 13, color: COLORS.textLight, textAlign: 'center',
        backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, marginVertical: 4,
    },
    bkPetRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: COLORS.surface, borderRadius: 16, padding: 12, marginBottom: 8,
        borderWidth: 2, borderColor: 'transparent',
    },
    bkPetRowSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryBg },
    bkPetImg: { width: 42, height: 42, borderRadius: 14 },
    bkPetImgPlaceholder: {
        width: 42, height: 42, borderRadius: 14,
        backgroundColor: COLORS.primaryBg, justifyContent: 'center', alignItems: 'center',
    },
    bkPetName: { flex: 1, fontSize: 15, fontWeight: '700', color: COLORS.text },
    bkCheckbox: {
        width: 22, height: 22, borderRadius: 11,
        borderWidth: 2, borderColor: COLORS.border, backgroundColor: '#FFF',
        justifyContent: 'center', alignItems: 'center',
    },
    bkCheckboxActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
    bkInput: {
        backgroundColor: COLORS.surface, borderRadius: 14,
        paddingHorizontal: 14, paddingVertical: 12,
        fontSize: 15, color: COLORS.text,
        borderWidth: 1.5, borderColor: COLORS.border,
    },
    bkCounterRow: {
        flexDirection: 'row', alignItems: 'center', gap: 20,
        backgroundColor: COLORS.surface, borderRadius: 18,
        paddingVertical: 10, paddingHorizontal: 20, alignSelf: 'flex-start',
    },
    bkCounterBtn: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: COLORS.primaryBg, justifyContent: 'center', alignItems: 'center',
    },
    bkCounterVal: { fontSize: 22, fontWeight: '900', color: COLORS.text, minWidth: 30, textAlign: 'center' },
    bkPriceSummary: {
        backgroundColor: COLORS.primaryBg, borderRadius: 18, padding: 16, marginTop: 14,
        alignItems: 'center',
    },
    bkPriceSummaryLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textLight, textTransform: 'uppercase', letterSpacing: 0.5 },
    bkPriceSummaryValue: { fontSize: 32, fontWeight: '900', color: COLORS.primary, marginTop: 4 },
    bkPriceSummaryDetail: { fontSize: 12, color: COLORS.textLight, marginTop: 4 },
    bkSubmitBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        backgroundColor: COLORS.primary, borderRadius: 18,
        paddingVertical: 16, marginTop: 20,
        shadowColor: COLORS.primary, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
    },
    bkSubmitBtnText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
    bkCancelBtn: { paddingVertical: 14, alignItems: 'center' },
    bkCancelBtnText: { color: COLORS.textLight, fontSize: 15, fontWeight: '600' },
});

// ─────────────────────────────────────────────────
// MAP STYLE — Night Pro
// ─────────────────────────────────────────────────
const mapStyleNight = [
    { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
    { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
    { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#283d6a' }] },
    { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
    { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#1a3d2b' }] },
    { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#6b9a76' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#38414e' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9ca5b3' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2c6675' }] },
    { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#1f3d4a' }] },
    { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#b0d5ce' }] },
    { featureType: 'road.highway', elementType: 'labels.text.stroke', stylers: [{ color: '#023e58' }] },
    { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
    { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#d59563' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] },
    { featureType: 'water', elementType: 'labels.text.stroke', stylers: [{ color: '#17263c' }] },
];
