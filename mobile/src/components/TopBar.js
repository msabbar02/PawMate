import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';

const API_KEY = "6ebcc59234e348b8af6172715260403";

const TopBar = ({ onSearchFocus }) => {
    const insets = useSafeAreaInsets();
    const [weatherData, setWeatherData] = useState({
        temp: null,
        icon: 'partly-sunny',
        color: '#F59E0B' // Colors by default
    });
    const [isLoading, setIsLoading] = useState(true);

    // WeatherAPI code mapping to Ionicons
    const getIconInfo = (code, isDay) => {
        if (!code) return { icon: 'partly-sunny', color: '#F59E0B' };

        switch (code) {
            case 1000: // Sunny / Clear
                return { icon: isDay ? 'sunny' : 'moon', color: isDay ? '#F59E0B' : '#9CA3AF' };
            case 1003: // Partly cloudy
                return { icon: isDay ? 'partly-sunny' : 'cloudy-night', color: '#6B7280' };
            case 1006: // Cloudy
            case 1009: // Overcast
            case 1030: // Mist
            case 1135: // Fog
                return { icon: 'cloud', color: '#6B7280' };
            case 1063: // Patchy rain possible
            case 1180: case 1183: case 1186: case 1189: case 1192: case 1195: // Rain
            case 1198: case 1201: case 1240: case 1243: case 1246: // Freezing rain, showers
                return { icon: 'rainy', color: '#3B82F6' };
            case 1087: // Thundery outbreaks
            case 1273: case 1276: case 1279: case 1282: // Thunderstorms
                return { icon: 'thunderstorm', color: '#6B7280' };
            case 1066: case 1069: case 1072: // Snow/Sleet possible
            case 1114: case 1117: case 1148: case 1150: case 1153: case 1168: case 1171:
            case 1204: case 1207: case 1210: case 1213: case 1216: case 1219: case 1222: case 1225:
            case 1237: case 1249: case 1252: case 1255: case 1258: case 1261: case 1264: // Snow, ice pellets
                return { icon: 'snow', color: '#9CA3AF' };
            default:
                return { icon: 'partly-sunny', color: '#F59E0B' };
        }
    };

    useEffect(() => {
        const fetchWeather = async () => {
            try {
                // Get high-accuracy location or fallback to last known
                const location = await Location.getLastKnownPositionAsync({})
                    || await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });

                if (!location) {
                    setIsLoading(false);
                    return;
                }

                // WeatherAPI current.json endpoint
                const res = await fetch(
                    `https://api.weatherapi.com/v1/current.json?key=${API_KEY}&q=${location.coords.latitude},${location.coords.longitude}&aqi=no`
                );

                if (!res.ok) {
                    throw new Error(`WeatherAPI error: ${res.status}`);
                }

                const data = await res.json();

                if (data && data.current) {
                    // WeatherAPI specific structure
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
                <Ionicons name="search" size={20} color="#6B7280" style={styles.searchIcon} />
                <View style={{ flex: 1 }} pointerEvents="none">
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Buscar zonas, parques..."
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
                        <Ionicons
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
