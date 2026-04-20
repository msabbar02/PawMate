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

        // Create a PaymentIntent with the order amount and currency
        // Only allow Google Pay and Apple Pay (wallet-based payment methods)
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Stripe expects amounts in cents
            currency: currency,
            payment_method_types: ['card'],
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
                .select('ownerId')
                .eq('id', reservationId)
                .single();
            if (!reservation || reservation.ownerId !== req.user.uid) {
                return res.status(403).json({ success: false, message: 'Not authorized to refund this payment' });
            }
        }

        const refund = await stripe.refunds.create({
            payment_intent: paymentIntentId,
        });

        res.json({
            success: true,
            refundId: refund.id,
            status: refund.status,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createPaymentIntent,
    refundPayment
};
