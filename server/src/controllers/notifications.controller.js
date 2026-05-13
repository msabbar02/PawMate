const { supabase } = require('../config/supabase');
const { sendSuccess, sendError } = require('../utils/response');
const { createTransporter, emailLayout, emailButton, escapeHtml, FROM_DEFAULT, FROM_SUPPORT } = require('./email.controller');

/**
 * Notificar al due�o por email cuando el cuidador acepta o rechaza la reserva.
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

        // Look up the owner's email and caregiver email from users table in parallel
        const [{ data: ownerData }, { data: caregiverData }] = await Promise.all([
            supabase.from('users').select('email').eq('id', data.ownerId).single(),
            supabase.from('users').select('email').eq('id', data.caregiverId).single(),
        ]);

        const ownerEmail     = ownerData?.email;
        const caregiverEmail = caregiverData?.email;
        const isAccepted     = data.status === 'aceptada' || data.status === 'accepted';
        const isRejected     = data.status === 'rechazada' || data.status === 'rejected';

        const caregiverName = escapeHtml(data.caregiverName || 'El cuidador');
        const ownerName     = escapeHtml(data.ownerName     || 'Cliente');
        const petName       = (data.petNames?.length > 0)
            ? data.petNames.map(escapeHtml).join(', ')
            : 'tu mascota';
        const serviceLabel  = data.serviceType === 'hotel'
            ? 'Hotel para mascotas'
            : 'Paseo';
        const startDate     = data.startDate || '';
        const endDate       = data.endDate   || '';
        const totalPrice    = data.totalPrice != null ? `${Number(data.totalPrice).toFixed(2)} �` : null;

        const results = { owner: false, caregiver: false };

        // -- Email to owner --------------------------------------------------
        if (ownerEmail?.includes('@') && (isAccepted || isRejected)) {
            try {
                const transporter = createTransporter();

                if (isAccepted) {
                    const html = emailLayout({
                        icon: '',
                        title: '�Tu reserva ha sido aceptada!',
                        subtitle: `${caregiverName} est� listo para cuidar a ${petName}`,
                        gradient: '#16A34A 0%, #15803d 100%',
                        body: `
  <h2 style="color:#1e293b;font-size:22px;margin:0 0 16px;">Hola ${ownerName},</h2>
  <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 20px;">
    �Buenas noticias! <strong>${caregiverName}</strong> ha <strong style="color:#16A34A;">aceptado</strong> tu solicitud de reserva.
  </p>
  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:16px;padding:20px;margin-bottom:24px;">
    <p style="margin:0 0 10px;font-size:14px;color:#166534;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Detalles de la reserva</p>
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:6px 0;color:#475569;font-size:14px;">Mascota(s)</td><td style="padding:6px 0;color:#1e293b;font-weight:600;font-size:14px;text-align:right;">${petName}</td></tr>
      <tr><td style="padding:6px 0;color:#475569;font-size:14px;">Servicio</td><td style="padding:6px 0;color:#1e293b;font-weight:600;font-size:14px;text-align:right;">${serviceLabel}</td></tr>
      ${startDate ? `<tr><td style="padding:6px 0;color:#475569;font-size:14px;">Inicio</td><td style="padding:6px 0;color:#1e293b;font-weight:600;font-size:14px;text-align:right;">${startDate}</td></tr>` : ''}
      ${endDate && endDate !== startDate ? `<tr><td style="padding:6px 0;color:#475569;font-size:14px;">Fin</td><td style="padding:6px 0;color:#1e293b;font-weight:600;font-size:14px;text-align:right;">${endDate}</td></tr>` : ''}
      ${totalPrice ? `<tr><td style="padding:6px 0;color:#475569;font-size:14px;">Precio total</td><td style="padding:6px 0;color:#16A34A;font-weight:700;font-size:15px;text-align:right;">${totalPrice}</td></tr>` : ''}
    </table>
  </div>
  <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px;">
    Puedes chatear con ${caregiverName} directamente en la app para coordinar todos los detalles. �Tu mascota est� en buenas manos!
  </p>
  <p style="color:#64748b;font-size:13px;margin:0;">�Tienes alguna pregunta? Escr�benos a <a href="mailto:soporte@apppawmate.com" style="color:#16A34A;">soporte@apppawmate.com</a></p>`,
                    });
                    await transporter.sendMail({
                        from: `"PawMate" <${FROM_DEFAULT}>`,
                        to: ownerEmail,
                        subject: `${caregiverName} ha aceptado tu reserva � PawMate`,
                        html,
                        text: `Hola ${ownerName},\n\n${caregiverName} ha aceptado tu reserva para ${petName} (${serviceLabel}).\n\nDetalles: ${startDate}${endDate && endDate !== startDate ? ' ? ' + endDate : ''}${totalPrice ? ' � ' + totalPrice : ''}.\n\nGracias por usar PawMate.`,
                    });
                } else {
                    const html = emailLayout({
                        icon: '',
                        title: 'Reserva no disponible',
                        subtitle: `${caregiverName} no puede atenderte en esta ocasi�n`,
                        gradient: '#64748b 0%, #475569 100%',
                        body: `
  <h2 style="color:#1e293b;font-size:22px;margin:0 0 16px;">Hola ${ownerName},</h2>
  <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 20px;">
    Lamentablemente, <strong>${caregiverName}</strong> no ha podido aceptar tu solicitud de reserva para <strong>${petName}</strong>.
  </p>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:20px;margin-bottom:24px;">
    <p style="margin:0;color:#475569;font-size:14px;line-height:1.6;">
      No te preocupes, en PawMate hay muchos cuidadores verificados cerca de ti. �Encuentra el cuidador perfecto para tu mascota!
    </p>
  </div>
  <p style="color:#64748b;font-size:13px;margin:0;">�Necesitas ayuda? <a href="mailto:soporte@apppawmate.com" style="color:#F5A623;">soporte@apppawmate.com</a></p>`,
                    });
                    await transporter.sendMail({
                        from: `"PawMate" <${FROM_DEFAULT}>`,
                        to: ownerEmail,
                        subject: `Actualizaci�n de tu reserva � PawMate`,
                        html,
                        text: `Hola ${ownerName},\n\n${caregiverName} no pudo aceptar tu reserva para ${petName}. Puedes buscar otro cuidador en la app.\n\nGracias por usar PawMate.`,
                    });
                }
                results.owner = true;
            } catch (emailErr) {
                console.error('Email to owner failed:', emailErr.message);
            }
        }

        // -- Email to caregiver (new booking request notification) -----------
        if (caregiverEmail?.includes('@') && data.status === 'pendiente') {
            try {
                const transporter = createTransporter();
                const html = emailLayout({
                    icon: '',
                    title: 'Nueva solicitud de reserva',
                    subtitle: `${ownerName} quiere reservar tus servicios`,
                    gradient: '#F5A623 0%, #FF6B35 100%',
                    body: `
  <h2 style="color:#1e293b;font-size:22px;margin:0 0 16px;">Hola ${caregiverName},</h2>
  <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 20px;">
    <strong>${ownerName}</strong> ha enviado una solicitud de reserva. Rev�sala y responde en la app.
  </p>
  <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:16px;padding:20px;margin-bottom:24px;">
    <p style="margin:0 0 10px;font-size:14px;color:#92400e;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Detalles</p>
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:6px 0;color:#475569;font-size:14px;">Mascota(s)</td><td style="padding:6px 0;color:#1e293b;font-weight:600;font-size:14px;text-align:right;">${petName}</td></tr>
      <tr><td style="padding:6px 0;color:#475569;font-size:14px;">Servicio</td><td style="padding:6px 0;color:#1e293b;font-weight:600;font-size:14px;text-align:right;">${serviceLabel}</td></tr>
      ${startDate ? `<tr><td style="padding:6px 0;color:#475569;font-size:14px;">Inicio</td><td style="padding:6px 0;color:#1e293b;font-weight:600;font-size:14px;text-align:right;">${startDate}</td></tr>` : ''}
      ${endDate && endDate !== startDate ? `<tr><td style="padding:6px 0;color:#475569;font-size:14px;">Fin</td><td style="padding:6px 0;color:#1e293b;font-weight:600;font-size:14px;text-align:right;">${endDate}</td></tr>` : ''}
      ${totalPrice ? `<tr><td style="padding:6px 0;color:#475569;font-size:14px;">Precio total</td><td style="padding:6px 0;color:#F5A623;font-weight:700;font-size:15px;text-align:right;">${totalPrice}</td></tr>` : ''}
    </table>
  </div>
  <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px;">
    Abre la app PawMate para aceptar o rechazar esta solicitud.
  </p>
  <p style="color:#64748b;font-size:13px;margin:0;">�Necesitas ayuda? <a href="mailto:soporte@apppawmate.com" style="color:#F5A623;">soporte@apppawmate.com</a></p>`,
                });
                await transporter.sendMail({
                    from: `"PawMate" <${FROM_DEFAULT}>`,
                    to: caregiverEmail,
                    subject: `Nueva reserva de ${ownerName} � PawMate`,
                    html,
                    text: `Hola ${caregiverName},\n\n${ownerName} ha solicitado una reserva para ${petName} (${serviceLabel}).\n\nAbre la app para responder.\n\nGracias por ser parte de PawMate.`,
                });
                results.caregiver = true;
            } catch (emailErr) {
                console.error('Email to caregiver failed:', emailErr.message);
            }
        }

        return sendSuccess(
            res,
            results,
            Object.values(results).some(Boolean)
                ? 'Notification emails sent'
                : 'No emails sent (check RESEND_API_KEY or email addresses)'
        );
    } catch (error) {
        console.error('sendReservationStatusEmail error:', error);
        return sendError(res, 'Error sending notification', 500);
    }
};

/**
 * Enviar email al dueño para valorar al cuidador al completar la reserva.
 * POST /api/notifications/rating-request
 * Body: { reservationId }
 */
