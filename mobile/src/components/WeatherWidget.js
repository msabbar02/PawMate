import React, { useContext } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';

const WeatherWidget = () => {
    const { userData } = useContext(AuthContext);
    const userName = userData?.name || 'User';

    // Simulated weather data
    const weather = {
        temp: 22,
        condition: '¡Tiempo estupendo!',
        icon: 'sunny',
    };

    return (
        <View style={styles.container}>
            <View style={styles.row}>
                <Ionicons name={weather.icon} size={22} color="#F59E0B" />
                <Text style={styles.tempText}>{weather.temp}°C</Text>
            </View>
            <Text style={styles.greetingText} numberOfLines={1}>
                {'Hola '}{userName}{'!'}
            </Text>
            <Text style={styles.conditionText} numberOfLines={1}>
                {weather.condition}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 60,
        left: 16,
        backgroundColor: 'rgba(255,255,255,0.92)',
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 6,
        maxWidth: 180,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    tempText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#101820',
        marginLeft: 6,
    },
    greetingText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1a7a4c',
    },
    conditionText: {
        fontSize: 11,
        color: '#6B7280',
        marginTop: 1,
    },
});

export default WeatherWidget;
