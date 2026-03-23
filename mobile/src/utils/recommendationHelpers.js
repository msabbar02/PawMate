import { db, auth } from '../config/firebase';
import { doc, getDoc, setDoc, getDocs, collection, updateDoc, increment } from 'firebase/firestore';

/**
 * Update user species preference after a like/unlike action.
 * @param {string} uid - User ID
 * @param {string} species - Species tag (e.g. 'dog', 'cat')
 * @param {number} delta - +1 for like, -1 for unlike
 */
export const updatePreference = async (uid, species, delta) => {
    if (!uid || !species) return;
    const prefRef = doc(db, 'users', uid, 'preferences', species);
    const prefSnap = await getDoc(prefRef);

    if (prefSnap.exists()) {
        await updateDoc(prefRef, { count: increment(delta) });
    } else if (delta > 0) {
        await setDoc(prefRef, { species, count: 1 });
    }
};

/**
 * Get top preferred species for a user, sorted by count descending.
 * @param {string} uid - User ID
 * @returns {Array<{species: string, count: number}>}
 */
export const getTopPreferences = async (uid) => {
    if (!uid) return [];
    const snap = await getDocs(collection(db, 'users', uid, 'preferences'));
    const prefs = snap.docs
        .map(d => ({ species: d.id, ...d.data() }))
        .filter(p => p.count > 0)
        .sort((a, b) => b.count - a.count);
    return prefs;
};
