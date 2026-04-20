const { supabase } = require('../config/supabase');
const { sendSuccess, sendError } = require('../utils/response');
const { createTransporter, FROM_DEFAULT } = require('./email.controller');

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

        // Verify the requesting user is a participant of this reservation
        if (req.user.uid !== data.ownerId && req.user.uid !== data.caregiverId) {
            return sendError(res, 'Not authorized for this reservation', 403);
        }

        // Look up the owner's email from the users table
        const { data: ownerData } = await supabase
            .from('users')
            .select('email')
            .eq('id', data.ownerId)
            .single();

        const ownerEmail = ownerData?.email;
        const status = data.status;
        const caregiverName = data.caregiverName || 'El cuidador';
        const petName = (data.petNames && data.petNames.length > 0) ? data.petNames.join(', ') : 'tu mascota';
        const ownerName = data.ownerName || 'Cliente';

        if (!ownerEmail || !ownerEmail.includes('@')) {
            return sendSuccess(res, { sent: false, reason: 'No owner email' }, 'Reservation updated; email not sent (no address)');
        }

        let sent = false;
        try {
            const transporter = createTransporter();

            const subject = (status === 'aceptada' || status === 'accepted')
                ? `PawMate: ${caregiverName} ha aceptado tu reserva`
                : `PawMate: ${caregiverName} ha rechazado tu reserva`;

            const text = (status === 'aceptada' || status === 'accepted')
                ? `Hola ${ownerName},\n\n${caregiverName} ha aceptado tu solicitud de reserva para ${petName}. Ya puedes coordinar el servicio.\n\nGracias por usar PawMate.`
                : `Hola ${ownerName},\n\n${caregiverName} no ha podido aceptar tu solicitud de reserva para ${petName}. Puedes buscar otro cuidador en la app.\n\nGracias por usar PawMate.`;

            await transporter.sendMail({
                from: FROM_DEFAULT,
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
