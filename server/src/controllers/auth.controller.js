const { auth, db } = require('../config/firebase');
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

        const decodedToken = await auth.verifyIdToken(token);
        return sendSuccess(res, { uid: decodedToken.uid, email: decodedToken.email }, 'Token verified successfully');
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
        const userDoc = await db.collection('users').doc(req.user.uid).get();

        if (!userDoc.exists) {
            return sendError(res, 'User not found', 404);
        }

        return sendSuccess(res, { uid: req.user.uid, ...userDoc.data() }, 'Profile retrieved successfully');
    } catch (error) {
        console.error('Get profile error:', error);
        return sendError(res, 'Error retrieving profile', 500);
    }
};

module.exports = {
    verifyToken,
    getProfile,
};
