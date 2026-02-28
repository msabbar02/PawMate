import React, { useState, useEffect, useContext, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

// Helper to calculate distance between two coordinates in km
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    var R = 6371; // Radius of the earth in km
    var dLat = (lat2 - lat1) * (Math.PI / 180);
    var dLon = (lon2 - lon1) * (Math.PI / 180);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // Distance in km
    return d;
}

const WalkTrackingScreen = ({ route, navigation }) => {
    const { theme } = useContext(ThemeContext);
    const { user } = useContext(AuthContext);
    const styles = getStyles(theme);

    const { petId, petName } = route.params;

    const [location, setLocation] = useState(null);
    const [routeCoords, setRouteCoords] = useState([]);
    const [isActive, setIsActive] = useState(false);

    // Stats
    const [distance, setDistance] = useState(0);
    const [durationSecs, setDurationSecs] = useState(0);
    const timerRef = useRef(null);
    const locationSubscriptionRef = useRef(null);
    const mapRef = useRef(null);

    useEffect(() => {
        const checkLocationAuth = async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Acceso Denegado', 'Permiso de ubicación es necesario para el seguimiento de paseos.');
                navigation.goBack();
                return;
            }

            let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            setLocation(loc);
        };
        checkLocationAuth();

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (locationSubscriptionRef.current) locationSubscriptionRef.current.remove();
        };
    }, []);

    const startWalk = async () => {
        setIsActive(true);
        setRouteCoords([]);
        setDistance(0);
        setDurationSecs(0);

        // Start timer
        timerRef.current = setInterval(() => {
            setDurationSecs(prev => prev + 1);
        }, 1000);

        // Start location tracking
        locationSubscriptionRef.current = await Location.watchPositionAsync(
            {
                accuracy: Location.Accuracy.High,
                timeInterval: 3000,
                distanceInterval: 5,
            },
            (newLocation) => {
                const { latitude, longitude } = newLocation.coords;

                setRouteCoords(prevCoords => {
                    const newCoords = [...prevCoords, { latitude, longitude }];
                    if (prevCoords.length > 0) {
                        const lastCoord = prevCoords[prevCoords.length - 1];
                        const dist = getDistanceFromLatLonInKm(
                            lastCoord.latitude, lastCoord.longitude,
                            latitude, longitude
                        );
                        setDistance(prevDist => prevDist + dist);
                    }
                    return newCoords;
                });
                setLocation(newLocation);

                // Keep map centered on current location
                if (mapRef.current) {
                    mapRef.current.animateToRegion({
                        latitude,
                        longitude,
                        latitudeDelta: 0.005,
                        longitudeDelta: 0.005,
                    }, 1000);
                }
            }
        );
    };

    const stopWalk = async () => {
        setIsActive(false);
        if (timerRef.current) clearInterval(timerRef.current);
        if (locationSubscriptionRef.current) locationSubscriptionRef.current.remove();

        const walkData = {
            ownerId: user.uid,
            petId,
            petName,
            distanceKm: parseFloat(distance.toFixed(2)),
            durationMins: Math.ceil(durationSecs / 60),
            date: serverTimestamp(),
            routeCoords
        };

        try {
            await addDoc(collection(db, 'walks'), walkData);
            navigation.replace('WalkSummary', { walkData });
        } catch (error) {
            console.error("Error saving walk:", error);
            Alert.alert('Error', 'No se pudo guardar el paseo guardado de red.');
        }
    };

    // Format duration MM:SS
    const formatTime = (secs) => {
        const mins = Math.floor(secs / 60);
        const remainingSecs = secs % 60;
        return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
    };

    if (!location) {
        return <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}><Text>Obteniendo ubicación...</Text></View>;
    }

    return (
        <View style={styles.container}>
            <MapView
                ref={mapRef}
                provider={PROVIDER_DEFAULT}
                style={styles.map}
                initialRegion={{
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    latitudeDelta: 0.015,
                    longitudeDelta: 0.015,
                }}
                showsUserLocation={false}
            >
                {/* Current Location Marker */}
                <Marker coordinate={{ latitude: location.coords.latitude, longitude: location.coords.longitude }}>
                    <View style={styles.markerContainer}>
                        <Ionicons name="paw" size={16} color="#FFF" />
                    </View>
                </Marker>

                {/* The Path */}
                {routeCoords.length > 0 ? (
                    <Polyline
                        coordinates={routeCoords}
                        strokeColor={theme.primary}
                        strokeWidth={5}
                        lineJoin="round"
                    />
                ) : null}
            </MapView>

            <View style={styles.topOverlay}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Paseo: {petName}</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.statsPanel}>
                <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                        <Text style={styles.statLabel}>TIEMPO</Text>
                        <Text style={styles.statValue}>{formatTime(durationSecs)}</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statBox}>
                        <Text style={styles.statLabel}>DISTANCIA</Text>
                        <Text style={styles.statValue}>{distance.toFixed(2)} km</Text>
                    </View>
                </View>

                {!isActive ? (
                    <TouchableOpacity style={styles.startBtn} onPress={startWalk}>
                        <Text style={styles.btnText}>¡Comenzar Paseo!</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={styles.stopBtn} onPress={stopWalk}>
                        <Text style={styles.btnText}>Terminar Paseo</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};

const getStyles = (theme) => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    map: { flex: 1 },
    topOverlay: {
        position: 'absolute', top: 50, left: 20, right: 20,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: theme.cardBackground, padding: 15, borderRadius: 15,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 5
    },
    backButton: { padding: 5 },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: theme.text },
    markerContainer: {
        backgroundColor: theme.primary, width: 30, height: 30, borderRadius: 15,
        justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF',
    },
    statsPanel: {
        position: 'absolute', bottom: 30, left: 20, right: 20,
        backgroundColor: theme.cardBackground, borderRadius: 20, padding: 25,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 8
    },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
    statBox: { flex: 1, alignItems: 'center' },
    statDivider: { width: 1, backgroundColor: theme.border, height: '100%' },
    statLabel: { fontSize: 12, color: theme.textSecondary, fontWeight: 'bold', marginBottom: 5 },
    statValue: { fontSize: 32, fontWeight: 'bold', color: theme.primary },
    startBtn: { backgroundColor: '#4caf50', paddingVertical: 18, borderRadius: 15, alignItems: 'center' },
    stopBtn: { backgroundColor: '#f44336', paddingVertical: 18, borderRadius: 15, alignItems: 'center' },
    btnText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' }
});

export default WalkTrackingScreen;
