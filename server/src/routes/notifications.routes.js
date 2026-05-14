/**
 * Rutas de notificaciones por email.
 *
 * - POST /reservation-status  Email al dueño/cuidador según estado de reserva.
 * - POST /welcome-email       Email de bienvenida tras registro.
 * - POST /auth-email          Webhook de Supabase Auth (verifica firma JWT).
 * - POST /ban-email           Notifica al usuario de la suspensión de cuenta.
 * - POST /rating-request      Pide al dueño que valore al cuidador al finalizar.
 */
const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth.middleware');
const { sendReservationStatusEmail, sendRatingRequestEmail } = require('../controllers/notifications.controller');
const { sendWelcomeEmail, handleAuthEmail, sendBanEmail } = require('../controllers/email.controller');

router.post('/reservation-status', verifyToken, sendReservationStatusEmail);
router.post('/welcome-email', verifyToken, sendWelcomeEmail);
router.post('/auth-email', handleAuthEmail); // Usa su propia verificación JWT de webhook.
router.post('/ban-email', verifyToken, sendBanEmail);
router.post('/rating-request', verifyToken, sendRatingRequestEmail);

module.exports = router;