const { auth } = require('../config/firebase');
const { sendError } = require('../utils/response');

/**
 * Middleware to verify Firebase authentication token
 */
const verifyToken = async (req, res, next) => {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return sendError(res, 'No token provided', 401);
        }

        const token = authHeader.split('Bearer ')[1];

        // Verify token with Firebase
        const decodedToken = await auth.verifyIdToken(token);

        // Attach user info to request
        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            emailVerified: decodedToken.email_verified,
        };

        next();
    } catch (error) {
        console.error('Token verification error:', error);
        return sendError(res, 'Invalid or expired token', 401);
    }
};

/**
 * Middleware to check if user is admin
 */
const isAdmin = async (req, res, next) => {
    try {
        // Check if user has admin custom claim
        const user = await auth.getUser(req.user.uid);

        if (user.customClaims && user.customClaims.admin === true) {
            next();
        } else {
            return sendError(res, 'Access denied. Admin privileges required.', 403);
        }
    } catch (error) {
        console.error('Admin check error:', error);
        return sendError(res, 'Error checking admin privileges', 500);
    }
};

module.exports = {
    verifyToken,
    isAdmin,
};
