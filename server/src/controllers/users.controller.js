const { supabase } = require('../config/supabase');
const { sendSuccess, sendError } = require('../utils/response');

// Fields safe to expose about any user (public profile)
const PUBLIC_USER_FIELDS = [
    'id', 'fullName', 'firstName', 'lastName', 'bio', 'city', 'province', 'country',
    'avatar', 'photoURL', 'role', 'isVerified', 'rating', 'reviewCount',
    'serviceTypes', 'acceptedSpecies', 'price', 'serviceRadius',
    'latitude', 'longitude', 'isOnline', 'galleryPhotos',
    'maxConcurrentWalks', 'maxConcurrentHotel', 'createdAt', 'created_at',
].join(',');

// Sensitive fields that should never leave the server for another user
const PRIVATE_FIELDS = new Set([
    'idFrontUrl', 'idBackUrl', 'selfieUrl', 'certDocUrl',
    'fcmToken', 'expoPushToken', 'phone', 'birthDate', 'gender',
    'preferences', 'address', 'verificationStatus', 'verificationRequestedAt',
    'pendingRole', 'is_banned',
]);

/**
 * Get all users (Admin only) with pagination
 * GET /api/users?limit=50&offset=0&role=caregiver
 */
const getAllUsers = async (req, res) => {
    try {
        const limit  = Math.min(parseInt(req.query.limit  || '50',  10), 200);
        const offset = Math.max(parseInt(req.query.offset || '0',   10), 0);
        const { role, search } = req.query;

        let query = supabase
            .from('users')
            .select('*', { count: 'exact' })
            .range(offset, offset + limit - 1)
            .order('created_at', { ascending: false });

        if (role)   query = query.eq('role', role);
        if (search) query = query.ilike('fullName', `%${search}%`);

        const { data, error, count } = await query;
        if (error) throw error;

        return sendSuccess(res, { users: data, total: count, limit, offset }, 'Users retrieved successfully');
    } catch (error) {
        console.error('Get all users error:', error);
        return sendError(res, 'Error retrieving users', 500);
    }
};

/**
 * Get user by ID.
 * Own profile → all fields (minus verification docs).
 * Other user   → public fields only.
 * Admin        → all fields.
 * GET /api/users/:id
 */
const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const isSelf  = req.user.uid === id;
        const isAdmin = req.user.isAdmin;

        const selectFields = (isSelf || isAdmin) ? '*' : PUBLIC_USER_FIELDS;

        const { data, error } = await supabase
            .from('users')
            .select(selectFields)
            .eq('id', id)
            .single();

        if (error || !data) {
            return sendError(res, 'User not found', 404);
        }

        // Even for own profile, strip verification document URLs (admin-only)
        if (!isAdmin) {
            for (const field of PRIVATE_FIELDS) {
                if (!isSelf) delete data[field]; // non-self: remove all private
                else if (['idFrontUrl', 'idBackUrl', 'selfieUrl', 'certDocUrl'].includes(field)) {
                    delete data[field]; // self: only remove doc URLs
                }
            }
        }

        return sendSuccess(res, data, 'User retrieved successfully');
    } catch (error) {
        console.error('Get user error:', error);
        return sendError(res, 'Error retrieving user', 500);
    }
};

/**
 * Update user
 * PUT /api/users/:id
 */
const ALLOWED_USER_FIELDS = [
    'fullName', 'firstName', 'lastName', 'phone', 'bio', 'city', 'province', 'country',
    'avatar', 'photoURL', 'birthDate', 'gender', 'latitude', 'longitude',
    'isOnline', 'lastSeen', 'isWalking', 'walkingPets', 'fcmToken', 'expoPushToken',
    'language', 'preferences', 'address', 'saveWalks', 'saveLocation',
    'totalWalks', 'totalDistance', 'totalMinutes',
    // Caregiver-specific
    'price', 'serviceTypes', 'acceptedSpecies', 'serviceRadius',
    'maxConcurrentWalks', 'maxConcurrentHotel', 'galleryPhotos',
];
const ADMIN_ONLY_FIELDS = ['role', 'is_banned', 'verificationStatus', 'isVerified', 'pendingRole'];

const updateUser = async (req, res) => {
    try {
        const { id } = req.params;

        if (req.user.uid !== id && !req.user.isAdmin) {
            return sendError(res, 'Unauthorized', 403);
        }

        const allowedKeys = req.user.isAdmin
            ? [...ALLOWED_USER_FIELDS, ...ADMIN_ONLY_FIELDS]
            : ALLOWED_USER_FIELDS;
        const updates = {};
        for (const key of allowedKeys) {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        }
        if (Object.keys(updates).length === 0) {
            return sendError(res, 'No valid fields to update', 400);
        }

        const { error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', id);

        if (error) throw error;

        return sendSuccess(res, null, 'User updated successfully');
    } catch (error) {
        console.error('Update user error:', error);
        return sendError(res, 'Error updating user', 500);
    }
};

/**
 * Delete user (Admin only)
 * DELETE /api/users/:id
 * Users can delete their own account. Admins can delete any account.
 */
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const isSelf = req.user.uid === id;

        // If not self-delete, verify caller is admin (inline check since route no longer enforces it)
        let isAdmin = false;
        if (!isSelf) {
            const { data: caller } = await supabase
                .from('users')
                .select('role')
                .eq('id', req.user.uid)
                .single();
            isAdmin = caller?.role === 'admin';
        }

        if (!isSelf && !isAdmin) {
            return sendError(res, 'Forbidden', 403);
        }

        // Delete from users table first
        const { error: dbError } = await supabase
            .from('users')
            .delete()
            .eq('id', id);

        if (dbError) throw dbError;

        // Delete from Supabase Auth (requires service key — admin API)
        const { error: authError } = await supabase.auth.admin.deleteUser(id);
        if (authError) {
            console.error('Auth user delete error:', authError);
            // Row already deleted — still respond success, auth cleanup failed
        }

        return sendSuccess(res, null, 'Account deleted successfully');
    } catch (error) {
        console.error('Delete user error:', error);
        return sendError(res, 'Error deleting account', 500);
    }
};

module.exports = {
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
};
