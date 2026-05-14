import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '../config/supabase';
import Constants from 'expo-constants';

/**
 * Pide permisos de notificación al sistema, obtiene el token Expo Push del
 * dispositivo y lo guarda en la fila del usuario en Supabase
 * (`users.expoPushToken`).
 *
 * Si la app se está ejecutando dentro de Expo Go la operación se omite, ya
 * que las push reales requieren un dev build a partir del SDK 53.
 *
 * @returns {Promise<string|undefined>} Token registrado o undefined si no hay.
 */
export async function registerForPushNotifications() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const isExpoGo = Constants.appOwnership === 'expo';
    if (isExpoGo) {
        console.log('Push notifications skipped (Expo Go)');
        return;
    }

    try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.log('Push notification permission denied');
            return;
        }

        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        if (!projectId) {
            console.warn('No EAS projectId found — skipping push token registration');
            return;
        }

        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        const token = tokenData.data;

        await supabase.from('users').update({
            expoPushToken: token,
            notificationsEnabled: true,
        }).eq('id', user.id);

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'PawMate',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF6B6B',
            });
        }

        console.log('Push token registered:', token);
        return token;
    } catch (e) {
        console.warn('registerForPushNotifications error:', e.message);
    }
}

// Comportamiento de las notificaciones cuando la app está en primer plano.
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});
