import { supabase } from '../config/supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

// Safe encoding type — fallback to string 'base64' if EncodingType is undefined
const BASE64_ENCODING = FileSystem.EncodingType?.Base64 ?? 'base64';

export async function convertUriToBase64(localUri) {
    if (!localUri) throw new Error('No URI provided');
    if (localUri.startsWith('data:') || localUri.startsWith('http')) {
        return localUri;
    }
    const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: BASE64_ENCODING });
    return `data:image/jpeg;base64,${base64}`;
}

// Internal helper: uploads to Supabase Storage and returns public URL.
async function _uploadToStorage(localUri, storagePath) {
    if (!localUri) throw new Error('No URI provided');
    if (localUri.startsWith('http')) return localUri;

    const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: BASE64_ENCODING });
    const arrayBuffer = decode(base64);

    const { error } = await supabase.storage
        .from('pawmate')
        .upload(storagePath, arrayBuffer, { contentType: 'image/jpeg', upsert: true });

    if (error) {
        if (error.message?.toLowerCase().includes('bucket') || error.message?.includes('404')) {
            console.warn("Bucket 'pawmate' does not exist. Returning base64 fallback.");
            return `data:image/jpeg;base64,${base64}`;
        }
        throw new Error('Supabase Storage Error: ' + error.message);
    }

    const { data: { publicUrl } } = supabase.storage.from('pawmate').getPublicUrl(storagePath);
    return publicUrl;
}

// For AVATAR uploads: uploads image AND updates user profile row.
export async function uploadImageToStorage(localUri, storagePath) {
    if (!localUri) throw new Error('No URI provided');
    if (localUri.startsWith('http')) return localUri;

    try {
        const publicUrl = await _uploadToStorage(localUri, storagePath);

        // Only update user profile if this is an avatar upload
        if (storagePath.startsWith('avatars/')) {
            const userId = storagePath.split('/')[1];
            if (userId) {
                await supabase.from('users').update({
                    avatar: publicUrl,
                    photoURL: publicUrl,
                }).eq('id', userId);
            }
        }

        return publicUrl;
    } catch (e) {
        console.error('Storage upload error:', e);
        throw e;
    }
}

// For PET images: uploads image only, never modifies any table.
export async function uploadPetImage(localUri, storagePath) {
    if (!localUri) throw new Error('No URI provided');
    if (localUri.startsWith('http')) return localUri;
    try {
        return await _uploadToStorage(localUri, storagePath);
    } catch (e) {
        console.error('Pet image upload error:', e);
        throw e;
    }
}

// For VERIFICATION DOCS: uploads image only, returns public URL.
export async function uploadVerificationDoc(localUri, storagePath) {
    if (!localUri) throw new Error('No URI provided');
    if (localUri.startsWith('http')) return localUri;
    try {
        return await _uploadToStorage(localUri, storagePath);
    } catch (e) {
        console.error('Verification doc upload error:', e);
        throw e;
    }
}

// Legacy alias — kept for backward compat
export async function saveAvatarToFirestore(localUri, userId) {
    if (!localUri) return null;
    if (!localUri.startsWith('http')) {
        return await uploadImageToStorage(localUri, `avatars/${userId}/${Date.now()}.jpg`);
    }
    // Already a URL — just update the user row
    await supabase.from('users').update({
        avatar: localUri,
        photoURL: localUri,
    }).eq('id', userId);
    return localUri;
}
