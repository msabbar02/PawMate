require('dotenv').config();
const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/error.middleware');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// ── Rate limiting ──────────────────────────────────────────────────────────
// Protect all API routes from brute-force and abuse
let apiLimiter = null;
try {
    const rateLimit = require('express-rate-limit');
    apiLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 200,                  // max 200 requests per window per IP
        standardHeaders: true,
        legacyHeaders: false,
        message: { success: false, message: 'Too many requests, please try again later.' },
        skip: (req) => req.path === '/api/health', // health check is unlimited
    });
    console.log('Rate limiting enabled');
} catch {
    console.warn(' express-rate-limit not installed — rate limiting disabled');
}

// ── CORS ───────────────────────────────────────────────────────────────────
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
        // Allow requests with no origin (mobile apps, curl, server-to-server)
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        cb(null, false);
    },
}));

// ── Body parsers ───────────────────────────────────────────────────────────
// Raw body for Stripe webhook signature verification (must come before express.json)
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// JSON body parser for all other routes
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true }));

// ── Apply rate limiter ─────────────────────────────────────────────────────
if (apiLimiter) app.use('/api', apiLimiter);

// ── API Routes ─────────────────────────────────────────────────────────────
app.use('/api', routes);

// 404 Handler
app.use(notFoundHandler);

// Global Error Handler
app.use(errorHandler);

// Start server (only in non-serverless environments)
if (process.env.VERCEL !== '1') {
    app.listen(PORT, () => {
        console.log(`PawMate API server running on port ${PORT}`);
        console.log(`Health check: http://localhost:${PORT}/api/health`);
    });
}

// Export for Vercel serverless
module.exports = app;
