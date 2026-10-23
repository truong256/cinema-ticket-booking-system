-- ====================================================================
-- SEED DATA - HỆ THỐNG ĐẶT VÉ XEM PHIM / SỰ KIỆN - ĐỀ 11
-- ====================================================================
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
USE cinema_db;


-- 1. Users (Mật khẩu hash bằng bcrypt vòng 10: 'Admin@123456' và 'User@123456')
-- Hash của 'Admin@123456': $2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lR5eK5f1E6fTfL0O8m5K5f1E6fTfL (hoặc chuỗi bcrypt tương đương)
-- Chúng ta dùng hash bcrypt chuẩn:
INSERT INTO users (username, email, password_hash, full_name, phone, role) VALUES
('admin', 'admin@cinema.local', '$2a$10$lZrbfQTGwucH5rACOdsCfuxAH2VZLNl4WnMl33YVUTD4C3vgnesmi', 'Quản Trị Viên Hệ Thống', '0987654321', 'admin'),
('truong256', 'nguyenduytruong25102006@gmail.com', '$2a$10$lZrbfQTGwucH5rACOdsCfuFnvPcR/7Ep8Etqopz4iOtHdO9EmkFu.', 'Nguyễn Duy Trường', '0912345678', 'customer'),
('customer1', 'khachhang1@gmail.com', '$2a$10$lZrbfQTGwucH5rACOdsCfuLWC66y2FhLp/2Mb2caDBwxNDhsY/oJu', 'Trần Văn Nam', '0933221100', 'customer')
ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash), full_name=VALUES(full_name);

-- 2. Cinemas
INSERT INTO cinemas (id, name, address, city, phone) VALUES
(1, 'CineStar Vincom Center', '72 Lê Thánh Tôn, Bến Nghé, Quận 1', 'TP. Hồ Chí Minh', '19006017'),
(2, 'Galaxy Cinema Royal City', '72A Nguyễn Trãi, Thượng Đình, Thanh Xuân', 'Hà Nội', '19002224')
ON DUPLICATE KEY UPDATE name=VALUES(name), address=VALUES(address), city=VALUES(city), phone=VALUES(phone);

-- 3. Rooms
INSERT INTO rooms (id, cinema_id, name, room_type, total_seats) VALUES
(1, 1, 'Phòng 01 - IMAX Laser', 'IMAX', 60),
(2, 1, 'Phòng 02 - Premium VIP', 'VIP', 40),
(3, 2, 'Phòng 03 - Dolby Atmos', 'Standard', 60)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- 4. Tạo ghế cho Phòng 1 (60 ghế: Hàng A, B là Regular; C, D, E là VIP; F là Couple)
INSERT IGNORE INTO seats (room_id, row_label, seat_number, seat_type) VALUES
-- Hàng A (Regular)
(1, 'A', 1, 'Regular'), (1, 'A', 2, 'Regular'), (1, 'A', 3, 'Regular'), (1, 'A', 4, 'Regular'), (1, 'A', 5, 'Regular'),
(1, 'A', 6, 'Regular'), (1, 'A', 7, 'Regular'), (1, 'A', 8, 'Regular'), (1, 'A', 9, 'Regular'), (1, 'A', 10, 'Regular'),
-- Hàng B (Regular)
(1, 'B', 1, 'Regular'), (1, 'B', 2, 'Regular'), (1, 'B', 3, 'Regular'), (1, 'B', 4, 'Regular'), (1, 'B', 5, 'Regular'),
(1, 'B', 6, 'Regular'), (1, 'B', 7, 'Regular'), (1, 'B', 8, 'Regular'), (1, 'B', 9, 'Regular'), (1, 'B', 10, 'Regular'),
-- Hàng C (VIP)
(1, 'C', 1, 'VIP'), (1, 'C', 2, 'VIP'), (1, 'C', 3, 'VIP'), (1, 'C', 4, 'VIP'), (1, 'C', 5, 'VIP'),
(1, 'C', 6, 'VIP'), (1, 'C', 7, 'VIP'), (1, 'C', 8, 'VIP'), (1, 'C', 9, 'VIP'), (1, 'C', 10, 'VIP'),
-- Hàng D (VIP)
(1, 'D', 1, 'VIP'), (1, 'D', 2, 'VIP'), (1, 'D', 3, 'VIP'), (1, 'D', 4, 'VIP'), (1, 'D', 5, 'VIP'),
(1, 'D', 6, 'VIP'), (1, 'D', 7, 'VIP'), (1, 'D', 8, 'VIP'), (1, 'D', 9, 'VIP'), (1, 'D', 10, 'VIP'),
-- Hàng E (VIP)
(1, 'E', 1, 'VIP'), (1, 'E', 2, 'VIP'), (1, 'E', 3, 'VIP'), (1, 'E', 4, 'VIP'), (1, 'E', 5, 'VIP'),
(1, 'E', 6, 'VIP'), (1, 'E', 7, 'VIP'), (1, 'E', 8, 'VIP'), (1, 'E', 9, 'VIP'), (1, 'E', 10, 'VIP'),
-- Hàng F (Couple)
(1, 'F', 1, 'Couple'), (1, 'F', 2, 'Couple'), (1, 'F', 3, 'Couple'), (1, 'F', 4, 'Couple'), (1, 'F', 5, 'Couple'),
(1, 'F', 6, 'Couple'), (1, 'F', 7, 'Couple'), (1, 'F', 8, 'Couple'), (1, 'F', 9, 'Couple'), (1, 'F', 10, 'Couple');

