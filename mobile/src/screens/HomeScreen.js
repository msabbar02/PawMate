import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

const HomeScreen = ({ navigation }) => {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Welcome to PawMate!</Text>
            <Text style={styles.subtitle}>Your pet's best friend.</Text>

            <TouchableOpacity
                style={styles.fab}
                onPress={() => navigation.navigate('CreatePet')}
            >
                <Text style={styles.fabIcon}>+</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#101820', // Darker theme like SignupScreen
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#1a7a4c', // Primary color
    },
    subtitle: {
        fontSize: 16,
        color: '#888',
    },
    fab: {
        position: 'absolute',
        width: 60,
        height: 60,
        alignItems: 'center',
        justifyContent: 'center',
        right: 25,
        bottom: 25,
        backgroundColor: '#1a7a4c',
        borderRadius: 30,
        elevation: 8,
        shadowColor: '#1a7a4c',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 5,
    },
    fabIcon: {
        fontSize: 30,
        color: 'white',
        fontWeight: 'bold',
        marginTop: -3,
    }
});

export default HomeScreen;
