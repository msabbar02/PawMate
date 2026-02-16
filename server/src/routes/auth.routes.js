const express = require('express');
const router = express.Router();
const { verifyToken, getProfile } = require('../controllers/auth.controller');
const { verifyToken: authMiddleware } = require('../middleware/auth.middleware');

// Public routes
router.post('/verify-token', verifyToken);

// Protected routes
router.get('/profile', authMiddleware, getProfile);

module.exports = router;
