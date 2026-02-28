import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, ActivityIndicator } from 'react-native';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';

const MyPetsScreen = ({ navigation }) => {
    const { theme } = useContext(ThemeContext);
    const { user } = useContext(AuthContext);
    const styles = getStyles(theme);

    const [pets, setPets] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        // Query pets belonging to the current user
        const q = query(
            collection(db, 'pets'),
            where('ownerId', '==', user.uid)
        );

        // Real-time listener
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedPets = [];
            snapshot.forEach((doc) => {
                fetchedPets.push({ id: doc.id, ...doc.data() });
            });
            setPets(fetchedPets);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching pets: ", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const renderPetCard = ({ item }) => (
        <TouchableOpacity
            style={styles.card}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('PetDetails', { pet: item })}
        >
            <Image
                source={{ uri: item.image }}
                style={styles.petImage}
                resizeMode="cover"
            />
            <View style={styles.cardContent}>
                <Text style={styles.petName}>{item.name}</Text>
                <Text style={styles.petDetails}>{item.type} • {item.breed}</Text>
                <Text style={styles.petAge}>{item.weight} kg</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Mis Mascotas</Text>
                <Text style={styles.headerSubtitle}>
                    {pets.length} de 5 mascotas registradas
                </Text>
            </View>

            {loading ? (
                <View style={styles.emptyContainer}>
                    <ActivityIndicator size="large" color={theme.primary} />
                </View>
            ) : pets.length === 0 ? (
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

const getStyles = (theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background,
    },
    header: {
        paddingTop: 60,
        paddingBottom: 20,
        paddingHorizontal: 20,
        backgroundColor: theme.background,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: theme.primary,
    },
    headerSubtitle: {
        fontSize: 14,
        color: theme.textSecondary,
        marginTop: 5,
    },
    listContainer: {
        padding: 20,
        paddingBottom: 160, // Space for FAB
    },
    card: {
        backgroundColor: theme.cardBackground,
        borderRadius: 15,
        marginBottom: 15,
        flexDirection: 'row',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: theme.border,
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
        color: theme.text,
        marginBottom: 4,
    },
    petDetails: {
        fontSize: 14,
        color: theme.textSecondary,
        marginBottom: 4,
    },
    petAge: {
        fontSize: 14,
        color: theme.primary,
        fontWeight: '600',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    emptyText: {
        color: theme.textSecondary,
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
    }
});

export default MyPetsScreen;
