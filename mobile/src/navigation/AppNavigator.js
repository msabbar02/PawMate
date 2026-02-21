import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import HomeScreen from '../screens/HomeScreen';
import SettingsScreen from '../screens/SettingsScreen';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import CreatePetScreen from '../screens/CreatePetScreen';
import MyPetsScreen from '../screens/MyPetsScreen';
import CommunityScreen from '../screens/CommunityScreen';
import { Ionicons } from '@expo/vector-icons';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const MainTabNavigator = () => {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName;

                    if (route.name === 'Home') {
                        iconName = focused ? 'home' : 'home-outline';
                    } else if (route.name === 'Mascotas') {
                        iconName = focused ? 'paw' : 'paw-outline';
                    } else if (route.name === 'Comunidad') {
                        iconName = focused ? 'people' : 'people-outline';
                    } else if (route.name === 'Settings') {
                        iconName = focused ? 'settings' : 'settings-outline';
                    }

                    return <Ionicons name={iconName} size={focused ? 28 : 24} color={color} />;
                },
                tabBarActiveTintColor: '#FFF',
                tabBarInactiveTintColor: '#8E9AAB',
                tabBarShowLabel: false, // Ocultar etiquetas para un look más limpio
                tabBarStyle: {
                    backgroundColor: '#1a7a4c', // Verde característico de PawMate
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
            <Tab.Screen name="Comunidad" component={CommunityScreen} />
            <Tab.Screen name="Settings" component={SettingsScreen} />
        </Tab.Navigator>
    );
};

const AppNavigator = () => {
    return (
        <NavigationContainer>
            <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Signup" component={SignupScreen} />
                <Stack.Screen
                    name="CreatePet"
                    component={CreatePetScreen}
                    options={{ presentation: 'modal' }}
                />
                <Stack.Screen name="Home" component={MainTabNavigator} />
            </Stack.Navigator>
        </NavigationContainer>
    );
};

export default AppNavigator;
