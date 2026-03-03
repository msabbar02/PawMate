import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ScrollView } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { db } from '../config/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

const HomeScreen = ({ navigation, route }) => {
    const { theme } = React.useContext(ThemeContext);
    const { userData } = React.useContext(AuthContext);
    const styles = getStyles(theme);

    const [location, setLocation] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null);
    const userName = userData?.name || 'User';
    const [pets, setPets] = useState([]);
    const [caregivers, setCaregivers] = useState([]);
    const { user } = React.useContext(AuthContext);

    const fetchLocation = async () => {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            setErrorMsg('Permission to access location was denied');
            return;
        }

        let loc = await Location.getCurrentPositionAsync({});
        setLocation(loc);
    };

    useEffect(() => {
        fetchLocation();
    }, []);

    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, 'pets'), where('ownerId', '==', user.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const petsData = [];
            snapshot.forEach((doc) => {
                petsData.push({ id: doc.id, ...doc.data() });
            });
            setPets(petsData);
        });
        return () => unsubscribe();
    }, [user]);

    useEffect(() => {
        const q = query(collection(db, 'users'), where('role', '==', 'caregiver'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = [];
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                if (data.isOnline && data.location?.latitude != null && data.location?.longitude != null) {
                    list.push({ id: docSnap.id, ...data });
                }
            });
            setCaregivers(list);
        });
        return () => unsubscribe();
    }, []);



    let defaultRegion = {
        latitude: 37.78825, // Fallback latitude
        longitude: -122.4324, // Fallback longitude
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
    };

    if (location) {
        defaultRegion = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
        };
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <View style={{ width: 40 }} />
                <View style={styles.logoAndTextContainer}>
                    <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="cover" />
                    <Text style={styles.greetingTitle}>Hola {userName}</Text>
                </View>
                <TouchableOpacity onPress={() => navigation.navigate('Mensajes')} style={styles.notificationBell}>
                    <Ionicons name="notifications-outline" size={26} color={theme.primary} />
                    <View style={styles.notificationBadge} />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>

                {/* Mapa */}
                <View style={styles.mapContainer}>
                    <MapView
                        provider={PROVIDER_DEFAULT}
                        style={styles.map}
                        region={defaultRegion}
                        showsUserLocation={true}
                        showsMyLocationButton={false}
                    >
                        {caregivers.map((c) => (
                            <Marker
                                key={c.id}
                                coordinate={{ latitude: c.location.latitude, longitude: c.location.longitude }}
                                title={c.name || 'Cuidador'}
                                description={c.isOnline ? 'Disponible' : ''}
                            >
                                <View style={styles.markerWrap}>
                                    <Image
                                        source={{ uri: c.avatar || 'https://via.placeholder.com/80' }}
                                        style={styles.markerAvatar}
                                    />
                                    <View style={[styles.markerDot, c.isOnline ? styles.markerDotOnline : styles.markerDotOffline]} />
                                </View>
                            </Marker>
                        ))}
                    </MapView>
                    <TouchableOpacity style={styles.locateButton} onPress={fetchLocation}>
                        <Ionicons name="locate" size={24} color={theme.primary} />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={styles.startWalkButton}
                    onPress={() => navigation.navigate('SelectPetWalk')}
                >
                    <Ionicons name="walk" size={28} color="#FFF" style={{ marginRight: 12 }} />
                    <Text style={styles.startWalkButtonText}>Iniciar paseo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.searchCaregiversButton}
                    onPress={() => navigation.navigate('SearchCaregivers')}
                >
                    <Ionicons name="search" size={24} color={theme.primary} style={{ marginRight: 10 }} />
                    <Text style={styles.searchCaregiversButtonText}>Buscar cuidadores</Text>
                </TouchableOpacity>

                <View style={{ height: 100 }} /> {/* Spacer for Bottom Tabs */}
            </ScrollView>
        </SafeAreaView>
    );
};

