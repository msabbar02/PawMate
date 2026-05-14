/**
 * Controlador de autenticación: verificación de token y obtención del perfil propio.
 *
 * Limpia siempre los campos sensibles (URLs de documentos KYC, tokens push)
 * antes de devolver datos del usuario al cliente.
 */
const { supabase } = require('../config/supabase');
const { sendSuccess, sendError } = require('../utils/response');

/** Campos que nunca deben enviarse al cliente. */
const SENSITIVE_FIELDS = [
    'idFrontUrl', 'idBackUrl', 'selfieUrl', 'certDocUrl',
    'fcmToken', 'expoPushToken',
];

/**
 * Devuelve una copia del usuario sin los campos sensibles.
 *
 * @param {Object|null} user Registro de usuario tal y como viene de Supabase.
 * @returns {Object|null}    Mismo objeto sin URLs de documentos ni tokens push.
 */
function stripSensitive(user) {
    if (!user) return user;
    const clean = { ...user };
    for (const field of SENSITIVE_FIELDS) delete clean[field];
    return clean;
}

/**
 * POST /api/auth/verify-token
 *
 * Comprueba que el JWT recibido en el cuerpo es válido para Supabase Auth.
 * Útil para validar el token desde clientes que no usan el middleware estándar.
 *
 * @param {import('express').Request}  req Petición con `{ token }` en el cuerpo.
 * @param {import('express').Response} res Respuesta JSON estándar.
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
 * GET /api/auth/profile
 *
 * Devuelve el perfil del usuario autenticado, sin campos sensibles.
 *
 * @param {import('express').Request}  req Petición autenticada (`req.user` poblado).
 * @param {import('express').Response} res Respuesta JSON estándar.
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

        return sendSuccess(res, { uid: req.user.uid, ...stripSensitive(data) }, 'Profile retrieved successfully');
    } catch (error) {
        console.error('Get profile error:', error);
        return sendError(res, 'Error retrieving profile', 500);
    }
};

module.exports = {
    verifyToken,
    getProfile,
};
