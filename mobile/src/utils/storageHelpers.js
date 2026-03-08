import { storage } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

/**
 * Uploads a local image URI to Firebase Storage and returns the download URL.
 * Uses XMLHttpRequest instead of fetch() for better React Native compatibility
 * with content:// and file:// URIs on Android.
 */
export async function uploadImageToStorage(localUri, storagePath) {
    if (!localUri || localUri.startsWith('https://')) {
        return localUri;
    }

    // XMLHttpRequest handles local URIs more reliably than fetch() on RN
    const blob = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = function () { resolve(xhr.response); };
        xhr.onerror = function () { reject(new TypeError('Network request failed')); };
        xhr.responseType = 'blob';
        xhr.open('GET', localUri, true);
        xhr.send(null);
    });

    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(storageRef);

    // Free the blob memory
    if (typeof blob.close === 'function') blob.close();

    return downloadURL;
}
