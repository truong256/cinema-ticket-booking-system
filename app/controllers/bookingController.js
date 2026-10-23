const crypto = require('crypto');
const db = require('../config/database');
const logger = require('../config/logger');
const { ticketsBookedTotal, revenueTotal, activeBookingsGauge } = require('../config/metrics');
const qrService = require('../services/qrService');
const emailService = require('../services/emailService');

// Tạo mã đặt vé ngẫu nhiên duy nhất
function generateBookingCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'BKG-';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Hàm dọn dẹp các đơn giữ chỗ đã hết hạn (Lazy cleanup 10 phút)
async function releaseExpiredBookings() {
    try {
        const expiredBookings = await db.query(`
            SELECT id, booking_code FROM bookings 
            WHERE payment_status = 'pending' 
              AND expires_at IS NOT NULL 
              AND expires_at < NOW()
        `);

        if (expiredBookings.length > 0) {
            const expiredIds = expiredBookings.map(b => b.id);
            await db.query(`
                UPDATE bookings 
                SET payment_status = 'failed', booking_status = 'cancelled', updated_at = NOW() 
                WHERE id IN (?)
            `, [expiredIds]);

            await db.query(`
                DELETE FROM booking_seats WHERE booking_id IN (?)
            `, [expiredIds]);

            logger.info(`Auto-released ${expiredBookings.length} expired pending bookings: ${expiredBookings.map(b => b.booking_code).join(', ')}`);
        }
    } catch (err) {
        logger.error(`Error in releaseExpiredBookings: ${err.message}`);
    }
}

// Kiểm tra quyền sở hữu vé (IDOR protection)
function checkBookingOwnership(req, booking) {
    if (req.session && req.session.user) {
        if (req.session.user.role === 'admin') return true;
        if (booking.user_id && req.session.user.id === booking.user_id) return true;
    }
    const token = req.query.token || req.body.bookingToken || req.headers['x-booking-token'];
    if (token && booking.booking_token && token === booking.booking_token) return true;
    if (req.session && req.session.guest_booking_tokens && req.session.guest_booking_tokens.includes(booking.booking_token)) return true;
    return false;
}

