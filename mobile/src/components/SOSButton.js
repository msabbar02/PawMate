import React, { useRef, useEffect } from 'react';
import { TouchableOpacity, Animated, StyleSheet, Alert } from 'react-native';
import Icon from './Icon';
import * as Location from 'expo-location';
import { useTranslation } from '../context/LanguageContext';

/**
 * Botón flotante de emergencia. Cuando está activo latíe para llamar la
 * atención; al pulsarlo solicita permiso de ubicación y entrega las
 * coordenadas al callback `onPress` para que el padre dispare el SOS real.
 *
 * @param {object}   props
 * @param {boolean}  props.isActive Si es `false` no se renderiza nada.
 * @param {Function} props.onPress  Callback `({latitude, longitude}) => void`.
 */
const SOSButton = ({ isActive, onPress }) => {
    const { t } = useTranslation();
    // Animación de latido (pulse) que usa el driver nativo por rendimiento
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        let animation;
        if (isActive) {
            animation = Animated.loop(
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
            );
            animation.start();
        } else {
            pulseAnim.setValue(1);
        }
        return () => { if (animation) animation.stop(); };
    }, [isActive]);

    const handlePress = async () => {
        try {
            // Requerimos GPS de alta precisión en emergencia
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert(t('components.sosPermissionDenied'), t('components.sosPermissionMsg'));
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
            Alert.alert(t('components.sosGPSError'), t('components.sosGPSErrorMsg'));
            console.warn("SOS Error:", error);
        }
    };

    if (!isActive) return null;

    return (
        <Animated.View style={[styles.container, { transform: [{ scale: pulseAnim }] }]}>
            <TouchableOpacity style={styles.button} onPress={handlePress} activeOpacity={0.8}>
                <Icon name="warning" size={28} color="#FFFFFF" />
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
