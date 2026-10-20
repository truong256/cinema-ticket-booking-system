const winston = require('winston');
const fs = require('fs');
const path = require('path');

// Đảm bảo thư mục log tồn tại
const logDir = process.env.LOG_DIR || (process.env.NODE_ENV === 'production' ? '/var/log/app' : path.join(__dirname, '../../logs'));
try {
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
} catch (e) {
    console.warn('Could not create log directory:', logDir, e.message);
}

const logFile = path.join(logDir, 'app.log');

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'cinema-booking-app' },
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
                    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
                    return `[${timestamp}] [${level}] [${service}]: ${message}${metaStr}`;
                })
            )
        })
    ]
});

// Thêm file transport nếu thư mục log khả dụng
try {
    logger.add(new winston.transports.File({
        filename: logFile,
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5
    }));
} catch (e) {
    console.warn('Failed to add file transport to logger:', e.message);
}

module.exports = logger;
