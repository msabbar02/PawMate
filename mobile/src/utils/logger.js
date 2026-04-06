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
