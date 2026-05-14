/**
 * Controlador CRUD de mascotas.
 *
 * Todas las operaciones están autenticadas y cada usuario solo puede leer
 * y modificar sus propias mascotas. Se valida la propiedad antes de cada
 * lectura/actualización/borrado y se filtran los campos permitidos en el
 * cuerpo para evitar inyección de columnas arbitrarias.
 */
const { supabase } = require('../config/supabase');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * GET /api/pets
 *
 * Devuelve todas las mascotas del usuario autenticado.
 *
 * @param {import('express').Request}  req Petición autenticada.
 * @param {import('express').Response} res Lista de mascotas.
 */
const getAllPets = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('pets')
            .select('*')
            .eq('ownerId', req.user.uid);

        if (error) throw error;

        return sendSuccess(res, data, 'Pets retrieved successfully');
    } catch (error) {
        console.error('Get pets error:', error);
        return sendError(res, 'Error retrieving pets', 500);
    }
};

/**
 * GET /api/pets/:id
 *
 * Devuelve una mascota por id, comprobando que pertenece al usuario.
 *
 * @param {import('express').Request}  req Parámetros: `{ id }`.
 * @param {import('express').Response} res Datos de la mascota.
 */
const getPetById = async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase
            .from('pets')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) {
            return sendError(res, 'Pet not found', 404);
        }

        if (data.ownerId !== req.user.uid) {
            return sendError(res, 'Unauthorized', 403);
        }

        return sendSuccess(res, data, 'Pet retrieved successfully');
    } catch (error) {
        console.error('Get pet error:', error);
        return sendError(res, 'Error retrieving pet', 500);
    }
};

/**
 * Lista blanca de campos editables/insertables en la tabla `pets`.
 * Cualquier campo fuera de esta lista se ignora silenciosamente.
 */
const ALLOWED_PET_FIELDS = [
    'name', 'species', 'breed', 'birthDate', 'birthdate', 'weight', 'gender', 'sex',
    'color', 'photoURL', 'image', 'description', 'microchip', 'vaccinated',
    'neutered', 'medicalNotes', 'allergies', 'medications',
];

/**
 * POST /api/pets
 *
 * Crea una nueva mascota asociada al usuario autenticado.
 *
 * @param {import('express').Request}  req Cuerpo con campos de la mascota (filtrados por whitelist).
 * @param {import('express').Response} res Mascota creada.
 */
const createPet = async (req, res) => {
    try {
        const petData = { ownerId: req.user.uid };
        for (const key of ALLOWED_PET_FIELDS) {
            if (req.body[key] !== undefined) petData[key] = req.body[key];
        }

        const { data, error } = await supabase
            .from('pets')
            .insert(petData)
            .select()
            .single();

        if (error) throw error;

        return sendSuccess(res, data, 'Pet created successfully', 201);
    } catch (error) {
        console.error('Create pet error:', error);
        return sendError(res, 'Error creating pet', 500);
    }
};

/**
 * PUT /api/pets/:id
 *
 * Actualiza una mascota tras verificar que es del usuario. Si no se envía
 * ningún campo válido devuelve 400.
 *
 * @param {import('express').Request}  req Parámetros: `{ id }`. Cuerpo: campos a actualizar.
 * @param {import('express').Response} res Resultado de la actualización.
 */
const updatePet = async (req, res) => {
    try {
        const { id } = req.params;

        const { data: pet, error: fetchError } = await supabase
            .from('pets')
            .select('ownerId')
            .eq('id', id)
            .single();

        if (fetchError || !pet) {
            return sendError(res, 'Pet not found', 404);
        }

        if (pet.ownerId !== req.user.uid) {
            return sendError(res, 'Unauthorized', 403);
        }

        const updates = {};
        for (const key of ALLOWED_PET_FIELDS) {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        }
        if (Object.keys(updates).length === 0) {
            return sendError(res, 'No valid fields to update', 400);
        }

        const { error } = await supabase
            .from('pets')
            .update(updates)
            .eq('id', id);

        if (error) throw error;

        return sendSuccess(res, null, 'Pet updated successfully');
    } catch (error) {
        console.error('Update pet error:', error);
        return sendError(res, 'Error updating pet', 500);
    }
};

/**
 * DELETE /api/pets/:id
 *
 * Elimina una mascota tras verificar que pertenece al usuario.
 *
 * @param {import('express').Request}  req Parámetros: `{ id }`.
 * @param {import('express').Response} res Resultado del borrado.
 */
const deletePet = async (req, res) => {
    try {
        const { id } = req.params;

        const { data: pet, error: fetchError } = await supabase
            .from('pets')
            .select('ownerId')
            .eq('id', id)
            .single();

        if (fetchError || !pet) {
            return sendError(res, 'Pet not found', 404);
        }

        if (pet.ownerId !== req.user.uid) {
            return sendError(res, 'Unauthorized', 403);
        }

        const { error } = await supabase
            .from('pets')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return sendSuccess(res, null, 'Pet deleted successfully');
    } catch (error) {
        console.error('Delete pet error:', error);
        return sendError(res, 'Error deleting pet', 500);
    }
};

module.exports = {
    getAllPets,
    getPetById,
    createPet,
    updatePet,
    deletePet,
};