const getStyles = (theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 15,
        paddingTop: 10,
        backgroundColor: theme.background,
        zIndex: 10,
    },
    logoAndTextContainer: {
        alignItems: 'center',
        flexDirection: 'row',
    },
    logo: {
        width: 36,
        height: 36,
        borderRadius: 18, // Circular logo
        marginRight: 10,
        backgroundColor: '#fff',
    },
    greetingTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: theme.primary,
    },
    scrollBody: {
        flex: 1,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.cardBackground,
        marginHorizontal: 20,
        marginTop: 10,
        marginBottom: 15,
        paddingHorizontal: 15,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.border,
    },
    searchText: {
        color: theme.textSecondary,
        fontSize: 16,
    },
    startWalkButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 20,
        marginTop: 20,
        paddingVertical: 18,
        backgroundColor: theme.primary,
        borderRadius: 16,
        elevation: 4,
        shadowColor: theme.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    startWalkButtonText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
    searchCaregiversButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 20,
        marginTop: 14,
        paddingVertical: 16,
        backgroundColor: theme.cardBackground,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: theme.primary,
    },
    searchCaregiversButtonText: { color: theme.primary, fontSize: 17, fontWeight: 'bold' },
    mapContainer: {
        borderRadius: 20,
        overflow: 'hidden',
        marginHorizontal: 20,
        marginTop: 15,
        marginBottom: 20,
        backgroundColor: theme.cardBackground,
        position: 'relative',
    },
    map: {
        width: '100%',
        height: '100%',
    },
    locateButton: {
        position: 'absolute',
        bottom: 15,
        right: 15,
        backgroundColor: theme.cardBackground,
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.5,
        shadowRadius: 3,
        elevation: 5,
        borderWidth: 1,
        borderColor: theme.border,
    },
    markerWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    markerAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: '#FFF',
        backgroundColor: theme.cardBackground,
    },
    markerDot: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: '#FFF',
    },
    markerDotOnline: {
        backgroundColor: '#4caf50',
    },
    markerDotOffline: {
        backgroundColor: '#f44336',
    },
    customMarkerContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    onlineDotMarker: {
        position: 'absolute',
        top: 0,
        right: 0,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#4caf50',
        borderWidth: 2,
        borderColor: theme.background, // To add border effect around it contrasting the map
    },
    markerTriangle: {
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: 6,
        borderRightWidth: 6,
        borderBottomWidth: 8,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: theme.primary,
        transform: [{ rotate: '180deg' }],
        marginTop: -1,
    },
    sectionContainer: {
        marginTop: 10,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 15,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.text,
    },
    seeAllText: {
        color: theme.primary,
        fontSize: 14,
        fontWeight: 'bold',
    },
    cardsContainer: {
        paddingHorizontal: 15,
    },
    caregiverCard: {
        backgroundColor: theme.cardBackground,
        borderRadius: 15,
        padding: 15,
        marginHorizontal: 5,
        width: 160,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.border,
    },
    skeletonCard: {
        backgroundColor: theme.cardBackground,
        borderRadius: 15,
        marginHorizontal: 5,
        width: 160,
        height: 180,
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: 10,
    },
    caregiverAvatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    onlineDot: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#4caf50',
        borderWidth: 2,
        borderColor: theme.cardBackground,
    },
    caregiverName: {
        color: theme.text,
        fontSize: 16,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    caregiverRole: {
        color: theme.textSecondary,
        fontSize: 12,
        marginTop: 4,
        marginBottom: 8,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    ratingText: {
        color: theme.textSecondary,
        fontSize: 12,
        marginLeft: 4,
    },
    bookingCard: {
        backgroundColor: theme.cardBackground,
        marginHorizontal: 20,
        marginBottom: 15,
        padding: 15,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: theme.border,
    },
    bookingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
    },
    bookingIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: theme.primary + '33', // 20% opacity using hex
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 15,
    },
    bookingInfo: {
        flex: 1,
    },
    bookingName: {
        color: theme.text,
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    bookingTime: {
        color: theme.textSecondary,
        fontSize: 13,
    },
    bookingPrice: {
        color: theme.primary,
        fontSize: 16,
        fontWeight: 'bold',
    },
    rebookBtn: {
        backgroundColor: theme.primary + '1A', // 10% opacity
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.primary + '80', // 50% opacity
    },
    rebookText: {
        color: theme.primary,
        fontWeight: 'bold',
        fontSize: 14,
    },
    fab: {
        position: 'absolute',
        width: 60,
        height: 60,
        alignItems: 'center',
        justifyContent: 'center',
        right: 25,
        bottom: 30,
        backgroundColor: theme.primary,
        borderRadius: 30,
        elevation: 8,
        shadowColor: theme.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 5,
    },
    fabIcon: {
        fontSize: 30,
        color: 'white',
        fontWeight: 'bold',
        marginTop: -3,
    },
    petCard: {
        backgroundColor: theme.cardBackground,
        borderRadius: 15,
        padding: 15,
        marginHorizontal: 5,
        width: 140,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.border,
    },
    petAvatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        marginBottom: 10,
    },
    petName: {
        color: theme.text,
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    walkButton: {
        backgroundColor: theme.primary,
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
    },
    walkButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    }
});

export default HomeScreen;
