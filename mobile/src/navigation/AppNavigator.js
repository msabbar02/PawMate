import React, { useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';

import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import MyPetsScreen from '../screens/MyPetsScreen';
import BookingScreen from '../screens/BookingScreen';
import CaregiversScreen from '../screens/CaregiversScreen';
import CaregiverDashboardScreen from '../screens/CaregiverDashboardScreen';
import CaregiverProfileScreen from '../screens/CaregiverProfileScreen';
import CreateBookingScreen from '../screens/CreateBookingScreen';
import ChatScreen from '../screens/ChatScreen';
import CaregiverSetupScreen from '../screens/CaregiverSetupScreen';
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

    const pct = Math.round(((3 - missing.length) / 3) * 100);

    return (
        <TouchableOpacity
            style={[styles.incompleteBanner, { backgroundColor: theme.primary || '#F5A623' }]}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.85}
        >
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>{pct}%</Text>
            </View>
            <Text style={styles.incompleteBannerText}>
                Completa tu perfil: falta {missing.join(', ')}
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#fff" />
        </TouchableOpacity>
    );
}

// Caregiver tab: shows dashboard for caregivers, list for owners
function CaregiverTabScreen(props) {
    const { userData } = useContext(AuthContext);
    if (userData?.role === 'caregiver') {
        return <CaregiverDashboardScreen {...props} />;
    }
    return <CaregiversScreen {...props} />;
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
    const { t } = useTranslation();
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
                    else if (route.name === 'Cuidadores') iconName = focused ? 'people' : 'people-outline';
                    else if (route.name === 'Reservas') {
                        iconName = isLocked ? 'lock-closed' : (focused ? 'calendar' : 'calendar-outline');
                    }
                    else if (route.name === 'Ajustes') iconName = focused ? 'settings' : 'settings-outline';

                    const activeColor = '#F5A623';
                    const routeLabel = route.name === 'Reservas' ? t('tabs.bookings')
                        : route.name === 'Mascotas' ? t('tabs.pets')
                        : route.name === 'Cuidadores' ? (role === 'caregiver' ? t('tabs.panel') : t('tabs.caregivers'))
                        : route.name === 'Ajustes' ? t('tabs.settings')
                        : t('tabs.home');

                    if (focused) {
                        return (
                            <View style={{ alignItems: 'center', justifyContent: 'center', width: 64, height: 64 }}>
                                <View style={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 14,
                                    backgroundColor: activeColor,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    shadowColor: activeColor,
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: 0.35,
                                    shadowRadius: 8,
                                    elevation: 6,
                                }}>
                                    <Ionicons name={iconName} size={22} color="#FFF" />
                                </View>
                                <Text style={{ fontSize: 10, fontWeight: '700', color: activeColor, marginTop: 4 }}>
                                    {routeLabel}
                                </Text>
                            </View>
                        );
                    }

                    return (
                        <View style={{ alignItems: 'center', justifyContent: 'center', width: 64, height: 64 }}>
                            <Ionicons name={iconName} size={23} color="rgba(255,255,255,0.45)" />
                            {isLocked && route.name === 'Reservas' && (
                                <View style={[styles.lockBadge, { position: 'absolute', top: 14, right: 14 }]}>
                                    <Ionicons name="lock-closed" size={9} color="#fff" />
                                </View>
                            )}
                            <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4, fontWeight: '600' }}>
                                {routeLabel}
                            </Text>
                        </View>
                    );
                },
                tabBarStyle: {
                    backgroundColor: '#1A1A2E',
                    height: Platform.OS === 'ios' ? 88 : 68,
                    borderTopWidth: 0,
                    elevation: 20,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 16,
                    borderTopLeftRadius: 24,
                    borderTopRightRadius: 24,
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    paddingTop: 6,
                },
                headerShown: false,
            })}
        >
            <Tab.Screen
                name="Home"
                component={HomeScreen}
                options={{ tabBarLabel: t('tabs.home') }}
            />
            <Tab.Screen
                name="Mascotas"
                component={MyPetsScreen}
                options={{ tabBarLabel: t('tabs.pets') }}
            />
            {role && role !== 'normal' && (
                <Tab.Screen
                    name="Cuidadores"
                    component={CaregiverTabScreen}
                    options={{ tabBarLabel: role === 'caregiver' ? 'Panel' : 'Cuidadores' }}
                />
            )}
            <Tab.Screen
                name="Reservas"
                component={BookingTabScreen}
                options={{ tabBarLabel: t('tabs.bookings') }}
            />
            <Tab.Screen
                name="Ajustes"
                component={SettingsScreen}
                options={{ tabBarLabel: t('tabs.settings') }}
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
                            name="CreateBooking"
                            component={CreateBookingScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="Chat"
                            component={ChatScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="CaregiverSetup"
                            component={CaregiverSetupScreen}
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
