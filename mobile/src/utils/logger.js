import { supabase } from '../config/supabase';

/**
 * Inserta una entrada en la tabla recent_activity para mostrarla en el feed
 * del usuario (perfil y home).
 *
 * @param {string} userId        Identificador del usuario que realiza la acción.
 * @param {string} title         Título corto que aparece en la tarjeta.
 * @param {string} [description] Descripción opcional debajo del título.
 * @param {string} [type]        Categoría: pet, walk, reservation, system, profile.
 * @param {string} [icon]        Nombre del icono de Ionicons.
 */
export const logActivity = async (userId, title, description = '', type = 'system', icon = 'information-circle') => {
    if (!userId) return;
    try {
        await supabase.from('recent_activity').insert([
            { userId, title, description, type, icon }
        ]);
    } catch (e) {
        console.warn('Error logging activity:', e);
    }
};

/**
 * Registra una acción en la tabla system_logs de Supabase. Estos registros
 * alimentan la pantalla de logs del panel de administración.
 *
 * @param {string} userId      Identificador del usuario que ejecuta la acción.
 * @param {string} userEmail   Correo del usuario (para mostrarlo en el panel).
 * @param {string} actionType  Tipo de acción (USER_LOGIN, PET_CREATED, etc.).
 * @param {string} entity      Entidad afectada (Auth, Pets, Reservations…).
 * @param {Object} [details]   Datos adicionales que se serializan a JSON.
 */
export const logSystemAction = async (userId, userEmail, actionType, entity, details = {}) => {
    try {
        const { error } = await supabase.from('system_logs').insert([
            {
                userId: userId || 'Sistema',
                userEmail: userEmail || 'Sistema',
                actionType,
                entity,
                details: typeof details === 'string' ? details : JSON.stringify(details),
            }
        ]);

        if (error) {
            console.warn('No se pudo registrar el log en system_logs:', error.message);
        }
    } catch (err) {
        console.error('Error ejecutando logSystemAction:', err);
    }
};
