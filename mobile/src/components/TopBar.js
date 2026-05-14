import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import Icon from './Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useTranslation } from '../context/LanguageContext';

// Clave WeatherAPI. Debe definirse `EXPO_PUBLIC_WEATHER_API_KEY` en el entorno o en eas.json.
// Si no está configurada el widget muestra el fallback de carga sin llamar al servicio.
const API_KEY = process.env.EXPO_PUBLIC_WEATHER_API_KEY || '';

/**
 * Barra superior del mapa con buscador y mini widget de clima en directo.
 *
 * @param {object}   props
 * @param {Function} props.onSearchFocus Callback al pulsar el campo de búsqueda.
 */
const TopBar = ({ onSearchFocus }) => {
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const [weatherData, setWeatherData] = useState({
        temp: null,
        icon: 'partly-sunny',
        color: '#F59E0B'
    });
    const [isLoading, setIsLoading] = useState(true);

    /**
     * Traduce un código de WeatherAPI a un par {icono Ionicons, color}.
     *
     * @param {number}  code  Código de condición meteorológica.
     * @param {boolean} isDay Indica si es de día en la ubicación consultada.
     */
    const getIconInfo = (code, isDay) => {
        if (!code) return { icon: 'partly-sunny', color: '#F59E0B' };

        switch (code) {
            case 1000: // Despejado / soleado
                return { icon: isDay ? 'sunny' : 'moon', color: isDay ? '#F59E0B' : '#9CA3AF' };
            case 1003: // Parcialmente nublado
                return { icon: isDay ? 'partly-sunny' : 'cloudy-night', color: '#6B7280' };
            case 1006:
            case 1009:
            case 1030:
            case 1135: // Nublado / niebla
                return { icon: 'cloud', color: '#6B7280' };
            case 1063:
            case 1180: case 1183: case 1186: case 1189: case 1192: case 1195:
            case 1198: case 1201: case 1240: case 1243: case 1246: // Lluvia y chubascos
                return { icon: 'rainy', color: '#3B82F6' };
            case 1087:
            case 1273: case 1276: case 1279: case 1282: // Tormentas
                return { icon: 'thunderstorm', color: '#6B7280' };
            case 1066: case 1069: case 1072:
            case 1114: case 1117: case 1148: case 1150: case 1153: case 1168: case 1171:
            case 1204: case 1207: case 1210: case 1213: case 1216: case 1219: case 1222: case 1225:
            case 1237: case 1249: case 1252: case 1255: case 1258: case 1261: case 1264: // Nieve y granizo
                return { icon: 'snow', color: '#9CA3AF' };
            default:
                return { icon: 'partly-sunny', color: '#F59E0B' };
        }
    };

    useEffect(() => {
        const fetchWeather = async () => {
            try {
                // Intentamos ubicación cacheada y, si no hay, una de baja precisión.
                const location = await Location.getLastKnownPositionAsync({})
                    || await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });

                if (!location) {
                    setIsLoading(false);
                    return;
                }

                const res = await fetch(
                    `https://api.weatherapi.com/v1/current.json?key=${API_KEY}&q=${location.coords.latitude},${location.coords.longitude}&aqi=no`
                );

                if (!res.ok) {
                    throw new Error(`WeatherAPI error: ${res.status}`);
                }

                const data = await res.json();

                if (data && data.current) {
                    const temp = Math.round(data.current.temp_c);
                    const code = data.current.condition?.code;
                    const isDay = data.current.is_day === 1;
                    const iconConfig = getIconInfo(code, isDay);

                    setWeatherData({
                        temp: temp,
                        icon: iconConfig.icon,
                        color: iconConfig.color
                    });
                }
            } catch (error) {
                console.warn('Error fetching weather:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchWeather();
    }, []);

    return (
        <View style={[styles.container, { top: insets.top + 10 }]}>
            {/* Buscador redondeado como botón */}
            <TouchableOpacity
                style={styles.searchContainer}
                onPress={onSearchFocus}
                activeOpacity={0.8}
            >
                <Icon name="search" size={20} color="#6B7280" style={styles.searchIcon} />
                <View style={{ flex: 1 }} pointerEvents="none">
                    <TextInput
                        style={styles.searchInput}
                        placeholder={t('components.searchPlaces')}
                        placeholderTextColor="#9CA3AF"
                        editable={false}
                    />
                </View>
            </TouchableOpacity>

            {/* Mini-widget de clima */}
            <View style={styles.weatherWidget}>
                {isLoading ? (
                    <ActivityIndicator size="small" color="#F59E0B" />
                ) : (
                    <>
                        <Text style={styles.weatherText}>
                            {weatherData.temp !== null ? `${weatherData.temp}°C` : '--°C'}
                        </Text>
                        <Icon
                            name={weatherData.icon}
                            size={18}
                            color={weatherData.color}
                            style={styles.weatherIcon}
                        />
                    </>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 16,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        zIndex: 10,
    },
    searchContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        height: 48,
        borderRadius: 24,
        paddingHorizontal: 16,
        // Sombra suave requerida
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 4,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: '#101820',
        fontFamily: 'sans-serif', // Tipografía limpia
    },
    weatherWidget: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        height: 48,
        borderRadius: 24,
        paddingHorizontal: 16,
        // Sombra suave requerida
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 4,
        justifyContent: 'center',
        minWidth: 70, // Evitar colapso durante ActivityIndicator
    },
    weatherText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#101820',
        fontFamily: 'sans-serif',
    },
    weatherIcon: {
        marginLeft: 6,
    },
});

export default TopBar;
