const { sendError } = require('../utils/response');

/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    let statusCode = err.statusCode || 500;
    let message = (process.env.NODE_ENV === 'production' && statusCode === 500)
        ? 'Internal Server Error'
        : (err.message || 'Internal Server Error');

    // Supabase error codes
    if (err.code) {
        switch (err.code) {
            case 'PGRST116':
                statusCode = 404;
                message = 'Resource not found';
                break;
            case '23505':
                statusCode = 409;
                message = 'Duplicate entry';
                break;
            case '23503':
                statusCode = 400;
                message = 'Referenced resource not found';
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
