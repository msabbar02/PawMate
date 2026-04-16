const { supabase } = require('../config/supabase');
const { sendError } = require('../utils/response');

/**
 * Middleware to verify Supabase JWT token
 */
const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return sendError(res, 'No token provided', 401);
        }

        const token = authHeader.split('Bearer ')[1];

        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return sendError(res, 'Invalid or expired token', 401);
        }

        req.user = {
            uid: user.id,
            email: user.email,
            emailVerified: user.email_confirmed_at != null,
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
        const { data, error } = await supabase
            .from('users')
            .select('role')
            .eq('id', req.user.uid)
            .single();

        if (error || !data || data.role !== 'admin') {
            return sendError(res, 'Access denied. Admin privileges required.', 403);
        }

        req.user.isAdmin = true;
        next();
    } catch (error) {
        console.error('Admin check error:', error);
        return sendError(res, 'Error checking admin privileges', 500);
    }
};

module.exports = {
    verifyToken,
    isAdmin,
};