-- Ghế cho Phòng 2 (40 ghế: A, B Regular; C, D VIP)
INSERT IGNORE INTO seats (room_id, row_label, seat_number, seat_type) VALUES
(2, 'A', 1, 'Regular'), (2, 'A', 2, 'Regular'), (2, 'A', 3, 'Regular'), (2, 'A', 4, 'Regular'), (2, 'A', 5, 'Regular'),
(2, 'A', 6, 'Regular'), (2, 'A', 7, 'Regular'), (2, 'A', 8, 'Regular'), (2, 'A', 9, 'Regular'), (2, 'A', 10, 'Regular'),
(2, 'B', 1, 'Regular'), (2, 'B', 2, 'Regular'), (2, 'B', 3, 'Regular'), (2, 'B', 4, 'Regular'), (2, 'B', 5, 'Regular'),
(2, 'B', 6, 'Regular'), (2, 'B', 7, 'Regular'), (2, 'B', 8, 'Regular'), (2, 'B', 9, 'Regular'), (2, 'B', 10, 'Regular'),
(2, 'C', 1, 'VIP'), (2, 'C', 2, 'VIP'), (2, 'C', 3, 'VIP'), (2, 'C', 4, 'VIP'), (2, 'C', 5, 'VIP'),
(2, 'C', 6, 'VIP'), (2, 'C', 7, 'VIP'), (2, 'C', 8, 'VIP'), (2, 'C', 9, 'VIP'), (2, 'C', 10, 'VIP'),
(2, 'D', 1, 'VIP'), (2, 'D', 2, 'VIP'), (2, 'D', 3, 'VIP'), (2, 'D', 4, 'VIP'), (2, 'D', 5, 'VIP'),
(2, 'D', 6, 'VIP'), (2, 'D', 7, 'VIP'), (2, 'D', 8, 'VIP'), (2, 'D', 9, 'VIP'), (2, 'D', 10, 'VIP');

-- Ghế cho Phòng 3 (60 ghế)
INSERT IGNORE INTO seats (room_id, row_label, seat_number, seat_type) VALUES
(3, 'A', 1, 'Regular'), (3, 'A', 2, 'Regular'), (3, 'A', 3, 'Regular'), (3, 'A', 4, 'Regular'), (3, 'A', 5, 'Regular'),
(3, 'A', 6, 'Regular'), (3, 'A', 7, 'Regular'), (3, 'A', 8, 'Regular'), (3, 'A', 9, 'Regular'), (3, 'A', 10, 'Regular'),
(3, 'B', 1, 'Regular'), (3, 'B', 2, 'Regular'), (3, 'B', 3, 'Regular'), (3, 'B', 4, 'Regular'), (3, 'B', 5, 'Regular'),
(3, 'B', 6, 'Regular'), (3, 'B', 7, 'Regular'), (3, 'B', 8, 'Regular'), (3, 'B', 9, 'Regular'), (3, 'B', 10, 'Regular'),
(3, 'C', 1, 'VIP'), (3, 'C', 2, 'VIP'), (3, 'C', 3, 'VIP'), (3, 'C', 4, 'VIP'), (3, 'C', 5, 'VIP'),
(3, 'C', 6, 'VIP'), (3, 'C', 7, 'VIP'), (3, 'C', 8, 'VIP'), (3, 'C', 9, 'VIP'), (3, 'C', 10, 'VIP'),
(3, 'D', 1, 'VIP'), (3, 'D', 2, 'VIP'), (3, 'D', 3, 'VIP'), (3, 'D', 4, 'VIP'), (3, 'D', 5, 'VIP'),
(3, 'D', 6, 'VIP'), (3, 'D', 7, 'VIP'), (3, 'D', 8, 'VIP'), (3, 'D', 9, 'VIP'), (3, 'D', 10, 'VIP'),
(3, 'E', 1, 'VIP'), (3, 'E', 2, 'VIP'), (3, 'E', 3, 'VIP'), (3, 'E', 4, 'VIP'), (3, 'E', 5, 'VIP'),
(3, 'E', 6, 'VIP'), (3, 'E', 7, 'VIP'), (3, 'E', 8, 'VIP'), (3, 'E', 9, 'VIP'), (3, 'E', 10, 'VIP'),
(3, 'F', 1, 'Couple'), (3, 'F', 2, 'Couple'), (3, 'F', 3, 'Couple'), (3, 'F', 4, 'Couple'), (3, 'F', 5, 'Couple'),
(3, 'F', 6, 'Couple'), (3, 'F', 7, 'Couple'), (3, 'F', 8, 'Couple'), (3, 'F', 9, 'Couple'), (3, 'F', 10, 'Couple');

