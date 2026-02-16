const { sendError } = require('../utils/response');

/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Default error
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';

    // Firebase specific errors
    if (err.code) {
        switch (err.code) {
            case 'auth/id-token-expired':
                statusCode = 401;
                message = 'Token expired';
                break;
            case 'auth/invalid-id-token':
                statusCode = 401;
                message = 'Invalid token';
                break;
            case 'auth/user-not-found':
                statusCode = 404;
                message = 'User not found';
                break;
            default:
                message = err.message;
        }
    }

    return sendError(res, message, statusCode, process.env.NODE_ENV === 'development' ? err : null);
};

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res) => {
    return sendError(res, `Route ${req.originalUrl} not found`, 404);
};

module.exports = {
    errorHandler,
    notFoundHandler,
};
