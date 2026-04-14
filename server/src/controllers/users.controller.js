const { supabase } = require('../config/supabase');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Get all users (Admin only)
 * GET /api/users
 */
const getAllUsers = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*');

        if (error) throw error;

        return sendSuccess(res, data, 'Users retrieved successfully');
    } catch (error) {
        console.error('Get all users error:', error);
        return sendError(res, 'Error retrieving users', 500);
    }
};

/**
 * Get user by ID
 * GET /api/users/:id
 */
const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) {
            return sendError(res, 'User not found', 404);
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
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        if (req.user.uid !== id && !req.user.isAdmin) {
            return sendError(res, 'Unauthorized', 403);
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
 * Delete user
 * DELETE /api/users/:id
 */
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return sendSuccess(res, null, 'User deleted successfully');
    } catch (error) {
        console.error('Delete user error:', error);
        return sendError(res, 'Error deleting user', 500);
    }
};

module.exports = {
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
};
