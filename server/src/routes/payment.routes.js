/**
 * Rutas de pago (Stripe).
 *
 * - POST /webhook         Webhook de Stripe (sin auth, cuerpo raw).
 * - POST /payment-intent  Crea un PaymentIntent (autenticada).
 * - POST /refund          Solicita un reembolso (autenticada).
 */
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// Stripe llama a este endpoint, no el usuario; el cuerpo raw se configura en index.js.
router.post('/webhook', paymentController.handleStripeWebhook);

router.post('/payment-intent', verifyToken, paymentController.createPaymentIntent);
router.post('/refund', verifyToken, paymentController.refundPayment);

module.exports = router;
