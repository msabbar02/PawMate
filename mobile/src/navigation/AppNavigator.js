import React, { useContext } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import HomeScreen from '../screens/HomeScreen';
import SettingsScreen from '../screens/SettingsScreen';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import CreatePetScreen from '../screens/CreatePetScreen';
import MyPetsScreen from '../screens/MyPetsScreen';
import MessagesScreen from '../screens/MessagesScreen';
import StoreScreen from '../screens/StoreScreen';
import PetDetailsScreen from '../screens/PetDetailsScreen';
import ProductDetailsScreen from '../screens/ProductDetailsScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import UpgradeRoleScreen from '../screens/UpgradeRoleScreen';
import BookingRequestScreen from '../screens/BookingRequestScreen';
import ReservationsScreen from '../screens/ReservationsScreen';
import QRGeneratorScreen from '../screens/QRGeneratorScreen';
import QRScannerScreen from '../screens/QRScannerScreen';
import WalkTrackingScreen from '../screens/WalkTrackingScreen';
import WalkSummaryScreen from '../screens/WalkSummaryScreen';
import ChatScreen from '../screens/ChatScreen';
import CreateStoreItemScreen from '../screens/CreateStoreItemScreen';
import { Ionicons } from '@expo/vector-icons';
import { ThemeContext } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import { ActivityIndicator, View } from 'react-native';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const MainTabNavigator = () => {
    const { theme } = useContext(ThemeContext);

    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName;

                    if (route.name === 'Home') {
                        iconName = focused ? 'home' : 'home-outline';
                    } else if (route.name === 'Mascotas') {
                        iconName = focused ? 'paw' : 'paw-outline';
                    } else if (route.name === 'Mensajes') {
                        iconName = focused ? 'chatbubble' : 'chatbubble-outline';
                    } else if (route.name === 'Tienda') {
                        iconName = focused ? 'cart' : 'cart-outline';
                    } else if (route.name === 'Settings') {
                        iconName = focused ? 'settings' : 'settings-outline';
                    }

                    return <Ionicons name={iconName} size={focused ? 28 : 24} color={color} />;
                },
                tabBarActiveTintColor: theme.tabBarActive,
                tabBarInactiveTintColor: theme.tabBarInactive,
                tabBarShowLabel: false, // Ocultar etiquetas para un look más limpio
                tabBarStyle: {
                    backgroundColor: theme.tabBar,
                    borderTopWidth: 0,
                    elevation: 10,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 5,
                    position: 'absolute', // Barra flotante
                    bottom: 20,
                    left: 20,
                    right: 20,
                    borderRadius: 30, // Bordes muy redondeados
                    height: 65,
                    paddingBottom: 0, // Ajuste para que los íconos queden centrados verticalmente
                },
                headerShown: false,
            })}
        >
            <Tab.Screen name="Home" component={HomeScreen} />
            <Tab.Screen name="Mascotas" component={MyPetsScreen} />
            <Tab.Screen name="Mensajes" component={MessagesScreen} />
            <Tab.Screen name="Tienda" component={StoreScreen} />
            <Tab.Screen name="Settings" component={SettingsScreen} />
        </Tab.Navigator>
    );
};

const AppNavigator = () => {
    const { theme } = useContext(ThemeContext);
    const { user, isLoading } = useContext(AuthContext);

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
                    // App Screens (User is signed in)
                    <>
                        <Stack.Screen name="HomeMain" component={MainTabNavigator} />
                        <Stack.Screen
                            name="CreatePet"
                            component={CreatePetScreen}
                            options={{ presentation: 'modal' }}
                        />
                        <Stack.Screen
                            name="CreateStoreItem"
                            component={CreateStoreItemScreen}
                            options={{ presentation: 'modal' }}
                        />
                        <Stack.Screen name="PetDetails" component={PetDetailsScreen} />
                        <Stack.Screen name="ProductDetails" component={ProductDetailsScreen} />
                        <Stack.Screen name="UserProfile" component={UserProfileScreen} />
                        <Stack.Screen name="UpgradeRole" component={UpgradeRoleScreen} />
                        <Stack.Screen
                            name="BookingRequest"
                            component={BookingRequestScreen}
                            options={{ presentation: 'modal' }}
                        />
                        <Stack.Screen name="Reservations" component={ReservationsScreen} />
                        <Stack.Screen
                            name="QRGenerator"
                            component={QRGeneratorScreen}
                            options={{ presentation: 'modal', headerShown: false }}
                        />
                        <Stack.Screen
                            name="QRScanner"
                            component={QRScannerScreen}
                            options={{ presentation: 'modal', headerShown: false }}
                        />
                        <Stack.Screen
                            name="WalkTracking"
                            component={WalkTrackingScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="WalkSummary"
                            component={WalkSummaryScreen}
                            options={{ headerShown: false }}
                        />
                        <Stack.Screen
                            name="ChatScreen"
                            component={ChatScreen}
                        />
                    </>
                ) : (
                    // Auth Screens (User is not signed in)
                    <>
                        <Stack.Screen name="Login" component={LoginScreen} />
                        <Stack.Screen name="Signup" component={SignupScreen} />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default AppNavigator;
