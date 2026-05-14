import React, { useEffect, useRef } from 'react';
import { View, Image, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Marker, Callout } from 'react-native-maps';
import Icon from './Icon';

/**
 * Marker animado que aparece en el mapa para representar a un cuidador o a
 * un dueño que está paseando en grupo.
 *
 * @param {object}   props
 * @param {object}   props.user            Usuario remoto a pintar (id, role, location…).
 * @param {string[]} [props.userPetSpecies] Especies del usuario actual; sirve para detectar match con cuidadores.
 * @param {Function} [props.onMessagePress] Callback al pulsar el botón del callout.
 */
const PetMarker = ({ user, userPetSpecies = [], onMessagePress }) => {
    const isCaregiver = user.role === 'caregiver';

    // El cálculo de match solo aplica a cuidadores: hay match si alguna especie del dueño coincide con las que el cuidador acepta.
    const acceptedSpecies = user.acceptedSpecies || [];
    const isMatch = isCaregiver && userPetSpecies.some(species =>
        acceptedSpecies.map(s => s.toLowerCase()).includes(species.toLowerCase())
    );

    // Borde animado: dorado cuando hay match con cuidador, azul cuando es dueño en paseo grupal.
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        let animation;
        if (isMatch || !isCaregiver) {
            animation = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.25,
                        duration: 900,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 900,
                        useNativeDriver: true,
                    }),
                ])
            );
            animation.start();
        } else {
            pulseAnim.stopAnimation();
            pulseAnim.setValue(1);
        }
        return () => { if (animation) animation.stop(); };
    }, [isMatch, isCaregiver]);

    const avatarUri = user.avatar || 'https://via.placeholder.com/80';
    const name = [user.name, user.surname].filter(Boolean).join(' ') || (isCaregiver ? 'Cuidador' : 'Dueño');

    // Formatear distancia
    const distanceText = user.distance != null
        ? user.distance < 1
            ? `${Math.round(user.distance * 1000)}m`
            : `${user.distance.toFixed(1)}km`
        : '—';

    return (
        <Marker
            coordinate={{
                latitude: user.location.latitude,
                longitude: user.location.longitude,
            }}
            tracksViewChanges={false}
        >
            <View style={styles.container}>
                {/* Anillo animado (Dorado para match, Azul para dueño) */}
                {(isMatch || !isCaregiver) && (
                    <Animated.View
                        style={[
                            styles.pulseRing,
                            {
                                transform: [{ scale: pulseAnim }],
                                borderColor: isCaregiver ? '#F59E0B' : '#3B82F6'
                            },
                        ]}
                    />
                )}

                {/* Círculo Principal */}
                <View style={[
                    styles.avatarBorder,
                    isCaregiver
                        ? (isMatch ? styles.avatarBorderMatch : styles.avatarBorderCaregiver)
                        : styles.avatarBorderOwner,
                ]}>
                    {isCaregiver ? (
                        <Image source={{ uri: avatarUri }} style={styles.avatar} />
                    ) : (
                        <View style={styles.ownerIconContainer}>
                            <Icon name="paw" size={24} color="#3B82F6" />
                        </View>
                    )}
                </View>

                {/* Punto Verde Online (solo para cuidadores) */}
                {isCaregiver && user.isOnline && (
                    <View style={styles.onlineDot} />
                )}

                {/* Badge flotante inferior */}
                {isMatch && (
                    <View style={[styles.badge, { backgroundColor: '#F59E0B' }]}>
                        <Text style={styles.badgeText}>Match </Text>
                    </View>
                )}
                {!isCaregiver && (
                    <View style={[styles.badge, { backgroundColor: '#3B82F6' }]}>
                        <Text style={styles.badgeText}>Grupo </Text>
                    </View>
                )}
            </View>

            {/* Custom Callout (Modal flotante al tocar) */}
            <Callout tooltip onPress={() => onMessagePress && onMessagePress(user)}>
                <View style={styles.calloutContainer}>
                    <Text style={styles.calloutName} numberOfLines={1}>{name}</Text>
                    <Text style={styles.calloutRole}>
                        {isCaregiver ? 'Cuidador' : 'Paseo en Grupo'} • {distanceText}
                    </Text>
                    <View style={styles.calloutButton}>
                        <Icon name="chatbubble-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text style={styles.calloutButtonText}>Enviar Mensaje</Text>
                    </View>
                </View>
            </Callout>
        </Marker>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 70,
        height: 80,
    },
    pulseRing: {
        position: 'absolute',
        top: 2,
        width: 56,
        height: 56,
        borderRadius: 28,
        borderWidth: 3,
        opacity: 0.5,
    },
    avatarBorder: {
        width: 52,
        height: 52,
        borderRadius: 26,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 5,
        backgroundColor: '#FFFFFF',
    },
    avatarBorderCaregiver: {
        borderWidth: 3,
        borderColor: '#F97316', // Naranja base para cuidadores
    },
    avatarBorderMatch: {
        borderWidth: 3,
        borderColor: '#F59E0B', // Dorado para match
    },
    avatarBorderOwner: {
        borderWidth: 3,
        borderColor: '#3B82F6', // Azul para dueños
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    ownerIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#EFF6FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    onlineDot: {
        position: 'absolute',
        top: 6,
        right: 8,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#10B981',
        borderWidth: 2.5,
        borderColor: '#FFFFFF',
    },
    badge: {
        position: 'absolute',
        bottom: 0,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3,
        elevation: 4,
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: 'bold',
        fontFamily: 'sans-serif',
    },
    // Callout Styles (Estilo moderno tipo Airbnb/Uber)
    calloutContainer: {
        width: 160,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 12,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 6,
        marginBottom: 8, // Separación de la flecha
    },
    calloutName: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#101820',
        fontFamily: 'sans-serif',
        marginBottom: 2,
    },
    calloutRole: {
        fontSize: 12,
        color: '#6B7280',
        fontFamily: 'sans-serif',
        marginBottom: 10,
    },
    calloutButton: {
        flexDirection: 'row',
        backgroundColor: '#101820', // Botón oscuro profesional
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 12,
        alignItems: 'center',
        width: '100%',
        justifyContent: 'center',
    },
    calloutButtonText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '600',
        fontFamily: 'sans-serif',
    },
});

export default PetMarker;
