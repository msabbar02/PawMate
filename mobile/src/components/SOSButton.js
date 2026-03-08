import React, { useRef, useEffect } from 'react';
import { TouchableOpacity, Animated, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

const SOSButton = ({ isActive, onPress }) => {
    // Animación de latido (pulse) que usa el driver nativo por rendimiento
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (isActive) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.2,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [isActive]);

    const handlePress = async () => {
        try {
            // Requerimos GPS de alta precisión en emergencia
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert("Permisos denegados", "Necesitamos acceso a tu ubicación para enviar la alerta SOS.");
                return;
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Highest,
            });

            // Pasamos las coordenadas al padre para que dispare el mensaje/API
            if (onPress) {
                onPress({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude
                });
            }
        } catch (error) {
            Alert.alert("Error de GPS", "No pudimos obtener tu ubicación exacta. Intenta de nuevo.");
            console.warn("SOS Error:", error);
        }
    };

    if (!isActive) return null;

    return (
        <Animated.View style={[styles.container, { transform: [{ scale: pulseAnim }] }]}>
            <TouchableOpacity style={styles.button} onPress={handlePress} activeOpacity={0.8}>
                <Ionicons name="warning" size={28} color="#FFFFFF" />
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        right: 16,
        bottom: 240, // Se posiciona por encima del bottom sheet
        zIndex: 50,
    },
    button: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#EF4444', // Rojo urgencia
        justifyContent: 'center',
        alignItems: 'center',
        // Sombras elegantes
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 8,
    },
});

export default SOSButton;
