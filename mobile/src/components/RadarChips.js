import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const FILTERS = [
    { label: '500m', delta: 0.005 },
    { label: '2km', delta: 0.02 },
    { label: '5km', delta: 0.05 },
];

/**
 * Chips de filtro de radio en el mapa (500m / 2km / 5km).
 *
 * @param {object} props
 * @param {string} props.activeFilter   Etiqueta del filtro actualmente activo.
 * @param {Function} props.onFilterChange Callback `(filtro) => void`.
 */
const RadarChips = ({ activeFilter, onFilterChange }) => {
    return (
        <View style={styles.container}>
            {FILTERS.map((filter) => {
                const isActive = activeFilter === filter.label;
                return (
                    <TouchableOpacity
                        key={filter.label}
                        style={[styles.chip, isActive && styles.chipActive]}
                        onPress={() => onFilterChange(filter)}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                            {filter.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 120,
        alignSelf: 'center',
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.92)',
        borderRadius: 25,
        paddingHorizontal: 6,
        paddingVertical: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 5,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
    },
    chip: {
        paddingHorizontal: 18,
        paddingVertical: 8,
        borderRadius: 20,
        marginHorizontal: 3,
    },
    chipActive: {
        backgroundColor: '#F59E0B',
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 4,
        elevation: 3,
    },
    chipText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6B7280',
    },
    chipTextActive: {
        color: '#FFFFFF',
        fontWeight: 'bold',
    },
});

export default RadarChips;