-- 5. Movies (6 phim bom tấn đang chiếu và sắp chiếu)
INSERT INTO movies (id, title, description, duration_minutes, release_date, poster_url, trailer_url, genre, age_rating, is_active) VALUES
(1, 'Dune: Part Two (Hành Tinh Cát 2)', 'Paul Atreides hợp lực cùng Chani và tộc người Fremen để trả thù những kẻ đã hủy hoại gia đình anh, đối mặt với sự lựa chọn giữa tình yêu và số phận vũ trụ.', 166, '2026-03-01', '/images/dune2.jpg', 'https://www.youtube.com/watch?v=Way9Dexny3w', 'Khoa học viễn tưởng, Hành động', 'T16', 1),
(2, 'Mai', 'Câu chuyện tình yêu đầy trắc trở giữa Mai - một nhân viên massage và Dương - chàng trai lãng tử đối diện với định kiến xã hội và những vết thương quá khứ.', 131, '2026-02-10', '/images/mai.jpg', 'https://www.youtube.com/watch?v=bK66l4B3sps', 'Tâm lý, Tình cảm', 'T18', 1),
(3, 'Godzilla x Kong: The New Empire', 'Hai quái thú huyền thoại Godzilla và Kong phải bắt tay nhau chống lại một mối đe dọa khổng lồ ẩn sâu bên trong Trái Đất Rỗng đe dọa sự tồn vong của nhân loại.', 115, '2026-03-29', '/images/godzilla_kong.jpg', 'https://www.youtube.com/watch?v=lV1OOlGwExg', 'Hành động, Phiêu lưu', 'K', 1),
(4, 'Inside Out 2 (Những Mảnh Ghép Cảm Xúc 2)', 'Riley bước vào tuổi dậy thì với những cảm xúc hoàn toàn mới: Lo Âu (Anxiety), Ganh Tị (Envy), Xấu Hổ (Embarrassment) khiến trụ sở cảm xúc đảo lộn hoàn toàn.', 96, '2026-06-14', '/images/inside_out2.jpg', 'https://www.youtube.com/watch?v=LEjhY15eCx0', 'Hoạt hình, Gia đình', 'P', 1),
(5, 'Lật Mặt 7: Một Điều Ước', 'Bộ phim cảm động về tình mẫu tử của bà Hai 73 tuổi và 5 người con trưởng thành với những hoàn cảnh và góc khuất cuộc đời riêng biệt.', 138, '2026-04-26', '/images/lat_mat_7.jpg', 'https://www.youtube.com/watch?v=d_k8E4U_HqE', 'Gia đình, Tình cảm', 'K', 1),
(6, 'Oppenheimer', 'Câu chuyện cuộc đời nhà vật lý J. Robert Oppenheimer, người đóng vai trò then chốt trong Dự án Manhattan phát triển vũ khí hạt nhân đầu tiên của nhân loại.', 180, '2026-05-15', '/images/oppenheimer.jpg', 'https://www.youtube.com/watch?v=uYPbbksJxIg', 'Lịch sử, Kịch tính', 'T18', 1)
ON DUPLICATE KEY UPDATE title=VALUES(title), description=VALUES(description), genre=VALUES(genre), duration_minutes=VALUES(duration_minutes), poster_url=VALUES(poster_url), trailer_url=VALUES(trailer_url), age_rating=VALUES(age_rating);

