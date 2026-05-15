import { supabase } from '../config/supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

// Tipo de codificación seguro: si EncodingType no está definido, usamos la cadena 'base64'.
const BASE64_ENCODING = FileSystem.EncodingType?.Base64 ?? 'base64';

// Buckets reales declarados en supabase_schema.sql.
const KNOWN_BUCKETS = ['avatars', 'pets', 'verifications', 'posts', 'chat', 'reports', 'gallery'];

/**
 * Sanitiza una ruta de Storage usando allowlist: solo permite letras, números,
 * guiones, guiones bajos, puntos y barras. Cualquier otro carácter (incluido
 * `..`) es eliminado. Lanza un error si la ruta resultante está vacía o sigue
 * conteniendo `..` tras la limpieza.
 *
 * @param {string} p Ruta a sanitizar.
 * @returns {string} Ruta segura.
 */
function sanitizePath(p) {
    // Allowlist: solo caracteres seguros en rutas de almacenamiento.
    const cleaned = String(p)
        .replace(/[^a-zA-Z0-9\-_./]/g, '')  // elimina todo lo que no sea seguro
        .replace(/\.{2,}/g, '.')             // colapsa ".." o "..." en "."
        .replace(/^[/]+/, '');               // elimina barras iniciales

    if (!cleaned || cleaned.includes('..')) {
        throw new Error('Invalid storage path: unsafe characters detected.');
    }
    return cleaned;
}

/**
 * Determina el bucket correcto a partir del prefijo de la ruta. Si el prefijo
 * coincide con un bucket conocido se usa ese; si no, se cae a 'posts' como
 * almacén público genérico.
 *
 * @param {string} storagePath Ruta destino (ej. `avatars/uid/file.jpg`).
 * @returns {{ bucket: string, path: string }} Bucket y subruta dentro del bucket.
 */
function resolveBucket(storagePath) {
    const [head, ...rest] = String(storagePath).split('/');
    if (KNOWN_BUCKETS.includes(head)) {
        return { bucket: head, path: rest.join('/') || head };
    }
    return { bucket: 'posts', path: storagePath };
}

/**
 * Convierte una URI local del dispositivo a una cadena base64 lista para
 * enviarse en un campo `<img src>` o un cuerpo JSON.
 *
 * Si la URI ya es una URL HTTP o un data URI se devuelve tal cual.
 *
 * @param {string} localUri Ruta local de la imagen.
 * @returns {Promise<string>} URL o data URI válido.
 */
export async function convertUriToBase64(localUri) {
    if (!localUri) throw new Error('No URI provided');
    if (localUri.startsWith('data:') || localUri.startsWith('http')) {
        return localUri;
    }
    const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: BASE64_ENCODING });
    return `data:image/jpeg;base64,${base64}`;
}

/**
 * Sube un fichero local al bucket de Supabase Storage que corresponda según
 * el prefijo de `storagePath` (avatars, pets, verifications, posts, chat,
 * reports, gallery). Si el bucket no existe, devuelve la imagen como data
 * URI base64 a modo de fallback para que la app no se rompa.
 *
 * @param {string} localUri    Ruta local de la imagen.
 * @param {string} storagePath Ruta destino dentro del bucket (incluye prefijo).
 * @returns {Promise<string>}  URL pública o data URI base64.
 */
async function _uploadToStorage(localUri, storagePath) {
    if (!localUri) throw new Error('No URI provided');
    if (localUri.startsWith('http')) return localUri;

    const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: BASE64_ENCODING });
    const arrayBuffer = decode(base64);
    const { bucket, path } = resolveBucket(sanitizePath(storagePath));

    const { error } = await supabase.storage
        .from(bucket)
        .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });

    if (error) {
        if (error.message?.toLowerCase().includes('bucket') || error.message?.includes('404')) {
            console.warn(`Bucket '${bucket}' no existe en Supabase. Devolviendo data URI como fallback.`);
            return `data:image/jpeg;base64,${base64}`;
        }
        throw new Error('Supabase Storage Error: ' + error.message);
    }

    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
    return publicUrl;
}

/**
 * Sube una imagen y, si la ruta empieza por `avatars/`, actualiza además las
 * columnas `avatar` y `photoURL` del usuario correspondiente.
 *
 * @param {string} localUri    Ruta local de la imagen.
 * @param {string} storagePath Ruta destino (ej. `avatars/{uid}/{ts}.jpg`).
 * @returns {Promise<string>}  URL pública resultante.
 */
export async function uploadImageToStorage(localUri, storagePath) {
    if (!localUri) throw new Error('No URI provided');
    if (localUri.startsWith('http')) return localUri;

    try {
        const publicUrl = await _uploadToStorage(localUri, storagePath);

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

/**
 * Sube una imagen de mascota. No modifica ninguna tabla.
 *
 * @param {string} localUri    Ruta local de la imagen.
 * @param {string} storagePath Ruta destino dentro del bucket.
 * @returns {Promise<string>}  URL pública resultante.
 */
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

/**
 * Sube un documento de verificación (DNI, selfie, certificado).
 *
 * @param {string} localUri    Ruta local del documento.
 * @param {string} storagePath Ruta destino dentro del bucket.
 * @returns {Promise<string>}  URL pública resultante.
 */
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

/**
 * Sube una imagen adjunta a un reporte de incidencia.
 *
 * @param {string} localUri    Ruta local de la imagen.
 * @param {string} storagePath Ruta destino dentro del bucket.
 * @returns {Promise<string>}  URL pública resultante.
 */
export async function uploadReportImage(localUri, storagePath) {
    if (!localUri) throw new Error('No URI provided');
    if (localUri.startsWith('http')) return localUri;
    try {
        return await _uploadToStorage(localUri, storagePath);
    } catch (e) {
        console.error('Report image upload error:', e);
        throw e;
    }
}

/**
 * Sube una foto a la galería del cuidador en
 * `gallery/{userId}/{timestamp}.jpg`.
 *
 * @param {string} localUri Ruta local de la imagen.
 * @param {string} userId   Identificador del usuario propietario.
 * @returns {Promise<string>} URL pública resultante.
 */
export async function uploadGalleryPhoto(localUri, userId) {
    if (!localUri) throw new Error('No URI provided');
    if (localUri.startsWith('http')) return localUri;
    try {
        return await _uploadToStorage(localUri, `gallery/${userId}/${Date.now()}.jpg`);
    } catch (e) {
        console.error('Gallery image upload error:', e);
        throw e;
    }
}

/**
 * Atajo retrocompatible para guardar el avatar de un usuario. Si la URI ya
 * es una URL remota, solo actualiza la fila del usuario.
 *
 * @param {string} localUri Ruta local o URL del avatar.
 * @param {string} userId   Identificador del usuario.
 * @returns {Promise<string|null>} URL final guardada.
 */
export async function saveAvatar(localUri, userId) {
    if (!localUri) return null;
    if (!localUri.startsWith('http')) {
        return await uploadImageToStorage(localUri, `avatars/${userId}/${Date.now()}.jpg`);
    }
    await supabase.from('users').update({
        avatar: localUri,
        photoURL: localUri,
    }).eq('id', userId);
    return localUri;
}
