import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Creates a notification document in Firestore for a specific user.
 * Path: notifications/{userId}/items/{auto-id}
 *
 * @param {string} userId  - Target user's UID
 * @param {object} data    - Notification payload
 */
export async function createNotification(userId, data) {
    if (!userId) return;
    try {
        await addDoc(collection(db, 'notifications', userId, 'items'), {
            ...data,
            read: false,
            createdAt: serverTimestamp(),
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
