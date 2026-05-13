import { supabase } from './supabase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.apppawmate.com';

async function getAdminToken() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token ?? null;
    } catch {
        return null;
    }
}

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

export const sendBanEmail = (email, fullName) =>
    callApi('/api/notifications/ban-email', { email, fullName });

export const sendRatingRequestEmail = (reservationId) =>
    callApi('/api/notifications/rating-request', { reservationId });
