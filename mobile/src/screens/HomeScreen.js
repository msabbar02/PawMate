import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ScrollView } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const HomeScreen = ({ navigation, route }) => {
    const [location, setLocation] = useState(null);
    const [errorMsg, setErrorMsg] = useState(null);
    const [activeFilter, setActiveFilter] = useState('Todos');
    const userName = route?.params?.userName || 'User';

    const filters = ['Todos', 'Online', '★ 4.5+', 'Cerca', 'Perros', 'Gatos', 'Pájaros'];

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

    // Placeholder data for caretakers adding online status
    const caretakers = location ? [
        { id: '1', title: 'Caregiver Ana', isOnline: true, coordinate: { latitude: location.coords.latitude + 0.005, longitude: location.coords.longitude + 0.005 } },
        { id: '2', title: 'Caregiver Juan', isOnline: false, coordinate: { latitude: location.coords.latitude - 0.005, longitude: location.coords.longitude - 0.008 } },
        { id: '3', title: 'Caregiver Maria', isOnline: true, coordinate: { latitude: location.coords.latitude + 0.008, longitude: location.coords.longitude - 0.002 } },
    ] : [];

    const bookings = [
        { id: '101', name: 'Ana', date: 'Ayer', type: 'Paseo Perro', price: '15€' },
        { id: '102', name: 'Juan', date: 'Hace 3 días', type: 'Cuidado Gato', price: '25€' },
    ];

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
                    <Ionicons name="notifications-outline" size={28} color="#1a7a4c" />
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

                {/* Filters Row */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersContainer}>
                    {filters.map((filter, index) => (
                        <TouchableOpacity
                            key={index}
                            style={[styles.filterChip, activeFilter === filter && styles.filterChipActive]}
                            onPress={() => setActiveFilter(filter)}
                        >
                            <Text style={[styles.filterText, activeFilter === filter && styles.filterTextActive]}>
                                {filter}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Map Section */}
                <View style={styles.mapContainer}>
                    <MapView
                        provider={PROVIDER_DEFAULT}
                        style={styles.map}
                        region={defaultRegion}
                        showsUserLocation={true}
                        showsMyLocationButton={false} // Disable default so ours doesn't conflict
                    >
                        {location ? caretakers.map((ct, idx) => (
                            <Marker
                                key={ct.id}
                                coordinate={ct.coordinate}
                                title={ct.title}
                            >
                                <View style={styles.customMarkerContainer}>
                                    <View style={[styles.markerAvatar, { backgroundColor: ['#284b3b', '#1a3025', '#3b5a4b'][idx % 3] }]}>
                                        <Ionicons name="person" size={18} color="#fff" />
                                    </View>
                                    <View style={[styles.onlineDotMarker, !ct.isOnline && { backgroundColor: '#888' }]} />
                                    <View style={styles.markerTriangle} />
                                </View>
                            </Marker>
                        )) : null}
                    </MapView>
                    <TouchableOpacity style={styles.locateButton} onPress={fetchLocation}>
                        <Ionicons name="locate" size={24} color="#1a7a4c" />
                    </TouchableOpacity>
                </View>

                {/* Modern UI Section Below Map */}
                <View style={styles.sectionContainer}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Cuidadores Top Cerca</Text>
                        <TouchableOpacity>
                            <Text style={styles.seeAllText}>Ver todos</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cardsContainer}>
                        {caretakers.length > 0 ? caretakers.map((ct, idx) => (
                            <TouchableOpacity key={ct.id} style={styles.caregiverCard}>
                                <View style={styles.avatarContainer}>
                                    <View style={[styles.caregiverAvatar, { backgroundColor: ['#284b3b', '#1a3025', '#3b5a4b'][idx % 3] }]}>
                                        <Ionicons name="person" size={30} color="#fff" />
                                    </View>
                                    <View style={[styles.onlineDot, !ct.isOnline && { backgroundColor: '#888' }]} />
                                </View>
                                <Text style={styles.caregiverName}>{ct.title}</Text>
                                <Text style={styles.caregiverRole}>Pet Sitter / Paseador</Text>
                                <View style={styles.ratingRow}>
                                    <Ionicons name="star" size={14} color="#f4c150" />
                                    <Text style={styles.ratingText}>4.{9 - idx} ({120 - idx * 15} reseñas)</Text>
                                </View>
                            </TouchableOpacity>
                        )) : (
                            <View style={styles.skeletonCard} />
                        )}
                    </ScrollView>
                </View>

                {/* Últimas Reservas / Recent Bookings */}
                <View style={[styles.sectionContainer, { marginTop: 25 }]}>
                    <Text style={[styles.sectionTitle, { paddingHorizontal: 20, marginBottom: 15 }]}>Últimas Reservas</Text>
                    {bookings.map((booking) => (
                        <View key={booking.id} style={styles.bookingCard}>
                            <View style={styles.bookingRow}>
                                <View style={styles.bookingIcon}>
                                    <Ionicons name="paw" size={20} color="#1a7a4c" />
                                </View>
                                <View style={styles.bookingInfo}>
                                    <Text style={styles.bookingName}>Con cuidador {booking.name}</Text>
                                    <Text style={styles.bookingTime}>{booking.type} • {booking.date}</Text>
                                </View>
                                <Text style={styles.bookingPrice}>{booking.price}</Text>
                            </View>
                            <TouchableOpacity style={styles.rebookBtn}>
                                <Text style={styles.rebookText}>Volver a reservar</Text>
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>

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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#101820',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 15,
        paddingTop: 10,
        backgroundColor: '#101820',
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
        color: '#1a7a4c',
    },
    scrollBody: {
        flex: 1,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1c2a35',
        marginHorizontal: 20,
        marginTop: 10,
        marginBottom: 15,
        paddingHorizontal: 15,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333',
    },
    searchText: {
        color: '#888',
        fontSize: 16,
    },
    filtersContainer: {
        paddingHorizontal: 15,
        marginBottom: 10,
    },
    filterChip: {
        backgroundColor: '#1c2a35',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginHorizontal: 5,
        borderWidth: 1,
        borderColor: '#333',
    },
    filterChipActive: {
        backgroundColor: '#1a7a4c',
        borderColor: '#1a7a4c',
    },
    filterText: {
        color: '#ccc',
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
        backgroundColor: '#1c2a35',
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
        backgroundColor: '#1c2a35',
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
        borderColor: '#2a3b47',
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
        borderColor: '#1a7a4c',
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
        borderColor: '#101820', // To add border effect around it contrasting the map
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
        borderBottomColor: '#1a7a4c',
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
        color: '#fff',
    },
    seeAllText: {
        color: '#1a7a4c',
        fontSize: 14,
        fontWeight: 'bold',
    },
    cardsContainer: {
        paddingHorizontal: 15,
    },
    caregiverCard: {
        backgroundColor: '#1c2a35',
        borderRadius: 15,
        padding: 15,
        marginHorizontal: 5,
        width: 160,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#2a3b47',
    },
    skeletonCard: {
        backgroundColor: '#1c2a35',
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
        borderColor: '#1c2a35',
    },
    caregiverName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    caregiverRole: {
        color: '#888',
        fontSize: 12,
        marginTop: 4,
        marginBottom: 8,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    ratingText: {
        color: '#ccc',
        fontSize: 12,
        marginLeft: 4,
    },
    bookingCard: {
        backgroundColor: '#1c2a35',
        marginHorizontal: 20,
        marginBottom: 15,
        padding: 15,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: '#2a3b47',
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
        backgroundColor: 'rgba(26, 122, 76, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 15,
    },
    bookingInfo: {
        flex: 1,
    },
    bookingName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    bookingTime: {
        color: '#888',
        fontSize: 13,
    },
    bookingPrice: {
        color: '#1a7a4c',
        fontSize: 16,
        fontWeight: 'bold',
    },
    rebookBtn: {
        backgroundColor: 'rgba(26, 122, 76, 0.1)',
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(26, 122, 76, 0.5)',
    },
    rebookText: {
        color: '#1a7a4c',
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
        backgroundColor: '#1a7a4c',
        borderRadius: 30,
        elevation: 8,
        shadowColor: '#1a7a4c',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 5,
    },
    fabIcon: {
        fontSize: 30,
        color: 'white',
        fontWeight: 'bold',
        marginTop: -3,
    }
});

export default HomeScreen;
