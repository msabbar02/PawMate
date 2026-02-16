const { db } = require('../config/firebase');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Get all users (Admin only)
 * GET /api/users
 */
const getAllUsers = async (req, res) => {
    try {
        const usersSnapshot = await db.collection('users').get();
        const users = [];

        usersSnapshot.forEach(doc => {
            users.push({ id: doc.id, ...doc.data() });
        });

        return sendSuccess(res, users, 'Users retrieved successfully');
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
        const userDoc = await db.collection('users').doc(id).get();

        if (!userDoc.exists) {
            return sendError(res, 'User not found', 404);
        }

        return sendSuccess(res, { id: userDoc.id, ...userDoc.data() }, 'User retrieved successfully');
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

        // Only allow user to update their own profile unless admin
        if (req.user.uid !== id && !req.user.isAdmin) {
            return sendError(res, 'Unauthorized', 403);
        }

        await db.collection('users').doc(id).update(updates);
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

        await db.collection('users').doc(id).delete();
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
