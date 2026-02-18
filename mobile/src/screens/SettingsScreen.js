import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const SettingsScreen = () => {
    const lastUpdated = new Date().toLocaleDateString();

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Settings</Text>
            <View style={styles.infoContainer}>
                <Text style={styles.label}>App Version:</Text>
                <Text style={styles.value}>1.0.0</Text>
            </View>
            <View style={styles.infoContainer}>
                <Text style={styles.label}>Last Updated:</Text>
                <Text style={styles.value}>{lastUpdated}</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        color: '#333',
    },
    infoContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    label: {
        fontSize: 16,
        color: '#333',
    },
    value: {
        fontSize: 16,
        color: '#666',
    },
});

export default SettingsScreen;
