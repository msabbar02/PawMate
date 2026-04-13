import React, { useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';

import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import MyPetsScreen from '../screens/MyPetsScreen';
import BookingScreen from '../screens/BookingScreen';
import CaregiversScreen from '../screens/CaregiversScreen';
import CaregiverProfileScreen from '../screens/CaregiverProfileScreen';
import MessagesScreen from '../screens/MessagesScreen';
import VerifyOwnerScreen from '../screens/VerifyOwnerScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// ── Profile Incomplete Banner ──────────────────────────────────
function ProfileIncompleteBanner() {
    const { userData } = useContext(AuthContext);
    const { theme } = useContext(ThemeContext);
    const navigation = useNavigation();

    if (!userData) return null;

    const missing = [];
    if (!userData.firstName && !userData.fullName) missing.push('nombre');
    if (!userData.phone) missing.push('teléfono');
    if (!userData.city && !userData.address?.city) missing.push('ciudad');

    if (missing.length === 0) return null;

    return (
        <TouchableOpacity
            style={styles.incompleteBanner}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.85}
        >
            <Ionicons name="alert-circle-outline" size={18} color="#fff" />
            <Text style={styles.incompleteBannerText}>
                Completa tu perfil: falta {missing.join(', ')}
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#fff" />
        </TouchableOpacity>
    );
}

// Wrapper that locks the Booking tab for 'normal' users
function BookingTabScreen() {
    const { userData } = useContext(AuthContext);
    const { theme } = useContext(ThemeContext);
    const navigation = useNavigation();
    const role = userData?.role;

    if (!role || role === 'normal') {
        return (
            <View style={[styles.lockContainer, { backgroundColor: theme.background }]}>
                <View style={[styles.lockCard, { backgroundColor: theme.cardBackground }]}>
                    <Ionicons name="lock-closed" size={52} color={theme.primary} />
                    <Text style={[styles.lockTitle, { color: theme.text }]}>Acceso restringido</Text>
                    <Text style={[styles.lockSubtitle, { color: theme.textSecondary }]}>
                        Para acceder a Reservas necesitas verificar tu cuenta como Dueño o Cuidador.
                    </Text>
                    <TouchableOpacity
                        style={[styles.lockBtn, { backgroundColor: theme.primary }]}
                        onPress={() => navigation.navigate('Verify')}
                    >
                        <Text style={styles.lockBtnText}>Verificar mi cuenta</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return <BookingScreen />;
}

const MainTabNavigator = () => {
    const { userData } = useContext(AuthContext);
    const { theme } = useContext(ThemeContext);
    const role = userData?.role;
    const isLocked = !role || role === 'normal';

    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                tabBarShowLabel: false,
                tabBarIcon: ({ focused, color }) => {
                    let iconName;
                    if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline';
                    else if (route.name === 'Mascotas') iconName = focused ? 'paw' : 'paw-outline';
                    else if (route.name === 'Reservas') {
                        iconName = isLocked ? 'lock-closed' : (focused ? 'calendar' : 'calendar-outline');
                    }
                    else if (route.name === 'Cuidadores') iconName = focused ? 'people' : 'people-outline';
                    else if (route.name === 'Ajustes') iconName = focused ? 'settings' : 'settings-outline';

                    const primaryColor = theme.primary || '#10b981';
                    const routeLabel = route.name === 'Reservas' ? 'Reservas' : route.name === 'Mascotas' ? 'Mascotas' : route.name === 'Cuidadores' ? 'Cuidar' : route.name === 'Ajustes' ? 'Ajustes' : 'Inicio';

                    if (focused) {
                        return (
                            <View style={{ alignItems: 'center', justifyContent: 'center', width: 60, height: 70 }}>
                                <View style={{
                                    position: 'absolute',
                                    top: -8, // Lowered even further per request
                                    width: 50,
                                    height: 50,
                                    borderRadius: 25,
                                    backgroundColor: primaryColor,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    borderWidth: 4,
                                    borderColor: theme.background || '#f8fafc',
                                    shadowColor: primaryColor,
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: 0.3,
                                    shadowRadius: 5,
                                    elevation: 6,
                                }}>
                                    <Ionicons name={iconName} size={22} color="#FFF" />
                                </View>
                                <Text style={{ fontSize: 11, fontWeight: '700', color: primaryColor, position: 'absolute', bottom: 8 }}>
                                    {routeLabel}
                                </Text>
                            </View>
                        );
                    }

                    return (
                        <View style={{ alignItems: 'center', justifyContent: 'center', width: 60, height: 70 }}>
                            <Ionicons name={iconName} size={24} color="#94a3b8" />
                            {isLocked && route.name === 'Reservas' && (
                                <View style={[styles.lockBadge, { position: 'absolute', top: 12, right: 12 }]}>
                                    <Ionicons name="lock-closed" size={10} color="#fff" />
                                </View>
                            )}
                            <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                                {routeLabel}
                            </Text>
                        </View>
                    );
                },
                tabBarStyle: {
                    backgroundColor: theme.tabBar || '#ffffff',
                    height: Platform.OS === 'ios' ? 85 : 65,
                    borderTopWidth: 0,
                    elevation: 10,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 10,
                },
                headerShown: false,
            })}
        >
            <Tab.Screen
                name="Home"
                component={HomeScreen}
                options={{ tabBarLabel: 'Inicio' }}
            />
            <Tab.Screen
                name="Mascotas"
                component={MyPetsScreen}
                options={{ tabBarLabel: 'Mascotas' }}
            />
            <Tab.Screen
                name="Reservas"
                component={BookingTabScreen}
                options={{ tabBarLabel: 'Reservas' }}
            />
            <Tab.Screen
                name="Cuidadores"
                component={CaregiversScreen}
                options={{ tabBarLabel: 'Cuidadores' }}
            />
            <Tab.Screen
                name="Ajustes"
                component={SettingsScreen}
                options={{ tabBarLabel: 'Ajustes' }}
            />
        </Tab.Navigator>
    );
};

