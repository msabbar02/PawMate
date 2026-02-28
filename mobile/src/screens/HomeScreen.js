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
            {/* Header section */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => Alert.alert('Notifications', 'No new notifications')} style={styles.notificationIcon}>
                    <Ionicons name="notifications-outline" size={28} color={theme.primary} />
                </TouchableOpacity>
                <View style={styles.logoAndTextContainer}>
                    <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="cover" />
                    <Text style={styles.greetingTitle}>Hola {userName}</Text>
                </View>
                <View style={{ width: 28 }} />
            </View>

            <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
                {/* Search Bar / Button */}
                <TouchableOpacity style={styles.searchBar} onPress={() => Alert.alert('Buscar', 'Search Caregivers screen coming soon!')}>
                    <Ionicons name="search" size={20} color="#888" style={{ marginRight: 10 }} />
                    <Text style={styles.searchText}>Encuentra el cuidador perfecto...</Text>
                </TouchableOpacity>



                {/* Map Section */}
                <View style={styles.mapContainer}>
                    <MapView
                        provider={PROVIDER_DEFAULT}
                        style={styles.map}
                        region={defaultRegion}
                        showsUserLocation={true}
                        showsMyLocationButton={false} // Disable default so ours doesn't conflict
                    >
                    </MapView>
                    <TouchableOpacity style={styles.locateButton} onPress={fetchLocation}>
                        <Ionicons name="locate" size={24} color={theme.primary} />
                    </TouchableOpacity>
                </View>

                {/* Tus Mascotas - Para Pasear */}
                {pets.length > 0 ? (
                    <View style={styles.sectionContainer}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Tus Mascotas</Text>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardsContainer}>
                            {pets.map((pet) => (
                                <View key={pet.id} style={styles.petCard}>
                                    <Image source={{ uri: pet.photo || 'https://via.placeholder.com/150' }} style={styles.petAvatar} />
                                    <Text style={styles.petName}>{pet.name}</Text>
                                    <TouchableOpacity
                                        style={styles.walkButton}
                                        onPress={() => navigation.navigate('WalkTracking', { petId: pet.id, petName: pet.name })}
                                    >
                                        <Text style={styles.walkButtonText}>Pasear</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                ) : null}



                <View style={{ height: 100 }} /> {/* Spacer for Bottom Tabs & FAB */}
            </ScrollView>

            <TouchableOpacity
                style={styles.fab}
                onPress={() => navigation.navigate('CreatePet')}
            >
                <Text style={styles.fabIcon}>+</Text>
            </TouchableOpacity>
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
    notificationIcon: {
        padding: 5,
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
    filtersContainer: {
        paddingHorizontal: 15,
        marginBottom: 10,
    },
    filterChip: {
        backgroundColor: theme.cardBackground,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginHorizontal: 5,
        borderWidth: 1,
        borderColor: theme.border,
    },
    filterChipActive: {
        backgroundColor: theme.primary,
        borderColor: theme.primary,
    },
    filterText: {
        color: theme.textSecondary,
        fontSize: 14,
        fontWeight: '500',
    },
    filterTextActive: {
        color: '#fff',
        fontWeight: 'bold',
    },
    mapContainer: {
        height: 240, // Map takes decent vertical space
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
    customMarkerContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    markerAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: theme.primary,
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
