const { sendSuccess, sendError } = require('../utils/response');

/* --- Shared helpers --- */

const FROM_DEFAULT = process.env.SMTP_FROM || 'hola@apppawmate.com';

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function createTransporter() {
    const nodemailer = require('nodemailer');

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.error('SMTP_USER or SMTP_PASS not set - emails will fail');
    }

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

const sendWelcomeEmail = async (req, res) => {
    try {
        const { email, fullName } = req.body;
        if (!email || !email.includes('@')) {
            return sendError(res, 'email is required', 400);
        }

        const name = escapeHtml(fullName || email.split('@')[0]);

        let sent = false;
        try {
            const transporter = createTransporter();
            const html = emailLayout({
                icon: '🐾',
                title: '¡Bienvenido a PawMate!',
                subtitle: 'Tu compañero perfecto para el cuidado de mascotas',
                gradient: '#6366f1 0%, #8b5cf6 100%',
                body: `
      <h2 style="color:#1e293b;font-size:22px;margin:0 0 16px;">Hola ${name},</h2>
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 20px;">
        ¡Nos alegra tenerte en la familia PawMate! Ahora puedes disfrutar de todas las funcionalidades para cuidar de tus mascotas:
      </p>
      <div style="background:#f8fafc;border-radius:16px;padding:20px;margin-bottom:24px;">
        <div style="display:flex;margin-bottom:12px;align-items:center;">
          <span style="font-size:24px;margin-right:12px;">🔍</span>
          <div><strong style="color:#1e293b;">Radar de Cuidadores</strong><p style="color:#64748b;margin:4px 0 0;font-size:13px;">Encuentra cuidadores cercanos verificados</p></div>
        </div>
        <div style="display:flex;margin-bottom:12px;align-items:center;">
          <span style="font-size:24px;margin-right:12px;">📅</span>
          <div><strong style="color:#1e293b;">Reservas</strong><p style="color:#64748b;margin:4px 0 0;font-size:13px;">Agenda paseos y servicios de hotel</p></div>
        </div>
        <div style="display:flex;align-items:center;">
          <span style="font-size:24px;margin-right:12px;">🚨</span>
          <div><strong style="color:#1e293b;">Botón SOS</strong><p style="color:#64748b;margin:4px 0 0;font-size:13px;">Emergencias durante paseos activos</p></div>
        </div>
      </div>
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px;">
        Para acceder a todas las funciones, verifica tu cuenta en la sección de Ajustes de la app.
      </p>
      <p style="color:#64748b;font-size:14px;margin:0;">
        ¿Necesitas ayuda? Escríbenos a <a href="mailto:soporte@apppawmate.com" style="color:#6366f1;">soporte@apppawmate.com</a>
      </p>`,
            });

            const text = `¡Bienvenido a PawMate, ${name}!\n\nNos alegra tenerte en la familia PawMate.\nAhora puedes encontrar cuidadores, agendar reservas y mucho más.\n\nVerifica tu cuenta en Ajustes para acceder a todas las funciones.\n\n¿Necesitas ayuda? soporte@apppawmate.com\n\n© ${new Date().getFullYear()} PawMate`;

            await transporter.sendMail({
                from: `"PawMate" <${FROM_DEFAULT}>`,
                to: email,
                subject: `¡Bienvenido a PawMate, ${name}! 🐾`,
                text,
                html,
            });
            sent = true;
        } catch (emailErr) {
            console.error('Welcome email send error:', emailErr.message, emailErr.stack);
        }

        return sendSuccess(res, { sent }, sent ? 'Welcome email sent' : 'Could not send email (check SMTP config)');
    } catch (error) {
        console.error('sendWelcomeEmail error:', error);
        return sendError(res, 'Error sending welcome email', 500);
    }
};

