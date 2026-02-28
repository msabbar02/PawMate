import React, { useContext } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, Alert } from 'react-native';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const SettingsScreen = ({ navigation }) => {
    const { theme, toggleTheme, isDarkMode } = useContext(ThemeContext);
    const { user, userData } = useContext(AuthContext);
    const styles = getStyles(theme);
    const lastUpdated = new Date().toLocaleDateString();

    const currentRole = userData?.role || 'user';

    // Convert role to Spanish
    const roleLabels = {
        'user': 'Normal',
        'owner': 'Dueño',
        'caregiver': 'Cuidador'
    };

    const handleOnlineStatusChange = async (newValue) => {
        try {
            await updateDoc(doc(db, 'users', user.uid), {
                isOnline: newValue
            });
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'No se pudo actualizar el estado online.');
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Ajustes</Text>

            {/* Profile Status */}
            <View style={styles.profileBox}>
                <Ionicons name="person-circle-outline" size={60} color={theme.primary} />
                <View style={styles.profileInfo}>
                    <Text style={styles.profileName}>{userData?.name} {userData?.surname}</Text>
                    <Text style={styles.profileRole}>Rol: {roleLabels[currentRole]}</Text>
                </View>

                {currentRole === 'user' && (
                    <TouchableOpacity
                        style={styles.upgradeBtn}
                        onPress={() => navigation.navigate('UpgradeRole')}
                    >
                        <Text style={styles.upgradeText}>Mejorar</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Caregiver Settings */}
            {currentRole === 'caregiver' && (
                <View style={[styles.infoContainer, { backgroundColor: theme.primary + '11', paddingHorizontal: 15, borderRadius: 10 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="radio-outline" size={24} color={userData?.isOnline ? '#4caf50' : theme.textSecondary} style={{ marginRight: 10 }} />
                        <Text style={[styles.label, { fontWeight: 'bold' }]}>Disponible (Online):</Text>
                    </View>
                    <Switch
                        value={userData?.isOnline || false}
                        onValueChange={handleOnlineStatusChange}
                        trackColor={{ false: '#767577', true: '#4caf50' }}
                        thumbColor={'#fff'}
                    />
                </View>
            )}

            <View style={styles.infoContainer}>
                <Text style={styles.label}>Modo Oscuro:</Text>
                <Switch
                    value={isDarkMode}
                    onValueChange={toggleTheme}
                    trackColor={{ false: '#767577', true: theme.primaryLight }}
                    thumbColor={isDarkMode ? theme.primary : '#f4f3f4'}
                />
            </View>

            <View style={styles.infoContainer}>
                <Text style={styles.label}>Versión de la App:</Text>
                <Text style={styles.value}>1.0.0</Text>
            </View>

            <View style={styles.infoContainer}>
                <Text style={styles.label}>Última actualización:</Text>
                <Text style={styles.value}>{lastUpdated}</Text>
            </View>
        </View>
    );
};

const getStyles = (theme) => StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: theme.background,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        color: theme.text,
    },
    infoContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
        marginBottom: 5,
    },
    label: {
        fontSize: 16,
        color: theme.textSecondary,
    },
    value: {
        fontSize: 16,
        color: theme.primary,
        fontWeight: 'bold',
    },
    profileBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.cardBackground,
        padding: 15,
        borderRadius: 15,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: theme.border,
    },
    profileInfo: {
        flex: 1,
        marginLeft: 15,
    },
    profileName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.text,
    },
    profileRole: {
        fontSize: 14,
        color: theme.primary,
        marginTop: 4,
    },
    upgradeBtn: {
        backgroundColor: theme.primary,
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
    },
    upgradeText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 12,
    }
});

export default SettingsScreen;
