const { supabase } = require('../config/supabase');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Get all pets for a user
 * GET /api/pets
 */
const getAllPets = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('pets')
            .select('*')
            .eq('userId', req.user.uid);

        if (error) throw error;

        return sendSuccess(res, data, 'Pets retrieved successfully');
    } catch (error) {
        console.error('Get pets error:', error);
        return sendError(res, 'Error retrieving pets', 500);
    }
};

/**
 * Get pet by ID
 * GET /api/pets/:id
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

        if (data.userId !== req.user.uid) {
            return sendError(res, 'Unauthorized', 403);
        }

        return sendSuccess(res, data, 'Pet retrieved successfully');
    } catch (error) {
        console.error('Get pet error:', error);
        return sendError(res, 'Error retrieving pet', 500);
    }
};

/**
 * Create new pet
 * POST /api/pets
 */
const createPet = async (req, res) => {
    try {
        const petData = {
            ...req.body,
            userId: req.user.uid,
            createdAt: new Date().toISOString(),
        };

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
 * Update pet
 * PUT /api/pets/:id
 */
const updatePet = async (req, res) => {
    try {
        const { id } = req.params;

        const { data: pet, error: fetchError } = await supabase
            .from('pets')
            .select('userId')
            .eq('id', id)
            .single();

        if (fetchError || !pet) {
            return sendError(res, 'Pet not found', 404);
        }

        if (pet.userId !== req.user.uid) {
            return sendError(res, 'Unauthorized', 403);
        }

        const { error } = await supabase
            .from('pets')
            .update({ ...req.body, updatedAt: new Date().toISOString() })
            .eq('id', id);

        if (error) throw error;

        return sendSuccess(res, null, 'Pet updated successfully');
    } catch (error) {
        console.error('Update pet error:', error);
        return sendError(res, 'Error updating pet', 500);
    }
};

/**
 * Delete pet
 * DELETE /api/pets/:id
 */
const deletePet = async (req, res) => {
    try {
        const { id } = req.params;

        const { data: pet, error: fetchError } = await supabase
            .from('pets')
            .select('userId')
            .eq('id', id)
            .single();

        if (fetchError || !pet) {
            return sendError(res, 'Pet not found', 404);
        }

        if (pet.userId !== req.user.uid) {
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