function MainTabsWithBanner() {
    return (
        <View style={{ flex: 1 }}>
            <ProfileIncompleteBanner />
            <MainTabNavigator />
        </View>
    );
}

export default function AppNavigator() {
    const { user, isLoading } = useContext(AuthContext);
    const { theme } = useContext(ThemeContext);

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {user ? (
                    <>
                        <Stack.Screen
                            name="MainTabs"
                            component={MainTabsWithBanner}
                        />
                        <Stack.Screen
                            name="CaregiverProfile"
                            component={CaregiverProfileScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen 
                            name="Messages" 
                            component={MessagesScreen} 
                            options={{ headerShown: false }} 
                        />
                        <Stack.Screen
                            name="Verify"
                            component={VerifyOwnerScreen}
                            options={{ headerShown: true, title: 'Verificar cuenta', headerTintColor: theme.primary }}
                        />
                        <Stack.Screen
                            name="Notifications"
                            component={NotificationsScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="Profile"
                            component={ProfileScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="Settings"
                            component={SettingsScreen}
                            options={{ headerShown: false }}
                        />
                    </>
                ) : (
                    <>
                        <Stack.Screen name="Login" component={LoginScreen} />
                        <Stack.Screen name="Signup" component={SignupScreen} />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
}

const styles = StyleSheet.create({
    incompleteBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f59e0b',
        paddingHorizontal: 14,
        paddingVertical: 9,
        gap: 8,
        paddingTop: Platform.OS === 'ios' ? 52 : 9,
    },
    incompleteBannerText: {
        flex: 1,
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
    lockContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    lockCard: {
        borderRadius: 20,
        padding: 36,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
        width: '100%',
    },
    lockTitle: {
        fontSize: 22,
        fontWeight: '700',
        marginTop: 16,
        marginBottom: 10,
    },
    lockSubtitle: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 28,
    },
    lockBtn: {
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 14,
    },
    lockBtnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 15,
    },
    lockBadge: {
        position: 'absolute',
        top: -4,
        right: -6,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#ef4444',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
