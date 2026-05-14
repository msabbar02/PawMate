import { supabase } from '../config/supabase';

/**
 * Actualiza el contador de preferencias de un usuario sobre una especie
 * concreta. Se usa cuando el usuario da o quita un "like" a una mascota.
 *
 * @param {string} uid     Identificador del usuario.
 * @param {string} species Etiqueta de la especie (dog, cat, etc.).
 * @param {number} delta   +1 al dar like, -1 al retirarlo.
 */
export const updatePreference = async (uid, species, delta) => {
    if (!uid || !species) return;
    try {
        const { data } = await supabase
            .from('preferences')
            .select('count')
            .eq('userId', uid)
            .eq('species', species)
            .maybeSingle();

        const currentCount = data ? data.count : 0;
        const newCount = currentCount + delta;

        if (newCount >= 0) {
            await supabase
                .from('preferences')
                .upsert(
                    { userId: uid, species, count: newCount },
                    { onConflict: 'userId, species' }
                );
        }
    } catch (e) {
        console.error('Error updating preference:', e);
    }
};

/**
 * Devuelve las especies preferidas del usuario ordenadas de mayor a menor
 * por el contador acumulado.
 *
 * @param {string} uid Identificador del usuario.
 * @returns {Promise<Array<{species: string, count: number}>>}
 */
export const getTopPreferences = async (uid) => {
    if (!uid) return [];
    try {
        const { data } = await supabase
            .from('preferences')
            .select('*')
            .eq('userId', uid)
            .gt('count', 0)
            .order('count', { ascending: false });

        return data || [];
    } catch (e) {
        return [];
    }
};
