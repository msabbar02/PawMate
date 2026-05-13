const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth.middleware');
const { sendReservationStatusEmail, sendRatingRequestEmail } = require('../controllers/notifications.controller');
const { sendWelcomeEmail, handleAuthEmail, sendBanEmail } = require('../controllers/email.controller');

router.post('/reservation-status', verifyToken, sendReservationStatusEmail);
router.post('/welcome-email', verifyToken, sendWelcomeEmail);
router.post('/auth-email', handleAuthEmail); // uses its own webhook JWT verification
router.post('/ban-email', verifyToken, sendBanEmail);
router.post('/rating-request', verifyToken, sendRatingRequestEmail);

module.exports = router;
