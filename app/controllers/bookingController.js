const db = require('../config/database');
const logger = require('../config/logger');
const { ticketsBookedTotal, revenueTotal, activeBookingsGauge } = require('../config/metrics');

// Tạo mã đặt vé ngẫu nhiên duy nhất
function generateBookingCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'BKG-';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

const bookingController = {
    // 1. Xem sơ đồ ghế của một suất chiếu
    getSeatSelection: async (req, res) => {
        const showtimeId = req.params.showtimeId;
        try {
            // Lấy thông tin suất chiếu, phim, phòng, rạp
            const showtimes = await db.query(`
                SELECT s.*, m.title as movie_title, m.poster_url, m.duration_minutes, m.age_rating,
                       r.id as room_id, r.name as room_name, r.room_type,
                       c.name as cinema_name, c.address as cinema_address
                FROM showtimes s
                JOIN movies m ON s.movie_id = m.id
                JOIN rooms r ON s.room_id = r.id
                JOIN cinemas c ON r.cinema_id = c.id
                WHERE s.id = ?
            `, [showtimeId]);

            if (showtimes.length === 0) {
                return res.status(404).render('error', {
                    title: 'Không tìm thấy suất chiếu',
                    statusCode: 404,
                    message: 'Suất chiếu không tồn tại hoặc đã bị hủy'
                });
            }

            const showtime = showtimes[0];

            // Lấy tất cả ghế trong phòng chiếu này
            const allSeats = await db.query(`
                SELECT id, room_id, row_label, seat_number, seat_type, is_active
                FROM seats
                WHERE room_id = ?
                ORDER BY row_label ASC, seat_number ASC
            `, [showtime.room_id]);

            // Lấy danh sách ID ghế ĐÃ ĐƯỢC ĐẶT trong suất chiếu này (chỉ tính booking có hiệu lực hoặc pending/completed)
            const bookedSeatsData = await db.query(`
                SELECT bs.seat_id
                FROM booking_seats bs
                JOIN bookings b ON bs.booking_id = b.id
                WHERE bs.showtime_id = ? AND b.booking_status = 'confirmed' AND b.payment_status != 'failed'
            `, [showtimeId]);

            const bookedSeatIds = new Set(bookedSeatsData.map(b => b.seat_id));

            // Tổ chức ghế theo hàng (row_label)
            const rows = {};
            allSeats.forEach(seat => {
                if (!rows[seat.row_label]) {
                    rows[seat.row_label] = [];
                }
                rows[seat.row_label].push({
                    ...seat,
                    isBooked: bookedSeatIds.has(seat.id)
                });
            });

            res.render('booking/seats', {
                title: `Chọn ghế - ${showtime.movie_title}`,
                showtime,
                seatRows: rows,
                bookedSeatCount: bookedSeatIds.size,
                totalSeatCount: allSeats.length
            });
        } catch (error) {
            logger.error(`Error loading seat selection: ${error.message}`);
            res.status(500).render('error', {
                title: 'Lỗi tải sơ đồ ghế',
                statusCode: 500,
                message: 'Không thể tải thông tin ghế ngồi cho suất chiếu này'
            });
        }
    },

    // 2. API lấy trạng thái ghế (cho AJAX refresh thời gian thực)
    getSeatsStatusApi: async (req, res) => {
        const showtimeId = req.params.showtimeId;
        try {
            const bookedSeatsData = await db.query(`
                SELECT bs.seat_id
                FROM booking_seats bs
                JOIN bookings b ON bs.booking_id = b.id
                WHERE bs.showtime_id = ? AND b.booking_status = 'confirmed' AND b.payment_status != 'failed'
            `, [showtimeId]);

            const bookedSeatIds = bookedSeatsData.map(b => b.seat_id);
            res.json({ success: true, showtimeId, bookedSeatIds });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // 3. Đặt vé với Transaction & Khóa bi quan (FOR UPDATE) chống Double Booking
    createBooking: async (req, res) => {
        const { showtimeId, seatIds, customerName, customerEmail, customerPhone } = req.body;

        // Backend validation
        if (!showtimeId || !seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng chọn ít nhất một ghế ngồi hợp lệ'
            });
        }

        if (!customerName || !customerEmail || !customerPhone) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng cung cấp đầy đủ thông tin: Họ tên, Email, Số điện thoại'
            });
        }

        const numericSeatIds = seatIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
        const connection = await db.getConnection();

        try {
            activeBookingsGauge.inc();
            // BẮT ĐẦU TRANSACTION NGHIÊM NGẶT
            await connection.beginTransaction();

            // 1. Khóa kiểm tra các ghế đã bị đặt trước đó cho suất chiếu này
            // Sử dụng SELECT ... FOR UPDATE để khóa hàng, chống xung đột song song (race condition)
            const [alreadyBooked] = await connection.query(`
                SELECT bs.seat_id, s.row_label, s.seat_number
                FROM booking_seats bs
                JOIN bookings b ON bs.booking_id = b.id
                JOIN seats s ON bs.seat_id = s.id
                WHERE bs.showtime_id = ? AND bs.seat_id IN (?)
                  AND b.booking_status = 'confirmed' AND b.payment_status != 'failed'
                FOR UPDATE
            `, [showtimeId, numericSeatIds]);

            if (alreadyBooked.length > 0) {
                // ĐÃ BỊ ĐẶT TRÙNG! ROLLBACK NGAY LẬP TỨC
                await connection.rollback();
                const bookedLabels = alreadyBooked.map(s => `${s.row_label}${s.seat_number}`).join(', ');
                logger.warn(`Double-booking prevented for showtime ${showtimeId}, seats: ${bookedLabels}`);
                return res.status(409).json({
                    success: false,
                    conflict: true,
                    message: `Rất tiếc! Ghế (${bookedLabels}) vừa có người khác đặt. Vui lòng chọn ghế khác.`
                });
            }

            // 2. Lấy giá vé và thông tin từng ghế
            const [showtimes] = await connection.query('SELECT * FROM showtimes WHERE id = ?', [showtimeId]);
            if (showtimes.length === 0) {
                await connection.rollback();
                return res.status(404).json({ success: false, message: 'Suất chiếu không tồn tại' });
            }
            const showtime = showtimes[0];

            const [seatsInfo] = await connection.query(
                'SELECT id, row_label, seat_number, seat_type, room_id, is_active FROM seats WHERE id IN (?)',
                [numericSeatIds]
            );

            // Kiểm tra ghế không tồn tại
            if (seatsInfo.length !== numericSeatIds.length) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Một hoặc nhiều ghế được chọn không tồn tại trong hệ thống'
                });
            }

            // Kiểm tra ghế phải thuộc đúng phòng chiếu của suất chiếu
            const invalidRoomSeats = seatsInfo.filter(s => s.room_id !== showtime.room_id || !s.is_active);
            if (invalidRoomSeats.length > 0) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Ghế được chọn không thuộc phòng chiếu của suất chiếu này hoặc đang tạm ngưng phục vụ'
                });
            }

            // Tính tổng tiền theo loại ghế
            let totalAmount = 0;
            const seatBookings = [];

            seatsInfo.forEach(seat => {
                let seatPrice = parseFloat(showtime.price_regular);
                if (seat.seat_type === 'VIP') seatPrice = parseFloat(showtime.price_vip);
                if (seat.seat_type === 'Couple') seatPrice = parseFloat(showtime.price_couple);

                totalAmount += seatPrice;
                seatBookings.push({
                    seat_id: seat.id,
                    price: seatPrice,
                    seat_type: seat.seat_type,
                    label: `${seat.row_label}${seat.seat_number}`
                });
            });

            // 3. Tạo bản ghi Booking
            const bookingCode = generateBookingCode();
            const userId = req.session && req.session.user ? req.session.user.id : null;

            const [bookingResult] = await connection.query(`
                INSERT INTO bookings (booking_code, user_id, showtime_id, total_amount, payment_status, booking_status, customer_name, customer_email, customer_phone)
                VALUES (?, ?, ?, ?, 'pending', 'confirmed', ?, ?, ?)
            `, [bookingCode, userId, showtimeId, totalAmount, customerName.trim(), customerEmail.trim(), customerPhone.trim()]);

            const bookingId = bookingResult.insertId;

            // 4. Lưu từng ghế vào booking_seats (DB UNIQUE KEY uq_showtime_seat bảo vệ tầng cuối cùng)
            for (const item of seatBookings) {
                await connection.query(`
                    INSERT INTO booking_seats (booking_id, showtime_id, seat_id, price)
                    VALUES (?, ?, ?, ?)
                `, [bookingId, showtimeId, item.seat_id, item.price]);
            }

            // COMMIT TRANSACTION THÀNH CÔNG
            await connection.commit();
            logger.info(`Booking created successfully: ${bookingCode} (ID: ${bookingId}) for showtime: ${showtimeId}, Total: ${totalAmount} VND`);

            res.json({
                success: true,
                bookingId,
                bookingCode,
                totalAmount,
                redirectUrl: `/booking/payment/${bookingId}`
            });

        } catch (error) {
            await connection.rollback();
            logger.error(`Booking transaction failed: ${error.message}`);
            // Xử lý lỗi trùng khoá ER_DUP_ENTRY hoặc DEADLOCK/TIMEOUT khi 2 khách hàng cùng đặt 1 ghế đồng thời
            if (error.code === 'ER_DUP_ENTRY' || error.code === 'ER_LOCK_DEADLOCK' || error.errno === 1213 || error.code === 'ER_LOCK_WAIT_TIMEOUT' || error.errno === 1205) {
                return res.status(409).json({
                    success: false,
                    conflict: true,
                    message: 'Ghế đã được đặt bởi khách hàng khác trong lúc xử lý (xung đột đồng thời). Vui lòng chọn ghế khác.'
                });
            }
            res.status(500).json({
                success: false,
                message: 'Đã xảy ra lỗi trong quá trình đặt vé. Vui lòng thử lại.'
            });
        } finally {
            activeBookingsGauge.dec();
            connection.release();
        }
    },

    // 4. Trang giả lập thanh toán (VNPAY / MoMo / Thẻ)
    getPaymentPage: async (req, res) => {
        const bookingId = req.params.bookingId;
        try {
            const bookings = await db.query(`
                SELECT b.*, s.start_time, m.title as movie_title, m.poster_url, r.name as room_name, c.name as cinema_name
                FROM bookings b
                JOIN showtimes s ON b.showtime_id = s.id
                JOIN movies m ON s.movie_id = m.id
                JOIN rooms r ON s.room_id = r.id
                JOIN cinemas c ON r.cinema_id = c.id
                WHERE b.id = ?
            `, [bookingId]);

            if (bookings.length === 0) {
                return res.status(404).render('error', {
                    title: 'Không tìm thấy vé',
                    statusCode: 404,
                    message: 'Không tìm thấy thông tin đơn đặt vé cần thanh toán'
                });
            }

            const booking = bookings[0];

            // Nếu vé đã hoàn tất thanh toán trước đó
            if (booking.payment_status === 'completed') {
                return res.redirect(`/booking/success/${booking.id}`);
            }

            // Lấy danh sách ghế đã chọn
            const seats = await db.query(`
                SELECT s.row_label, s.seat_number, s.seat_type, bs.price
                FROM booking_seats bs
                JOIN seats s ON bs.seat_id = s.id
                WHERE bs.booking_id = ?
            `, [bookingId]);

            res.render('booking/checkout', {
                title: `Thanh toán đặt vé - ${booking.booking_code}`,
                booking,
                seats
            });
        } catch (error) {
            logger.error(`Error loading payment page: ${error.message}`);
            res.status(500).render('error', {
                title: 'Lỗi',
                statusCode: 500,
                message: 'Không thể tải trang thanh toán'
            });
        }
    },

    // 5. Xử lý thanh toán giả lập (Thành công HOẶC Thất bại)
    processPayment: async (req, res) => {
        const bookingId = req.params.bookingId;
        const { paymentMethod, paymentAction } = req.body; // paymentAction: 'simulate_success' | 'simulate_failure'

        try {
            const bookings = await db.query('SELECT * FROM bookings WHERE id = ?', [bookingId]);
            if (bookings.length === 0) {
                return res.status(404).json({ success: false, message: 'Đơn đặt vé không tồn tại' });
            }
            const booking = bookings[0];

            // 1. Chống cập nhật thanh toán nhiều lần sai nghiệp vụ
            if (booking.payment_status === 'completed') {
                return res.status(400).json({
                    success: false,
                    message: 'Đơn đặt vé này đã được thanh toán hoàn tất trước đó'
                });
            }

            // 2. Không cho thanh toán đơn của người khác trái phép
            if (booking.user_id && req.session && req.session.user) {
                if (req.session.user.id !== booking.user_id && req.session.user.role !== 'admin') {
                    logger.warn(`Unauthorized payment attempt by user ${req.session.user.id} for booking ${bookingId}`);
                    return res.status(403).json({
                        success: false,
                        message: 'Bạn không có quyền thanh toán đơn đặt vé của người khác'
                    });
                }
            }

            const txnId = `TXN-${paymentMethod || 'VNPAY'}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

            if (paymentAction === 'simulate_success') {
                // THANH TOÁN THÀNH CÔNG
                await db.query(`
                    UPDATE bookings 
                    SET payment_status = 'completed', booking_status = 'confirmed', updated_at = NOW()
                    WHERE id = ?
                `, [bookingId]);

                await db.query(`
                    INSERT INTO payments (booking_id, payment_method, transaction_id, amount, status, response_data)
                    VALUES (?, ?, ?, ?, 'success', ?)
                `, [bookingId, paymentMethod || 'VNPAY_MOCK', txnId, booking.total_amount, JSON.stringify({
                    responseCode: '00',
                    message: 'Giao dịch thanh toán giả lập thành công',
                    bankCode: 'NCB',
                    payDate: new Date().toISOString()
                })]);

                // Lấy thông tin loại ghế để ghi nhận Prometheus Metrics
                const seats = await db.query(`
                    SELECT s.seat_type FROM booking_seats bs
                    JOIN seats s ON bs.seat_id = s.id
                    WHERE bs.booking_id = ?
                `, [bookingId]);

                seats.forEach(s => {
                    ticketsBookedTotal.inc({ seat_type: s.seat_type });
                });
                revenueTotal.inc({ payment_method: paymentMethod || 'VNPAY_MOCK' }, parseFloat(booking.total_amount));

                logger.info(`Payment SUCCESS: Booking ${booking.booking_code}, Amount: ${booking.total_amount} VND, Txn: ${txnId}`);

                return res.json({
                    success: true,
                    status: 'success',
                    redirectUrl: `/booking/success/${bookingId}`
                });

            } else {
                // THANH TOÁN THẤT BẠI HOẶC BỊ HỦY
                // Nghiệp vụ bắt buộc đề bài: giải phóng ghế ngay lập tức, không ghi nhận vé đã thanh toán!
                await db.query(`
                    UPDATE bookings 
                    SET payment_status = 'failed', booking_status = 'cancelled', updated_at = NOW()
                    WHERE id = ?
                `, [bookingId]);

                // Xóa ghế trong booking_seats để khách hàng khác có thể chọn ngay lập tức
                await db.query('DELETE FROM booking_seats WHERE booking_id = ?', [bookingId]);

                await db.query(`
                    INSERT INTO payments (booking_id, payment_method, transaction_id, amount, status, response_data)
                    VALUES (?, ?, ?, ?, 'failed', ?)
                `, [bookingId, paymentMethod || 'VNPAY_MOCK', txnId, booking.total_amount, JSON.stringify({
                    responseCode: '24',
                    message: 'Khách hàng hủy giao dịch hoặc thẻ không đủ số dư (Mô phỏng thất bại)'
                })]);

                logger.warn(`Payment FAILED/CANCELLED: Booking ${booking.booking_code}, Seats released, Txn: ${txnId}`);

                return res.json({
                    success: false,
                    status: 'failed',
                    message: 'Giao dịch thanh toán thất bại hoặc đã bị hủy. Ghế đã được giải phóng.',
                    redirectUrl: `/booking/failure/${bookingId}`
                });
            }
        } catch (error) {
            logger.error(`Process payment error: ${error.message}`);
            res.status(500).json({ success: false, message: 'Lỗi trong quá trình xử lý thanh toán' });
        }
    },

    // 6. Trang thông báo Đặt vé thành công (Hiển thị Vé điện tử + Mã QR giả lập)
    getBookingSuccess: async (req, res) => {
        const bookingId = req.params.bookingId;
        try {
            const bookings = await db.query(`
                SELECT b.*, s.start_time, s.end_time,
                       m.title as movie_title, m.poster_url, m.duration_minutes, m.age_rating,
                       r.name as room_name, r.room_type,
                       c.name as cinema_name, c.address as cinema_address,
                       p.payment_method, p.transaction_id, p.created_at as payment_time
                FROM bookings b
                JOIN showtimes s ON b.showtime_id = s.id
                JOIN movies m ON s.movie_id = m.id
                JOIN rooms r ON s.room_id = r.id
                JOIN cinemas c ON r.cinema_id = c.id
                LEFT JOIN payments p ON b.id = p.booking_id AND p.status = 'success'
                WHERE b.id = ? AND b.payment_status = 'completed'
            `, [bookingId]);

            if (bookings.length === 0) {
                return res.status(404).render('error', {
                    title: 'Không tìm thấy vé hợp lệ',
                    statusCode: 404,
                    message: 'Vé này chưa hoàn tất thanh toán hoặc không tồn tại'
                });
            }

            const booking = bookings[0];

            const seats = await db.query(`
                SELECT s.row_label, s.seat_number, s.seat_type, bs.price
                FROM booking_seats bs
                JOIN seats s ON bs.seat_id = s.id
                WHERE bs.booking_id = ?
            `, [bookingId]);

            res.render('booking/success', {
                title: 'Đặt vé thành công - Vé điện tử',
                booking,
                seats
            });
        } catch (error) {
            logger.error(`Error loading booking success: ${error.message}`);
            res.status(500).render('error', {
                title: 'Lỗi',
                statusCode: 500,
                message: 'Không thể tải thông tin vé đã đặt'
            });
        }
    },

    // 7. Trang thông báo Đặt vé / Thanh toán thất bại
    getBookingFailure: async (req, res) => {
        const bookingId = req.params.bookingId;
        try {
            const bookings = await db.query('SELECT * FROM bookings WHERE id = ?', [bookingId]);
            const booking = bookings.length > 0 ? bookings[0] : null;

            res.render('booking/failure', {
                title: 'Thanh toán không thành công',
                booking
            });
        } catch (error) {
            res.render('booking/failure', {
                title: 'Thanh toán thất bại',
                booking: null
            });
        }
    },

    // 8. Lịch sử đặt vé của người dùng
    getUserHistory: async (req, res) => {
        const userId = req.session.user.id;
        try {
            const bookings = await db.query(`
                SELECT b.*, s.start_time, m.title as movie_title, m.poster_url, r.name as room_name, c.name as cinema_name
                FROM bookings b
                JOIN showtimes s ON b.showtime_id = s.id
                JOIN movies m ON s.movie_id = m.id
                JOIN rooms r ON s.room_id = r.id
                JOIN cinemas c ON r.cinema_id = c.id
                WHERE b.user_id = ?
                ORDER BY b.created_at DESC
            `, [userId]);

            res.render('booking/history', {
                title: 'Lịch sử đặt vé của tôi',
                bookings
            });
        } catch (error) {
            logger.error(`Error loading user bookings history: ${error.message}`);
            res.status(500).render('error', {
                title: 'Lỗi',
                statusCode: 500,
                message: 'Không thể tải lịch sử đặt vé của bạn'
            });
        }
    }
};

module.exports = bookingController;
