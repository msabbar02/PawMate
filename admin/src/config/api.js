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

/**
 * Crea un nuevo administrador a través del backend (service key).
 * Solo el superadministrador puede usarlo. Devuelve `{ ok, error }`
 * para que la UI pueda mostrar un mensaje detallado al usuario.
 *
 * @param {{email:string, password:string, fullName:string}} payload
 * @returns {Promise<{ok:boolean, error?:string, data?:any}>}
 */
export async function createAdminAccount(payload) {
    const token = await getAdminToken();
    if (!token) return { ok: false, error: 'No hay sesión activa' };
    try {
        const res = await fetch(`${API_BASE_URL}/api/users/create-admin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
            return { ok: false, error: json?.error || json?.message || `HTTP ${res.status}` };
        }
        return { ok: true, data: json?.data };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

/**
 * Cambia la contraseña de un usuario llamando al endpoint del backend
 * (que usa la service key). El backend valida los permisos según las
 * reglas de superadmin.
 *
 * @param {string} userId
 * @param {string} password
 * @returns {Promise<{ok:boolean, error?:string}>}
 */
export async function setUserPassword(userId, password) {
    const token = await getAdminToken();
    if (!token) return { ok: false, error: 'No hay sesión activa' };
    try {
        const res = await fetch(`${API_BASE_URL}/api/users/${userId}/password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ password }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
            return { ok: false, error: json?.error || json?.message || `HTTP ${res.status}` };
        }
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}
