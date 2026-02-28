import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, FlatList, Alert, ActivityIndicator, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../context/ThemeContext';
import { db } from '../config/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

const { width } = Dimensions.get('window');

const UserProfileScreen = ({ route, navigation }) => {
    const { theme } = React.useContext(ThemeContext);
    const styles = getStyles(theme);
    const userId = route.params?.userId;

    const [userProfile, setUserProfile] = useState(null);
    const [products, setProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchUserData = async () => {
            if (!userId) return;
            try {
                const userDoc = await getDoc(doc(db, 'users', userId));
                if (userDoc.exists()) {
                    setUserProfile({ id: userDoc.id, ...userDoc.data() });
                }

                const q = query(collection(db, 'products'), where('publisherId', '==', userId));
                const snapshot = await getDocs(q);
                const userProducts = [];
                snapshot.forEach((pDoc) => {
                    userProducts.push({ id: pDoc.id, ...pDoc.data() });
                });
                setProducts(userProducts);
            } catch (error) {
                console.error('Error fetching user profile:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchUserData();
    }, [userId]);

    if (isLoading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    if (!userProfile) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: theme.text }}>Usuario no encontrado.</Text>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
                    <Text style={{ color: theme.primary }}>Volver</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Perfil</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.profileSection}>
                    <Image source={{ uri: userProfile.avatar }} style={styles.avatar} />
                    <Text style={styles.name}>{userProfile.name}</Text>
                    <View style={styles.roleBadge}>
                        <Text style={styles.roleText}>{userProfile.role}</Text>
                    </View>

                    <View style={styles.statsRow}>
                        <View style={styles.statBox}>
                            <Ionicons name="star" size={20} color="#FFD700" />
                            <Text style={styles.statValue}>{userProfile.rating}</Text>
                            <Text style={styles.statLabel}>Valoración</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statBox}>
                            <Ionicons name="people" size={20} color={theme.primary} />
                            <Text style={styles.statValue}>{userProfile.reviews}</Text>
                            <Text style={styles.statLabel}>Reseñas</Text>
                        </View>
                    </View>

                    <Text style={styles.bioTitle}>Sobre Mí</Text>
                    <Text style={styles.bioText}>{userProfile.description || userProfile.bio || 'Sin descripción.'}</Text>
                </View>

                {products.length > 0 ? (
                    <View style={styles.productsSection}>
                        <Text style={styles.sectionTitle}>Productos en Venta</Text>
                        <View style={styles.productsGrid}>
                            {products.map((item) => (
                                <TouchableOpacity
                                    key={item.id}
                                    style={styles.productCard}
                                    activeOpacity={0.8}
                                    onPress={() => navigation.navigate('ProductDetails', { item: item })}
                                >
                                    <Image
                                        source={{ uri: item.images && item.images.length > 0 ? item.images[0] : 'https://via.placeholder.com/150' }}
                                        style={styles.productImage}
                                        resizeMode="cover"
                                    />
                                    <View style={styles.productInfo}>
                                        <Text style={styles.productTitle} numberOfLines={2}>{item.title}</Text>
                                        <Text style={styles.productPrice}>{item.price} €</Text>

                                        {/* Favorites Count indicator */}
                                        <View style={styles.favoritesRow}>
                                            <Ionicons name="heart" size={12} color="#ff4757" />
                                            <Text style={styles.favoritesText}>{item.favorites || 0}</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                ) : null}

                <View style={{ height: 100 }} />
            </ScrollView>

            <View style={[styles.bottomBar, { flexDirection: 'row', justifyContent: 'space-between' }]}>
                <TouchableOpacity
                    style={[styles.contactButton, { flex: 1, marginRight: 5 }]}
                    onPress={() => navigation.navigate('ChatScreen', { recipientId: userProfile.id, recipientName: userProfile.name })}
                >
                    <Ionicons name="chatbubble-ellipses-outline" size={24} color="#FFF" />
                    <Text style={styles.contactButtonText}>Mensaje</Text>
                </TouchableOpacity>
                {userProfile.role === 'Caregiver' ? (
                    <TouchableOpacity
                        style={[styles.contactButton, { flex: 1, marginLeft: 5, backgroundColor: theme.primary + 'E6' }]}
                        onPress={() => navigation.navigate('BookingRequest', { caregiverId: userProfile.id, caregiverName: userProfile.name })}
                    >
                        <Ionicons name="calendar-outline" size={24} color="#FFF" />
                        <Text style={styles.contactButtonText}>Reservar</Text>
                    </TouchableOpacity>
                ) : null}
            </View>
        </View>
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
        paddingTop: 50,
        paddingBottom: 20,
        paddingHorizontal: 20,
        backgroundColor: theme.background,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
    },
    backButton: {
        padding: 5,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.text,
    },
    profileSection: {
        alignItems: 'center',
        padding: 30,
    },
    avatar: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 3,
        borderColor: theme.primary,
        marginBottom: 15,
    },
    name: {
        fontSize: 24,
        fontWeight: 'bold',
        color: theme.text,
        marginBottom: 8,
    },
    roleBadge: {
        backgroundColor: theme.primary + '20',
        paddingHorizontal: 15,
        paddingVertical: 6,
        borderRadius: 20,
        marginBottom: 25,
    },
    roleText: {
        color: theme.primary,
        fontWeight: 'bold',
    },
    statsRow: {
        flexDirection: 'row',
        backgroundColor: theme.cardBackground,
        padding: 20,
        borderRadius: 15,
        width: '100%',
        borderWidth: 1,
        borderColor: theme.border,
        marginBottom: 30,
        elevation: 2,
    },
    statBox: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statDivider: {
        width: 1,
        backgroundColor: theme.border,
        height: '100%',
    },
    statValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.text,
        marginTop: 5,
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 12,
        color: theme.textSecondary,
    },
    bioTitle: {
        alignSelf: 'flex-start',
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.text,
        marginBottom: 10,
    },
    bioText: {
        alignSelf: 'flex-start',
        fontSize: 16,
        color: theme.textSecondary,
        lineHeight: 24,
        textAlign: 'left',
    },
    productsSection: {
        paddingHorizontal: 15,
        marginTop: 10,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.text,
        marginBottom: 15,
        marginLeft: 5,
    },
    productsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    productCard: {
        width: (width - 40) / 2, // 2 columnas
        backgroundColor: theme.cardBackground,
        borderRadius: 12,
        marginBottom: 15,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: theme.border,
        elevation: 2,
    },
    productImage: {
        width: '100%',
        height: 120,
        backgroundColor: theme.border,
    },
    productInfo: {
        padding: 10,
    },
    productTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: theme.text,
        marginBottom: 4,
        height: 35, // Fija para alineación
    },
    productPrice: {
        fontSize: 14,
        fontWeight: 'bold',
        color: theme.primary,
        marginBottom: 4,
    },
    favoritesRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    favoritesText: {
        fontSize: 12,
        color: theme.textSecondary,
        marginLeft: 4,
    },
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: theme.cardBackground,
        padding: 20,
        paddingBottom: 30,
        borderTopWidth: 1,
        borderTopColor: theme.border,
    },
    contactButton: {
        backgroundColor: theme.primary,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 15,
        borderRadius: 12,
    },
    contactButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 10,
    }
});

export default UserProfileScreen;
