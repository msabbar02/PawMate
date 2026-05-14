import React from 'react';

/**
 * Envuelve `StripeProvider` de forma segura para que la app no casque en
 * Expo Go, donde los módulos nativos de Stripe no están disponibles. Si el
 * módulo no se puede importar renderiza los hijos sin proveedor.
 */

let StripeProviderReal = null;

try {
    const stripe = require('@stripe/stripe-react-native');
    StripeProviderReal = stripe.StripeProvider;
} catch (e) {
    console.warn('Stripe native module not available. Payments will be disabled.');
}

/**
 * Proveedor de Stripe con fallback. Si Stripe no está disponible renderiza
 * los hijos directamente para no bloquear la navegación.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children      Componentes hijos.
 * @param {string}          props.publishableKey Clave pública de Stripe.
 */
export const SafeStripeProvider = ({ children, publishableKey }) => {
    if (StripeProviderReal) {
        return (
            <StripeProviderReal publishableKey={publishableKey}>
                {children}
            </StripeProviderReal>
        );
    }
    return <>{children}</>;
};

/**
 * Hook de Stripe con fallback. Devuelve funciones mock cuando el módulo
 * nativo no está presente, de forma que los flujos de pago fallen con un
 * mensaje legible en lugar de lanzar una excepción.
 *
 * @returns {object} Interfaz de `useStripe` o equivalente mock.
 */
export const useSafeStripe = () => {
    try {
        const stripe = require('@stripe/stripe-react-native');
        return stripe.useStripe();
    } catch (e) {
        return {
            initPaymentSheet: async () => ({ error: { message: 'Stripe no disponible en Expo Go.' } }),
            presentPaymentSheet: async () => ({ error: { code: 'Canceled', message: 'Stripe no disponible en Expo Go.' } }),
            confirmPlatformPayPayment: async () => ({ error: { message: 'Stripe no disponible en Expo Go. Usa un build de desarrollo.' } }),
            isPlatformPaySupported: async () => false,
        };
    }
};

// Exportación segura de PlatformPay con constantes de fallback.
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
