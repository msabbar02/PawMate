/**
 * Rutas de autenticación.
 *
 * - POST /verify-token   Verifica un JWT (público).
 * - GET  /profile        Devuelve el perfil del usuario autenticado.
 */
const express = require('express');
const router = express.Router();
const { verifyToken, getProfile } = require('../controllers/auth.controller');
const { verifyToken: authMiddleware } = require('../middleware/auth.middleware');

router.post('/verify-token', verifyToken);
router.get('/profile', authMiddleware, getProfile);

module.exports = router;
