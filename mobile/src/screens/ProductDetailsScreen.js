import React from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { ThemeContext } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const ProductDetailsScreen = ({ route, navigation }) => {
    const { theme } = React.useContext(ThemeContext);
    const styles = getStyles(theme);
    // In a real app the user object inside item would be an ID fetched from Firebase. We're mocking the profile part structurally for now.
    const item = route.params?.item;

    if (!item) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: theme.text }}>Detalles no disponibles.</Text>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
                    <Text style={{ color: theme.primary }}>Volver</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // Mock Publisher Data for now
    const publisher = {
        id: 'user123',
        name: 'Carlos Ruiz',
        avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100',
        rating: 4.8
    };

    return (
        <View style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header Image */}
                <View style={styles.imageContainer}>
                    <Image source={{ uri: item.images && item.images.length > 0 ? item.images[0] : 'https://via.placeholder.com/400' }} style={styles.productImage} />

                    <View style={styles.stateBadge}>
                        <Text style={styles.stateText}>{item.state}</Text>
                    </View>

                    {/* Floating Back Button */}
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="arrow-back" size={24} color="#FFF" />
                    </TouchableOpacity>
                </View>

                {/* Primary Info */}
                <View style={styles.infoSection}>
                    <View style={styles.categoryBadge}>
                        <Text style={styles.categoryText}>{item.category}</Text>
                    </View>
                    <Text style={styles.title}>{item.title}</Text>
                    <Text style={styles.price}>{item.price} €</Text>
                </View>

                {/* Description */}
                <View style={styles.descriptionSection}>
                    <Text style={styles.sectionTitle}>Descripción</Text>
                    <Text style={styles.descriptionText}>{item.description}</Text>
                </View>

                {/* Publisher Profile Trigger */}
                <View style={styles.publisherSection}>
                    <Text style={styles.sectionTitle}>Vendedor</Text>
                    <TouchableOpacity
                        style={styles.publisherCard}
                        onPress={() => navigation.navigate('UserProfile', { userId: publisher.id })}
                    >
                        <Image source={{ uri: publisher.avatar }} style={styles.publisherAvatar} />
                        <View style={styles.publisherInfo}>
                            <Text style={styles.publisherName}>{publisher.name}</Text>
                            <View style={styles.ratingRow}>
                                <Ionicons name="star" size={14} color="#FFD700" />
                                <Text style={styles.ratingText}>{publisher.rating}</Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={24} color={theme.textSecondary} />
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* Bottom Action Bar */}
            <View style={styles.bottomBar}>
                <TouchableOpacity
                    style={styles.contactButton}
                    onPress={() => navigation.navigate('ChatScreen', { recipientId: publisher.id, recipientName: publisher.name })}
                >
                    <Ionicons name="chatbubble-ellipses-outline" size={24} color="#FFF" />
                    <Text style={styles.contactButtonText}>Contactar Vendedor</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const getStyles = (theme) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.background,
    },
    imageContainer: {
        width: width,
        height: width, // Square image
        position: 'relative',
        backgroundColor: theme.cardBackground,
    },
    productImage: {
        width: '100%',
        height: '100%',
    },
    stateBadge: {
        position: 'absolute',
        bottom: 15,
        right: 15,
        backgroundColor: 'rgba(0,0,0,0.8)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    stateText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    backButton: {
        position: 'absolute',
        top: 50,
        left: 20,
        backgroundColor: 'rgba(0,0,0,0.5)',
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    infoSection: {
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
    },
    categoryBadge: {
        alignSelf: 'flex-start',
        backgroundColor: theme.primary + '20',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        marginBottom: 10,
    },
    categoryText: {
        color: theme.primary,
        fontSize: 12,
        fontWeight: 'bold',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: theme.text,
        marginBottom: 10,
    },
    price: {
        fontSize: 28,
        fontWeight: 'bold',
        color: theme.primary,
    },
    descriptionSection: {
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.text,
        marginBottom: 15,
    },
    descriptionText: {
        fontSize: 16,
        color: theme.textSecondary,
        lineHeight: 24,
    },
    publisherSection: {
        padding: 20,
        paddingBottom: 100, // Space for bottom bar
    },
    publisherCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.cardBackground,
        padding: 15,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: theme.border,
    },
    publisherAvatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 15,
    },
    publisherInfo: {
        flex: 1,
    },
    publisherName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.text,
        marginBottom: 4,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    ratingText: {
        fontSize: 14,
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
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 10,
    }
});

export default ProductDetailsScreen;
