const express = require('express');
const router = express.Router();
const { getAllPets, getPetById, createPet, updatePet, deletePet } = require('../controllers/pets.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// All routes require authentication
router.use(verifyToken);

// Get all pets for authenticated user
router.get('/', getAllPets);

// Create new pet
router.post('/', createPet);

// Get pet by ID
router.get('/:id', getPetById);

// Update pet
router.put('/:id', updatePet);

// Delete pet
router.delete('/:id', deletePet);

module.exports = router;
