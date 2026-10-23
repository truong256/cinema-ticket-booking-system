-- ====================================================================
-- CINEVIBE MIGRATION 01: COMPLETE CINEMA SYSTEM
-- Supports: 10-min seat holding, Guest IDOR tokens, Real QR check-in,
--           Password reset tokens, and Cinema/Room status flags.
-- ====================================================================

USE cinema_db;

-- 1. Bookings enhancements
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'expires_at');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE bookings ADD COLUMN expires_at DATETIME NULL AFTER total_amount', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'booking_token');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE bookings ADD COLUMN booking_token VARCHAR(64) NULL AFTER booking_code', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'checkin_status');
SET @sql := IF(@col_exists = 0, "ALTER TABLE bookings ADD COLUMN checkin_status ENUM('pending', 'checked_in') DEFAULT 'pending' AFTER booking_status", 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'checkin_at');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE bookings ADD COLUMN checkin_at DATETIME NULL AFTER checkin_status', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bookings' AND COLUMN_NAME = 'checkin_by');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE bookings ADD COLUMN checkin_by VARCHAR(50) NULL AFTER checkin_at', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE bookings 
SET booking_token = SHA2(CONCAT(id, booking_code, UNIX_TIMESTAMP(created_at)), 256)
WHERE booking_token IS NULL OR booking_token = '';

-- 2. Users enhancements
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'reset_password_token');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE users ADD COLUMN reset_password_token VARCHAR(100) NULL AFTER role', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'reset_password_expires');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE users ADD COLUMN reset_password_expires DATETIME NULL AFTER reset_password_token', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'status');
SET @sql := IF(@col_exists = 0, "ALTER TABLE users ADD COLUMN status ENUM('active', 'locked') DEFAULT 'active' AFTER role", 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. Cinemas & Rooms enhancements
SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cinemas' AND COLUMN_NAME = 'is_active');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE cinemas ADD COLUMN is_active TINYINT(1) DEFAULT 1 AFTER phone', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'rooms' AND COLUMN_NAME = 'is_active');
SET @sql := IF(@col_exists = 0, 'ALTER TABLE rooms ADD COLUMN is_active TINYINT(1) DEFAULT 1 AFTER total_seats', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
