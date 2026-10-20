require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const morgan = require('morgan');

const logger = require('./config/logger');
const db = require('./config/database');
const { register } = require('./config/metrics');
const metricsMiddleware = require('./middlewares/metricsMiddleware');
const { injectUser } = require('./middlewares/auth');

// Routers
const movieController = require('./controllers/movieController');
const authRoutes = require('./routes/authRoutes');
const movieRoutes = require('./routes/movieRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Cấu hình View Engine (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Cấu hình static assets
app.use(express.static(path.join(__dirname, 'public')));

// Parser
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session Management
app.use(session({
    secret: process.env.SESSION_SECRET || 'CinemaSecureSessionKey_2026_DTC245200120',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE === 'true',
        maxAge: 24 * 60 * 60 * 1000 // 1 ngày
    }
}));

// Winston HTTP Request logger format
app.use(morgan('combined', {
    stream: {
        write: (message) => logger.info(message.trim())
    },
    skip: (req) => req.path === '/healthz' || req.path === '/metrics'
}));

// Prometheus Metrics Middleware
app.use(metricsMiddleware);

// Inject User to views
app.use(injectUser);

// -------------------------------------------------------------
// SYSTEM ENDPOINTS (Health check & Prometheus Metrics)
// -------------------------------------------------------------
app.get('/metrics', async (req, res) => {
    try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
    } catch (err) {
        logger.error(`Error generating Prometheus metrics: ${err.message}`);
        res.status(500).end(err.message);
    }
});

app.get('/healthz', async (req, res) => {
    const dbStatus = await db.testConnection();
    const status = dbStatus.success ? 200 : 503;
    res.status(status).json({
        status: dbStatus.success ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: dbStatus.success ? 'connected' : 'disconnected',
        student: {
            name: 'Nguyen Duy Truong',
            id: 'DTC245200120',
            class: 'CNTTK23E',
            topic: 'De 11 - He thong Dat ve Xem phim / Su kien'
        }
    });
});

// -------------------------------------------------------------
// APPLICATION ROUTES
// -------------------------------------------------------------
app.get('/', movieController.getHome);
app.use('/auth', authRoutes);
app.use('/movies', movieRoutes);
app.use('/booking', bookingRoutes);
app.use('/admin', adminRoutes);

// About / Information page
app.get('/about', (req, res) => {
    res.render('about', {
        title: 'Giới thiệu Dự án Đề 11 - Triển khai & Quản trị Hệ thống'
    });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).render('error', {
        title: 'Trang không tồn tại - 404',
        statusCode: 404,
        message: 'Đường dẫn bạn yêu cầu không tồn tại trên hệ thống.'
    });
});

// 500 Global Error Handler
app.use((err, req, res, next) => {
    logger.error(`Unhandled Application Error: ${err.message}`, { stack: err.stack, path: req.path });
    res.status(500).render('error', {
        title: 'Lỗi máy chủ nội bộ - 500',
        statusCode: 500,
        message: process.env.NODE_ENV === 'production'
            ? 'Đã xảy ra lỗi trong quá trình xử lý yêu cầu.'
            : err.message
    });
});

// Start Server
let server = null;
if (require.main === module) {
    server = app.listen(PORT, '0.0.0.0', () => {
        logger.info(`=======================================================`);
        logger.info(`Cinema Booking Application running on port ${PORT}`);
        logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
        logger.info(`Student: Nguyen Duy Truong - DTC245200120 - CNTTK23E`);
        logger.info(`Health check: http://localhost:${PORT}/healthz`);
        logger.info(`Metrics:      http://localhost:${PORT}/metrics`);
        logger.info(`=======================================================`);
    });

    // Graceful Shutdown
    const shutdown = (signal) => {
        logger.info(`${signal} received. Closing HTTP server gracefully...`);
        server.close(() => {
            logger.info('HTTP server closed.');
            process.exit(0);
        });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = app;

