import { supabase } from '../config/supabase';

/**
 * Update user species preference after a like/unlike action.
 * @param {string} uid - User ID
 * @param {string} species - Species tag (e.g. 'dog', 'cat')
 * @param {number} delta - +1 for like, -1 for unlike
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
 * Get top preferred species for a user, sorted by count descending.
 * @param {string} uid - User ID
 * @returns {Array<{species: string, count: number}>}
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
