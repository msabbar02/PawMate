const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth.routes');
const usersRoutes = require('./users.routes');
const petsRoutes = require('./pets.routes');
const notificationsRoutes = require('./notifications.routes');
const paymentRoutes = require('./payment.routes');


// Mount routes
router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/pets', petsRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/payments', paymentRoutes);


// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'PawMate API is running',
        timestamp: new Date().toISOString(),
    });
});

module.exports = router;
