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

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const MainTabNavigator = () => {
    return (
        <Tab.Navigator>
            <Tab.Screen name="Home" component={HomeScreen} />
            <Tab.Screen name="Mascotas" component={MyPetsScreen} />
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
