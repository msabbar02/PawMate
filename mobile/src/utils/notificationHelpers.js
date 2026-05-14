import { supabase } from '../config/supabase';

/**
 * Envía una notificación push de Expo al dispositivo del usuario indicado.
 * Requiere que el usuario tenga un `expoPushToken` registrado.
 *
 * @param {string} userId Identificador del usuario destinatario.
 * @param {string} title  Título que se muestra en la notificación.
 * @param {string} body   Texto del cuerpo de la notificación.
 */
async function sendPushNotification(userId, title, body) {
    try {
        const { data: userData } = await supabase.from('users').select('expoPushToken').eq('id', userId).single();
        if (!userData?.expoPushToken) return;

        const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                to: userData.expoPushToken,
                sound: 'default',
                title,
                body,
            }),
        });
        if (!response.ok) {
            console.warn('Push notification failed:', response.status, await response.text().catch(() => ''));
        }
    } catch (e) {
        console.warn('sendPushNotification failed:', e.message);
    }
}

/**
 * Crea un registro en la tabla `notifications` para un usuario y dispara, en
 * paralelo, una notificación push hacia su dispositivo.
 *
 * Las claves conocidas (`type`, `title`, `body`, `icon`, `iconBg`,
 * `iconColor`) se guardan en columnas dedicadas; el resto se serializa en la
 * columna `data` (jsonb).
 *
 * @param {string} userId  Identificador del destinatario.
 * @param {object} payload Carga útil con campos conocidos y datos extra.
 */
export async function createNotification(userId, payload) {
    if (!userId) return;
    try {
        const { type, title, body, icon, iconBg, iconColor, ...extra } = payload;
        await supabase.from('notifications').insert({
            userId,
            type, title, body, icon, iconBg, iconColor,
            data: Object.keys(extra).length > 0 ? extra : {},
            read: false,
        });

        sendPushNotification(userId, title, body);
    } catch (e) {
        console.warn('createNotification failed:', e.message);
    }
}

/**
 * Genera una cadena única corta apta para identificar un QR de reserva.
 * Combina la marca de tiempo y un sufijo aleatorio en base 36.
 *
 * @returns {string} Identificador único.
 */
export function generateUniqueId() {
    return (
        Date.now().toString(36) +
        Math.random().toString(36).substring(2, 10)
    );
}
