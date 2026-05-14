import { supabase } from './supabase';

// Base URL del backend PawMate.
// En Expo Go (iPhone/Android físico) cambia localhost por la IP de tu PC, ej: http://192.168.1.X:3000
// En Android emulador usa http://10.0.2.2:3000
export const API_BASE_URL = typeof __DEV__ !== 'undefined' && __DEV__
    ? 'https://api.apppawmate.com'   // ← usa producción en dev para Expo Go, o pon tu IP local
    : 'https://api.apppawmate.com';

/** Helper: get current Supabase JWT to authenticate server calls */
async function getAuthToken() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token ?? null;
    } catch {
        return null;
    }
}

/** Helper: build auth headers (returns empty object if no token) */
async function authHeaders() {
    const token = await getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Notify owner/caregiver by email when a reservation status changes.
 * Requires auth — called by participants of the reservation.
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
 * Delete the current user's account (profile row + auth user).
 * The server handles both deletions using the service key.
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
 * Send welcome email after user signs up.
 * Requires auth — user session must exist.
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
 * Notify owner by email to rate the caregiver after a reservation is completed.
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
