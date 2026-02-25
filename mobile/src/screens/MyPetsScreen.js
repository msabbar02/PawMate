import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image } from 'react-native';

const MOCK_PETS = [
    {
        id: '1',
        name: 'Max',
        type: 'Perro',
        breed: 'Labrador',
        age: '3 años',
        image: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
    },
    {
        id: '2',
        name: 'Luna',
        type: 'Gato',
        breed: 'Siamés',
        age: '1 año',
        image: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80',
    }
];

const MyPetsScreen = ({ navigation }) => {
    // Para cuando haya integración real: const [pets, setPets] = useState([]);
    const [pets, setPets] = useState(MOCK_PETS);

    const renderPetCard = ({ item }) => (
        <View style={styles.card}>
            <Image
                source={{ uri: item.image }}
                style={styles.petImage}
                resizeMode="cover"
            />
            <View style={styles.cardContent}>
                <Text style={styles.petName}>{item.name}</Text>
                <Text style={styles.petDetails}>{item.type} • {item.breed}</Text>
                <Text style={styles.petAge}>{item.age}</Text>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Mis Mascotas</Text>
                <Text style={styles.headerSubtitle}>
                    {pets.length} de 5 mascotas registradas
                </Text>
            </View>

            {pets.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No tienes mascotas registradas aún.</Text>
                </View>
            ) : (
                <FlatList
                    data={pets}
                    keyExtractor={(item) => item.id}
                    renderItem={renderPetCard}
                    contentContainerStyle={styles.listContainer}
                    showsVerticalScrollIndicator={false}
                />
            )}

            <TouchableOpacity
                style={styles.fab}
                onPress={() => navigation.navigate('CreatePet')}
            >
                <Text style={styles.fabIcon}>+</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#101820', // Dark theme background
    },
    header: {
        paddingTop: 60,
        paddingBottom: 20,
        paddingHorizontal: 20,
        backgroundColor: '#101820',
        borderBottomWidth: 1,
        borderBottomColor: '#1c2a35',
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1a7a4c', // Primary green
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#888',
        marginTop: 5,
    },
    listContainer: {
        padding: 20,
        paddingBottom: 160, // Space for FAB
    },
    card: {
        backgroundColor: '#1c2a35',
        borderRadius: 15,
        marginBottom: 15,
        flexDirection: 'row',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#333',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    petImage: {
        width: 100,
        height: 100,
    },
    cardContent: {
        flex: 1,
        padding: 15,
        justifyContent: 'center',
    },
    petName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 4,
    },
    petDetails: {
        fontSize: 14,
        color: '#ccc',
        marginBottom: 4,
    },
    petAge: {
        fontSize: 14,
        color: '#1a7a4c',
        fontWeight: '600',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    emptyText: {
        color: '#888',
        fontSize: 16,
        textAlign: 'center',
    },
    fab: {
        position: 'absolute',
        width: 60,
        height: 60,
        alignItems: 'center',
        justifyContent: 'center',
        right: 25,
        bottom: 100, // Changed from 25 to 100 to clear the floating bottom tabs
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

export default MyPetsScreen;
