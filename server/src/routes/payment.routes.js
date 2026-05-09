const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// Stripe webhook — must use raw body (set in index.js before express.json)
// No auth middleware: Stripe calls this, not the app user
router.post('/webhook', paymentController.handleStripeWebhook);

// Protected payment routes
router.post('/payment-intent', verifyToken, paymentController.createPaymentIntent);
router.post('/refund', verifyToken, paymentController.refundPayment);

module.exports = router;