const handleAuthEmail = async (req, res) => {
    try {
        const hookSecret = process.env.SUPABASE_AUTH_HOOK_SECRET;
        if (!hookSecret) {
            console.error('SUPABASE_AUTH_HOOK_SECRET is not set — rejecting auth hook request');
            return res.status(500).json({ error: { http_code: 500, message: 'Auth hook not configured' } });
        }
        const authHeader = req.headers['authorization'] || '';
        if (!authHeader) {
            return res.status(401).json({ error: { http_code: 401, message: 'Missing authorization header' } });
        }
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

        const { user, email_data } = req.body;
        if (!user?.email || !email_data) {
            return res.status(400).json({ error: { http_code: 400, message: 'Invalid hook payload' } });
        }

        const { email_action_type, token_hash, redirect_to, site_url, token_hash_new } = email_data;
        const supabaseUrl = process.env.SUPABASE_URL;
        const baseRedirect = redirect_to || site_url || '';
        const userName = escapeHtml(user.user_metadata?.full_name || user.user_metadata?.fullName || user.email.split('@')[0]);

        const buildLink = (hash, type) => {
            let url = `${supabaseUrl}/auth/v1/verify?token=${hash}&type=${type}`;
            if (baseRedirect) url += `&redirect_to=${encodeURIComponent(baseRedirect)}`;
            return url;
        };

        const confirmUrl = buildLink(token_hash, email_action_type);
        const transporter = createTransporter();

        if (email_action_type === 'signup') {
            const html = emailLayout({
                icon: '🐾', title: '¡Bienvenido a PawMate!',
                subtitle: 'Solo falta un paso para activar tu cuenta',
                gradient: '#6366f1 0%, #8b5cf6 100%',
                body: `
      <h2 style="color:#1e293b;font-size:22px;margin:0 0 16px;">Hola ${userName},</h2>
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 8px;">
        ¡Gracias por registrarte en PawMate! Confirma tu dirección de correo para activar tu cuenta.
      </p>
      ${emailButton(confirmUrl, 'Confirmar mi cuenta')}
      <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0 0 8px;">Si el botón no funciona, copia y pega este enlace:</p>
      <p style="word-break:break-all;color:#6366f1;font-size:12px;margin:0 0 16px;">${confirmUrl}</p>
      ${expiryNote()}`,
            });
            await transporter.sendMail({
                from: `"PawMate" <${FROM_DEFAULT}>`, to: user.email,
                subject: `¡Confirma tu cuenta en PawMate, ${userName}! 🐾`, html,
                text: `Hola ${userName},\n\nConfirma tu cuenta: ${confirmUrl}\n\nExpira en 24h.\n\n© ${new Date().getFullYear()} PawMate`,
            });
        }

        else if (email_action_type === 'magiclink') {
            const html = emailLayout({
                icon: '🔗', title: 'Tu enlace de acceso',
                subtitle: 'Inicia sesión con un solo clic',
                gradient: '#6366f1 0%, #8b5cf6 100%',
                body: `
      <h2 style="color:#1e293b;font-size:22px;margin:0 0 16px;">Hola ${userName},</h2>
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 8px;">Haz clic en el botón para acceder a tu cuenta:</p>
      ${emailButton(confirmUrl, 'Iniciar sesión')}
      <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0 0 8px;">Si el botón no funciona, copia y pega este enlace:</p>
      <p style="word-break:break-all;color:#6366f1;font-size:12px;margin:0 0 16px;">${confirmUrl}</p>
      ${expiryNote()}`,
            });
            await transporter.sendMail({
                from: `"PawMate" <${FROM_DEFAULT}>`, to: user.email,
                subject: 'Tu enlace de acceso a PawMate 🔗', html,
                text: `Hola ${userName},\n\nInicia sesión: ${confirmUrl}\n\nExpira en 24h.\n\n© ${new Date().getFullYear()} PawMate`,
            });
        }

        else if (email_action_type === 'email_change') {
            const html = emailLayout({
                icon: '🔒', title: 'Cambio de email',
                subtitle: 'Confirma esta acción de seguridad',
                gradient: '#ef4444 0%, #f97316 100%',
                body: `
      <h2 style="color:#1e293b;font-size:22px;margin:0 0 16px;">Hola ${userName},</h2>
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 8px;">
        Has solicitado cambiar el correo electrónico de tu cuenta PawMate. Confirma este cambio:
      </p>
      ${emailButton(confirmUrl, 'Confirmar cambio de email', '#ef4444')}
      <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0 0 8px;">Si el botón no funciona, copia y pega este enlace:</p>
      <p style="word-break:break-all;color:#ef4444;font-size:12px;margin:0 0 16px;">${confirmUrl}</p>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px;margin:16px 0;">
        <p style="color:#991b1b;font-size:13px;margin:0;"><strong>⚠️ ¿No has sido tú?</strong> Ignora este email y cambia tu contraseña por precaución.</p>
      </div>
      ${expiryNote()}`,
            });
            await transporter.sendMail({
                from: `"PawMate Seguridad" <${FROM_DEFAULT}>`, to: user.email,
                subject: 'Confirma tu cambio de email · PawMate 🔒', html,
                text: `Hola ${userName},\n\nConfirma el cambio: ${confirmUrl}\n\n© ${new Date().getFullYear()} PawMate`,
            });

            if (token_hash_new) {
                const newConfirmUrl = buildLink(token_hash_new, email_action_type);
                const htmlNew = emailLayout({
                    icon: '🔒', title: 'Confirma tu nuevo email',
                    subtitle: 'Verifica que esta dirección es tuya',
                    gradient: '#ef4444 0%, #f97316 100%',
                    body: `
      <h2 style="color:#1e293b;font-size:22px;margin:0 0 16px;">Hola ${userName},</h2>
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 8px;">Confirma esta dirección como tu nuevo correo en PawMate.</p>
      ${emailButton(newConfirmUrl, 'Confirmar nuevo email', '#ef4444')}
      <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0 0 8px;">Si el botón no funciona, copia y pega este enlace:</p>
      <p style="word-break:break-all;color:#ef4444;font-size:12px;margin:0 0 16px;">${newConfirmUrl}</p>
      ${expiryNote()}`,
                });
                await transporter.sendMail({
                    from: `"PawMate Seguridad" <${FROM_DEFAULT}>`,
                    to: user.new_email || user.email_change_send_to || user.email,
                    subject: 'Confirma tu nuevo email · PawMate 🔒', html: htmlNew,
                    text: `Hola ${userName},\n\nConfirma: ${newConfirmUrl}\n\n© ${new Date().getFullYear()} PawMate`,
                });
            }
        }

        else if (email_action_type === 'recovery') {
            const html = emailLayout({
                icon: '🔑', title: 'Restablecer contraseña',
                subtitle: 'Recupera el acceso a tu cuenta',
                gradient: '#f59e0b 0%, #f97316 100%',
                body: `
      <h2 style="color:#1e293b;font-size:22px;margin:0 0 16px;">Hola ${userName},</h2>
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 8px;">Haz clic para crear una nueva contraseña:</p>
      ${emailButton(confirmUrl, 'Restablecer contraseña', '#f59e0b')}
      <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0 0 8px;">Si el botón no funciona, copia y pega este enlace:</p>
      <p style="word-break:break-all;color:#f59e0b;font-size:12px;margin:0 0 16px;">${confirmUrl}</p>
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px;margin:16px 0;">
        <p style="color:#92400e;font-size:13px;margin:0;"><strong>🔐 Consejo:</strong> Usa una contraseña única de al menos 8 caracteres.</p>
      </div>
      ${expiryNote()}`,
            });
            await transporter.sendMail({
                from: `"PawMate Soporte" <${FROM_DEFAULT}>`, to: user.email,
                subject: 'Restablecer tu contraseña · PawMate 🔑', html,
                text: `Hola ${userName},\n\nRestablece: ${confirmUrl}\n\nExpira en 24h.\n\n© ${new Date().getFullYear()} PawMate`,
            });
        }

        else {
            const html = emailLayout({
                icon: '🐾', title: 'PawMate', subtitle: '',
                gradient: '#6366f1 0%, #8b5cf6 100%',
                body: `
      <h2 style="color:#1e293b;font-size:22px;margin:0 0 16px;">Hola ${userName},</h2>
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 8px;">Haz clic en el enlace para continuar:</p>
      ${emailButton(confirmUrl, 'Continuar')}
      ${expiryNote()}`,
            });
            await transporter.sendMail({
                from: `"PawMate" <${FROM_DEFAULT}>`, to: user.email,
                subject: 'Acción requerida · PawMate', html,
                text: `Hola ${userName},\n\nContinúa aquí: ${confirmUrl}\n\n© ${new Date().getFullYear()} PawMate`,
            });
        }

        console.log(`Auth email [${email_action_type}] sent to ${user.email}`);
        return res.json({ success: true });
    } catch (err) {
        console.error('Auth email hook error:', err.message, err.stack);
        return res.status(500).json({ error: { http_code: 500, message: err.message } });
    }
};

module.exports = { sendWelcomeEmail, handleAuthEmail, createTransporter, FROM_DEFAULT };