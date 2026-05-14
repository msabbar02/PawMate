/**
 * Rutas CRUD de mascotas (todas requieren autenticación).
 *
 * - GET    /        Lista las mascotas del usuario.
 * - POST   /        Crea una mascota.
 * - GET    /:id     Obtiene una mascota por id.
 * - PUT    /:id     Actualiza una mascota.
 * - DELETE /:id     Elimina una mascota.
 */
const express = require('express');
const router = express.Router();
const { getAllPets, getPetById, createPet, updatePet, deletePet } = require('../controllers/pets.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.use(verifyToken);

router.get('/', getAllPets);
router.post('/', createPet);
router.get('/:id', getPetById);
router.put('/:id', updatePet);
router.delete('/:id', deletePet);

module.exports = router;
