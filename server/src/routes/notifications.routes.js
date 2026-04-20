const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth.middleware');
const { sendReservationStatusEmail } = require('../controllers/notifications.controller');
const { sendWelcomeEmail, handleAuthEmail } = require('../controllers/email.controller');

router.post('/reservation-status', verifyToken, sendReservationStatusEmail);
router.post('/welcome-email', verifyToken, sendWelcomeEmail);
router.post('/auth-email', handleAuthEmail); // uses its own webhook JWT verification

module.exports = router;