const sendRatingRequestEmail = async (req, res) => {
    try {
        const { reservationId } = req.body;
        if (!reservationId) return sendError(res, 'reservationId is required', 400);

        const { data, error } = await supabase.from('reservations').select('*').eq('id', reservationId).single();
        if (error || !data) return sendError(res, 'Reservation not found', 404);

        const { data: ownerData } = await supabase.from('users').select('email, fullName').eq('id', data.ownerId).single();
        if (!ownerData?.email?.includes('@')) return sendSuccess(res, { sent: false }, 'Owner email not found');

        const ownerName     = escapeHtml(data.ownerName || ownerData.fullName || ownerData.email.split('@')[0]);
        const caregiverName = escapeHtml(data.caregiverName || 'el cuidador');
        const petName       = data.petNames?.length > 0 ? data.petNames.map(escapeHtml).join(', ') : 'tu mascota';
        const serviceLabel  = data.serviceType === 'hotel' ? 'hotel para mascotas' : 'paseo';

        const transporter = createTransporter();
        let sent = false;
        try {
            await transporter.sendMail({
                from: FROM_DEFAULT,
                to: ownerData.email,
                subject: `¿Cómo fue la experiencia con ${caregiverName}? ⭐ PawMate`,
                html: emailLayout({
                    icon: '⭐',
                    title: '¿Cómo fue la experiencia?',
                    subtitle: `Valora a ${caregiverName} y ayuda a la comunidad`,
                    gradient: '#f59e0b 0%, #f97316 100%',
                    body: `
  <h2 style="color:#1e293b;font-size:22px;margin:0 0 16px;">Hola ${ownerName},</h2>
  <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 20px;">
    El servicio de <strong>${serviceLabel}</strong> para <strong>${petName}</strong> con <strong>${caregiverName}</strong> ha finalizado. ¡Esperamos que haya sido una gran experiencia!
  </p>
  <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:16px;padding:24px;margin-bottom:24px;text-align:center;">
    <p style="margin:0 0 10px;font-size:15px;color:#92400e;font-weight:700;">Tu opinión importa</p>
    <div style="font-size:36px;letter-spacing:6px;margin-bottom:12px;">⭐⭐⭐⭐⭐</div>
    <p style="margin:0;color:#78350f;font-size:13px;line-height:1.6;">Tus valoraciones ayudan a otros dueños a elegir el cuidador perfecto<br/>y motivan a los cuidadores a seguir mejorando.</p>
  </div>
  <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px;">
    Abre la app PawMate y accede a tus reservas completadas para dejar tu valoración. ¡Solo tarda 30 segundos!
  </p>
  ${emailButton('https://apppawmate.com', 'Abrir PawMate y valorar', '#f59e0b')}
  <p style="color:#64748b;font-size:13px;margin:16px 0 0;text-align:center;">
    ¿Tuviste algún problema? <a href="mailto:soporte@apppawmate.com" style="color:#f59e0b;">soporte@apppawmate.com</a>
  </p>`,
                }),
                text: `Hola ${ownerName},\n\nEl servicio de ${serviceLabel} para ${petName} con ${caregiverName} ha finalizado.\n\nAbre PawMate para valorar la experiencia. Tu opinión ayuda a la comunidad.\n\n© ${new Date().getFullYear()} PawMate`,
            });
            sent = true;
        } catch (emailErr) {
            console.error('[Email] Rating request email error:', emailErr.message);
        }
        return sendSuccess(res, { sent }, sent ? 'Rating request email sent' : 'Could not send email');
    } catch (error) {
        console.error('sendRatingRequestEmail error:', error);
        return sendError(res, 'Error sending rating request email', 500);
    }
};

module.exports = {
    sendReservationStatusEmail,
    sendRatingRequestEmail,
};
