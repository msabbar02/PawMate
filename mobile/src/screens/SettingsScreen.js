import React, { useContext } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, Alert, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
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
            const updateData = { isOnline: newValue };
            if (newValue) {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                    const loc = await Location.getCurrentPositionAsync({});
                    updateData.location = {
                        latitude: loc.coords.latitude,
                        longitude: loc.coords.longitude
                    };
                }
            } else {
                updateData.location = null;
            }
            await updateDoc(doc(db, 'users', user.uid), updateData);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'No se pudo actualizar el estado online.');
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
                {/* Header Profile Section */}
                <View style={styles.profileHeader}>
                    {userData?.photoURL || userData?.avatar ? (
                        <Image source={{ uri: userData?.photoURL || userData?.avatar }} style={styles.largeAvatar} />
                    ) : (
                        <View style={styles.placeholderAvatar}>
                            <Ionicons name="person" size={60} color={theme.textSecondary} />
                        </View>
                    )}
                    <Text style={styles.profileNameMain}>{userData?.name} {userData?.surname}</Text>
                    <Text style={styles.profileRoleMain}>{roleLabels[currentRole]}</Text>

                    {currentRole === 'caregiver' && (
                        <View style={styles.ratingBadge}>
                            <Ionicons name="star" size={16} color="#FFD700" />
                            <Ionicons name="star" size={16} color="#FFD700" />
                            <Ionicons name="star" size={16} color="#FFD700" />
                            <Ionicons name="star" size={16} color="#FFD700" />
                            <Ionicons name="star" size={16} color="#FFD700" />
                            <Text style={styles.ratingText}>(5.0)</Text>
                        </View>
                    )}

                    {currentRole === 'user' && (
                        <TouchableOpacity style={styles.upgradeBtnCenter} onPress={() => navigation.navigate('UpgradeRole')}>
                            <Ionicons name="diamond-outline" size={16} color="#FFF" />
                            <Text style={styles.upgradeTextCenter}>Mejorar a Cuidador</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Main Action Buttons */}
                <View style={styles.actionButtonsRow}>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.primary }]} onPress={() => navigation.navigate('ProfileEdit')}>
                        <Ionicons name="person-circle-outline" size={24} color="#FFF" />
                        <Text style={styles.actionBtnTextPrimary}>Ver Perfil</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.cardBackground, borderWidth: 1, borderColor: theme.border }]} onPress={() => Alert.alert('Cerrar sesión', '¿Estás seguro?', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Salir', style: 'destructive', onPress: () => { import('firebase/auth').then(({ signOut }) => { const { auth } = require('../config/firebase'); signOut(auth); }); } }])}>
                        <Ionicons name="log-out-outline" size={24} color="#f44336" />
                        <Text style={[styles.actionBtnTextSecondary, { color: '#f44336' }]}>Cerrar Sesión</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.sectionSettings}>
                    <Text style={styles.sectionTitle}>Ajustes de la cuenta</Text>

                    {/* Caregiver Settings */}
                    {currentRole === 'caregiver' && (
                        <View style={styles.settingItem}>
                            <View style={styles.settingItemLeft}>
                                <View style={[styles.iconWrap, { backgroundColor: '#4caf5020' }]}>
                                    <Ionicons name="radio-outline" size={20} color="#4caf50" />
                                </View>
                                <Text style={styles.settingLabel}>Disponible (Online)</Text>
                            </View>
                            <Switch
                                value={userData?.isOnline || false}
                                onValueChange={handleOnlineStatusChange}
                                trackColor={{ false: '#767577', true: '#4caf50' }}
                                thumbColor={'#fff'}
                            />
                        </View>
                    )}

                    <View style={styles.settingItem}>
                        <View style={styles.settingItemLeft}>
                            <View style={[styles.iconWrap, { backgroundColor: theme.primary + '20' }]}>
                                {isDarkMode ? (
                                    <Ionicons name="moon" size={20} color={theme.primary} />
                                ) : (
                                    <Ionicons name="sunny" size={20} color="#FF9800" />
                                )}
                            </View>
                            <Text style={styles.settingLabel}>Modo Oscuro</Text>
                        </View>
                        <Switch
                            value={isDarkMode}
                            onValueChange={toggleTheme}
                            trackColor={{ false: '#767577', true: theme.primaryLight }}
                            thumbColor={isDarkMode ? theme.primary : '#f4f3f4'}
                        />
                    </View>

                    <View style={styles.infoFooter}>
                        <Text style={styles.infoFooterText}>PawMate App v1.0.0</Text>
                        <Text style={styles.infoFooterText}>Actualizado: {lastUpdated}</Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const getStyles = (theme) => StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: theme.background
    },
    container: {
        flex: 1,
        backgroundColor: theme.background,
    },
    profileHeader: {
        alignItems: 'center',
        paddingTop: 30,
        paddingBottom: 20,
    },
    largeAvatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        marginBottom: 12,
        borderWidth: 2,
        borderColor: theme.border,
    },
    placeholderAvatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: theme.cardBackground,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
        borderWidth: 2,
        borderColor: theme.border,
    },
    profileNameMain: {
        fontSize: 24,
        fontWeight: 'bold',
        color: theme.text,
        marginBottom: 4,
    },
    profileRoleMain: {
        fontSize: 16,
        color: theme.textSecondary,
        marginBottom: 8,
    },
    ratingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.cardBackground,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        marginTop: 4,
        gap: 2,
        borderWidth: 1,
        borderColor: theme.border,
    },
    ratingText: {
        fontSize: 14,
        fontWeight: 'bold',
        color: theme.text,
        marginLeft: 4,
    },
    upgradeBtnCenter: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.primary,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        marginTop: 10,
        gap: 6,
    },
    upgradeTextCenter: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 14,
    },
    actionButtonsRow: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        gap: 16,
        marginBottom: 30,
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 16,
        gap: 8,
    },
    actionBtnTextPrimary: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    actionBtnTextSecondary: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    sectionSettings: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: theme.textSecondary,
        textTransform: 'uppercase',
        marginBottom: 16,
        marginLeft: 4,
    },
    settingItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: theme.cardBackground,
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: theme.border,
    },
    settingItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    settingLabel: {
        fontSize: 17,
        fontWeight: '500',
        color: theme.text,
    },
    infoFooter: {
        marginTop: 30,
        alignItems: 'center',
    },
    infoFooterText: {
        fontSize: 13,
        color: theme.textSecondary,
        marginBottom: 4,
    }
});

export default SettingsScreen;
