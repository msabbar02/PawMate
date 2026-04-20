require('dotenv').config();
const express = require('express');
const cors = require('cors');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/error.middleware');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
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
app.use(express.json({ limit: '100kb' })); // Parse JSON bodies with explicit size limit
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// API Routes
app.use('/api', routes);

// 404 Handler
app.use(notFoundHandler);

// Global Error Handler
app.use(errorHandler);

// Start server (only in non-serverless environments)
if (process.env.VERCEL !== '1') {
    app.listen(PORT, () => {
        console.log(`🚀 PawMate API server running on port ${PORT}`);
        console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
    });
}

// Export for Vercel serverless
module.exports = app;
