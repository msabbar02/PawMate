import { db } from '../config/firebase';
import { doc, updateDoc } from 'firebase/firestore';

/**
 * Converts a local image URI to base64 and saves it to Firestore.
 * No Firebase Storage needed — works on the free Spark plan.
 *
 * The image should already be resized/compressed by expo-image-picker
 * before calling this (quality: 0.3, max 300x300).
 */
export async function saveAvatarToFirestore(localUri, userId) {
    if (!localUri) throw new Error('No URI provided');

    // If it's already a base64 data URL or https, return as-is
    if (localUri.startsWith('data:') || localUri.startsWith('https://')) {
        return localUri;
    }

    // Convert local URI to base64 via XHR
    const base64 = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = function () {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('FileReader failed'));
            reader.readAsDataURL(xhr.response);
        };
        xhr.onerror = () => reject(new Error('XHR failed'));
        xhr.responseType = 'blob';
        xhr.open('GET', localUri, true);
        xhr.send(null);
    });

    // Save to Firestore
    await updateDoc(doc(db, 'users', userId), {
        avatar: base64,
        photoURL: base64,
    });

    return base64;
}

/**
 * Legacy: kept for any existing code that imports this.
 * Now saves to Firestore instead of Firebase Storage.
 */
export async function uploadImageToStorage(localUri, storagePath) {
    // Extract userId from path like "avatars/uid.jpg"
    const userId = storagePath.split('/')[1]?.replace('.jpg', '');
    if (userId) {
        return await saveAvatarToFirestore(localUri, userId);
    }
    throw new Error('Could not parse userId from storagePath: ' + storagePath);
}
