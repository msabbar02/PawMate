const express = require('express');
const router = express.Router();
const { sendReservationStatusEmail } = require('../controllers/notifications.controller');

router.post('/reservation-status', sendReservationStatusEmail);

module.exports = router;
