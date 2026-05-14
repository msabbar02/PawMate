/**
 * Controlador de usuarios.
 *
 * Implementa los endpoints de listado paginado (solo admin), consulta por id
 * con visibilidad según el rol, actualización con whitelist de campos y
 * borrado seguro tanto en la tabla `users` como en Supabase Auth.
 */
const { supabase } = require('../config/supabase');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Email del superadministrador con privilegios totales.
 * Solo este usuario puede crear/borrar otros administradores y nadie
 * (ni siquiera él mismo) puede eliminarlo.
 */
const SUPERADMIN_EMAIL = (process.env.SUPERADMIN_EMAIL || 'adminpawmate@gmail.com').toLowerCase();

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

        // Carga el solicitante (rol y email) para validar reglas de superadmin.
        const { data: caller } = await supabase
            .from('users')
            .select('role, email')
            .eq('id', req.user.uid)
            .single();
        const callerEmail  = (caller?.email || '').toLowerCase();
        const isAdmin      = caller?.role === 'admin';
        const isSuperadmin = callerEmail === SUPERADMIN_EMAIL;

        if (!isSelf && !isAdmin) {
            return sendError(res, 'Forbidden', 403);
        }

        // Carga el objetivo para reglas de superadmin.
        const { data: target } = await supabase
            .from('users')
            .select('role, email')
            .eq('id', id)
            .single();
        const targetEmail = (target?.email || '').toLowerCase();

        // El superadmin no puede ser borrado por nadie (ni por sí mismo).
        if (targetEmail === SUPERADMIN_EMAIL) {
            return sendError(res, 'El superadministrador no puede ser eliminado', 403);
        }

        // Solo el superadmin puede borrar a otros administradores.
        if (target?.role === 'admin' && !isSuperadmin) {
            return sendError(res, 'Solo el superadministrador puede eliminar administradores', 403);
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

/**
 * POST /api/users/:id/password
 *
 * Cambia la contraseña de un usuario usando la service key del backend
 * (`supabase.auth.admin.updateUserById`). Reglas de autorización:
 *   - El propio usuario siempre puede cambiar su contraseña.
 *   - Un admin puede cambiar la contraseña de cualquier usuario normal.
 *   - Solo el superadministrador puede cambiar la contraseña de otro admin.
 *   - La contraseña del superadmin solo puede cambiarla él mismo.
 *
 * @param {import('express').Request}  req Parámetros: `{ id }`. Cuerpo: `{ password }`.
 * @param {import('express').Response} res Resultado del cambio.
 */
const setUserPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { password } = req.body || {};
        if (!password || String(password).length < 6) {
            return sendError(res, 'La contraseña debe tener al menos 6 caracteres', 400);
        }

        const isSelf = req.user.uid === id;

        const { data: caller } = await supabase
            .from('users')
            .select('role, email')
            .eq('id', req.user.uid)
            .single();
        const callerEmail  = (caller?.email || '').toLowerCase();
        const isAdmin      = caller?.role === 'admin';
        const isSuperadmin = callerEmail === SUPERADMIN_EMAIL;

        if (!isSelf && !isAdmin) {
            return sendError(res, 'Forbidden', 403);
        }

        const { data: target } = await supabase
            .from('users')
            .select('role, email')
            .eq('id', id)
            .single();
        const targetEmail = (target?.email || '').toLowerCase();

        // La contraseña del superadmin solo puede cambiarla él mismo.
        if (targetEmail === SUPERADMIN_EMAIL && !isSelf) {
            return sendError(res, 'Solo el superadministrador puede cambiar su propia contraseña', 403);
        }

        // Solo el superadmin puede cambiar contraseñas de otros admins.
        if (target?.role === 'admin' && !isSelf && !isSuperadmin) {
            return sendError(res, 'Solo el superadministrador puede cambiar la contraseña de otros admins', 403);
        }

        const { error: authError } = await supabase.auth.admin.updateUserById(id, { password });
        if (authError) {
            console.error('setUserPassword auth.admin.updateUserById error:', authError);
            return sendError(res, authError.message || 'No se pudo cambiar la contraseña', 500);
        }

        return sendSuccess(res, null, 'Contraseña actualizada correctamente');
    } catch (error) {
        console.error('setUserPassword error:', error);
        return sendError(res, 'Error cambiando la contraseña', 500);
    }
};

/**
 * POST /api/users/create-admin
 *
 * Crea una nueva cuenta de administrador. Solo el superadministrador
 * (`adminpawmate@gmail.com`) puede invocarlo. Usa la service key del
 * backend para crear el usuario en Supabase Auth con email ya confirmado,
 * evitando así disparar el Auth Hook de envío de correo de verificación
 * (causa del error "Hook requires authorization token" cuando se intentaba
 * crear el admin desde el cliente con `supabase.auth.signUp`).
 *
 * @param {import('express').Request}  req Cuerpo: `{ email, password, fullName }`.
 * @param {import('express').Response} res Datos del admin creado.
 */
const createAdmin = async (req, res) => {
    try {
        const { email, password, fullName } = req.body || {};
        if (!email || !password || !fullName) {
            return sendError(res, 'Faltan campos requeridos', 400);
        }
        if (String(password).length < 6) {
            return sendError(res, 'La contraseña debe tener al menos 6 caracteres', 400);
        }

        // Solo el superadmin puede crear nuevos administradores.
        const { data: caller } = await supabase
            .from('users')
            .select('email')
            .eq('id', req.user.uid)
            .single();
        const callerEmail = (caller?.email || '').toLowerCase();
        if (callerEmail !== SUPERADMIN_EMAIL) {
            return sendError(res, 'Solo el superadministrador puede crear nuevos admins', 403);
        }

        const cleanEmail    = String(email).trim().toLowerCase();
        const cleanFullName = String(fullName).trim();

        // Crea la cuenta en Auth con email confirmado para no disparar el Auth Hook.
        const { data: created, error: authError } = await supabase.auth.admin.createUser({
            email: cleanEmail,
            password,
            email_confirm: true,
            user_metadata: { full_name: cleanFullName, role: 'admin' },
        });
        if (authError) {
            console.error('createAdmin auth.admin.createUser error:', authError);
            return sendError(res, authError.message || 'No se pudo crear el usuario en Auth', 500);
        }

        const newId = created?.user?.id;
        if (!newId) {
            return sendError(res, 'Auth no devolvió un id de usuario', 500);
        }

        // Upsert en la tabla pública con rol admin.
        const { error: upsertError } = await supabase.from('users').upsert({
            id: newId,
            email: cleanEmail,
            fullName: cleanFullName,
            firstName: cleanFullName.split(' ')[0] || '',
            lastName:  cleanFullName.split(' ').slice(1).join(' ') || '',
            role: 'admin',
        });
        if (upsertError) {
            console.error('createAdmin users upsert error:', upsertError);
            return sendError(res, 'Usuario creado en Auth pero falló el upsert en users: ' + upsertError.message, 500);
        }

        return sendSuccess(res, { id: newId, email: cleanEmail, fullName: cleanFullName }, 'Admin creado correctamente');
    } catch (error) {
        console.error('createAdmin error:', error);
        return sendError(res, 'Error creando administrador', 500);
    }
};

module.exports = {
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
    createAdmin,
    setUserPassword,
};
