// Base URL del backend PawMate. En producción usa tu URL real.
// En Android emulador usa http://10.0.2.2:3000 en lugar de localhost.
export const API_BASE_URL = typeof __DEV__ !== 'undefined' && __DEV__
    ? 'http://localhost:3000'
    : 'https://api.apppawmate.com';

export const notifyReservationStatus = async (reservationId) => {
    try {
        const res = await fetch(`${API_BASE_URL}/api/notifications/reservation-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reservationId }),
        });
        return res.ok;
    } catch (e) {
        console.warn('Notify reservation status:', e.message);
        return false;
    }
};

export const sendWelcomeEmail = async (email, fullName) => {
    try {
        const res = await fetch(`${API_BASE_URL}/api/notifications/welcome-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, fullName }),
        });
        return res.ok;
    } catch (e) {
        console.warn('Welcome email:', e.message);
        return false;
    }
};

export const sendWelcomeEmail = async (email, fullName) => {
    try {
        const res = await fetch(`${API_BASE_URL}/api/notifications/welcome-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, fullName }),
        });
        return res.ok;
    } catch (e) {
        console.warn('Welcome email:', e.message);
        return false;
    }
};
