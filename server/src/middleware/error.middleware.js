/**
 * Manejadores globales de errores y de rutas no encontradas.
 */
const { sendError } = require('../utils/response');

/**
 * Manejador global de errores de Express.
 * Traduce códigos típicos de PostgreSQL/Supabase a códigos HTTP coherentes
 * y oculta detalles internos en producción.
 *
 * @param {Error}                      err  Error capturado por Express.
 * @param {import('express').Request}  req  Petición entrante.
 * @param {import('express').Response} res  Respuesta saliente.
 * @param {Function}                   next No usado, requerido por Express para detectar middleware de error.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    const isProd = process.env.NODE_ENV === 'production';
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';

    // Mapeo de códigos PostgREST/PostgreSQL más habituales.
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
                // Mantener `message` actual; se sanea más abajo en producción.
                break;
        }
    }

    // En producción no exponemos mensajes internos: solo textos genéricos por familia.
    if (isProd) {
        if (statusCode >= 500) message = 'Internal Server Error';
        else if (statusCode === 400) message = message || 'Bad Request';
        else if (statusCode === 401) message = 'Unauthorized';
        else if (statusCode === 403) message = 'Forbidden';
        else if (statusCode === 404) message = 'Resource not found';
        else if (statusCode === 409) message = 'Conflict';
    }

    return sendError(res, message, statusCode, isProd ? null : err);
};

/**
 * Manejador de rutas no encontradas (404).
 *
 * @param {import('express').Request}  req Petición entrante.
 * @param {import('express').Response} res Respuesta saliente.
 */
const notFoundHandler = (req, res) => {
    return sendError(res, `Route ${req.originalUrl} not found`, 404);
};

module.exports = {
    errorHandler,
    notFoundHandler,
};
