import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
        <View style={styles.card}>
            <Image
                source={{ uri: item.image || item.photo || 'https://via.placeholder.com/400' }}
                style={styles.petImage}
                resizeMode="cover"
            />
            {/* Overlay Gradient equivalent using View to keep text legible */}
            <View style={styles.cardContent}>
                <View style={styles.cardHeaderInfo}>
                    <Text style={styles.petName} numberOfLines={1}>{item.name}</Text>
                    <View style={styles.petDetailsRow}>
                        <Text style={styles.petDetails}>{item.type} • {item.breed}</Text>
                        <View style={styles.weightBadge}>
                            <Text style={styles.weightText}>{item.weight} kg</Text>
                        </View>
                    </View>
                </View>
                <View style={styles.cardActions}>
                    <TouchableOpacity
                        style={[styles.cardBtn, styles.editBtn]}
                        onPress={() => navigation.navigate('EditPet', { petId: item.id })}
                    >
                        <Ionicons name="create-outline" size={16} color={theme.text} />
                        <Text style={styles.editBtnText}>Editar Datos</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.cardBtn, styles.viewBtn]}
                        onPress={() => navigation.navigate('PetDetails', { petId: item.id })}
                    >
                        <Ionicons name="eye-outline" size={16} color={theme.primary} />
                        <Text style={styles.viewBtnText}>Ver Perfil</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Mis Mascotas</Text>
                <Text style={styles.headerSubtitle}>
                    {`${pets.length} de 5 mascotas registradas`}
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
        borderRadius: 24,
        marginBottom: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: theme.border,
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
    },
    petImage: {
        width: '100%',
        height: 200,
    },
    cardContent: {
        padding: 20,
    },
    cardHeaderInfo: {
        marginBottom: 16,
    },
    petName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: theme.text,
        marginBottom: 6,
    },
    petDetailsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    petDetails: {
        fontSize: 15,
        color: theme.textSecondary,
    },
    weightBadge: {
        backgroundColor: theme.primary + '15',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    weightText: {
        fontSize: 14,
        color: theme.primary,
        fontWeight: '700',
    },
    cardActions: {
        flexDirection: 'row',
        gap: 12,
    },
    cardBtn: {
        flex: 1,
        flexDirection: 'row',
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    editBtn: {
        backgroundColor: theme.background,
        borderWidth: 1,
        borderColor: theme.border,
    },
    viewBtn: {
        backgroundColor: theme.primary + '15',
    },
    editBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.text,
    },
    viewBtnText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: theme.primary,
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