const bookingController = {
    // 1. Xem sơ đồ ghế của một suất chiếu
    getSeatSelection: async (req, res) => {
        const showtimeId = req.params.showtimeId;
        try {
            await releaseExpiredBookings();

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

            // Kiểm tra trạng thái suất chiếu
            if (showtime.status === 'cancelled') {
                return res.status(400).render('error', {
                    title: 'Suất chiếu đã bị hủy',
                    statusCode: 400,
                    message: 'Rất tiếc, suất chiếu này đã bị hủy bởi ban quản lý rạp.'
                });
            }

            // Lấy tất cả ghế trong phòng chiếu này
            const allSeats = await db.query(`
                SELECT id, room_id, row_label, seat_number, seat_type, is_active
                FROM seats
                WHERE room_id = ?
                ORDER BY row_label ASC, seat_number ASC
            `, [showtime.room_id]);

            // Lấy danh sách ID ghế ĐÃ ĐƯỢC ĐẶT (chỉ tính completed hoặc pending còn hạn)
            const bookedSeatsData = await db.query(`
                SELECT bs.seat_id
                FROM booking_seats bs
                JOIN bookings b ON bs.booking_id = b.id
                WHERE bs.showtime_id = ? 
                  AND b.booking_status = 'confirmed' 
                  AND (b.payment_status = 'completed' OR (b.payment_status = 'pending' AND (b.expires_at IS NULL OR b.expires_at > NOW())))
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
                    isBooked: bookedSeatIds.has(seat.id) || !seat.is_active
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
            await releaseExpiredBookings();

            const bookedSeatsData = await db.query(`
                SELECT bs.seat_id
                FROM booking_seats bs
                JOIN bookings b ON bs.booking_id = b.id
                WHERE bs.showtime_id = ? 
                  AND b.booking_status = 'confirmed' 
                  AND (b.payment_status = 'completed' OR (b.payment_status = 'pending' AND (b.expires_at IS NULL OR b.expires_at > NOW())))
            `, [showtimeId]);

            const bookedSeatIds = bookedSeatsData.map(b => b.seat_id);
            res.json({ success: true, showtimeId, bookedSeatIds });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    // 3. Đặt vé với Transaction & Khóa bi quan (FOR UPDATE) chống Double Booking & Giữ ghế 10 phút
    createBooking: async (req, res) => {
        const { showtimeId, seatIds, customerName, customerEmail, customerPhone } = req.body;

        await releaseExpiredBookings();

        // Backend validation
        if (!showtimeId || !seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng chọn ít nhất một ghế ngồi hợp lệ'
            });
        }

        // Giới hạn số ghế tối đa mỗi đơn (tối đa 8 ghế)
        if (seatIds.length > 8) {
            return res.status(400).json({
                success: false,
                message: 'Mỗi lần đặt vé chỉ được chọn tối đa 8 ghế để đảm bảo công bằng cho khách hàng khác'
            });
        }

        // Chống gửi danh sách ghế trùng lặp
        const numericSeatIds = seatIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id) && id > 0);
        if (new Set(numericSeatIds).size !== numericSeatIds.length || numericSeatIds.length !== seatIds.length) {
            return res.status(400).json({
                success: false,
                message: 'Danh sách ghế không hợp lệ hoặc chứa mã ghế trùng lặp'
            });
        }

        if (!customerName || !customerName.trim() || !customerEmail || !customerEmail.trim() || !customerPhone || !customerPhone.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Vui lòng cung cấp đầy đủ thông tin: Họ tên, Email, Số điện thoại'
            });
        }

        // Validate định dạng email và phone
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(customerEmail.trim())) {
            return res.status(400).json({
                success: false,
                message: 'Địa chỉ Email không đúng định dạng hợp lệ'
            });
        }

        const phoneRegex = /^[0-9+() -]{8,15}$/;
        if (!phoneRegex.test(customerPhone.trim())) {
            return res.status(400).json({
                success: false,
                message: 'Số điện thoại không đúng định dạng hợp lệ'
            });
        }

        const connection = await db.getConnection();

        try {
            activeBookingsGauge.inc();
            await connection.beginTransaction();

            // 1. Kiểm tra Suất chiếu còn mở bán không
            const [showtimes] = await connection.query('SELECT *, (start_time < NOW()) as is_past FROM showtimes WHERE id = ? FOR UPDATE', [showtimeId]);
            if (showtimes.length === 0) {
                await connection.rollback();
                return res.status(404).json({ success: false, message: 'Suất chiếu không tồn tại' });
            }
            const showtime = showtimes[0];

            if (showtime.status === 'cancelled') {
                await connection.rollback();
                return res.status(400).json({ success: false, message: 'Suất chiếu này đã bị hủy, không thể đặt vé' });
            }

            if (showtime.is_past) {
                await connection.rollback();
                return res.status(400).json({ success: false, message: 'Suất chiếu này đã bắt đầu hoặc đã kết thúc, không thể đặt vé' });
            }

            // 2. Khóa kiểm tra các ghế đã bị đặt hoặc đang giữ chỗ có hiệu lực
            const [alreadyBooked] = await connection.query(`
                SELECT bs.seat_id, s.row_label, s.seat_number
                FROM booking_seats bs
                JOIN bookings b ON bs.booking_id = b.id
                JOIN seats s ON bs.seat_id = s.id
                WHERE bs.showtime_id = ? AND bs.seat_id IN (?)
                  AND b.booking_status = 'confirmed' 
                  AND (b.payment_status = 'completed' OR (b.payment_status = 'pending' AND (b.expires_at IS NULL OR b.expires_at > NOW())))
                FOR UPDATE
            `, [showtimeId, numericSeatIds]);

            if (alreadyBooked.length > 0) {
                await connection.rollback();
                const bookedLabels = alreadyBooked.map(s => `${s.row_label}${s.seat_number}`).join(', ');
                logger.warn(`Double-booking prevented for showtime ${showtimeId}, seats: ${bookedLabels}`);
                return res.status(409).json({
                    success: false,
                    conflict: true,
                    message: `Rất tiếc! Ghế (${bookedLabels}) vừa có người khác giữ chỗ hoặc đã đặt. Vui lòng chọn ghế khác.`
                });
            }

            // 3. Kiểm tra ghế hợp lệ: tồn tại, đúng phòng, và đang hoạt động (không bị khóa tạm)
            const [seatsInfo] = await connection.query(
                'SELECT id, row_label, seat_number, seat_type, room_id, is_active FROM seats WHERE id IN (?)',
                [numericSeatIds]
            );

            if (seatsInfo.length !== numericSeatIds.length) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Một hoặc nhiều ghế được chọn không tồn tại trong hệ thống'
                });
            }

            const invalidRoomSeats = seatsInfo.filter(s => s.room_id !== showtime.room_id || !s.is_active);
            if (invalidRoomSeats.length > 0) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Ghế được chọn không thuộc phòng chiếu của suất chiếu này hoặc đang tạm khóa bảo trì'
                });
            }

            // 4. Tính tổng tiền theo loại ghế
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

            // 5. Tạo bản ghi Booking với mã bảo mật và thời gian hết hạn giữ chỗ (10 phút)
            const bookingCode = generateBookingCode();
            const bookingToken = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 phút
            const userId = req.session && req.session.user ? req.session.user.id : null;

            const [bookingResult] = await connection.query(`
                INSERT INTO bookings (
                    booking_code, booking_token, user_id, showtime_id, total_amount, 
                    payment_status, booking_status, customer_name, customer_email, customer_phone, 
                    expires_at
                )
                VALUES (?, ?, ?, ?, ?, 'pending', 'confirmed', ?, ?, ?, ?)
            `, [bookingCode, bookingToken, userId, showtimeId, totalAmount, customerName.trim(), customerEmail.trim(), customerPhone.trim(), expiresAt]);

            const bookingId = bookingResult.insertId;

            // 6. Lưu từng ghế vào booking_seats (DB UNIQUE KEY uq_showtime_seat bảo vệ)
            for (const item of seatBookings) {
                await connection.query(`
                    INSERT INTO booking_seats (booking_id, showtime_id, seat_id, price)
                    VALUES (?, ?, ?, ?)
                `, [bookingId, showtimeId, item.seat_id, item.price]);
            }

            await connection.commit();

            // Lưu token vào session cho khách vãng lai
            if (!req.session.guest_booking_tokens) {
                req.session.guest_booking_tokens = [];
            }
            req.session.guest_booking_tokens.push(bookingToken);

            logger.info(`Booking created successfully: ${bookingCode} (ID: ${bookingId}, Token: ${bookingToken.substring(0, 8)}...), Expires in 10 mins`);

            res.json({
                success: true,
                bookingId,
                bookingCode,
                bookingToken,
                totalAmount,
                redirectUrl: `/booking/payment/${bookingId}?token=${bookingToken}`
            });

        } catch (error) {
            await connection.rollback();
            logger.error(`Booking transaction failed: ${error.message}`);
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

    // 4. Trang giả lập thanh toán (VNPAY / MoMo / Thẻ ATM) với đếm ngược 10 phút
    getPaymentPage: async (req, res) => {
        const bookingId = req.params.bookingId;
        try {
            await releaseExpiredBookings();

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

            // Bảo vệ IDOR: kiểm tra quyền truy cập đơn
            if (!checkBookingOwnership(req, booking)) {
                logger.warn(`IDOR blocked: Unauthorized access to payment page for booking ${bookingId}`);
                return res.status(403).render('error', {
                    title: 'Từ chối truy cập',
                    statusCode: 403,
                    message: 'Bạn không có quyền truy cập thông tin đơn đặt vé này'
                });
            }

            // Nếu vé đã hoàn tất thanh toán trước đó
            if (booking.payment_status === 'completed') {
                return res.redirect(`/booking/success/${booking.id}?token=${encodeURIComponent(booking.booking_token || '')}`);
            }

            // Kiểm tra nếu đơn đã hết hạn giữ chỗ (10 phút)
            const [expiryCheck] = await db.query(`
                SELECT (expires_at IS NOT NULL AND expires_at < NOW()) as is_expired,
                       TIMESTAMPDIFF(SECOND, NOW(), expires_at) as remaining_seconds
                FROM bookings WHERE id = ?
            `, [bookingId]);

            if (expiryCheck && expiryCheck.length > 0 && expiryCheck[0].is_expired) {
                await db.query(`
                    UPDATE bookings SET payment_status = 'failed', booking_status = 'cancelled', updated_at = NOW() WHERE id = ?
                `, [bookingId]);
                await db.query('DELETE FROM booking_seats WHERE booking_id = ?', [bookingId]);
                return res.render('booking/failure', {
                    title: 'Hết hạn giữ chỗ',
                    booking,
                    errorMessage: 'Đơn đặt vé đã hết thời hạn giữ chỗ (10 phút). Ghế đã được tự động giải phóng.'
                });
            }

            // Tính số giây còn lại cho bộ đếm 10 phút
            const remainingSeconds = (expiryCheck && expiryCheck.length > 0 && expiryCheck[0].remaining_seconds !== null)
                ? Math.max(0, expiryCheck[0].remaining_seconds)
                : 600;

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
                seats,
                remainingSeconds,
                bookingToken: booking.booking_token || ''
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

    // 5. Xử lý thanh toán giả lập (An toàn, Transaction, Lock FOR UPDATE, Idempotent, Allowlist)
    processPayment: async (req, res) => {
        const bookingId = req.params.bookingId;
        const { paymentMethod, paymentAction, bookingToken } = req.body;

        // 1. Kiểm tra allowlist cho phương thức và hành động thanh toán
        const allowedMethods = ['VNPAY', 'VNPAY_MOCK', 'MOMO', 'MOMO_MOCK', 'ATM', 'ATM_MOCK', 'BANKING', 'BANK_TRANSFER'];
        const allowedActions = ['simulate_success', 'simulate_failure', 'simulate_cancel'];

        const selectedMethod = (paymentMethod || 'VNPAY_MOCK').toUpperCase();
        if (!allowedMethods.includes(selectedMethod)) {
            return res.status(400).json({
                success: false,
                message: 'Phương thức thanh toán không hợp lệ'
            });
        }

        if (!allowedActions.includes(paymentAction)) {
            return res.status(400).json({
                success: false,
                message: 'Hành động thanh toán không được hỗ trợ'
            });
        }

        const connection = await db.getConnection();

        try {
            await connection.beginTransaction();

            // 2. Khóa dòng bản ghi Booking bằng FOR UPDATE để chống hai request thanh toán đồng thời
            const [bookings] = await connection.query('SELECT * FROM bookings WHERE id = ? FOR UPDATE', [bookingId]);
            if (bookings.length === 0) {
                await connection.rollback();
                return res.status(404).json({ success: false, message: 'Đơn đặt vé không tồn tại' });
            }
            const booking = bookings[0];

            // 3. Bảo vệ IDOR: xác thực quyền thanh toán
            req.body.bookingToken = bookingToken;
            if (!checkBookingOwnership(req, booking)) {
                await connection.rollback();
                logger.warn(`Unauthorized payment attempt for booking ${bookingId}`);
                return res.status(403).json({
                    success: false,
                    message: 'Bạn không có quyền thanh toán đơn đặt vé này'
                });
            }

            // 4. Chống thanh toán lặp (Idempotency)
            if (booking.payment_status === 'completed') {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Đơn đặt vé này đã được thanh toán hoàn tất trước đó'
                });
            }

            // 5. Kiểm tra nếu đơn đã quá hạn 10 phút
            const [expiryRows] = await connection.query(`
                SELECT (expires_at IS NOT NULL AND expires_at < NOW()) as is_expired
                FROM bookings WHERE id = ?
            `, [bookingId]);

            if (expiryRows && expiryRows.length > 0 && expiryRows[0].is_expired) {
                await connection.query(`
                    UPDATE bookings SET payment_status = 'failed', booking_status = 'cancelled', updated_at = NOW() WHERE id = ?
                `, [bookingId]);
                await connection.query('DELETE FROM booking_seats WHERE booking_id = ?', [bookingId]);
                await connection.commit();

                return res.status(400).json({
                    success: false,
                    status: 'expired',
                    message: 'Đơn đặt vé đã hết thời hạn thanh toán 10 phút. Ghế đã được tự động giải phóng.'
                });
            }

            // 6. Kiểm tra nếu đơn đã bị hủy trước đó
            if (booking.booking_status === 'cancelled') {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Đơn đặt vé này đã bị hủy, không thể tiếp tục thanh toán'
                });
            }

            const txnId = `TXN-${selectedMethod}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

            if (paymentAction === 'simulate_success') {
                // THANH TOÁN THÀNH CÔNG
                await connection.query(`
                    UPDATE bookings 
                    SET payment_status = 'completed', booking_status = 'confirmed', updated_at = NOW()
                    WHERE id = ?
                `, [bookingId]);

                await connection.query(`
                    INSERT INTO payments (booking_id, payment_method, transaction_id, amount, status, response_data)
                    VALUES (?, ?, ?, ?, 'success', ?)
                `, [bookingId, selectedMethod, txnId, booking.total_amount, JSON.stringify({
                    responseCode: '00',
                    message: 'Giao dịch thanh toán giả lập thành công',
                    bankCode: selectedMethod.includes('MOMO') ? 'MOMO_PAY' : 'NCB_GATEWAY',
                    payDate: new Date().toISOString()
                })]);

                // Lấy thông tin loại ghế để ghi nhận Prometheus Metrics
                const [seats] = await connection.query(`
                    SELECT s.seat_type FROM booking_seats bs
                    JOIN seats s ON bs.seat_id = s.id
                    WHERE bs.booking_id = ?
                `, [bookingId]);

                await connection.commit();

                seats.forEach(s => {
                    ticketsBookedTotal.inc({ seat_type: s.seat_type });
                });
                revenueTotal.inc({ payment_method: selectedMethod }, parseFloat(booking.total_amount));

                logger.info(`Payment SUCCESS: Booking ${booking.booking_code}, Amount: ${booking.total_amount} VND, Txn: ${txnId}`);

                // Gửi email xác nhận vé (chạy nền, không ảnh hưởng phản hồi checkout)
                const baseUrl = `${req.protocol}://${req.get('host')}`;
                emailService.sendBookingConfirmation(bookingId, baseUrl).catch(err => {
                    logger.error(`Background email confirmation error: ${err.message}`);
                });

                return res.json({
                    success: true,
                    status: 'success',
                    redirectUrl: `/booking/success/${bookingId}?token=${encodeURIComponent(booking.booking_token || '')}`
                });

            } else {
                // THANH TOÁN THẤT BẠI HOẶC KHÁCH HÀNG HỦY
                await connection.query(`
                    UPDATE bookings 
                    SET payment_status = 'failed', booking_status = 'cancelled', updated_at = NOW()
                    WHERE id = ?
                `, [bookingId]);

                // Giải phóng ghế ngay lập tức để người khác có thể đặt
                await connection.query('DELETE FROM booking_seats WHERE booking_id = ?', [bookingId]);

                await connection.query(`
                    INSERT INTO payments (booking_id, payment_method, transaction_id, amount, status, response_data)
                    VALUES (?, ?, ?, ?, 'failed', ?)
                `, [bookingId, selectedMethod, txnId, booking.total_amount, JSON.stringify({
                    responseCode: paymentAction === 'simulate_cancel' ? '24' : '51',
                    message: paymentAction === 'simulate_cancel' 
                        ? 'Khách hàng chủ động hủy giao dịch' 
                        : 'Mô phỏng thanh toán thất bại (Số dư không đủ hoặc thẻ bị từ chối)'
                })]);

                await connection.commit();

                logger.warn(`Payment FAILED/CANCELLED: Booking ${booking.booking_code}, Seats released, Txn: ${txnId}`);

                return res.json({
                    success: false,
                    status: 'failed',
                    message: 'Giao dịch thanh toán không thành công. Ghế đã được giải phóng.',
                    redirectUrl: `/booking/failure/${bookingId}`
                });
            }
        } catch (error) {
            await connection.rollback();
            logger.error(`Process payment error: ${error.message}`);
            res.status(500).json({ success: false, message: 'Lỗi trong quá trình xử lý thanh toán' });
        } finally {
            connection.release();
        }
    },

    // 6. Trang thông báo Đặt vé thành công (Vé điện tử với Mã QR Thực tế quét được)
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

            // Kiểm tra quyền sở hữu vé
            if (!checkBookingOwnership(req, booking)) {
                logger.warn(`IDOR blocked: Unauthorized view of success ticket ${bookingId}`);
                return res.status(403).render('error', {
                    title: 'Từ chối truy cập',
                    statusCode: 403,
                    message: 'Bạn không có quyền xem vé điện tử này'
                });
            }

            const seats = await db.query(`
                SELECT s.row_label, s.seat_number, s.seat_type, bs.price
                FROM booking_seats bs
                JOIN seats s ON bs.seat_id = s.id
                WHERE bs.booking_id = ?
            `, [bookingId]);

            // Tạo mã QR thực tế quét được dẫn đến trang xác minh vé
            const { qrDataUrl, verificationUrl } = await qrService.generateTicketQr(req, booking);

            res.render('booking/success', {
                title: 'Đặt vé thành công - Vé điện tử',
                booking,
                seats,
                qrCodeDataUrl: qrDataUrl,
                verificationUrl
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
                booking,
                errorMessage: null
            });
        } catch (error) {
            res.render('booking/failure', {
                title: 'Thanh toán thất bại',
                booking: null,
                errorMessage: null
            });
        }
    },

    // 8. Lịch sử đặt vé của người dùng có bộ lọc trạng thái
    getUserHistory: async (req, res) => {
        const userId = req.session.user.id;
        const statusFilter = req.query.status || 'all';

        try {
            let query = `
                SELECT b.*, s.start_time, m.title as movie_title, m.poster_url, r.name as room_name, c.name as cinema_name,
                       (SELECT GROUP_CONCAT(CONCAT(s2.row_label, s2.seat_number) SEPARATOR ', ')
                        FROM booking_seats bs2
                        JOIN seats s2 ON bs2.seat_id = s2.id
                        WHERE bs2.booking_id = b.id) as seat_list
                FROM bookings b
                JOIN showtimes s ON b.showtime_id = s.id
                JOIN movies m ON s.movie_id = m.id
                JOIN rooms r ON s.room_id = r.id
                JOIN cinemas c ON r.cinema_id = c.id
                WHERE b.user_id = ?
            `;
            const params = [userId];

            if (statusFilter === 'completed') {
                query += ' AND b.payment_status = "completed"';
            } else if (statusFilter === 'pending') {
                query += ' AND b.payment_status = "pending"';
            } else if (statusFilter === 'cancelled') {
                query += ' AND (b.booking_status = "cancelled" OR b.payment_status = "failed")';
            }

            query += ' ORDER BY b.created_at DESC';

            const bookings = await db.query(query, params);

            res.render('booking/history', {
                title: 'Lịch sử đặt vé của tôi',
                bookings,
                statusFilter
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
