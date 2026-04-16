import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '../config/supabase';
import Constants from 'expo-constants';

/**
 * Requests notification permissions and registers the device's
 * Expo Push Token in Supabase under users/{userId}.expoPushToken.
 * Silently skips if running in Expo Go (push not supported).
 */
export async function registerForPushNotifications() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Skip in Expo Go — push notifications require a dev build since SDK 53
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

        // Use EAS project ID from app.json/app.config.js
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

// Configure how notifications are displayed while app is in foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});
