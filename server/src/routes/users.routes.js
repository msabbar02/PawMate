/**
 * Rutas de usuarios (todas requieren autenticación).
 *
 * - GET    /        Lista paginada (solo admin).
 * - GET    /:id     Obtiene un usuario (visibilidad según rol).
 * - PUT    /:id     Actualiza el perfil (propio o admin).
 * - DELETE /:id     Borra una cuenta (propio o admin; el controlador valida).
 */
const express = require('express');
const router = express.Router();
const { getAllUsers, getUserById, updateUser, deleteUser, createAdmin, setUserPassword } = require('../controllers/users.controller');
const { verifyToken, isAdmin } = require('../middleware/auth.middleware');

router.use(verifyToken);

router.get('/', isAdmin, getAllUsers);
router.post('/create-admin', isAdmin, createAdmin); // Solo el superadmin (validado en el controlador) puede crear admins.
router.post('/:id/password', setUserPassword);      // El controlador valida self-vs-admin-vs-superadmin.
router.get('/:id', getUserById);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

module.exports = router;
