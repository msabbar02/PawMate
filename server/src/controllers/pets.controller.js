const { db } = require('../config/firebase');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Get all pets for a user
 * GET /api/pets
 */
const getAllPets = async (req, res) => {
    try {
        const petsSnapshot = await db.collection('pets')
            .where('userId', '==', req.user.uid)
            .get();

        const pets = [];
        petsSnapshot.forEach(doc => {
            pets.push({ id: doc.id, ...doc.data() });
        });

        return sendSuccess(res, pets, 'Pets retrieved successfully');
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
        const petDoc = await db.collection('pets').doc(id).get();

        if (!petDoc.exists) {
            return sendError(res, 'Pet not found', 404);
        }

        const petData = petDoc.data();

        // Check if user owns this pet
        if (petData.userId !== req.user.uid) {
            return sendError(res, 'Unauthorized', 403);
        }

        return sendSuccess(res, { id: petDoc.id, ...petData }, 'Pet retrieved successfully');
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

        const petRef = await db.collection('pets').add(petData);
        return sendSuccess(res, { id: petRef.id, ...petData }, 'Pet created successfully', 201);
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
        const petDoc = await db.collection('pets').doc(id).get();

        if (!petDoc.exists) {
            return sendError(res, 'Pet not found', 404);
        }

        // Check if user owns this pet
        if (petDoc.data().userId !== req.user.uid) {
            return sendError(res, 'Unauthorized', 403);
        }

        await db.collection('pets').doc(id).update({
            ...req.body,
            updatedAt: new Date().toISOString(),
        });

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
        const petDoc = await db.collection('pets').doc(id).get();

        if (!petDoc.exists) {
            return sendError(res, 'Pet not found', 404);
        }

        // Check if user owns this pet
        if (petDoc.data().userId !== req.user.uid) {
            return sendError(res, 'Unauthorized', 403);
        }

        await db.collection('pets').doc(id).delete();
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
