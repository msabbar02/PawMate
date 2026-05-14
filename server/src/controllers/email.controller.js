/**
 * Controlador de envío de emails transaccionales (Resend).
 *
 * Define las plantillas HTML reutilizables (layout, botón, nota de expiración)
 * y los handlers HTTP para los emails de bienvenida, hooks de Supabase Auth
 * (signup, recovery, cambio de email) y aviso de baneo.
 */
const { Resend } = require('resend');
const { sendSuccess, sendError } = require('../utils/response');

// Direcciones FROM compartidas, configurables por variable de entorno.
const FROM_DEFAULT = process.env.EMAIL_FROM         || 'PawMate <noreply@apppawmate.com>';
const FROM_SUPPORT = process.env.EMAIL_FROM_SUPPORT  || 'PawMate Soporte <soporte@apppawmate.com>';
const FROM_ADMIN   = process.env.EMAIL_FROM_ADMIN    || 'PawMate Admin <admin@apppawmate.com>';

const LOGO_URL = process.env.APP_LOGO_URL || 'https://apppawmate.com/icon.png';

/** Cliente de Resend reutilizado entre envíos (instanciar uno por petición es caro). */
let resendClient = null;
function getResend() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return null;
    if (!resendClient) resendClient = new Resend(apiKey);
    return resendClient;
}

/**
 * Envía un email vía Resend. Lanza error si falta la API key o falla el envío,
 * para que los handlers superiores puedan capturarlo y responder con coherencia.
 *
 * @param {Object} opts          Opciones del email.
 * @param {string} opts.from     Remitente.
 * @param {string} opts.to       Destinatario.
 * @param {string} opts.subject  Asunto.
 * @param {string} opts.html     Cuerpo HTML.
 * @param {string} [opts.text]   Cuerpo en texto plano (fallback).
 * @returns {Promise<Object>}    Respuesta de Resend con el id del envío.
 */
async function sendEmail({ from, to, subject, html, text }) {
    const resend = getResend();
    if (!resend) {
        console.error('[Email] RESEND_API_KEY not set — email will not be sent');
        throw new Error('RESEND_API_KEY not configured');
    }
    const { data, error } = await resend.emails.send({ from, to, subject, html, text });
    if (error) {
        console.error('[Email] Resend error:', error);
        throw new Error(error.message || JSON.stringify(error));
    }
    console.log('[Email] Sent OK id=', data?.id, '→', to);
    return data;
}

/**
 * Shim de compatibilidad para `notifications.controller.js`, que espera
 * un objeto con método `sendMail` al estilo de Nodemailer.
 *
 * @returns {{ sendMail: Function }} Adaptador mínimo sobre `sendEmail`.
 */
function createTransporter() {
    return {
        sendMail: (opts) => sendEmail(opts),
    };
}

/**
 * Escapa caracteres HTML para evitar inyección cuando se interpolan datos
 * de usuario en las plantillas de email.
 *
 * @param {string} str Texto a sanear.
 * @returns {string}   Texto seguro para incrustar en HTML.
 */
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
 * Construye el layout HTML común a todos los emails (logo, cabecera con
 * gradiente, cuerpo y pie con copyright).
 *
 * @param {Object} opts            Datos de la cabecera y cuerpo del email.
 * @param {string} opts.icon       Emoji o icono grande de la cabecera.
 * @param {string} opts.title      Título principal.
 * @param {string} [opts.subtitle] Subtítulo opcional.
 * @param {string} opts.gradient   CSS de gradiente para la cabecera.
 * @param {string} opts.body       HTML del cuerpo principal.
 * @returns {string}               Documento HTML completo.
 */
