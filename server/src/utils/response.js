/**
 * Standardized API response helper
 */

/**
 * Send success response
 * @param {Object} res - Express response object
 * @param {*} data - Response data
 * @param {String} message - Success message
 * @param {Number} statusCode - HTTP status code (default: 200)
 */
const sendSuccess = (res, data = null, message = 'Success', statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data,
    });
};

/**
 * Send error response
 * @param {Object} res - Express response object
 * @param {String} message - Error message
 * @param {Number} statusCode - HTTP status code (default: 500)
 * @param {*} error - Error details (optional)
 */
const sendError = (res, message = 'Internal Server Error', statusCode = 500, error = null) => {
    const response = {
        success: false,
        message,
    };

    // Include error details in development mode
    if (process.env.NODE_ENV === 'development' && error) {
        response.error = error;
    }

    return res.status(statusCode).json(response);
};

module.exports = {
    sendSuccess,
    sendError,
};
