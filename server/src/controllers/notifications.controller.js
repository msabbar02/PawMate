const { db } = require('../config/firebase');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Notificar al dueño por email cuando el cuidador acepta o rechaza la reserva.
 * POST /api/notifications/reservation-status
 * Body: { reservationId }
 * La reserva ya debe estar actualizada en Firestore (status: 'accepted' | 'rejected').
 */
const sendReservationStatusEmail = async (req, res) => {
    try {
        const { reservationId } = req.body;
        if (!reservationId) {
            return sendError(res, 'reservationId is required', 400);
        }

        const resDoc = await db.collection('reservations').doc(reservationId).get();
        if (!resDoc.exists) {
            return sendError(res, 'Reservation not found', 404);
        }

        const data = resDoc.data();
        const ownerEmail = data.ownerEmail || data.ownerId; // ownerId no es email; si no hay ownerEmail no podemos enviar
        const status = data.status;
        const caregiverName = data.caregiverName || 'El cuidador';
        const petName = data.petName || 'tu mascota';
        const ownerName = data.ownerName || 'Cliente';

        if (!ownerEmail || !ownerEmail.includes('@')) {
            return sendSuccess(res, { sent: false, reason: 'No owner email' }, 'Reservation updated; email not sent (no address)');
        }

        // Intentar enviar email si está configurado nodemailer
        let sent = false;
        try {
            const nodemailer = require('nodemailer');
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST || 'smtp.gmail.com',
                port: parseInt(process.env.SMTP_PORT || '587', 10),
                secure: process.env.SMTP_SECURE === 'true',
                auth: process.env.SMTP_USER ? {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                } : undefined,
            });

            const subject = status === 'accepted'
                ? `PawMate: ${caregiverName} ha aceptado tu reserva`
                : `PawMate: ${caregiverName} ha rechazado tu reserva`;

            const text = status === 'accepted'
                ? `Hola ${ownerName},\n\n${caregiverName} ha aceptado tu solicitud de reserva para ${petName}. Ya puedes coordinar el servicio.\n\nGracias por usar PawMate.`
                : `Hola ${ownerName},\n\n${caregiverName} no ha podido aceptar tu solicitud de reserva para ${petName}. Puedes buscar otro cuidador en la app.\n\nGracias por usar PawMate.`;

            await transporter.sendMail({
                from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@pawmate.com',
                to: ownerEmail,
                subject,
                text,
            });
            sent = true;
        } catch (emailErr) {
            console.error('Email send error:', emailErr.message);
        }

        return sendSuccess(res, { sent }, sent ? 'Email sent to owner' : 'Reservation updated; email not sent (check SMTP config)');
    } catch (error) {
        console.error('sendReservationStatusEmail error:', error);
        return sendError(res, 'Error sending notification', 500);
    }
};

module.exports = {
    sendReservationStatusEmail,
};
