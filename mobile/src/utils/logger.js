import { supabase } from '../config/supabase';

/**
 * Logs a user activity into the recent_activity table.
 * @param {string} userId - The ID of the user performing the action
 * @param {string} title - Short title for the activity (e.g., 'Mascota Registrada')
 * @param {string} description - Optional detail (e.g., 'Añadiste a Firulais a tu familia')
 * @param {string} type - 'pet', 'walk', 'reservation', 'system', 'profile'
 * @param {string} icon - Ionicons icon name (e.g., 'paw', 'walk', 'calendar')
 */
export const logActivity = async (userId, title, description = '', type = 'system', icon = 'information-circle') => {
    if (!userId) return;
    try {
        await supabase.from('recent_activity').insert([
            {
                userId,
                title,
                description,
                type,
                icon
            }
        ]);
    } catch (e) {
        console.warn('Error logging activity: ', e);
    }
};

/**
 * Registra una acción en la tabla system_logs de Supabase para el panel de administración.
 * @param {string} userId - El ID del usuario que realizó la acción.
 * @param {string} userEmail - El correo del usuario.
 * @param {string} actionType - Tipo de acción (e.g., 'LOGIN', 'RESERVATION_CREATED', 'PET_CREATED').
 * @param {string} entity - Entidad afectada (e.g., 'Auth', 'Reservations', 'Pets').
 * @param {Object} details - Detalles adicionales (opcional).
 */
export const logSystemAction = async (userId, userEmail, actionType, entity, details = {}) => {
    try {
        await supabase.from('system_logs').insert([
            {
                userId: userId || 'Sistema',
                userEmail: userEmail || 'Sistema',
                actionType: actionType,
                entity: entity,
                details: typeof details === 'string' ? details : JSON.stringify(details),
                created_at: new Date().toISOString(),
            }
        ]);
    } catch {
        // Silently fail — system_logs table may not exist yet
    }
};
