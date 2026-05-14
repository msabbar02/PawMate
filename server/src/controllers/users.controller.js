/**
 * Controlador de usuarios.
 *
 * Implementa los endpoints de listado paginado (solo admin), consulta por id
 * con visibilidad según el rol, actualización con whitelist de campos y
 * borrado seguro tanto en la tabla `users` como en Supabase Auth.
 */
const { supabase } = require('../config/supabase');
const { sendSuccess, sendError } = require('../utils/response');

/** Campos seguros para exponer de cualquier usuario (perfil público). */
const PUBLIC_USER_FIELDS = [
    'id', 'fullName', 'firstName', 'lastName', 'bio', 'city', 'province', 'country',
    'avatar', 'photoURL', 'role', 'isVerified', 'rating', 'reviewCount',
    'serviceTypes', 'acceptedSpecies', 'price', 'serviceRadius',
    'latitude', 'longitude', 'isOnline', 'galleryPhotos',
    'maxConcurrentWalks', 'maxConcurrentHotel', 'createdAt', 'created_at',
].join(',');

/** Campos sensibles que nunca deben salir del servidor para otro usuario. */
const PRIVATE_FIELDS = new Set([
    'idFrontUrl', 'idBackUrl', 'selfieUrl', 'certDocUrl',
    'fcmToken', 'expoPushToken', 'phone', 'birthDate', 'gender',
    'preferences', 'address', 'verificationStatus', 'verificationRequestedAt',
    'pendingRole', 'is_banned',
]);

/**
 * GET /api/users?limit=50&offset=0&role=caregiver
 *
 * Devuelve todos los usuarios con paginación y filtros opcionales por rol
 * y búsqueda parcial por nombre. Solo accesible por administradores.
 *
 * @param {import('express').Request}  req Query: `{ limit, offset, role, search }`.
 * @param {import('express').Response} res `{ users, total, limit, offset }`.
 */
const getAllUsers = async (req, res) => {
    try {
        const limit  = Math.min(parseInt(req.query.limit  || '50',  10), 200);
        const offset = Math.max(parseInt(req.query.offset || '0',   10), 0);
        const { role, search } = req.query;

        let query = supabase
            .from('users')
            .select('*', { count: 'exact' })
            .range(offset, offset + limit - 1)
            .order('created_at', { ascending: false });

        if (role)   query = query.eq('role', role);
        if (search) query = query.ilike('fullName', `%${search}%`);

        const { data, error, count } = await query;
        if (error) throw error;

        return sendSuccess(res, { users: data, total: count, limit, offset }, 'Users retrieved successfully');
    } catch (error) {
        console.error('Get all users error:', error);
        return sendError(res, 'Error retrieving users', 500);
    }
};

/**
 * GET /api/users/:id
 *
 * Devuelve los datos de un usuario aplicando reglas de visibilidad según
 * el solicitante:
 *   - Admin    → todos los campos.
 *   - Propio   → todos los campos excepto URLs de documentos KYC.
 *   - Tercero  → solo los campos públicos del perfil.
 *
 * @param {import('express').Request}  req Parámetros: `{ id }`.
 * @param {import('express').Response} res Datos del usuario filtrados por rol.
 */
const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const isSelf  = req.user.uid === id;
        const isAdmin = req.user.isAdmin;

        const selectFields = (isSelf || isAdmin) ? '*' : PUBLIC_USER_FIELDS;

        const { data, error } = await supabase
            .from('users')
            .select(selectFields)
            .eq('id', id)
            .single();

        if (error || !data) {
            return sendError(res, 'User not found', 404);
        }

        // Incluso en el perfil propio, elimina las URLs de documentos de verificación (solo admin).
        if (!isAdmin) {
            for (const field of PRIVATE_FIELDS) {
                if (!isSelf) delete data[field]; // Otro usuario: elimina todos los privados.
                else if (['idFrontUrl', 'idBackUrl', 'selfieUrl', 'certDocUrl'].includes(field)) {
                    delete data[field]; // Propio: solo elimina URLs de documentos.
                }
            }
        }

        return sendSuccess(res, data, 'User retrieved successfully');
    } catch (error) {
        console.error('Get user error:', error);
        return sendError(res, 'Error retrieving user', 500);
    }
};

