/**
 * Helpers para emitir respuestas JSON estandarizadas desde la API.
 * Todas las rutas devuelven `{ success, message, data?, error? }` para que
 * el cliente pueda parsearlas de forma uniforme.
 */

/**
 * Envía una respuesta de éxito.
 *
 * @param {import('express').Response} res        Respuesta de Express.
 * @param {*}                          [data]     Carga útil a devolver.
 * @param {string}                     [message]  Mensaje legible.
 * @param {number}                     [statusCode] Código HTTP (200 por defecto).
 */
const sendSuccess = (res, data = null, message = 'Success', statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data,
    });
};

/**
 * Envía una respuesta de error.
 * En modo desarrollo incluye el objeto de error original para depurar;
 * en producción se omite para no filtrar información sensible.
 *
 * @param {import('express').Response} res          Respuesta de Express.
 * @param {string}                     [message]    Mensaje legible.
 * @param {number}                     [statusCode] Código HTTP (500 por defecto).
 * @param {*}                          [error]      Detalles internos del error.
 */
const sendError = (res, message = 'Internal Server Error', statusCode = 500, error = null) => {
    const response = {
        success: false,
        message,
    };

    if (process.env.NODE_ENV === 'development' && error) {
        response.error = error;
    }

    return res.status(statusCode).json(response);
};

module.exports = {
    sendSuccess,
    sendError,
};
