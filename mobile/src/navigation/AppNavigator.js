import React, { useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';

import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import MyPetsScreen from '../screens/MyPetsScreen';
import CommunityScreen from '../screens/CommunityScreen';
import BookingScreen from '../screens/BookingScreen';
import VerifyOwnerScreen from '../screens/VerifyOwnerScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

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
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName;
                    if (route.name === 'Home') {
                        iconName = focused ? 'home' : 'home-outline';
                    } else if (route.name === 'Mascotas') {
                        iconName = focused ? 'paw' : 'paw-outline';
                    } else if (route.name === 'Reservas') {
                        if (isLocked) {
                            return (
                                <View style={{ position: 'relative' }}>
                                    <Ionicons name="calendar-outline" size={size} color={color} />
                                    <View style={styles.lockBadge}>
                                        <Ionicons name="lock-closed" size={8} color="#fff" />
                                    </View>
                                </View>
                            );
                        }
                        iconName = focused ? 'calendar' : 'calendar-outline';
                    } else if (route.name === 'Comunidad') {
                        iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
                    } else if (route.name === 'Ajustes') {
                        iconName = focused ? 'settings' : 'settings-outline';
                    }
                    return <Ionicons name={iconName} size={size} color={color} />;
                },
                tabBarActiveTintColor: theme.tabBarActive,
                tabBarInactiveTintColor: theme.tabBarInactive,
                tabBarStyle: {
                    backgroundColor: theme.tabBar,
                    borderTopColor: theme.border,
                    borderTopWidth: 1,
                    elevation: 0,
                    shadowOpacity: 0,
                    height: Platform.OS === 'ios' ? 84 : 60,
                    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
                    paddingTop: 8,
                },
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '600',
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
                name="Comunidad"
                component={CommunityScreen}
                options={{ tabBarLabel: 'Comunidad' }}
            />
            <Tab.Screen
                name="Ajustes"
                component={SettingsScreen}
                options={{ tabBarLabel: 'Ajustes' }}
            />
        </Tab.Navigator>
    );
};

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
                        <Stack.Screen name="MainTabs" component={MainTabNavigator} />
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
