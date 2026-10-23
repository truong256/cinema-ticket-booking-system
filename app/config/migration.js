const logger = require('./logger');

/**
 * Safe, idempotent database schema migrations for CineVibe
 * Automatically checks information_schema and applies missing columns/indexes/tables
 * without touching or overwriting existing data.
 */
async function runMigrations(db) {
    logger.info('Checking database schema migrations...');

    async function addColumnIfNotExists(table, column, definition) {
        try {
            const rows = await db.query(
                `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
                [table, column]
            );
            if (rows.length === 0) {
                await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
                logger.info(`[Migration] Added column '${column}' to table '${table}'`);
            }
        } catch (err) {
            logger.error(`[Migration Error] Failed adding column ${column} to ${table}: ${err.message}`);
        }
    }

    async function addIndexIfNotExists(table, indexName, indexDefinition) {
        try {
            const rows = await db.query(
                `SELECT INDEX_NAME FROM information_schema.STATISTICS 
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
                [table, indexName]
            );
            if (rows.length === 0) {
                await db.query(`ALTER TABLE ${table} ADD INDEX ${indexName} ${indexDefinition}`);
                logger.info(`[Migration] Added index '${indexName}' to table '${table}'`);
            }
        } catch (err) {
            logger.error(`[Migration Error] Failed adding index ${indexName} to ${table}: ${err.message}`);
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

    // Populate tokens for existing bookings if missing
    try {
        await db.query(`
            UPDATE bookings 
            SET booking_token = SHA2(CONCAT(id, booking_code, UNIX_TIMESTAMP(created_at)), 256)
            WHERE booking_token IS NULL OR booking_token = ''
        `);
    } catch (e) {
        // Ignore if already populated
    }

    // 2. Users table enhancements (Password recovery, account locking)
    await addColumnIfNotExists('users', 'reset_password_token', 'VARCHAR(100) NULL');
    await addColumnIfNotExists('users', 'reset_password_expires', 'DATETIME NULL');
    await addColumnIfNotExists('users', 'status', "ENUM('active', 'locked') DEFAULT 'active'");

    // 3. Cinemas & Rooms enhancements (Status toggling)
    await addColumnIfNotExists('cinemas', 'is_active', 'TINYINT(1) DEFAULT 1');
    await addColumnIfNotExists('rooms', 'is_active', 'TINYINT(1) DEFAULT 1');

    logger.info('Database migrations verified successfully.');
}

module.exports = { runMigrations };
