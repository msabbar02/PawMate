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

        if (!amount) {
            return res.status(400).json({ success: false, message: 'Amount is required' });
        }

        // Create a PaymentIntent with the order amount and currency
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Stripe expects amounts in cents
            currency: currency,
            automatic_payment_methods: {
                enabled: true,
            },
            metadata: reservationId ? { reservationId } : undefined,
        });

        // Update reservation paymentStatus if reservationId provided
        if (reservationId) {
            await supabase.from('reservations')
                .update({ paymentStatus: 'processing' })
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
        const { paymentIntentId } = req.body;

        if (!paymentIntentId) {
            return res.status(400).json({ success: false, message: 'PaymentIntent ID is required' });
        }

        const refund = await stripe.refunds.create({
            payment_intent: paymentIntentId,
        });

        res.json({
            success: true,
            refund,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createPaymentIntent,
    refundPayment
};
