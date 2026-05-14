/**
 * Router raíz de la API. Compone los sub-routers por dominio y expone el
 * endpoint público de health check usado por monitorización y por el
 * limitador de tasa para excluirlo del límite.
 */
const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const usersRoutes = require('./users.routes');
const petsRoutes = require('./pets.routes');
const notificationsRoutes = require('./notifications.routes');
const paymentRoutes = require('./payment.routes');

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/pets', petsRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/payments', paymentRoutes);

/**
 * GET /api/health
 *
 * Endpoint público de comprobación de vida del servicio.
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'PawMate API is running',
        timestamp: new Date().toISOString(),
    });
});

module.exports = router;
