const { sendSuccess, sendError } = require('../utils/response');

/* â”€â”€â”€ Shared helpers â”€â”€â”€ */

function createTransporter() {
    const nodemailer = require('nodemailer');
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
}

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
      &copy; ${new Date().getFullYear()} PawMate &middot; pawmate.com
    </p>
  </div>
</body>
</html>`;
}

function emailButton(url, label, color = '#6366f1') {
    return `<div style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:${color};color:white;font-size:16px;font-weight:600;padding:14px 36px;border-radius:12px;text-decoration:none;">${label}</a>
    </div>`;
}

function expiryNote() {
    return `<p style="color:#94a3b8;font-size:12px;text-align:center;margin:16px 0 0;">Este enlace expira en 24 horas. Si no has solicitado esto, puedes ignorar este email.</p>`;
}

/**
 * Enviar email de bienvenida cuando un usuario se registra / inicia sesiÃ³n con Google.
 * POST /api/notifications/welcome-email
 * Body: { email, fullName }
 */
const sendWelcomeEmail = async (req, res) => {
    try {
        const { email, fullName } = req.body;
        if (!email || !email.includes('@')) {
            return sendError(res, 'email is required', 400);
        }

        const name = fullName || email.split('@')[0];

        let sent = false;
        try {
            const transporter = createTransporter();
            const html = emailLayout({
                icon: 'ðŸ¾',
                title: `Â¡Bienvenido a PawMate!`,
                subtitle: 'Tu compaÃ±ero perfecto para el cuidado de mascotas',
                gradient: '#6366f1 0%, #8b5cf6 100%',
                body: `
      <h2 style="color:#1e293b;font-size:22px;margin:0 0 16px;">Hola ${name},</h2>
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 20px;">
        Â¡Nos alegra tenerte en la familia PawMate! Ahora puedes disfrutar de todas las funcionalidades para cuidar de tus mascotas:
      </p>
      <div style="background:#f8fafc;border-radius:16px;padding:20px;margin-bottom:24px;">
        <div style="display:flex;margin-bottom:12px;align-items:center;">
          <span style="font-size:24px;margin-right:12px;">ðŸ“</span>
          <div><strong style="color:#1e293b;">Radar de Cuidadores</strong><p style="color:#64748b;margin:4px 0 0;font-size:13px;">Encuentra cuidadores cercanos verificados</p></div>
        </div>
        <div style="display:flex;margin-bottom:12px;align-items:center;">
          <span style="font-size:24px;margin-right:12px;">ðŸ—“ï¸</span>
          <div><strong style="color:#1e293b;">Reservas</strong><p style="color:#64748b;margin:4px 0 0;font-size:13px;">Agenda paseos y servicios de hotel</p></div>
        </div>
        <div style="display:flex;align-items:center;">
          <span style="font-size:24px;margin-right:12px;">ðŸš¨</span>
          <div><strong style="color:#1e293b;">BotÃ³n SOS</strong><p style="color:#64748b;margin:4px 0 0;font-size:13px;">Emergencias durante paseos activos</p></div>
        </div>
      </div>
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px;">
        Para acceder a todas las funciones, verifica tu cuenta en la secciÃ³n de Ajustes de la app.
      </p>
      <p style="color:#64748b;font-size:14px;margin:0;">
        Â¿Necesitas ayuda? EscrÃ­benos a <a href="mailto:soporte@apppawmate.com" style="color:#6366f1;">soporte@apppawmate.com</a>
      </p>`,
            });

            const text = `Â¡Bienvenido a PawMate, ${name}!\n\nNos alegra tenerte en la familia PawMate.\nAhora puedes encontrar cuidadores, agendar reservas y mucho mÃ¡s.\n\nVerifica tu cuenta en Ajustes para acceder a todas las funciones.\n\nÂ¿Necesitas ayuda? soporte@apppawmate.com\n\nÂ© ${new Date().getFullYear()} PawMate`;

            await transporter.sendMail({
                from: `"PawMate | Bienvenida" <hola@apppawmate.com>`,
                to: email,
                subject: `Â¡Bienvenido a PawMate, ${name}! ðŸ¾`,
                text,
                html,
            });
            sent = true;
        } catch (emailErr) {
            console.error('Welcome email send error:', emailErr.message);
        }

        return sendSuccess(res, { sent }, sent ? 'Welcome email sent' : 'Could not send email (check SMTP config)');
    } catch (error) {
        console.error('sendWelcomeEmail error:', error);
        return sendError(res, 'Error sending welcome email', 500);
    }
};

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 *  Supabase Auth Hook â€” Send Email
 *  Supabase llama a este endpoint en vez de enviar emails internamente.
 *  POST /api/notifications/auth-email
 *  Body (from Supabase): { user, email_data }
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const handleAuthEmail = async (req, res) => {
    try {
        // Verify Supabase webhook secret
        const hookSecret = process.env.SUPABASE_AUTH_HOOK_SECRET;
        if (hookSecret) {
            const authHeader = req.headers['authorization'] || '';
            if (!authHeader) {
                return res.status(401).json({ error: { http_code: 401, message: 'Missing authorization header' } });
            }
            // Supabase sends the secret as a signed JWT â€” for webhook-secret (symmetric)
            // we verify the payload matches. The secret format: v1,whsec_<base64>
            try {
                const jwt = require('jsonwebtoken');
                const secret = hookSecret.startsWith('v1,whsec_')
                    ? hookSecret.replace('v1,whsec_', '')
                    : hookSecret;
                const token = authHeader.replace('Bearer ', '');
                jwt.verify(token, Buffer.from(secret, 'base64'));
            } catch (jwtErr) {
                console.error('Auth hook JWT verification failed:', jwtErr.message);
                return res.status(401).json({ error: { http_code: 401, message: 'Invalid hook signature' } });
            }
        }

        const { user, email_data } = req.body;
        if (!user?.email || !email_data) {
            return res.status(400).json({ error: { http_code: 400, message: 'Invalid hook payload' } });
        }

        const {
            email_action_type,
            token_hash,
            redirect_to,
            site_url,
            token_hash_new,
        } = email_data;

        const supabaseUrl = process.env.SUPABASE_URL;
        const baseRedirect = redirect_to || site_url || '';
        const userName = user.user_metadata?.full_name || user.user_metadata?.fullName || user.email.split('@')[0];

        // Build Supabase verify link
        const buildLink = (hash, type) => {
            let url = `${supabaseUrl}/auth/v1/verify?token=${hash}&type=${type}`;
            if (baseRedirect) url += `&redirect_to=${encodeURIComponent(baseRedirect)}`;
            return url;
        };

        const confirmUrl = buildLink(token_hash, email_action_type);
        const transporter = createTransporter();

        /* â”€â”€ Signup: Confirmar registro â”€â”€ */
        if (email_action_type === 'signup') {
            const html = emailLayout({
                icon: 'ðŸ¾',
                title: 'Â¡Bienvenido a PawMate!',
                subtitle: 'Solo falta un paso para activar tu cuenta',
                gradient: '#6366f1 0%, #8b5cf6 100%',
                body: `
      <h2 style="color:#1e293b;font-size:22px;margin:0 0 16px;">Hola ${userName},</h2>
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 8px;">
        Â¡Gracias por registrarte en PawMate! Confirma tu direcciÃ³n de correo para activar tu cuenta y empezar a disfrutar de todo lo que ofrecemos.
      </p>
      ${emailButton(confirmUrl, 'Confirmar mi cuenta')}
      <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0 0 8px;">
        Si el botÃ³n no funciona, copia y pega este enlace en tu navegador:
      </p>
      <p style="word-break:break-all;color:#6366f1;font-size:12px;margin:0 0 16px;">${confirmUrl}</p>
      ${expiryNote()}`,
            });

            await transporter.sendMail({
                from: '"PawMate | Bienvenida" <hola@apppawmate.com>',
                to: user.email,
                subject: `Â¡Confirma tu cuenta en PawMate, ${userName}! ðŸ¾`,
                html,
                text: `Hola ${userName},\n\nConfirma tu cuenta: ${confirmUrl}\n\nEste enlace expira en 24h.\n\nÂ© ${new Date().getFullYear()} PawMate`,
            });
        }

        /* â”€â”€ Magic Link â”€â”€ */
        else if (email_action_type === 'magiclink') {
            const html = emailLayout({
                icon: 'ðŸ”—',
                title: 'Tu enlace de acceso',
                subtitle: 'Inicia sesiÃ³n con un solo clic',
                gradient: '#6366f1 0%, #8b5cf6 100%',
                body: `
      <h2 style="color:#1e293b;font-size:22px;margin:0 0 16px;">Hola ${userName},</h2>
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 8px;">
        Has solicitado un enlace para iniciar sesiÃ³n en PawMate. Haz clic en el botÃ³n para acceder a tu cuenta:
      </p>
      ${emailButton(confirmUrl, 'Iniciar sesiÃ³n')}
      <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0 0 8px;">
        Si el botÃ³n no funciona, copia y pega este enlace en tu navegador:
      </p>
      <p style="word-break:break-all;color:#6366f1;font-size:12px;margin:0 0 16px;">${confirmUrl}</p>
      ${expiryNote()}`,
            });

            await transporter.sendMail({
                from: '"PawMate" <hola@apppawmate.com>',
                to: user.email,
                subject: 'Tu enlace de acceso a PawMate ðŸ”—',
                html,
                text: `Hola ${userName},\n\nInicia sesiÃ³n: ${confirmUrl}\n\nEste enlace expira en 24h.\n\nÂ© ${new Date().getFullYear()} PawMate`,
            });
        }

        /* â”€â”€ Email Change (seguridad) â”€â”€ */
        else if (email_action_type === 'email_change') {
            const html = emailLayout({
                icon: 'ðŸ”’',
                title: 'Cambio de email',
                subtitle: 'Confirma esta acciÃ³n de seguridad',
                gradient: '#ef4444 0%, #f97316 100%',
                body: `
      <h2 style="color:#1e293b;font-size:22px;margin:0 0 16px;">Hola ${userName},</h2>
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 8px;">
        Has solicitado cambiar la direcciÃ³n de correo electrÃ³nico asociada a tu cuenta de PawMate. Por motivos de seguridad, necesitamos que confirmes este cambio.
      </p>
      ${emailButton(confirmUrl, 'Confirmar cambio de email', '#ef4444')}
      <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0 0 8px;">
        Si el botÃ³n no funciona, copia y pega este enlace en tu navegador:
      </p>
      <p style="word-break:break-all;color:#ef4444;font-size:12px;margin:0 0 16px;">${confirmUrl}</p>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px;margin:16px 0;">
        <p style="color:#991b1b;font-size:13px;margin:0;"><strong>âš ï¸ Â¿No has sido tÃº?</strong> Si no has solicitado este cambio, ignora este email y tu cuenta permanecerÃ¡ segura. Te recomendamos cambiar tu contraseÃ±a por precauciÃ³n.</p>
      </div>
      ${expiryNote()}`,
            });

            // Send to the current email
            await transporter.sendMail({
                from: '"PawMate Seguridad" <team@apppawmate.com>',
                to: user.email,
                subject: 'Confirma tu cambio de email Â· PawMate ðŸ”’',
                html,
                text: `Hola ${userName},\n\nConfirma el cambio de email: ${confirmUrl}\n\nSi no has sido tÃº, ignora este email.\n\nÂ© ${new Date().getFullYear()} PawMate`,
            });

            // If there's a new email hash, also confirm from the new address
            if (token_hash_new) {
                const newConfirmUrl = buildLink(token_hash_new, email_action_type);
                const htmlNew = emailLayout({
                    icon: 'ðŸ”’',
                    title: 'Confirma tu nuevo email',
                    subtitle: 'Verifica que esta direcciÃ³n es tuya',
                    gradient: '#ef4444 0%, #f97316 100%',
                    body: `
      <h2 style="color:#1e293b;font-size:22px;margin:0 0 16px;">Hola ${userName},</h2>
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 8px;">
        Has indicado esta direcciÃ³n como tu nuevo correo en PawMate. ConfÃ­rmala para completar el cambio.
      </p>
      ${emailButton(newConfirmUrl, 'Confirmar nuevo email', '#ef4444')}
      <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0 0 8px;">
        Si el botÃ³n no funciona, copia y pega este enlace en tu navegador:
      </p>
      <p style="word-break:break-all;color:#ef4444;font-size:12px;margin:0 0 16px;">${newConfirmUrl}</p>
      ${expiryNote()}`,
                });

                await transporter.sendMail({
                    from: '"PawMate Seguridad" <team@apppawmate.com>',
                    to: user.new_email || user.email_change_send_to || user.email,
                    subject: 'Confirma tu nuevo email Â· PawMate ðŸ”’',
                    html: htmlNew,
                    text: `Hola ${userName},\n\nConfirma tu nuevo email: ${newConfirmUrl}\n\nÂ© ${new Date().getFullYear()} PawMate`,
                });
            }
        }

        /* â”€â”€ Recovery (restablecer contraseÃ±a) â”€â”€ */
        else if (email_action_type === 'recovery') {
            const html = emailLayout({
                icon: 'ðŸ”‘',
                title: 'Restablecer contraseÃ±a',
                subtitle: 'Recupera el acceso a tu cuenta',
                gradient: '#f59e0b 0%, #f97316 100%',
                body: `
      <h2 style="color:#1e293b;font-size:22px;margin:0 0 16px;">Hola ${userName},</h2>
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 8px;">
        Has solicitado restablecer la contraseÃ±a de tu cuenta en PawMate. Haz clic en el botÃ³n para crear una nueva contraseÃ±a:
      </p>
      ${emailButton(confirmUrl, 'Restablecer contraseÃ±a', '#f59e0b')}
      <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0 0 8px;">
        Si el botÃ³n no funciona, copia y pega este enlace en tu navegador:
      </p>
      <p style="word-break:break-all;color:#f59e0b;font-size:12px;margin:0 0 16px;">${confirmUrl}</p>
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px;margin:16px 0;">
        <p style="color:#92400e;font-size:13px;margin:0;"><strong>ðŸ” Consejo de seguridad:</strong> Usa una contraseÃ±a Ãºnica de al menos 8 caracteres con letras, nÃºmeros y sÃ­mbolos.</p>
      </div>
      ${expiryNote()}`,
            });

            await transporter.sendMail({
                from: '"PawMate Soporte TÃ©cnico" <team@apppawmate.com>',
                to: user.email,
                subject: 'Restablecer tu contraseÃ±a Â· PawMate ðŸ”‘',
                html,
                text: `Hola ${userName},\n\nRestablece tu contraseÃ±a: ${confirmUrl}\n\nEste enlace expira en 24h.\n\nSi no lo has solicitado, ignora este email.\n\nÂ© ${new Date().getFullYear()} PawMate`,
            });
        }

        /* â”€â”€ Tipo desconocido: fallback genÃ©rico â”€â”€ */
        else {
            const html = emailLayout({
                icon: 'ðŸ¾',
                title: 'PawMate',
                subtitle: '',
                gradient: '#6366f1 0%, #8b5cf6 100%',
                body: `
      <h2 style="color:#1e293b;font-size:22px;margin:0 0 16px;">Hola ${userName},</h2>
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 8px;">Haz clic en el enlace para continuar:</p>
      ${emailButton(confirmUrl, 'Continuar')}
      ${expiryNote()}`,
            });

            await transporter.sendMail({
                from: '"PawMate" <hola@apppawmate.com>',
                to: user.email,
                subject: 'AcciÃ³n requerida Â· PawMate',
                html,
                text: `Hola ${userName},\n\nContinÃºa aquÃ­: ${confirmUrl}\n\nÂ© ${new Date().getFullYear()} PawMate`,
            });
        }

        console.log(`Auth email [${email_action_type}] sent to ${user.email}`);
        return res.json({ success: true });
    } catch (err) {
        console.error('Auth email hook error:', err);
        return res.status(500).json({ error: { http_code: 500, message: err.message } });
    }
};

module.exports = { sendWelcomeEmail, handleAuthEmail };
