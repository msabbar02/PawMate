/**
 * Controlador de pagos con Stripe.
 *
 * Crea PaymentIntents asociados a una reserva, procesa reembolsos y
 * recibe el webhook de Stripe para sincronizar el estado de pago en la
 * base de datos. Si `STRIPE_SECRET_KEY` no está definida, los endpoints
 * responden 503 sin romper el resto del servidor.
 */
const stripe = process.env.STRIPE_SECRET_KEY
    ? require('stripe')(process.env.STRIPE_SECRET_KEY)
    : null;

const { supabase } = require('../config/supabase');

/**
 * POST /api/payments/create-intent
 *
 * Crea un PaymentIntent en Stripe para cobrar una reserva. Verifica que el
 * importe es positivo, que la reserva existe y pertenece al usuario y que
 * aún no ha sido pagada. Marca la reserva como `processing` mientras se cobra.
 *
 * @param {import('express').Request}  req  Cuerpo: `{ amount, currency?, reservationId? }`.
 * @param {import('express').Response} res  Devuelve `{ clientSecret }` en éxito.
 * @param {Function}                   next Siguiente middleware (gestiona errores).
 */
const createPaymentIntent = async (req, res, next) => {
    try {
        if (!stripe) {
            return res.status(503).json({ success: false, message: 'Payment service not configured' });
        }

        const { amount, currency = 'eur', reservationId } = req.body;

        if (!amount || typeof amount !== 'number' || amount <= 0) {
            return res.status(400).json({ success: false, message: 'A valid positive amount is required' });
        }

        // Valida que la reserva pertenece al usuario que hace la petición antes de cobrar.
        if (reservationId) {
            const { data: reservation } = await supabase
                .from('reservations')
                .select('ownerId, status, paymentStatus')
                .eq('id', reservationId)
                .single();

            if (!reservation) {
                return res.status(404).json({ success: false, message: 'Reservation not found' });
            }
            if (reservation.ownerId !== req.user.uid) {
                return res.status(403).json({ success: false, message: 'Not authorized to pay for this reservation' });
            }
            if (reservation.paymentStatus === 'paid') {
                return res.status(409).json({ success: false, message: 'This reservation has already been paid' });
            }
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Stripe espera importes en céntimos.
            currency,
            payment_method_types: ['card'],
            metadata: reservationId ? { reservationId, userId: req.user.uid } : { userId: req.user.uid },
        });

        // Marca la reserva como pago en proceso.
        if (reservationId) {
            await supabase.from('reservations')
                .update({ paymentStatus: 'processing', paymentIntentId: paymentIntent.id })
                .eq('id', reservationId);
        }

        res.json({
            success: true,
            clientSecret: paymentIntent.client_secret,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/payments/refund
 *
 * Solicita el reembolso de un pago en Stripe. Verifica que la reserva
 * pertenece al usuario y no estaba ya reembolsada; si el reembolso tiene
 * éxito marca la reserva como cancelada y reembolsada.
 *
 * @param {import('express').Request}  req  Cuerpo: `{ paymentIntentId, reservationId? }`.
 * @param {import('express').Response} res  Devuelve `{ refundId, status }`.
 * @param {Function}                   next Siguiente middleware (gestiona errores).
 */
const refundPayment = async (req, res, next) => {
    try {
        if (!stripe) {
            return res.status(503).json({ success: false, message: 'Payment service not configured' });
        }

        const { paymentIntentId, reservationId } = req.body;

        if (!paymentIntentId) {
            return res.status(400).json({ success: false, message: 'PaymentIntent ID is required' });
        }

        // Verifica que el usuario que pide el reembolso es dueño de la reserva asociada al pago.
        if (reservationId) {
            const { data: reservation } = await supabase
                .from('reservations')
                .select('ownerId, status, paymentStatus')
                .eq('id', reservationId)
                .single();

            if (!reservation || reservation.ownerId !== req.user.uid) {
                return res.status(403).json({ success: false, message: 'Not authorized to refund this payment' });
            }
            if (reservation.paymentStatus === 'refunded') {
                return res.status(409).json({ success: false, message: 'This payment has already been refunded' });
            }
        }

        const refund = await stripe.refunds.create({
            payment_intent: paymentIntentId,
        });

        // Actualiza paymentStatus de la reserva a 'refunded' si tiene éxito.
        if (reservationId && refund.status !== 'failed') {
            await supabase.from('reservations')
                .update({
                    paymentStatus: 'refunded',
                    status: 'cancelada',
                })
                .eq('id', reservationId);
        }

        res.json({
            success: true,
            refundId: refund.id,
            status: refund.status,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POST /api/payments/webhook
 *
 * Webhook de Stripe. Procesa los eventos `payment_intent.succeeded`,
 * `payment_intent.payment_failed` y `charge.refunded` para mantener
 * sincronizado `paymentStatus` y `status` en `reservations`.
 *
 * IMPORTANTE: requiere cuerpo raw (sin `express.json` previo) y siempre
 * responde 200 aunque la actualización a BD falle, para que Stripe no reintente.
 *
 * @param {import('express').Request}  req Webhook de Stripe (cuerpo raw).
 * @param {import('express').Response} res Respuesta `{ received: true }`.
 */
const handleStripeWebhook = async (req, res) => {
    if (!stripe) {
        return res.status(503).json({ message: 'Payment service not configured' });
    }

    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    // En producción la verificación de firma es obligatoria: sin secret, rechazamos.
    if (!webhookSecret) {
        if (process.env.NODE_ENV === 'production') {
            console.error('STRIPE_WEBHOOK_SECRET no configurado en producción — webhook rechazado');
            return res.status(503).json({ message: 'Webhook signing not configured' });
        }
        console.warn('STRIPE_WEBHOOK_SECRET not set — skipping signature verification (dev only)');
    }

    let event;
    try {
        event = webhookSecret
            ? stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
            : JSON.parse(req.body.toString());
    } catch (err) {
        console.error('Stripe webhook signature error:', err.message);
        return res.status(400).json({ message: `Webhook Error: ${err.message}` });
    }

    try {
        switch (event.type) {
            case 'payment_intent.succeeded': {
                const paymentIntent = event.data.object;
                const reservationId = paymentIntent.metadata?.reservationId;
                if (reservationId) {
                    // Solo actualiza paymentStatus. El status de la reserva (pendiente/aceptada)
                    // sigue siendo decisión del cuidador; no lo cambiamos desde el webhook.
                    await supabase.from('reservations')
                        .update({
                            paymentStatus: 'paid',
                            paymentIntentId: paymentIntent.id,
                        })
                        .eq('id', reservationId)
                        .in('paymentStatus', ['processing', 'pending']);
                    console.log(`Payment confirmed for reservation ${reservationId}`);
                }
                break;
            }

            case 'payment_intent.payment_failed': {
                const paymentIntent = event.data.object;
                const reservationId = paymentIntent.metadata?.reservationId;
                if (reservationId) {
                    await supabase.from('reservations')
                        .update({ paymentStatus: 'failed' })
                        .eq('id', reservationId);
                    console.warn(`Payment failed for reservation ${reservationId}`);
                }
                break;
            }

            case 'charge.refunded': {
                // Gestionado por el controlador refundPayment, pero también procesamos el webhook como respaldo.
                const charge = event.data.object;
                const paymentIntentId = charge.payment_intent;
                if (paymentIntentId) {
                    await supabase.from('reservations')
                        .update({ paymentStatus: 'refunded', status: 'cancelada' })
                        .eq('paymentIntentId', paymentIntentId)
                        .neq('paymentStatus', 'refunded'); // idempotente.
                }
                break;
            }

            default:
                // Tipo de evento no gestionado: no hace falta acción.
                break;
        }
    } catch (dbErr) {
        // Devolvemos 500 para que Stripe reintente con backoff y no perdamos sincronía.
        console.error('Webhook DB update error:', dbErr.message);
        return res.status(500).json({ message: 'Webhook processing failed' });
    }

    res.json({ received: true });
};

module.exports = {
    createPaymentIntent,
    refundPayment,
    handleStripeWebhook,
};
