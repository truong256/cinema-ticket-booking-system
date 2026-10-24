/**
 * CineVibe - Standalone Database Migration Runner
 * Chạy trực tiếp: node config/migration.js
 * Hoặc qua npm:  npm run migrate (trong thư mục app/)
 *
 * Tính chất:
 * - An toàn để chạy lại nhiều lần (idempotent)
 * - Không xóa dữ liệu hiện có
 * - Kiểm tra information_schema trước khi ALTER
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const logger = require('./logger');

async function runMigrations(db) {
    logger.info('Checking database schema migrations...');

    async function addColumnIfNotExists(table, column, definition) {
        const rows = await db.query(
            `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
            [table, column]
        );
        if (rows.length === 0) {
            try {
                await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
                logger.info(`[Migration] Added column '${column}' to table '${table}'`);
            } catch (err) {
                logger.error(`[Migration Error] Failed adding column ${column} to ${table}: ${err.message}`);
                throw err;
            }
        }
    }

    async function addIndexIfNotExists(table, indexName, indexDefinition) {
        const rows = await db.query(
            `SELECT INDEX_NAME FROM information_schema.STATISTICS 
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
            [table, indexName]
        );
        if (rows.length === 0) {
            try {
                await db.query(`ALTER TABLE ${table} ADD INDEX ${indexName} ${indexDefinition}`);
                logger.info(`[Migration] Added index '${indexName}' to table '${table}'`);
            } catch (err) {
                logger.error(`[Migration Error] Failed adding index ${indexName} to ${table}: ${err.message}`);
                throw err;
            }
        }
    }

    // 1. Bookings table enhancements (Holding seats expiry, Guest IDOR token, Real QR check-in)
    await addColumnIfNotExists('bookings', 'expires_at', 'DATETIME NULL');
    await addColumnIfNotExists('bookings', 'booking_token', 'VARCHAR(64) NULL');
    await addColumnIfNotExists('bookings', 'checkin_status', "ENUM('pending', 'checked_in') DEFAULT 'pending'");
    await addColumnIfNotExists('bookings', 'checkin_at', 'DATETIME NULL');
    await addColumnIfNotExists('bookings', 'checkin_by', 'VARCHAR(50) NULL');

    await addIndexIfNotExists('bookings', 'idx_booking_expires', '(payment_status, expires_at)');
    await addIndexIfNotExists('bookings', 'idx_booking_token', '(booking_token)');

    // Populate tokens for existing bookings if missing (dùng crypto_random thay vì SHA2 dự đoán được)
    const pendingTokens = await db.query(
        "SELECT id FROM bookings WHERE booking_token IS NULL OR booking_token = '' LIMIT 1"
    );
    if (pendingTokens.length > 0) {
        await db.query(`
            UPDATE bookings 
            SET booking_token = SHA2(CONCAT(id, booking_code, UNIX_TIMESTAMP(created_at), UUID()), 256)
            WHERE booking_token IS NULL OR booking_token = ''
        `);
    }

    // 2. Users table enhancements (Password recovery dùng hashed token, account locking)
    await addColumnIfNotExists('users', 'reset_password_token', 'VARCHAR(100) NULL');
    await addColumnIfNotExists('users', 'reset_password_expires', 'DATETIME NULL');
    await addColumnIfNotExists('users', 'status', "ENUM('active', 'locked') DEFAULT 'active'");

    // 3. Cinemas & Rooms enhancements (Status toggling)
    await addColumnIfNotExists('cinemas', 'is_active', 'TINYINT(1) DEFAULT 1');
    await addColumnIfNotExists('rooms', 'is_active', 'TINYINT(1) DEFAULT 1');

    // 4. Timestamps chuẩn hóa
    await addColumnIfNotExists('bookings', 'updated_at', 'TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP');
    await addColumnIfNotExists('movies', 'updated_at', 'TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP');
    await addColumnIfNotExists('cinemas', 'updated_at', 'TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP');
    await addColumnIfNotExists('rooms', 'updated_at', 'TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP');
    await addColumnIfNotExists('showtimes', 'updated_at', 'TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP');
    await addColumnIfNotExists('users', 'updated_at', 'TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP');

    // 5. Xác thực cấu trúc bảng sau migration (Post-migration schema verification)
    const requiredSchema = [
        { table: 'bookings', column: 'expires_at' },
        { table: 'bookings', column: 'booking_token' },
        { table: 'bookings', column: 'checkin_status' },
        { table: 'users', column: 'reset_password_token' },
        { table: 'users', column: 'reset_password_expires' },
        { table: 'users', column: 'status' },
        { table: 'cinemas', column: 'is_active' },
        { table: 'rooms', column: 'is_active' }
    ];

    for (const item of requiredSchema) {
        const verifyRows = await db.query(
            `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
            [item.table, item.column]
        );
        if (verifyRows.length === 0) {
            throw new Error(`[Migration Verification] Column '${item.column}' on '${item.table}' does not exist after migration`);
        }
    }

    logger.info('Database migrations verified successfully with post-migration schema checks.');
}

module.exports = { runMigrations };

// Standalone mode: node config/migration.js
if (require.main === module) {
    const db = require('./database');
    runMigrations(db)
        .then(() => {
            logger.info('[Standalone] All migrations completed successfully.');
            process.exit(0);
        })
        .catch(err => {
            logger.error(`[Standalone] Migration failed: ${err.message}`);
            process.exit(1);
        });
}
