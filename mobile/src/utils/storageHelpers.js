import { supabase } from '../config/supabase';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

export async function convertUriToBase64(localUri) {
    if (!localUri) throw new Error('No URI provided');
    if (localUri.startsWith('data:') || localUri.startsWith('http')) {
        return localUri;
    }
    const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
    return `data:image/jpeg;base64,${base64}`;
}

export async function saveAvatarToFirestore(localUri, userId) {
    if (!localUri) return null;
    let url = localUri;
    if (!localUri.startsWith('http')) {
        url = await uploadImageToStorage(localUri, `avatars/${userId}/${Date.now()}.jpg`);
    } else {
        await supabase.from('users').update({
            avatar: url,
            photoURL: url
        }).eq('id', userId);
    }
    return url;
}

export async function uploadImageToStorage(localUri, storagePath) {
    if (!localUri) throw new Error('No URI provided');
    if (localUri.startsWith('http')) return localUri;

    try {
        const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
        const arrayBuffer = decode(base64);

        const { data, error } = await supabase.storage
            .from('pawmate')
            .upload(storagePath, arrayBuffer, {
                contentType: 'image/jpeg',
                upsert: true,
            });

        if (error) {
            // Check if bucket doesn't exist.
            if (error.message.includes('bucket not found') || error.message.includes('404')) {
                 console.warn("Bucket 'pawmate' does not exist yet. Please create it in Supabase dashboard. Returning base64 fallback.");
                 return `data:image/jpeg;base64,${base64}`;
            }
            throw new Error('Supabase Storage Error: ' + error.message);
        }

        const { data: { publicUrl } } = supabase.storage
            .from('pawmate')
            .getPublicUrl(storagePath);

        // If it's an avatar update, also update the user table
        if (storagePath.startsWith('avatars/')) {
            const userId = storagePath.split('/')[1];
            if (userId) {
                await supabase.from('users').update({
                    avatar: publicUrl,
                    photoURL: publicUrl
                }).eq('id', userId);
            }
        }

        return publicUrl;
    } catch (e) {
        console.error('Storage upload error:', e);
        throw e;
    }
}
