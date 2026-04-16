import React from 'react';

// Safe wrapper for StripeProvider that won't crash in Expo Go
// When running in Expo Go, native Stripe modules aren't available.
// This wrapper catches the error and renders children without Stripe.

let StripeProviderReal = null;

try {
    // Attempt to import the real StripeProvider
    const stripe = require('@stripe/stripe-react-native');
    StripeProviderReal = stripe.StripeProvider;
} catch (e) {
    // Module not available (e.g. Expo Go environment)
    console.warn('Stripe native module not available. Payments will be disabled.');
}

export const SafeStripeProvider = ({ children, publishableKey }) => {
    if (StripeProviderReal) {
        return (
            <StripeProviderReal publishableKey={publishableKey}>
                {children}
            </StripeProviderReal>
        );
    }

    // Fallback: render without Stripe when native module isn't available
    return <>{children}</>;
};

// Safe hook wrapper for useStripe
export const useSafeStripe = () => {
    try {
        const stripe = require('@stripe/stripe-react-native');
        return stripe.useStripe();
    } catch (e) {
        // Return mock functions when Stripe is not available
        return {
            initPaymentSheet: async () => ({ error: { message: 'Stripe no disponible en Expo Go.' } }),
            presentPaymentSheet: async () => ({ error: { code: 'Canceled', message: 'Stripe no disponible en Expo Go.' } }),
            confirmPlatformPayPayment: async () => ({ error: { message: 'Stripe no disponible en Expo Go. Usa un build de desarrollo.' } }),
            isPlatformPaySupported: async () => false,
        };
    }
};

// Safe PlatformPay export
export let SafePlatformPay = {};
try {
    const stripe = require('@stripe/stripe-react-native');
    SafePlatformPay = stripe.PlatformPay || {};
} catch (e) {
    SafePlatformPay = {
        BillingAddressFormat: { Min: 0 },
        PaymentType: { Immediate: 0 },
    };
}
