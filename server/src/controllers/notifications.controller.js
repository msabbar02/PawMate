const { supabase } = require('../config/supabase');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Notificar al dueño por email cuando el cuidador acepta o rechaza la reserva.
 * POST /api/notifications/reservation-status
 * Body: { reservationId }
 */
const sendReservationStatusEmail = async (req, res) => {
    try {
        const { reservationId } = req.body;
        if (!reservationId) {
            return sendError(res, 'reservationId is required', 400);
        }

        const { data, error } = await supabase
            .from('reservations')
            .select('*')
            .eq('id', reservationId)
            .single();

        if (error || !data) {
            return sendError(res, 'Reservation not found', 404);
        }

        const ownerEmail = data.ownerEmail;
        const status = data.status;
        const caregiverName = data.caregiverName || 'El cuidador';
        const petName = data.petName || 'tu mascota';
        const ownerName = data.ownerName || 'Cliente';

        if (!ownerEmail || !ownerEmail.includes('@')) {
            return sendSuccess(res, { sent: false, reason: 'No owner email' }, 'Reservation updated; email not sent (no address)');
        }

        let sent = false;
        try {
            const nodemailer = require('nodemailer');
            const transporter = nodemailer.createTransport({
                host: process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com',
                port: parseInt(process.env.BREVO_SMTP_PORT || '587', 10),
                secure: false,
                auth: {
                    user: process.env.BREVO_SMTP_USER,
                    pass: process.env.BREVO_SMTP_PASS,
                },
            });

            const subject = status === 'accepted'
                ? `PawMate: ${caregiverName} ha aceptado tu reserva`
                : `PawMate: ${caregiverName} ha rechazado tu reserva`;

            const text = status === 'accepted'
                ? `Hola ${ownerName},\n\n${caregiverName} ha aceptado tu solicitud de reserva para ${petName}. Ya puedes coordinar el servicio.\n\nGracias por usar PawMate.`
                : `Hola ${ownerName},\n\n${caregiverName} no ha podido aceptar tu solicitud de reserva para ${petName}. Puedes buscar otro cuidador en la app.\n\nGracias por usar PawMate.`;

            await transporter.sendMail({
                from: process.env.BREVO_FROM_EMAIL || 'noreply@pawmate.com',
                to: ownerEmail,
                subject,
                text,
            });
            sent = true;
        } catch (emailErr) {
            console.error('Brevo email send error:', emailErr.message);
        }

        return sendSuccess(res, { sent }, sent ? 'Email sent to owner' : 'Reservation updated; email not sent (check Brevo SMTP config)');
    } catch (error) {
        console.error('sendReservationStatusEmail error:', error);
        return sendError(res, 'Error sending notification', 500);
    }
};

module.exports = {
    sendReservationStatusEmail,
};
