const mysql = require('mysql2/promise');
const logger = require('./logger');

const dbConfig = {
    host: process.env.DB_HOST || 'mysql',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'cinema_user',
    password: process.env.DB_PASSWORD || 'CinemaSecurePass2026!',
    database: process.env.DB_NAME || 'cinema_db',
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '20', 10),
    queueLimit: 0,
    connectTimeout: 10000,
    timezone: '+07:00',
    charset: 'utf8mb4'
};

let pool = null;

function getPool() {
    if (!pool) {
        pool = mysql.createPool(dbConfig);
        logger.info(`Database connection pool initialized for host: ${dbConfig.host}:${dbConfig.port}, db: ${dbConfig.database}`);
    }
    return pool;
}

// Hàm thực thi truy vấn an toàn
async function query(sql, params = []) {
    const p = getPool();
    const startTime = Date.now();
    try {
        const [results] = await p.query(sql, params);
        const duration = Date.now() - startTime;
        if (duration > 500) {
            logger.warn(`Slow query (${duration}ms): ${sql}`);
        }
        return results;
    } catch (error) {
        logger.error(`Database query error: ${error.message}`, { sql, params });
        throw error;
    }
}

// Lấy connection để thực hiện Transaction
async function getConnection() {
    const p = getPool();
    return await p.getConnection();
}

// Kiểm tra kết nối DB
async function testConnection() {
    try {
        const p = getPool();
        const [rows] = await p.query('SELECT 1 AS connected, NOW() AS server_time');
        logger.info('Database connection verified successfully:', rows[0]);
        return { success: true, data: rows[0] };
    } catch (error) {
        logger.error(`Database connection check failed: ${error.message}`);
        return { success: false, error: error.message };
    }
}

module.exports = {
    getPool,
    query,
    getConnection,
    testConnection,
    dbConfig
};