function emailLayout({ icon, title, subtitle, gradient, body }) {
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 20px;">
    <div style="background:white;border-radius:24px 24px 0 0;padding:18px 30px 14px;text-align:center;border-bottom:1px solid #f1f5f9;">
      <img src="${LOGO_URL}" alt="PawMate" style="height:50px;width:auto;" />
    </div>
    <div style="background:linear-gradient(135deg,${gradient});padding:32px 30px 40px;text-align:center;">
      <div style="font-size:52px;margin-bottom:12px;">${icon}</div>
      <h1 style="color:white;font-size:26px;margin:0 0 8px;font-weight:800;">${title}</h1>
      ${subtitle ? `<p style="color:rgba(255,255,255,0.85);font-size:15px;margin:0;">${subtitle}</p>` : ''}
    </div>
    <div style="background:white;border-radius:0 0 24px 24px;padding:36px 30px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
      ${body}
    </div>
    <div style="text-align:center;margin-top:20px;">
      <img src="${LOGO_URL}" alt="PawMate" style="height:28px;width:auto;opacity:0.45;margin-bottom:8px;" />
      <p style="color:#94a3b8;font-size:12px;margin:4px 0 0;">
        &copy; ${new Date().getFullYear()} PawMate &middot; <a href="https://apppawmate.com" style="color:#94a3b8;text-decoration:none;">apppawmate.com</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Genera un botón CTA estilizado.
 *
 * @param {string} url     URL destino del botón.
 * @param {string} label   Texto del botón.
 * @param {string} [color] Color de fondo (por defecto morado).
 * @returns {string}       Snippet HTML del botón.
 */
function emailButton(url, label, color = '#6366f1') {
    return `<div style="text-align:center;margin:28px 0;">
      <a href="${url}" style="display:inline-block;background:${color};color:white;font-size:16px;font-weight:600;padding:14px 36px;border-radius:12px;text-decoration:none;">${label}</a>
    </div>`;
}

/**
 * Nota legal corta indicando que el enlace expira en 24 h.
 *
 * @returns {string} Snippet HTML de la nota.
 */
function expiryNote() {
    return `<p style="color:#94a3b8;font-size:12px;text-align:center;margin:16px 0 0;">Este enlace expira en 24 horas. Si no has solicitado esto, puedes ignorar este email.</p>`;
}

/**
 * POST /api/notifications/welcome-email
 *
 * Envía el email de bienvenida tras el registro. Nunca falla la respuesta
 * por errores de envío: devuelve `{ sent: false }` para que el cliente
 * pueda reintentarlo o ignorarlo según convenga.
 *
 * @param {import('express').Request}  req Petición con `{ email, fullName }`.
 * @param {import('express').Response} res Respuesta JSON estándar.
 */
const sendWelcomeEmail = async (req, res) => {
    try {
        const { email, fullName } = req.body;
        if (!email || !email.includes('@')) {
            return sendError(res, 'email is required', 400);
        }

        const name = escapeHtml(fullName || email.split('@')[0]);
        let sent = false;
        try {
            await sendEmail({
                from: FROM_DEFAULT,
                to: email,
                subject: `¡Bienvenido a PawMate, ${name}! `,
                html: emailLayout({
                    icon: '',
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
          <span style="font-size:24px;margin-right:12px;"></span>
          <div><strong style="color:#1e293b;">Radar de Cuidadores</strong><p style="color:#64748b;margin:4px 0 0;font-size:13px;">Encuentra cuidadores cercanos verificados</p></div>
        </div>
        <div style="display:flex;margin-bottom:12px;align-items:center;">
          <span style="font-size:24px;margin-right:12px;"></span>
          <div><strong style="color:#1e293b;">Reservas</strong><p style="color:#64748b;margin:4px 0 0;font-size:13px;">Agenda paseos y servicios de hotel</p></div>
        </div>
        <div style="display:flex;align-items:center;">
          <span style="font-size:24px;margin-right:12px;"></span>
          <div><strong style="color:#1e293b;">Botón SOS</strong><p style="color:#64748b;margin:4px 0 0;font-size:13px;">Emergencias durante paseos activos</p></div>
        </div>
      </div>
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px;">
        Para acceder a todas las funciones, verifica tu cuenta en la sección de Ajustes de la app.
      </p>
      <p style="color:#64748b;font-size:14px;margin:0;">
        ¿Necesitas ayuda? Escríbenos a <a href="mailto:soporte@apppawmate.com" style="color:#6366f1;">soporte@apppawmate.com</a>
      </p>`,
                }),
                text: `¡Bienvenido a PawMate, ${name}!\n\nNos alegra tenerte en la familia PawMate.\n\nVerifica tu cuenta en Ajustes para acceder a todas las funciones.\n\n¿Necesitas ayuda? soporte@apppawmate.com\n\n© ${new Date().getFullYear()} PawMate`,
            });
            sent = true;
        } catch (emailErr) {
            console.error('Welcome email send error:', emailErr.message);
        }

        return sendSuccess(res, { sent }, sent ? 'Welcome email sent' : 'Could not send email');
    } catch (error) {
        console.error('sendWelcomeEmail error:', error);
        return sendError(res, 'Error sending welcome email', 500);
    }
};

/**
 * POST /api/notifications/auth-email
 *
 * Hook de Supabase Auth: recibe los eventos de signup, magiclink, recovery
 * y email_change y envía emails personalizados con la marca PawMate en lugar
 * de los emails por defecto de Supabase.
 *
 * Verifica la firma JWT del webhook usando `SUPABASE_AUTH_HOOK_SECRET`.
 *
 * @param {import('express').Request}  req Petición del webhook de Supabase.
 * @param {import('express').Response} res Respuesta acorde al contrato del hook.
 */
const handleAuthEmail = async (req, res) => {
    try {
        const hookSecret = process.env.SUPABASE_AUTH_HOOK_SECRET;
        if (!hookSecret) {
            console.error('SUPABASE_AUTH_HOOK_SECRET is not set');
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
            jwt.verify(authHeader.replace('Bearer ', ''), Buffer.from(secret, 'base64'));
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

        if (email_action_type === 'signup') {
            await sendEmail({
                from: FROM_DEFAULT,
                to: user.email,
                subject: `¡Confirma tu cuenta en PawMate, ${userName}! `,
                html: emailLayout({
                    icon: '', title: '¡Bienvenido a PawMate!',
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
                }),
                text: `Hola ${userName},\n\nConfirma tu cuenta: ${confirmUrl}\n\nExpira en 24h.\n\n© ${new Date().getFullYear()} PawMate`,
            });
        }

        else if (email_action_type === 'magiclink') {
            await sendEmail({
                from: FROM_DEFAULT,
                to: user.email,
                subject: 'Tu enlace de acceso a PawMate ',
                html: emailLayout({
                    icon: '', title: 'Tu enlace de acceso',
                    subtitle: 'Inicia sesión con un solo clic',
                    gradient: '#6366f1 0%, #8b5cf6 100%',
                    body: `
      <h2 style="color:#1e293b;font-size:22px;margin:0 0 16px;">Hola ${userName},</h2>
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 8px;">Haz clic en el botón para acceder a tu cuenta:</p>
      ${emailButton(confirmUrl, 'Iniciar sesión')}
      <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0 0 8px;">Si el botón no funciona, copia y pega este enlace:</p>
      <p style="word-break:break-all;color:#6366f1;font-size:12px;margin:0 0 16px;">${confirmUrl}</p>
      ${expiryNote()}`,
                }),
                text: `Hola ${userName},\n\nInicia sesión: ${confirmUrl}\n\nExpira en 24h.\n\n© ${new Date().getFullYear()} PawMate`,
            });
        }

        else if (email_action_type === 'email_change') {
            await sendEmail({
                from: FROM_SUPPORT,
                to: user.email,
                subject: 'Confirma tu cambio de email · PawMate ',
                html: emailLayout({
                    icon: '', title: 'Cambio de email',
                    subtitle: 'Confirma esta acción de seguridad',
                    gradient: '#ef4444 0%, #f97316 100%',
                    body: `
      <h2 style="color:#1e293b;font-size:22px;margin:0 0 16px;">Hola ${userName},</h2>
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 8px;">Has solicitado cambiar el correo de tu cuenta PawMate. Confirma este cambio:</p>
      ${emailButton(confirmUrl, 'Confirmar cambio de email', '#ef4444')}
      <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0 0 8px;">Si el botón no funciona, copia y pega este enlace:</p>
      <p style="word-break:break-all;color:#ef4444;font-size:12px;margin:0 0 16px;">${confirmUrl}</p>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px;margin:16px 0;">
        <p style="color:#991b1b;font-size:13px;margin:0;"><strong>¿No has sido tú?</strong> Ignora este email y cambia tu contraseña.</p>
      </div>
      ${expiryNote()}`,
                }),
                text: `Hola ${userName},\n\nConfirma el cambio: ${confirmUrl}\n\n© ${new Date().getFullYear()} PawMate`,
            });

            if (token_hash_new) {
                const newConfirmUrl = buildLink(token_hash_new, email_action_type);
                await sendEmail({
                    from: FROM_SUPPORT,
                    to: user.new_email || user.email_change_send_to || user.email,
                    subject: 'Confirma tu nuevo email · PawMate ',
                    html: emailLayout({
                        icon: '', title: 'Confirma tu nuevo email',
                        subtitle: 'Verifica que esta dirección es tuya',
                        gradient: '#ef4444 0%, #f97316 100%',
                        body: `
      <h2 style="color:#1e293b;font-size:22px;margin:0 0 16px;">Hola ${userName},</h2>
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 8px;">Confirma esta dirección como tu nuevo correo en PawMate.</p>
      ${emailButton(newConfirmUrl, 'Confirmar nuevo email', '#ef4444')}
      <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0 0 8px;">Si el botón no funciona, copia y pega este enlace:</p>
      <p style="word-break:break-all;color:#ef4444;font-size:12px;margin:0 0 16px;">${newConfirmUrl}</p>
      ${expiryNote()}`,
                    }),
                    text: `Hola ${userName},\n\nConfirma: ${newConfirmUrl}\n\n© ${new Date().getFullYear()} PawMate`,
                });
            }
        }

        else if (email_action_type === 'recovery') {
            await sendEmail({
                from: FROM_SUPPORT,
                to: user.email,
                subject: 'Restablecer tu contraseña · PawMate ',
                html: emailLayout({
                    icon: '', title: 'Restablecer contraseña',
                    subtitle: 'Recupera el acceso a tu cuenta',
                    gradient: '#f59e0b 0%, #f97316 100%',
                    body: `
      <h2 style="color:#1e293b;font-size:22px;margin:0 0 16px;">Hola ${userName},</h2>
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 8px;">Haz clic para crear una nueva contraseña:</p>
      ${emailButton(confirmUrl, 'Restablecer contraseña', '#f59e0b')}
      <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0 0 8px;">Si el botón no funciona, copia y pega este enlace:</p>
      <p style="word-break:break-all;color:#f59e0b;font-size:12px;margin:0 0 16px;">${confirmUrl}</p>
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px;margin:16px 0;">
        <p style="color:#92400e;font-size:13px;margin:0;"><strong>Consejo:</strong> Usa una contraseña única de al menos 8 caracteres.</p>
      </div>
      ${expiryNote()}`,
                }),
                text: `Hola ${userName},\n\nRestablece: ${confirmUrl}\n\nExpira en 24h.\n\n© ${new Date().getFullYear()} PawMate`,
            });
        }

        else {
            await sendEmail({
                from: FROM_DEFAULT,
                to: user.email,
                subject: 'Acción requerida · PawMate',
                html: emailLayout({
                    icon: '', title: 'PawMate', subtitle: '',
                    gradient: '#6366f1 0%, #8b5cf6 100%',
                    body: `
      <h2 style="color:#1e293b;font-size:22px;margin:0 0 16px;">Hola ${userName},</h2>
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 8px;">Haz clic en el enlace para continuar:</p>
      ${emailButton(confirmUrl, 'Continuar')}
      ${expiryNote()}`,
                }),
                text: `Hola ${userName},\n\nContinúa aquí: ${confirmUrl}\n\n© ${new Date().getFullYear()} PawMate`,
            });
        }

        console.log(`[Email] Auth hook [${email_action_type}] sent to ${user.email}`);
        return res.json({ success: true });
    } catch (err) {
        console.error('[Email] Auth hook error:', err.message, err.stack);
        return res.status(500).json({ error: { http_code: 500, message: err.message } });
    }
};

/**
 * POST /api/notifications/ban-email
 *
 * Notifica al usuario que su cuenta ha sido suspendida por el equipo de soporte.
 *
 * @param {import('express').Request}  req Petición con `{ email, fullName }`.
 * @param {import('express').Response} res Respuesta JSON estándar.
 */
const sendBanEmail = async (req, res) => {
    try {
        const { email, fullName } = req.body;
        if (!email || !email.includes('@')) return sendError(res, 'email is required', 400);
        const name = escapeHtml(fullName || email.split('@')[0]);
        let sent = false;
        try {
            await sendEmail({
                from: FROM_ADMIN,
                to: email,
                subject: 'Tu cuenta de PawMate ha sido suspendida',
                html: emailLayout({
                    icon: '🚫',
                    title: 'Cuenta suspendida',
                    subtitle: 'Tu acceso a PawMate ha sido restringido',
                    gradient: '#ef4444 0%, #b91c1c 100%',
                    body: `
      <h2 style="color:#1e293b;font-size:22px;margin:0 0 16px;">Hola ${name},</h2>
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 20px;">
        Tu cuenta en PawMate ha sido <strong style="color:#ef4444;">suspendida temporalmente</strong> por nuestro equipo de seguridad debido a una posible infracción de nuestros términos de uso.
      </p>
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:16px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:13px;color:#991b1b;font-weight:700;text-transform:uppercase;letter-spacing:.5px;">Motivo</p>
        <p style="margin:0;color:#7f1d1d;font-size:14px;line-height:1.6;">Razones de seguridad y protección de la comunidad PawMate.</p>
      </div>
      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px;">
        Si crees que esto es un error o deseas resolverlo, contáctanos. Nuestro equipo revisará tu caso en un plazo de 24–48 horas.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="mailto:soporte@apppawmate.com" style="display:inline-block;background:#ef4444;color:white;font-size:16px;font-weight:600;padding:14px 36px;border-radius:12px;text-decoration:none;">Contactar soporte</a>
      </div>
      <p style="color:#64748b;font-size:13px;margin:0;text-align:center;">
        O escríbenos a <a href="mailto:soporte@apppawmate.com" style="color:#ef4444;">soporte@apppawmate.com</a>
      </p>`,
                }),
                text: `Hola ${name},\n\nTu cuenta en PawMate ha sido suspendida temporalmente por razones de seguridad.\n\nSi crees que es un error, escríbenos a soporte@apppawmate.com\n\n© ${new Date().getFullYear()} PawMate`,
            });
            sent = true;
        } catch (emailErr) {
            console.error('[Email] Ban email error:', emailErr.message);
        }
        return sendSuccess(res, { sent }, sent ? 'Ban email sent' : 'Could not send email');
    } catch (error) {
        console.error('sendBanEmail error:', error);
        return sendError(res, 'Error sending ban email', 500);
    }
};

module.exports = { sendWelcomeEmail, handleAuthEmail, sendEmail, createTransporter, emailLayout, emailButton, escapeHtml, sendBanEmail, FROM_DEFAULT, FROM_SUPPORT, FROM_ADMIN };
