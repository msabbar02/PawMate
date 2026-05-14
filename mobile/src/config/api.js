import { supabase } from './supabase';

// URL base del backend PawMate. Para apuntar a un backend local en dev,
// define EXPO_PUBLIC_API_BASE_URL en .env o eas.json (p. ej. http://192.168.1.10:3000).
export const API_BASE_URL =
    process.env.EXPO_PUBLIC_API_BASE_URL || 'https://api.apppawmate.com';

/**
 * Obtiene el JWT de la sesión activa de Supabase para autenticar las
 * peticiones al backend propio.
 *
 * @returns {Promise<string|null>} Token de acceso o `null` si no hay sesión.
 */
async function getAuthToken() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token ?? null;
    } catch {
        return null;
    }
}

/**
 * Construye la cabecera `Authorization` con el JWT actual. Si no hay sesión
 * devuelve un objeto vacío para que las llamadas aún funcionen (endpoints
 * públicos).
 *
 * @returns {Promise<object>} Objeto con `Authorization` o `{}`.
 */
async function authHeaders() {
    const token = await getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Notifica al dueño o al cuidador por email cuando el estado de una reserva
 * cambia. Solo usuarios participantes en la reserva pueden llamarlo.
 *
 * @param {string} reservationId Identificador de la reserva.
 * @returns {Promise<boolean>} `true` si el servidor confirmó el envío.
 */
export const notifyReservationStatus = async (reservationId) => {
    try {
        const headers = await authHeaders();
        const res = await fetch(`${API_BASE_URL}/api/notifications/reservation-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify({ reservationId }),
        });
        return res.ok;
    } catch (e) {
        console.warn('Notify reservation status:', e.message);
        return false;
    }
};

/**
 * Elimina la cuenta del usuario actual (fila en users + usuario auth).
 * El backend usa la service key para borrar ambos registros de forma segura.
 *
 * @param {string} userId Identificador del usuario.
 * @returns {Promise<true>} Lanza error si el servidor responde con un error.
 */
export const deleteAccount = async (userId) => {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...headers },
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Error al eliminar la cuenta');
    }
    return true;
};

/**
 * Envía el email de bienvenida al usuario recién registrado.
 *
 * @param {string} email    Dirección de correo del nuevo usuario.
 * @param {string} fullName Nombre completo para personalizar el asunto.
 * @returns {Promise<boolean>} `true` si el servidor confirmó el envío.
 */
export const sendWelcomeEmail = async (email, fullName) => {
    try {
        const headers = await authHeaders();
        const res = await fetch(`${API_BASE_URL}/api/notifications/welcome-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify({ email, fullName }),
        });
        return res.ok;
    } catch (e) {
        console.warn('Welcome email:', e.message);
        return false;
    }
};

/**
 * Notifica al dueño por email para que valore al cuidador una vez
 * completada la reserva.
 *
 * @param {string} reservationId Identificador de la reserva.
 * @returns {Promise<boolean>} `true` si el servidor confirmó el envío.
 */
export const notifyRatingRequest = async (reservationId) => {
    try {
        const headers = await authHeaders();
        const res = await fetch(`${API_BASE_URL}/api/notifications/rating-request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify({ reservationId }),
        });
        return res.ok;
    } catch (e) {
        console.warn('Rating request email:', e.message);
        return false;
    }
};
