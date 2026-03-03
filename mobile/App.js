import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { ThemeProvider } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
// import { StripeProvider } from '@stripe/stripe-react-native';

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

export default function App() {
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <AuthProvider>
          {/* <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}> */}
          <AppNavigator />
          {/* </StripeProvider> */}
        </AuthProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