-- 6. Showtimes (Suất chiếu cho hôm nay và những ngày tới)
INSERT INTO showtimes (id, movie_id, room_id, start_time, end_time, price_regular, price_vip, price_couple, status) VALUES
(1, 1, 1, DATE_ADD(NOW(), INTERVAL 2 HOUR), DATE_ADD(DATE_ADD(NOW(), INTERVAL 4 HOUR), INTERVAL 46 MINUTE), 90000.00, 120000.00, 200000.00, 'scheduled'),
(2, 1, 1, DATE_ADD(NOW(), INTERVAL 6 HOUR), DATE_ADD(DATE_ADD(NOW(), INTERVAL 8 HOUR), INTERVAL 46 MINUTE), 95000.00, 130000.00, 220000.00, 'scheduled'),
(3, 2, 2, DATE_ADD(NOW(), INTERVAL 1 HOUR), DATE_ADD(DATE_ADD(NOW(), INTERVAL 3 HOUR), INTERVAL 11 MINUTE), 85000.00, 110000.00, 180000.00, 'scheduled'),
(4, 2, 2, DATE_ADD(NOW(), INTERVAL 4 HOUR), DATE_ADD(DATE_ADD(NOW(), INTERVAL 6 HOUR), INTERVAL 11 MINUTE), 85000.00, 110000.00, 180000.00, 'scheduled'),
(5, 3, 3, DATE_ADD(NOW(), INTERVAL 3 HOUR), DATE_ADD(DATE_ADD(NOW(), INTERVAL 4 HOUR), INTERVAL 55 MINUTE), 80000.00, 100000.00, 170000.00, 'scheduled'),
(6, 4, 1, DATE_ADD(DATE_ADD(NOW(), INTERVAL 1 DAY), INTERVAL 9 HOUR), DATE_ADD(DATE_ADD(DATE_ADD(NOW(), INTERVAL 1 DAY), INTERVAL 10 HOUR), INTERVAL 36 MINUTE), 85000.00, 110000.00, 180000.00, 'scheduled'),
(7, 5, 2, DATE_ADD(DATE_ADD(NOW(), INTERVAL 1 DAY), INTERVAL 14 HOUR), DATE_ADD(DATE_ADD(DATE_ADD(NOW(), INTERVAL 1 DAY), INTERVAL 16 HOUR), INTERVAL 18 MINUTE), 85000.00, 110000.00, 180000.00, 'scheduled')
ON DUPLICATE KEY UPDATE status=VALUES(status), start_time=VALUES(start_time), end_time=VALUES(end_time);

-- 7. Sample Bookings (Một vài booking mẫu để chứng minh hoạt động)
INSERT INTO bookings (id, booking_code, user_id, showtime_id, total_amount, payment_status, booking_status, customer_name, customer_email, customer_phone) VALUES
(1, 'BKG-20261021-001', 2, 1, 240000.00, 'completed', 'confirmed', 'Nguyễn Duy Trường', 'nguyenduytruong25102006@gmail.com', '0912345678'),
(2, 'BKG-20261021-002', 3, 3, 110000.00, 'completed', 'confirmed', 'Trần Văn Nam', 'khachhang1@gmail.com', '0933221100')
ON DUPLICATE KEY UPDATE total_amount=VALUES(total_amount);

-- 8. Sample Booking Seats (Ghế C5, C6 đã được đặt cho showtime 1)
-- Lưu ý: C5, C6 là ghế VIP (room 1: id=25, 26)
INSERT IGNORE INTO booking_seats (booking_id, showtime_id, seat_id, price) VALUES
(1, 1, 25, 120000.00),
(1, 1, 26, 120000.00),
(2, 3, 85, 110000.00);

-- 9. Sample Payments
INSERT INTO payments (booking_id, payment_method, transaction_id, amount, status, response_data) VALUES
(1, 'VNPAY_MOCK', 'TXN-VNPAY-20261021-8849', 240000.00, 'success', '{"code":"00","message":"Giao dich thanh cong qua VNPAY Gia Lap","bankCode":"NCB"}'),
(2, 'MOMO_MOCK', 'TXN-MOMO-20261021-1205', 110000.00, 'success', '{"resultCode":0,"message":"Thanh toan Momo thanh cong"}')
ON DUPLICATE KEY UPDATE amount=VALUES(amount);
