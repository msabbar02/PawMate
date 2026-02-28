import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../context/ThemeContext';
import { db } from '../config/firebase';
import { collection, getDocs } from 'firebase/firestore';

const { width } = Dimensions.get('window');

const CATEGORIES = ['Todos', 'Accesorios', 'Comida', 'Juguetes', 'Salud', 'Higiene'];
const STATES = ['Cualquiera', 'Nuevo', 'Segunda mano'];

const StoreScreen = ({ navigation }) => {
    const { theme } = React.useContext(ThemeContext);
    const styles = getStyles(theme);

    const [products, setProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState('Todos');
    const [selectedState, setSelectedState] = useState('Cualquiera');

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, 'products'));
                const productsData = [];
                querySnapshot.forEach((doc) => {
                    productsData.push({ id: doc.id, ...doc.data() });
                });
                setProducts(productsData);
            } catch (error) {
                console.error("Error fetching products: ", error);
            } finally {
                setIsLoading(false);
            }
        };

        const unsubscribe = navigation.addListener('focus', () => {
            fetchProducts();
        });

        return unsubscribe;
    }, [navigation]);

    const filteredProducts = products.filter(product => {
        const categoryMatch = selectedCategory === 'Todos' || product.category === selectedCategory;
        const stateMatch = selectedState === 'Cualquiera' || product.state === selectedState;
        return categoryMatch && stateMatch;
    });

    const renderProduct = ({ item }) => (
        <TouchableOpacity
            style={styles.productCard}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('ProductDetails', { item: item })}
        >
            <Image
                source={{ uri: item.images && item.images.length > 0 ? item.images[0] : 'https://via.placeholder.com/150' }}
                style={styles.productImage}
                resizeMode="cover"
            />
            <View style={styles.stateBadge}>
                <Text style={styles.stateText}>{item.state}</Text>
            </View>
            <View style={styles.productInfo}>
                <Text style={styles.productTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.productPrice}>{item.price} €</Text>
                <Text style={styles.productCategory}>{item.category}</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Tienda PawMate</Text>
                <Text style={styles.headerSubtitle}>Compra y vende artículos</Text>
            </View>

            <View style={styles.filtersContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                    {CATEGORIES.map((category) => (
                        <TouchableOpacity
                            key={`cat-${category}`}
                            style={[
                                styles.filterBadge,
                                selectedCategory === category && styles.filterBadgeActive
                            ]}
                            onPress={() => setSelectedCategory(category)}
                        >
                            <Text style={[
                                styles.filterText,
                                selectedCategory === category && styles.filterTextActive
                            ]}>{category}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                    {STATES.map((state) => (
                        <TouchableOpacity
                            key={`state-${state}`}
                            style={[
                                styles.filterBadge,
                                styles.stateFilterBadge,
                                selectedState === state && styles.filterBadgeActive
                            ]}
                            onPress={() => setSelectedState(state)}
                        >
                            <Text style={[
                                styles.filterText,
                                selectedState === state && styles.filterTextActive
                            ]}>{state}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {isLoading ? (
                <View style={[styles.emptyContainer, { justifyContent: 'center' }]}>
                    <ActivityIndicator size="large" color={theme.primary} />
                </View>
            ) : filteredProducts.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="cart-outline" size={60} color={theme.border} />
                    <Text style={styles.emptyText}>No hay productos que coincidan con los filtros.</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredProducts}
                    keyExtractor={(item) => item.id}
                    renderItem={renderProduct}
                    numColumns={2}
                    contentContainerStyle={styles.listContainer}
                    columnWrapperStyle={styles.columnWrapper}
                    showsVerticalScrollIndicator={false}
                />
            )}

            <TouchableOpacity
                style={styles.fab}
                onPress={() => navigation.navigate('CreateStoreItem')}
            >
                <Ionicons name="add" size={30} color="#FFF" />
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
    filtersContainer: {
        backgroundColor: theme.cardBackground,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
    },
    filterScroll: {
        paddingHorizontal: 15,
        marginBottom: 8,
    },
    filterBadge: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: theme.background,
        marginRight: 10,
        borderWidth: 1,
        borderColor: theme.border,
    },
    stateFilterBadge: {
        borderRadius: 8, // Diferenciar visualmente
        backgroundColor: theme.background,
    },
    filterBadgeActive: {
        backgroundColor: theme.primary,
        borderColor: theme.primary,
    },
    filterText: {
        color: theme.textSecondary,
        fontSize: 14,
        fontWeight: '500',
    },
    filterTextActive: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    listContainer: {
        padding: 15,
        paddingBottom: 120, // Espacio para el FAB y la barra de navegación
    },
    columnWrapper: {
        justifyContent: 'space-between',
    },
    productCard: {
        width: (width - 45) / 2, // 2 columnas con padding
        backgroundColor: theme.cardBackground,
        borderRadius: 12,
        marginBottom: 15,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: theme.border,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    productImage: {
        width: '100%',
        height: 150,
        backgroundColor: theme.border,
    },
    stateBadge: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    stateText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    productInfo: {
        padding: 12,
    },
    productTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.text,
        marginBottom: 6,
        height: 40, // Fija para alineación
    },
    productPrice: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.primary,
        marginBottom: 4,
    },
    productCategory: {
        fontSize: 12,
        color: theme.textSecondary,
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
        marginTop: 15,
    },
    fab: {
        position: 'absolute',
        width: 60,
        height: 60,
        alignItems: 'center',
        justifyContent: 'center',
        right: 25,
        bottom: 100, // Alto para sortear la barra inferior
        backgroundColor: theme.primary,
        borderRadius: 30,
        elevation: 8,
        shadowColor: theme.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 5,
    }
});

export default StoreScreen;
