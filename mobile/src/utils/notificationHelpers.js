import { supabase } from '../config/supabase';

/**
 * Sends an Expo push notification to a device.
 * Requires the user to have registered an expoPushToken.
 */
async function sendPushNotification(userId, title, body) {
    try {
        const { data: userData } = await supabase.from('users').select('expoPushToken').eq('id', userId).single();
        if (!userData?.expoPushToken) return;

        await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to: userData.expoPushToken,
                sound: 'default',
                title,
                body,
            }),
        });
    } catch (e) {
        console.warn('sendPushNotification failed:', e.message);
    }
}

/**
 * Creates a notification record for a specific user.
 * Table: notifications
 *
 * Known columns: type, title, body, icon, iconBg, iconColor
 * Everything else goes into the `data` jsonb column.
 *
 * @param {string} userId  - Target user's UID
 * @param {object} payload - Notification payload
 */
export async function createNotification(userId, payload) {
    if (!userId) return;
    try {
        const { type, title, body, icon, iconBg, iconColor, ...extra } = payload;
        await supabase.from('notifications').insert({
            userId,
            type, title, body, icon, iconBg, iconColor,
            data: Object.keys(extra).length > 0 ? extra : {},
            read: false,
        });

        // Also fire a push notification to the user's device
        sendPushNotification(userId, title, body);
    } catch (e) {
        console.warn('createNotification failed:', e.message);
    }
}

/** Generates a simple unique string suitable for QR codes */
export function generateUniqueId() {
    return (
        Date.now().toString(36) +
        Math.random().toString(36).substring(2, 10)
    );
}
