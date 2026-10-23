const db = require('../config/database');
const logger = require('../config/logger');

const ticketController = {
    // 1. Xác minh thông tin vé điện tử qua mã QR Token hoặc Booking Code
    // Không lộ thông tin riêng tư (phone, email) trên trang xác minh công khai
    verifyTicket: async (req, res) => {
        const token = req.query.token;
        const code = req.query.code;

        if (!token && !code) {
            return res.render('ticket/verify', {
                title: 'Xác minh vé điện tử - CINEVIBE',
                booking: null,
                seats: [],
                ticketStatus: 'invalid',
                message: 'Vui lòng cung cấp mã QR hoặc mã vé hợp lệ để kiểm tra.'
            });
        }

        try {
            // CHỈ lấy các trường cần thiết, KHÔNG lấy customer_phone hay customer_email
            let query = `
                SELECT b.id, b.booking_code, b.booking_token, b.user_id, b.showtime_id,
                       b.payment_status, b.booking_status, b.total_amount,
                       b.checkin_status, b.checkin_at, b.checkin_by,
                       b.customer_name,
                       s.start_time, s.end_time, (s.end_time < NOW()) as is_ended,
                       m.title as movie_title, m.poster_url, m.duration_minutes, m.age_rating,
                       r.name as room_name, r.room_type,
                       c.name as cinema_name, c.address as cinema_address,
                       p.payment_method, p.created_at as payment_time
                FROM bookings b
                JOIN showtimes s ON b.showtime_id = s.id
                JOIN movies m ON s.movie_id = m.id
                JOIN rooms r ON s.room_id = r.id
                JOIN cinemas c ON r.cinema_id = c.id
                LEFT JOIN payments p ON b.id = p.booking_id AND p.status = 'success'
                WHERE 
            `;
            const params = [];

            if (token) {
                query += ' b.booking_token = ?';
                params.push(token.trim());
            } else {
                query += ' b.booking_code = ?';
                params.push(code.trim());
            }

            const bookings = await db.query(query, params);

            if (bookings.length === 0) {
                return res.render('ticket/verify', {
                    title: 'Xác minh vé - Không tìm thấy',
                    booking: null,
                    seats: [],
                    ticketStatus: 'not_found',
                    message: 'Không tìm thấy thông tin vé tương ứng trong hệ thống CineVibe.'
                });
            }

            const booking = bookings[0];

            // Lấy danh sách ghế của đơn (không lộ thông tin cá nhân)
            const seats = await db.query(`
                SELECT s.row_label, s.seat_number, s.seat_type, bs.price
                FROM booking_seats bs
                JOIN seats s ON bs.seat_id = s.id
                WHERE bs.booking_id = ?
            `, [booking.id]);

            // Xác định trạng thái của vé
            let ticketStatus = 'valid';
            let message = 'Vé hợp lệ và sẵn sàng vào rạp xem phim.';

            if (booking.booking_status === 'cancelled' || booking.payment_status === 'failed') {
                ticketStatus = 'cancelled';
                message = 'Vé này đã bị hủy hoặc giao dịch thanh toán không thành công.';
            } else if (booking.payment_status !== 'completed') {
                ticketStatus = 'unpaid';
                message = 'Vé này chưa được thanh toán hoàn tất.';
            } else if (booking.checkin_status === 'checked_in') {
                ticketStatus = 'already_used';
                const checkinTime = booking.checkin_at ? new Date(booking.checkin_at).toLocaleString('vi-VN') : 'trước đó';
                message = `Vé này đã được soát vé vào rạp lúc ${checkinTime} bởi nhân viên ${booking.checkin_by || 'hệ thống'}.`;
            } else if (booking.is_ended) {
                ticketStatus = 'expired';
                message = 'Suất chiếu của vé này đã kết thúc.';
            }

            res.render('ticket/verify', {
                title: `Xác minh vé - ${booking.booking_code}`,
                booking,
                seats,
                ticketStatus,
                message,
                currentUser: req.session ? req.session.user : null
            });

        } catch (error) {
            logger.error(`Error verifying ticket: ${error.message}`);
            res.status(500).render('error', {
                title: 'Lỗi xác minh vé',
                statusCode: 500,
                message: 'Không thể xác minh vé điện tử lúc này'
            });
        }
    },

    // 2. Điểm danh / Check-in vé tại quầy (dành cho Admin / Soát vé)
    // Sử dụng DB Transaction + Atomic Conditional UPDATE chống 2 request check-in đồng thời cùng thành công
    checkinTicket: async (req, res) => {
        const { bookingId, token } = req.body;

        if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Chỉ nhân viên soát vé hoặc quản trị viên mới có quyền check-in vé'
            });
        }

        if (!bookingId && !token) {
            return res.status(400).json({ success: false, message: 'Thiếu thông tin vé cần check-in' });
        }

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Bước 1: Lock dòng bản ghi bằng FOR UPDATE để chống đồng thời
            let bookingQuery = 'SELECT id, booking_code, payment_status, booking_status, checkin_status, checkin_at, checkin_by FROM bookings WHERE ';
            const params = [];
            if (bookingId) {
                bookingQuery += 'id = ? FOR UPDATE';
                params.push(bookingId);
            } else {
                bookingQuery += 'booking_token = ? FOR UPDATE';
                params.push(token);
            }

            const [bookings] = await connection.query(bookingQuery, params);
            if (bookings.length === 0) {
                await connection.rollback();
                return res.status(404).json({ success: false, message: 'Không tìm thấy vé trong hệ thống' });
            }

            const booking = bookings[0];

            if (booking.payment_status !== 'completed' || booking.booking_status === 'cancelled') {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Vé chưa thanh toán hoặc đã bị hủy, không thể check-in'
                });
            }

            if (booking.checkin_status === 'checked_in') {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: `Vé này đã được check-in lúc ${new Date(booking.checkin_at).toLocaleString('vi-VN')} bởi ${booking.checkin_by || 'nhân viên'}`
                });
            }

            const checkinBy = req.session.user.username || 'admin';

            // Bước 2: Atomic conditional UPDATE - chỉ update nếu vé CHƯA check-in
            // WHERE checkin_status = 'pending' ngăn 2 request đồng thời đều thành công
            const [updateResult] = await connection.query(`
                UPDATE bookings 
                SET checkin_status = 'checked_in', checkin_at = NOW(), checkin_by = ?, updated_at = NOW()
                WHERE id = ? AND checkin_status = 'pending' AND payment_status = 'completed'
            `, [checkinBy, booking.id]);

            if (updateResult.affectedRows === 0) {
                // Race condition: vé vừa được check-in bởi request khác trong cùng khoảng thời gian
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Vé này vừa được check-in bởi nhân viên khác ngay lúc này'
                });
            }

            await connection.commit();

            logger.info(`Ticket checked-in successfully: ${booking.booking_code} (ID: ${booking.id}) by ${checkinBy}`);

            res.json({
                success: true,
                message: 'Check-in vé thành công! Khách hàng có thể vào phòng chiếu.',
                checkinAt: new Date().toLocaleString('vi-VN'),
                checkinBy
            });

        } catch (error) {
            await connection.rollback();
            logger.error(`Error checking-in ticket: ${error.message}`);
            res.status(500).json({ success: false, message: 'Lỗi hệ thống khi check-in vé' });
        } finally {
            connection.release();
        }
    }
};

module.exports = ticketController;
