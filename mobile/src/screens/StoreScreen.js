import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ScrollView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const MOCK_PRODUCTS = [
    {
        id: '1',
        title: 'Correa Extensible 5m',
        price: '15.00',
        category: 'Accesorios',
        state: 'Nuevo',
        description: 'Correa extensible resistente hasta 20kg. Color rojo.',
        images: ['https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80'],
    },
    {
        id: '2',
        title: 'Pienso Premium Cachorros 10kg',
        price: '45.50',
        category: 'Comida',
        state: 'Nuevo',
        description: 'Pienso sabor salmón sin cereales para cachorros. Saco cerrado.',
        images: ['https://images.unsplash.com/photo-1589924691995-400dc9ecc119?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80'],
    },
    {
        id: '3',
        title: 'Rascador para Gatos 1.5m',
        price: '20.00',
        category: 'Accesorios',
        state: 'Segunda mano',
        description: 'Rascador con cueva y varias plataformas. Poco uso.',
        images: ['https://images.unsplash.com/photo-1545249390-6bdfa286032f?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80'],
    },
    {
        id: '4',
        title: 'Pelotas de Tenis x3',
        price: '5.00',
        category: 'Juguetes',
        state: 'Nuevo',
        description: 'Pack de 3 pelotas de tenis extra resistentes.',
        images: ['https://images.unsplash.com/photo-1550159930-40066082a4fc?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80'],
    },
    {
        id: '5',
        title: 'Transportín Mediano',
        price: '25.00',
        category: 'Accesorios',
        state: 'Segunda mano',
        description: 'Transportín rígido homologado para avión. Medidas 60x40x40cm.',
        images: ['https://images.unsplash.com/photo-1599571171887-21cc551069ff?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80'],
    }
];

const CATEGORIES = ['Todos', 'Accesorios', 'Comida', 'Juguetes', 'Salud', 'Higiene'];
const STATES = ['Cualquiera', 'Nuevo', 'Segunda mano'];

const StoreScreen = ({ navigation }) => {
    const [products, setProducts] = useState(MOCK_PRODUCTS);
    const [selectedCategory, setSelectedCategory] = useState('Todos');
    const [selectedState, setSelectedState] = useState('Cualquiera');

    const filteredProducts = products.filter(product => {
        const categoryMatch = selectedCategory === 'Todos' || product.category === selectedCategory;
        const stateMatch = selectedState === 'Cualquiera' || product.state === selectedState;
        return categoryMatch && stateMatch;
    });

    const renderProduct = ({ item }) => (
        <TouchableOpacity style={styles.productCard} activeOpacity={0.8}>
            <Image
                source={{ uri: item.images[0] }}
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

            {filteredProducts.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="cart-outline" size={60} color="#334155" />
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#101820', // Tema oscuro de PawMate
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
        color: '#1a7a4c', // Verde primario
    },
    headerSubtitle: {
        fontSize: 14,
        color: '#888',
        marginTop: 5,
    },
    filtersContainer: {
        backgroundColor: '#1c2a35',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#334155',
    },
    filterScroll: {
        paddingHorizontal: 15,
        marginBottom: 8,
    },
    filterBadge: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#2d3748',
        marginRight: 10,
        borderWidth: 1,
        borderColor: '#4a5568',
    },
    stateFilterBadge: {
        borderRadius: 8, // Diferenciar visualmente
        backgroundColor: '#101820',
    },
    filterBadgeActive: {
        backgroundColor: '#1a7a4c',
        borderColor: '#1a7a4c',
    },
    filterText: {
        color: '#a0aec0',
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
        backgroundColor: '#1c2a35',
        borderRadius: 12,
        marginBottom: 15,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#2d3748',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    productImage: {
        width: '100%',
        height: 150,
        backgroundColor: '#2d3748',
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
        color: '#FFF',
        marginBottom: 6,
        height: 40, // Fija para alineación
    },
    productPrice: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1a7a4c',
        marginBottom: 4,
    },
    productCategory: {
        fontSize: 12,
        color: '#888',
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
        backgroundColor: '#1a7a4c',
        borderRadius: 30,
        elevation: 8,
        shadowColor: '#1a7a4c',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 5,
    }
});

export default StoreScreen;
