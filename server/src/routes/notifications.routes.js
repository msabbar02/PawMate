const express = require('express');
const router = express.Router();
const { sendReservationStatusEmail } = require('../controllers/notifications.controller');
const { sendWelcomeEmail, handleAuthEmail } = require('../controllers/email.controller');

router.post('/reservation-status', sendReservationStatusEmail);
router.post('/welcome-email', sendWelcomeEmail);
router.post('/auth-email', handleAuthEmail);

module.exports = router;
