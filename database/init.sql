-- ====================================================================
-- HỆ THỐNG ĐẶT VÉ XEM PHIM / SỰ KIỆN - ĐỀ 11
-- Học phần: Triển khai và Quản trị Hệ thống Phần mềm
-- Sinh viên: Nguyễn Duy Trường - MSV: DTC245200120 - Lớp: CNTTK23E
-- ====================================================================

CREATE DATABASE IF NOT EXISTS cinema_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cinema_db;
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- 1. Bảng Người dùng (users)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role ENUM('customer', 'admin') DEFAULT 'customer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_role (role),
    INDEX idx_user_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Bảng Rạp chiếu (cinemas)
CREATE TABLE IF NOT EXISTS cinemas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    address VARCHAR(255) NOT NULL,
    city VARCHAR(50) DEFAULT 'Hà Nội',
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Bảng Phòng chiếu (rooms)
CREATE TABLE IF NOT EXISTS rooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cinema_id INT NOT NULL,
    name VARCHAR(50) NOT NULL,
    room_type ENUM('Standard', 'VIP', 'IMAX') DEFAULT 'Standard',
    total_seats INT DEFAULT 60,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cinema_id) REFERENCES cinemas(id) ON DELETE CASCADE,
    INDEX idx_room_cinema (cinema_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Bảng Ghế ngồi (seats)
CREATE TABLE IF NOT EXISTS seats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT NOT NULL,
    row_label CHAR(2) NOT NULL,
    seat_number INT NOT NULL,
    seat_type ENUM('Regular', 'VIP', 'Couple') DEFAULT 'Regular',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    UNIQUE KEY uq_room_seat (room_id, row_label, seat_number),
    INDEX idx_seat_room (room_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Bảng Phim & Sự kiện (movies)
CREATE TABLE IF NOT EXISTS movies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    duration_minutes INT NOT NULL,
    release_date DATE,
    poster_url VARCHAR(500),
    trailer_url VARCHAR(500),
    genre VARCHAR(100),
    age_rating VARCHAR(10) DEFAULT 'P',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_movie_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Bảng Suất chiếu (showtimes)
CREATE TABLE IF NOT EXISTS showtimes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    movie_id INT NOT NULL,
    room_id INT NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    price_regular DECIMAL(10, 2) NOT NULL DEFAULT 85000.00,
    price_vip DECIMAL(10, 2) NOT NULL DEFAULT 110000.00,
    price_couple DECIMAL(10, 2) NOT NULL DEFAULT 180000.00,
    status ENUM('scheduled', 'cancelled', 'completed') DEFAULT 'scheduled',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE RESTRICT,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE RESTRICT,
    INDEX idx_showtime_movie (movie_id),
    INDEX idx_showtime_room (room_id),
    INDEX idx_showtime_start (start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Bảng Đặt vé (bookings)
CREATE TABLE IF NOT EXISTS bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_code VARCHAR(30) NOT NULL UNIQUE,
    user_id INT,
    showtime_id INT NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL,
    payment_status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
    booking_status ENUM('confirmed', 'cancelled') DEFAULT 'confirmed',
    customer_name VARCHAR(100) NOT NULL,
    customer_email VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (showtime_id) REFERENCES showtimes(id) ON DELETE RESTRICT,
    INDEX idx_booking_user (user_id),
    INDEX idx_booking_showtime (showtime_id),
    INDEX idx_booking_status (payment_status, booking_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Bảng Chi tiết Ghế được đặt trong từng Suất chiếu (booking_seats)
-- Ràng buộc UNIQUE (showtime_id, seat_id) ngăn chặn tuyệt đối double-booking ở cấp DB!
CREATE TABLE IF NOT EXISTS booking_seats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    showtime_id INT NOT NULL,
    seat_id INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    FOREIGN KEY (showtime_id) REFERENCES showtimes(id) ON DELETE RESTRICT,
    FOREIGN KEY (seat_id) REFERENCES seats(id) ON DELETE RESTRICT,
    UNIQUE KEY uq_showtime_seat (showtime_id, seat_id),
    INDEX idx_bs_booking (booking_id),
    INDEX idx_bs_showtime (showtime_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Bảng Giao dịch Thanh toán (payments)
CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    payment_method ENUM('VNPAY_MOCK', 'MOMO_MOCK', 'BANK_TRANSFER', 'CASH') DEFAULT 'VNPAY_MOCK',
    transaction_id VARCHAR(100) NOT NULL UNIQUE,
    amount DECIMAL(12, 2) NOT NULL,
    status ENUM('success', 'failed') NOT NULL,
    response_data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    INDEX idx_payment_booking (booking_id),
    INDEX idx_payment_tx (transaction_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ====================================================================
-- TÀI KHOẢN PHÂN QUYỀN VÀ BẢO MẬT (HARDENING LEAST PRIVILEGE)
-- Phân quyền truy cập tối thiểu cho cinema_user (app) và exporter (Prometheus)
-- Mật khẩu được nạp an toàn từ biến môi trường (.env), không lưu vào git
-- ====================================================================

-- 1. App user (quản lý qua MYSQL_USER và MYSQL_PASSWORD trong .env)
CREATE USER IF NOT EXISTS 'cinema_user'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON cinema_db.* TO 'cinema_user'@'%';

-- 2. Prometheus mysqld-exporter user (quản lý qua MYSQL_EXPORTER_PASSWORD trong .env)
CREATE USER IF NOT EXISTS 'exporter'@'%';
GRANT PROCESS, REPLICATION CLIENT, SELECT ON *.* TO 'exporter'@'%';

FLUSH PRIVILEGES;
