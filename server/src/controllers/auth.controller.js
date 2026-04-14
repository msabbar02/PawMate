const { supabase } = require('../config/supabase');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Verify user token
 * POST /api/auth/verify-token
 */
const verifyToken = async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return sendError(res, 'Token is required', 400);
        }

        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return sendError(res, 'Invalid token', 401);
        }

        return sendSuccess(res, { uid: user.id, email: user.email }, 'Token verified successfully');
    } catch (error) {
        console.error('Verify token error:', error);
        return sendError(res, 'Invalid token', 401);
    }
};

/**
 * Get user profile
 * GET /api/auth/profile
 */
const getProfile = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', req.user.uid)
            .single();

        if (error || !data) {
            return sendError(res, 'User not found', 404);
        }

        return sendSuccess(res, { uid: req.user.uid, ...data }, 'Profile retrieved successfully');
    } catch (error) {
        console.error('Get profile error:', error);
        return sendError(res, 'Error retrieving profile', 500);
    }
};

module.exports = {
    verifyToken,
    getProfile,
};
