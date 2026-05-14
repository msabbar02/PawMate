/**
 * Cliente HTTP fino para llamadas a la API privada de PawMate desde el
 * panel de administración.
 *
 * Añade automáticamente el `Authorization: Bearer <jwt>` con el token
 * del admin autenticado vía Supabase. Devuelve `true`/`false` para
 * indicar si la llamada se completó con éxito; los errores se loguean
 * pero no se propagan para no romper la UI por una notificación fallida.
 */
import { supabase } from './supabase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.apppawmate.com';

/**
 * Obtiene el access token actual del admin desde Supabase.
 * @returns {Promise<string|null>} JWT o `null` si no hay sesión.
 */
async function getAdminToken() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token ?? null;
    } catch {
        return null;
    }
}

/**
 * Realiza un POST autenticado contra la API.
 *
 * @param {string} endpoint Ruta relativa (p. ej. `/api/notifications/...`).
 * @param {Object} body     Cuerpo JSON.
 * @returns {Promise<boolean>} `true` si la respuesta fue 2xx.
 */
async function callApi(endpoint, body) {
    const token = await getAdminToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    try {
        const res = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });
        return res.ok;
    } catch (e) {
        console.warn('[AdminAPI] call failed:', e.message);
        return false;
    }
}

/** Solicita al backend el envío del email de baneo. */
export const sendBanEmail = (email, fullName) =>
    callApi('/api/notifications/ban-email', { email, fullName });

/** Solicita al backend el envío del email de petición de valoración. */
export const sendRatingRequestEmail = (reservationId) =>
    callApi('/api/notifications/rating-request', { reservationId });