/**
 * Whitelist de campos editables por el propio usuario.
 * Los administradores pueden además tocar `ADMIN_ONLY_FIELDS`.
 */
const ALLOWED_USER_FIELDS = [
    'fullName', 'firstName', 'lastName', 'phone', 'bio', 'city', 'province', 'country',
    'avatar', 'photoURL', 'birthDate', 'gender', 'latitude', 'longitude',
    'isOnline', 'lastSeen', 'isWalking', 'walkingPets', 'fcmToken', 'expoPushToken',
    'language', 'preferences', 'address', 'saveWalks', 'saveLocation',
    'totalWalks', 'totalDistance', 'totalMinutes',
    // Campos específicos del rol cuidador.
    'price', 'serviceTypes', 'acceptedSpecies', 'serviceRadius',
    'maxConcurrentWalks', 'maxConcurrentHotel', 'galleryPhotos',
];

/** Campos que solo un administrador puede modificar. */
const ADMIN_ONLY_FIELDS = ['role', 'is_banned', 'verificationStatus', 'isVerified', 'pendingRole'];

/**
 * PUT /api/users/:id
 *
 * Actualiza el perfil del usuario. Solo el propio usuario o un admin
 * pueden modificarlo; el resto de campos enviados en el cuerpo se ignoran.
 *
 * @param {import('express').Request}  req Parámetros: `{ id }`. Cuerpo: campos a actualizar.
 * @param {import('express').Response} res Resultado de la actualización.
 */
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;

        if (req.user.uid !== id && !req.user.isAdmin) {
            return sendError(res, 'Unauthorized', 403);
        }

        const allowedKeys = req.user.isAdmin
            ? [...ALLOWED_USER_FIELDS, ...ADMIN_ONLY_FIELDS]
            : ALLOWED_USER_FIELDS;
        const updates = {};
        for (const key of allowedKeys) {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        }
        if (Object.keys(updates).length === 0) {
            return sendError(res, 'No valid fields to update', 400);
        }

        const { error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', id);

        if (error) throw error;

        return sendSuccess(res, null, 'User updated successfully');
    } catch (error) {
        console.error('Update user error:', error);
        return sendError(res, 'Error updating user', 500);
    }
};

/**
 * DELETE /api/users/:id
 *
 * Borra una cuenta. Cualquier usuario puede borrar la suya propia y los
 * administradores pueden borrar cualquier cuenta. Borra primero la fila en
 * `users` y a continuación en Supabase Auth (si la limpieza de auth falla
 * la cuenta queda huérfana en Auth pero el usuario ya no podrá acceder).
 *
 * @param {import('express').Request}  req Parámetros: `{ id }`.
 * @param {import('express').Response} res Resultado del borrado.
 */
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const isSelf = req.user.uid === id;

        // Si no es auto-borrado, comprueba inline que el usuario es admin.
        let isAdmin = false;
        if (!isSelf) {
            const { data: caller } = await supabase
                .from('users')
                .select('role')
                .eq('id', req.user.uid)
                .single();
            isAdmin = caller?.role === 'admin';
        }

        if (!isSelf && !isAdmin) {
            return sendError(res, 'Forbidden', 403);
        }

        // Borra primero de Supabase Auth: el ON DELETE CASCADE limpiará la fila en
        // public.users automáticamente, evitando dejar cuentas zombie en Auth.
        const { error: authError } = await supabase.auth.admin.deleteUser(id);
        if (authError && authError.status !== 404) {
            console.error('Auth user delete error:', authError);
            return sendError(res, 'Error deleting account', 500);
        }

        // Como red de seguridad, intenta borrar la fila en `users` por si el cascade no la limpió.
        const { error: dbError } = await supabase
            .from('users')
            .delete()
            .eq('id', id);
        if (dbError && dbError.code !== 'PGRST116') {
            console.error('Users row delete (post-auth) error:', dbError);
        }

        return sendSuccess(res, null, 'Account deleted successfully');
    } catch (error) {
        console.error('Delete user error:', error);
        return sendError(res, 'Error deleting account', 500);
    }
};

module.exports = {
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
};
