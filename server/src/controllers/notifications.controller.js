const { supabase } = require('../config/supabase');
const { sendSuccess, sendError } = require('../utils/response');
const { createTransporter, FROM_DEFAULT, FROM_SUPPORT } = require('./email.controller');

// Reuse the shared email layout helpers from email.controller
const { emailLayout, emailButton } = (() => {
    // Inline copies so we don't need to export them
    function emailLayout({ icon, title, subtitle, gradient, body }) {
        return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:linear-gradient(135deg,${gradient});border-radius:24px 24px 0 0;padding:40px 30px;text-align:center;">
      <div style="font-size:60px;margin-bottom:16px;">${icon}</div>
      <h1 style="color:white;font-size:28px;margin:0 0 8px;">${title}</h1>
      ${subtitle ? `<p style="color:rgba(255,255,255,0.85);font-size:16px;margin:0;">${subtitle}</p>` : ''}
    </div>
    <div style="background:white;border-radius:0 0 24px 24px;padding:36px 30px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
      ${body}
    </div>
    <p style="text-align:center;color:#94a3b8;font-size:12px;margin-top:24px;">
      &copy; ${new Date().getFullYear()} PawMate &middot; apppawmate.com
    </p>
  </div>
</body>
</html>`;
    }
    function emailButton(url, label, color = '#F5A623') {
        return `<div style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:${color};color:white;font-size:16px;font-weight:600;padding:14px 36px;border-radius:12px;text-decoration:none;">${label}</a>
    </div>`;
    }
    return { emailLayout, emailButton };
})();

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

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
        const totalPrice    = data.totalPrice != null ? `${Number(data.totalPrice).toFixed(2)} €` : null;

        const results = { owner: false, caregiver: false };

        // ── Email to owner ──────────────────────────────────────────────────
        if (ownerEmail?.includes('@') && (isAccepted || isRejected)) {
            try {
                const transporter = createTransporter();

                if (isAccepted) {
                    const html = emailLayout({
                        icon: '',
                        title: '¡Tu reserva ha sido aceptada!',
                        subtitle: `${caregiverName} está listo para cuidar a ${petName}`,
                        gradient: '#16A34A 0%, #15803d 100%',
                        body: `
  <h2 style="color:#1e293b;font-size:22px;margin:0 0 16px;">Hola ${ownerName},</h2>
  <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 20px;">
    ¡Buenas noticias! <strong>${caregiverName}</strong> ha <strong style="color:#16A34A;">aceptado</strong> tu solicitud de reserva.
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
    Puedes chatear con ${caregiverName} directamente en la app para coordinar todos los detalles. ¡Tu mascota está en buenas manos!
  </p>
  <p style="color:#64748b;font-size:13px;margin:0;">¿Tienes alguna pregunta? Escríbenos a <a href="mailto:support@apppawmate.com" style="color:#16A34A;">support@apppawmate.com</a></p>`,
                    });
                    await transporter.sendMail({
                        from: `"PawMate" <${FROM_DEFAULT}>`,
                        to: ownerEmail,
                        subject: `${caregiverName} ha aceptado tu reserva · PawMate`,
                        html,
                        text: `Hola ${ownerName},\n\n${caregiverName} ha aceptado tu reserva para ${petName} (${serviceLabel}).\n\nDetalles: ${startDate}${endDate && endDate !== startDate ? ' → ' + endDate : ''}${totalPrice ? ' · ' + totalPrice : ''}.\n\nGracias por usar PawMate.`,
                    });
                } else {
                    const html = emailLayout({
                        icon: '',
                        title: 'Reserva no disponible',
                        subtitle: `${caregiverName} no puede atenderte en esta ocasión`,
                        gradient: '#64748b 0%, #475569 100%',
                        body: `
  <h2 style="color:#1e293b;font-size:22px;margin:0 0 16px;">Hola ${ownerName},</h2>
  <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 20px;">
    Lamentablemente, <strong>${caregiverName}</strong> no ha podido aceptar tu solicitud de reserva para <strong>${petName}</strong>.
  </p>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:20px;margin-bottom:24px;">
    <p style="margin:0;color:#475569;font-size:14px;line-height:1.6;">
      No te preocupes, en PawMate hay muchos cuidadores verificados cerca de ti. ¡Encuentra el cuidador perfecto para tu mascota!
    </p>
  </div>
  <p style="color:#64748b;font-size:13px;margin:0;">¿Necesitas ayuda? <a href="mailto:support@apppawmate.com" style="color:#F5A623;">support@apppawmate.com</a></p>`,
                    });
                    await transporter.sendMail({
                        from: `"PawMate" <${FROM_DEFAULT}>`,
                        to: ownerEmail,
                        subject: `Actualización de tu reserva · PawMate`,
                        html,
                        text: `Hola ${ownerName},\n\n${caregiverName} no pudo aceptar tu reserva para ${petName}. Puedes buscar otro cuidador en la app.\n\nGracias por usar PawMate.`,
                    });
                }
                results.owner = true;
            } catch (emailErr) {
                console.error('Email to owner failed:', emailErr.message);
            }
        }

        // ── Email to caregiver (new booking request notification) ───────────
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
    <strong>${ownerName}</strong> ha enviado una solicitud de reserva. Revísala y responde en la app.
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
  <p style="color:#64748b;font-size:13px;margin:0;">¿Necesitas ayuda? <a href="mailto:support@apppawmate.com" style="color:#F5A623;">support@apppawmate.com</a></p>`,
                });
                await transporter.sendMail({
                    from: `"PawMate" <${FROM_DEFAULT}>`,
                    to: caregiverEmail,
                    subject: `Nueva reserva de ${ownerName} · PawMate`,
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

module.exports = {
    sendReservationStatusEmail,
};
