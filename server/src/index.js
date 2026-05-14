/**
 * Punto de entrada del servidor PawMate API.
 *
 * Configura Express con CORS, limitador de tasa, parsers de cuerpo,
 * el webhook raw de Stripe y los manejadores globales de error/404.
 * Se ejecuta como servidor HTTP en local y como función serverless en Vercel.
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/error.middleware');

const app = express();
const PORT = process.env.PORT || 3000;

/**
 * Cabeceras de seguridad HTTP (CSP mínima, HSTS, X-Frame-Options, etc.).
 * Si el paquete `helmet` no está instalado el servidor sigue arrancando.
 */
try {
    const helmet = require('helmet');
    app.use(helmet({
        // Desactivamos COEP para no romper recursos cross-origin de Supabase/Stripe.
        crossOriginEmbedderPolicy: false,
    }));
    console.log('Helmet enabled');
} catch {
    console.warn(' helmet no instalado — cabeceras de seguridad desactivadas (npm i helmet)');
}

/**
 * Limitador de tasa global para mitigar fuerza bruta y abuso.
 * Si el paquete `express-rate-limit` no está instalado se desactiva sin romper el arranque.
 */
let apiLimiter = null;
let authLimiter = null;
let paymentLimiter = null;
try {
    const rateLimit = require('express-rate-limit');
    apiLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 200,
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, message: 'Too many requests, please try again later.' },
        skip: (req) => req.path === '/api/health',
    });
    // Limitador estricto para endpoints sensibles a fuerza bruta.
    authLimiter = rateLimit({
        windowMs: 5 * 60 * 1000,
        max: 20,
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, message: 'Too many authentication attempts, please try again later.' },
    });
    paymentLimiter = rateLimit({
        windowMs: 1 * 60 * 1000,
        max: 10,
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, message: 'Too many payment attempts, please slow down.' },
    });
    console.log('Rate limiting enabled');
} catch {
    console.warn(' express-rate-limit no instalado — limitador de tasa desactivado');
}

/**
 * Lista blanca de orígenes permitidos por CORS.
 * En desarrollo se añaden los puertos típicos de Vite y CRA.
 */
const allowedOrigins = [
    'https://apppawmate.com',
    'https://www.apppawmate.com',
    'https://admin.apppawmate.com',
    'https://api.apppawmate.com',
];
if (process.env.NODE_ENV !== 'production') {
    allowedOrigins.push('http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174');
}
app.use(cors({
    origin: (origin, cb) => {
        // Permite peticiones sin origen (apps móviles, curl, server-to-server).
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        cb(null, false);
    },
}));

// El webhook de Stripe necesita el cuerpo raw para verificar la firma; debe registrarse antes del parser JSON.
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// Parser JSON con límite estricto para evitar abuso de memoria.
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true }));

if (apiLimiter) app.use('/api', apiLimiter);
if (authLimiter) app.use('/api/auth', authLimiter);
if (paymentLimiter) {
    app.use('/api/payments/payment-intent', paymentLimiter);
    app.use('/api/payments/refund', paymentLimiter);
}

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

// Solo arranca el servidor HTTP fuera de entornos serverless (Vercel).
if (process.env.VERCEL !== '1') {
    app.listen(PORT, () => {
        console.log(`PawMate API server running on port ${PORT}`);
        console.log(`Health check: http://localhost:${PORT}/api/health`);
    });
}

module.exports = app;
