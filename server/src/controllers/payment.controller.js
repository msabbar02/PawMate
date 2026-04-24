const stripe = process.env.STRIPE_SECRET_KEY
    ? require('stripe')(process.env.STRIPE_SECRET_KEY)
    : null;

const { supabase } = require('../config/supabase');

const createPaymentIntent = async (req, res, next) => {
    try {
        if (!stripe) {
            return res.status(503).json({ success: false, message: 'Payment service not configured' });
        }

        const { amount, currency = 'eur', reservationId } = req.body;

        if (!amount || typeof amount !== 'number' || amount <= 0) {
            return res.status(400).json({ success: false, message: 'A valid positive amount is required' });
        }

        // Validate the reservation belongs to the requesting user before charging
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
            amount: Math.round(amount * 100), // Stripe expects amounts in cents
            currency,
            payment_method_types: ['card'],
            metadata: reservationId ? { reservationId, userId: req.user.uid } : { userId: req.user.uid },
        });

        // Mark reservation as processing payment
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

const refundPayment = async (req, res, next) => {
    try {
        if (!stripe) {
            return res.status(503).json({ success: false, message: 'Payment service not configured' });
        }

        const { paymentIntentId, reservationId } = req.body;

        if (!paymentIntentId) {
            return res.status(400).json({ success: false, message: 'PaymentIntent ID is required' });
        }

        // Verify the requesting user owns the reservation linked to this payment
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

        // Update reservation paymentStatus to 'refunded' on success
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
 * Stripe webhook — payment_intent.succeeded → mark reservation as paid.
 * POST /api/payments/webhook
 * Raw body required (no express.json() on this route).
 */
const handleStripeWebhook = async (req, res) => {
    if (!stripe) {
        return res.status(503).json({ message: 'Payment service not configured' });
    }

    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
        console.warn('STRIPE_WEBHOOK_SECRET not set — skipping signature verification');
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
                    await supabase.from('reservations')
                        .update({
                            paymentStatus: 'paid',
                            paymentIntentId: paymentIntent.id,
                            // Auto-accept reservation once payment is confirmed
                            status: 'aceptada',
                        })
                        .eq('id', reservationId)
                        .in('paymentStatus', ['processing', 'pending']); // only update if not already paid
                    console.log(`✅ Payment confirmed for reservation ${reservationId}`);
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
                    console.warn(`❌ Payment failed for reservation ${reservationId}`);
                }
                break;
            }

            case 'charge.refunded': {
                // Handled via refundPayment controller, but also process webhook as fallback
                const charge = event.data.object;
                const paymentIntentId = charge.payment_intent;
                if (paymentIntentId) {
                    await supabase.from('reservations')
                        .update({ paymentStatus: 'refunded', status: 'cancelada' })
                        .eq('paymentIntentId', paymentIntentId)
                        .neq('paymentStatus', 'refunded'); // idempotent
                }
                break;
            }

            default:
                // Unhandled event type — no action needed
                break;
        }
    } catch (dbErr) {
        // Log but still return 200 so Stripe doesn't retry
        console.error('Webhook DB update error:', dbErr.message);
    }

    res.json({ received: true });
};

module.exports = {
    createPaymentIntent,
    refundPayment,
    handleStripeWebhook,
};
