const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// In a real app we might want to ensure only authenticated users can call these
// For now we'll put verifyToken on them if it exists. We assume it's imported correctly.
// Also we would normally validate bodies

router.post('/payment-intent', verifyToken, paymentController.createPaymentIntent);
router.post('/refund', verifyToken, paymentController.refundPayment);

module.exports = router;
