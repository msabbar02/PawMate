import { supabase } from '../config/supabase';

/**
 * Creates a notification record for a specific user.
 * Table: notifications
 *
 * @param {string} userId  - Target user's UID
 * @param {object} data    - Notification payload
 */
export async function createNotification(userId, data) {
    if (!userId) return;
    try {
        await supabase.from('notifications').insert({
            userId,
            ...data,
            read: false,
        });
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
